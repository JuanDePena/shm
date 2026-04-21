import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  claimJobs,
  registerNode,
  reportJob
} from "@simplehost/agent-control-plane-client";
import {
  supportedJobKinds,
  type AppServiceSnapshot,
  type CodeServerServiceSnapshot,
  type MailServiceSnapshot,
  type MailSyncPayload,
  type RustDeskListenerSnapshot,
  type RustDeskServiceSnapshot,
  type AgentBufferedReport,
  type AgentJobEnvelope,
  type AgentJobReportRequest,
  type AgentNodeRegistrationRequest,
  type AgentNodeRuntimeSnapshot,
  type AgentNodeSnapshot,
  type AgentSpoolEntry
} from "@simplehost/agent-contracts";
import { executeAllowlistedJob } from "@simplehost/agent-drivers";
import {
  createAgentRuntimeConfig,
  ensureAgentStateDirectories,
  getAgentStatePaths,
  listJsonFiles,
  readJsonFile,
  removeFileIfExists,
  writeJsonFileAtomic
} from "@simplehost/agent-runtime-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/agent-renderers";

const execFileAsync = promisify(execFile);
const rustDeskTrackedPorts = new Set([21115, 21116, 21117, 21118, 21119]);
const expectedPublicMailPorts = [
  { label: "smtp", port: 25, exposure: "public" as const },
  { label: "submissions", port: 465, exposure: "public" as const },
  { label: "submission", port: 587, exposure: "public" as const },
  { label: "imaps", port: 993, exposure: "public" as const },
  { label: "pop3s", port: 995, exposure: "public" as const }
];
const expectedLocalMailPorts = [
  { label: "rspamd-milter", port: 11332, exposure: "local" as const }
];

async function writeLastAppliedState(
  desiredStateVersion: string,
  lastCompletedJobId?: string
): Promise<void> {
  const config = createAgentRuntimeConfig();
  const timestamp = new Date().toISOString();

  await writeJsonFileAtomic(getAgentStatePaths(config).lastAppliedStateFile, {
    schemaVersion: 1,
    desiredStateVersion,
    lastCompletedJobId,
    lastHeartbeatAt: timestamp
  });
}

async function readStoredNodeToken(): Promise<string | undefined> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeId: string;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);

  if (!existingIdentity || existingIdentity.nodeId !== config.nodeId) {
    return undefined;
  }

  return existingIdentity.nodeToken;
}

export async function createNodeSnapshot(): Promise<AgentNodeSnapshot> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);

  await ensureAgentStateDirectories(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeId: string;
    hostname: string;
    controlPlaneUrl: string;
    configPath: string;
    generatedAt: string;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);
  const existingNodeToken =
    existingIdentity?.nodeId === config.nodeId ? existingIdentity.nodeToken : undefined;

  const snapshot: AgentNodeSnapshot = {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready",
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString(),
    nodeToken: existingNodeToken
  };

  await writeJsonFileAtomic(statePaths.nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken: existingNodeToken
  });

  await writeLastAppliedState("bootstrap");

  return snapshot;
}

function createRegistrationRequest(
  snapshot: AgentNodeSnapshot,
  runtimeSnapshot?: AgentNodeRuntimeSnapshot
): AgentNodeRegistrationRequest {
  const config = createAgentRuntimeConfig();

  return {
    nodeId: snapshot.nodeId,
    hostname: snapshot.hostname,
    version: config.version,
    supportedJobKinds: [...supportedJobKinds],
    generatedAt: snapshot.generatedAt,
    runtimeSnapshot
  };
}

async function commandOutput(
  command: string,
  args: string[]
): Promise<string | undefined> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8"
    });
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function namedPackageTargetsInstalled(targets: string[]): Promise<boolean> {
  const namedTargets = targets.filter(
    (target) =>
      target.trim().length > 0 &&
      !target.includes("/") &&
      !/^[a-z]+:\/\//i.test(target)
  );

  if (namedTargets.length === 0) {
    return false;
  }

  const installed = await Promise.all(
    namedTargets.map((target) => commandOutput("rpm", ["-q", target]))
  );

  return installed.every((value) => value !== undefined && value.trim().length > 0);
}

function extractCodeServerVersion(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\b\d+\.\d+\.\d+\b/);
  return match?.[0];
}

async function inspectCodeServer(): Promise<CodeServerServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const serviceName = config.services.codeServer.serviceName;
  const enabledState = await commandOutput("systemctl", ["is-enabled", serviceName]);
  const activeState = await commandOutput("systemctl", ["is-active", serviceName]);
  const rpmVersionOutput = await commandOutput("rpm", [
    "-q",
    "code-server",
    "--qf",
    "%{VERSION}-%{RELEASE}\n"
  ]);
  const versionOutput = await commandOutput("code-server", ["--version"]);

  const configContent = await readFile(config.services.codeServer.configPath, "utf8").catch(
    () => ""
  );
  const settingsContent = await readFile(
    config.services.codeServer.settingsPath,
    "utf8"
  ).catch(() => "");

  const bindAddress = /^bind-addr:\s*(.+)$/m.exec(configContent)?.[1]?.trim();
  const authMode = /^auth:\s*(.+)$/m.exec(configContent)?.[1]?.trim();

  return {
    serviceName,
    enabled: enabledState !== undefined && enabledState !== "disabled",
    active: activeState === "active",
    version:
      extractCodeServerVersion(rpmVersionOutput) ??
      extractCodeServerVersion(versionOutput),
    bindAddress,
    authMode,
    settingsProfileHash: settingsContent
      ? createHash("sha256").update(settingsContent).digest("hex").slice(0, 12)
      : undefined,
    checkedAt
  };
}

function parseSocketAddress(value: string): { address: string; port: number } | undefined {
  const bracketedMatch = value.match(/^\[(.*)\]:(\d+)$/);

  if (bracketedMatch) {
    return {
      address: bracketedMatch[1] ?? "::",
      port: Number.parseInt(bracketedMatch[2] ?? "", 10)
    };
  }

  const plainMatch = value.match(/^(.*):(\d+)$/);

  if (!plainMatch) {
    return undefined;
  }

  return {
    address: plainMatch[1] ?? "*",
    port: Number.parseInt(plainMatch[2] ?? "", 10)
  };
}

function isLoopbackAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function addressAcceptsPublicTraffic(address: string): boolean {
  const normalized = address.trim().toLowerCase();

  if (normalized === "*" || normalized === "0.0.0.0" || normalized === "::") {
    return true;
  }

  return normalized.length > 0 && !isLoopbackAddress(normalized);
}

function addressAcceptsLoopbackTraffic(address: string): boolean {
  const normalized = address.trim().toLowerCase();

  return (
    normalized === "*" ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

function parseFirewallPorts(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  const matches = [...value.matchAll(/(\d+)\/tcp/g)];

  return [...new Set(matches.map((match) => Number.parseInt(match[1] ?? "", 10)).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function parseFirewallPortsFromXml(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  const matches = [...value.matchAll(/<port\s+protocol="tcp"\s+port="(\d+)"\s*\/>/g)];

  return [...new Set(matches.map((match) => Number.parseInt(match[1] ?? "", 10)).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function readPostfixGeneratedSetting(content: string | undefined, key: string): string | undefined {
  if (!content) {
    return undefined;
  }

  const match = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m").exec(content);
  return match?.[1]?.trim();
}

async function inspectRustDeskListeners(): Promise<RustDeskListenerSnapshot[]> {
  const output = await commandOutput("ss", ["-H", "-lntu"]);

  if (!output) {
    return [];
  }

  const listeners = new Map<string, RustDeskListenerSnapshot>();

  for (const line of output.split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const protocol = parts[0];
    const localAddress = parts[4];

    if (
      (protocol !== "tcp" && protocol !== "udp") ||
      typeof localAddress !== "string"
    ) {
      continue;
    }

    const parsed = parseSocketAddress(localAddress);

    if (!parsed || !rustDeskTrackedPorts.has(parsed.port)) {
      continue;
    }

    listeners.set(`${protocol}:${parsed.address}:${parsed.port}`, {
      protocol,
      address: parsed.address,
      port: parsed.port
    });
  }

  return [...listeners.values()].sort((left, right) =>
    `${left.port}:${left.protocol}:${left.address}`.localeCompare(
      `${right.port}:${right.protocol}:${right.address}`
    )
  );
}

async function inspectRustDesk(): Promise<RustDeskServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const { hbbsServiceName, hbbrServiceName, publicKeyPath } = config.services.rustdesk;
  const [
    hbbsEnabledState,
    hbbsActiveState,
    hbbrEnabledState,
    hbbrActiveState,
    publicKey,
    listeners
  ] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", hbbsServiceName]),
    commandOutput("systemctl", ["is-active", hbbsServiceName]),
    commandOutput("systemctl", ["is-enabled", hbbrServiceName]),
    commandOutput("systemctl", ["is-active", hbbrServiceName]),
    readFile(publicKeyPath, "utf8")
      .then((content) => content.trim())
      .catch(() => undefined),
    inspectRustDeskListeners()
  ]);

  return {
    hbbsServiceName,
    hbbsEnabled: hbbsEnabledState !== undefined && hbbsEnabledState !== "disabled",
    hbbsActive: hbbsActiveState === "active",
    hbbrServiceName,
    hbbrEnabled: hbbrEnabledState !== undefined && hbbrEnabledState !== "disabled",
    hbbrActive: hbbrActiveState === "active",
    publicKey,
    publicKeyPath,
    listeners,
    checkedAt
  };
}

async function inspectMailTcpListeners(): Promise<NonNullable<MailServiceSnapshot["portListeners"]>> {
  const trackedPorts = new Set(
    [...expectedPublicMailPorts, ...expectedLocalMailPorts].map((entry) => entry.port)
  );
  const output = await commandOutput("ss", ["-H", "-ltn"]);
  const listenersByPort = new Map<number, Set<string>>();

  if (output) {
    for (const line of output.split(/\r?\n/g)) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const parts = trimmed.split(/\s+/);
      const localAddress = parts[3];

      if (typeof localAddress !== "string") {
        continue;
      }

      const parsed = parseSocketAddress(localAddress);

      if (!parsed || !trackedPorts.has(parsed.port)) {
        continue;
      }

      const addresses = listenersByPort.get(parsed.port) ?? new Set<string>();
      addresses.add(parsed.address);
      listenersByPort.set(parsed.port, addresses);
    }
  }

  return [...expectedPublicMailPorts, ...expectedLocalMailPorts].map((entry) => {
    const addresses = [...(listenersByPort.get(entry.port) ?? new Set<string>())].sort((left, right) =>
      left.localeCompare(right)
    );

    return {
      label: entry.label,
      protocol: "tcp",
      port: entry.port,
      exposure: entry.exposure,
      addresses,
      listening: addresses.length > 0
    };
  });
}

function createEmptyMailQueueSnapshot(): NonNullable<MailServiceSnapshot["queue"]> {
  return {
    messageCount: 0,
    activeCount: 0,
    deferredCount: 0,
    holdCount: 0,
    incomingCount: 0,
    maildropCount: 0,
    topDeferReasons: []
  };
}

async function inspectMailQueue(): Promise<MailServiceSnapshot["queue"] | undefined> {
  const output = await commandOutput("postqueue", ["-j"]);

  if (output === undefined) {
    return undefined;
  }

  const snapshot = createEmptyMailQueueSnapshot();
  const deferReasonCounts = new Map<string, number>();

  for (const line of output.split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as {
        queue_name?: string;
        recipients?: Array<{ delay_reason?: string }>;
      };

      snapshot.messageCount += 1;

      switch (parsed.queue_name) {
        case "active":
          snapshot.activeCount += 1;
          break;
        case "deferred":
          snapshot.deferredCount += 1;
          break;
        case "hold":
          snapshot.holdCount += 1;
          break;
        case "incoming":
          snapshot.incomingCount += 1;
          break;
        case "maildrop":
          snapshot.maildropCount += 1;
          break;
        case "corrupt":
          snapshot.corruptCount = (snapshot.corruptCount ?? 0) + 1;
          break;
        default:
          break;
      }

      for (const recipient of parsed.recipients ?? []) {
        const reason = recipient?.delay_reason?.trim();

        if (!reason) {
          continue;
        }

        deferReasonCounts.set(reason, (deferReasonCounts.get(reason) ?? 0) + 1);
      }
    } catch {
      continue;
    }
  }

  snapshot.topDeferReasons = [...deferReasonCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([reason]) => reason);

  return snapshot;
}

async function inspectRecentMailFailures(
  postfixServiceName: string
): Promise<NonNullable<MailServiceSnapshot["recentDeliveryFailures"]>> {
  const output = await commandOutput("journalctl", [
    "-u",
    postfixServiceName,
    "--since",
    "12 hours ago",
    "-n",
    "200",
    "--no-pager",
    "-o",
    "short-iso"
  ]);

  if (!output) {
    return [];
  }

  const failures: NonNullable<MailServiceSnapshot["recentDeliveryFailures"]> = [];

  for (const line of output.split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed || !trimmed.includes("status=")) {
      continue;
    }

    const match = trimmed.match(
      /^(\S+)\s+\S+\s+postfix\/[^:]+(?:\[\d+\])?:\s+([A-F0-9]+):\s+to=<([^>]+)>,.*?(?:relay=([^,\s]+)[^,]*,.*)?status=(deferred|bounced|expired)\s+\((.+)\)$/i
    );

    if (!match) {
      continue;
    }

    const occurredAt = new Date(match[1] ?? "");

    failures.push({
      occurredAt: Number.isFinite(occurredAt.getTime())
        ? occurredAt.toISOString()
        : new Date().toISOString(),
      queueId: match[2] ?? undefined,
      recipient: match[3] ?? undefined,
      relay: match[4] ?? undefined,
      status: (match[5] ?? "deferred") as "deferred" | "bounced" | "expired",
      reason: match[6] ?? "unknown postfix delivery failure"
    });
  }

  return failures.slice(-8).reverse();
}

async function inspectMail(): Promise<MailServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const {
    postfixServiceName,
    dovecotServiceName,
    rspamdServiceName,
    redisServiceName,
    postfixPackageTargets,
    dovecotPackageTargets,
    rspamdPackageTargets,
    redisPackageTargets,
    configRoot,
    statePath,
    vmailRoot,
    dkimRoot,
    policyRoot,
    roundcubeRoot,
    roundcubeSharedRoot,
    roundcubeConfigPath,
    roundcubeDatabasePath,
    roundcubePackageRoot,
    firewallServiceName,
    firewallServicePath
  } = config.services.mail;

  const [
    postfixEnabledState,
    postfixActiveState,
    dovecotEnabledState,
    dovecotActiveState,
    rspamdEnabledState,
    rspamdActiveState,
    redisEnabledState,
    redisActiveState,
    desiredStateContent,
    postfixInstalled,
    dovecotInstalled,
    rspamdInstalled,
    redisInstalled,
    roundcubePackageRootExists,
    roundcubeConfigExists,
    roundcubeDatabaseExists,
    desiredStatePresent,
    postfixConfigPresent,
    dovecotConfigPresent,
    rspamdConfigPresent,
    postfixGeneratedContent,
    firewallConfigured,
    firewallInfo,
    firewallServiceContent,
    portListeners,
    queue,
    recentDeliveryFailures
  ] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", postfixServiceName]),
    commandOutput("systemctl", ["is-active", postfixServiceName]),
    commandOutput("systemctl", ["is-enabled", dovecotServiceName]),
    commandOutput("systemctl", ["is-active", dovecotServiceName]),
    commandOutput("systemctl", ["is-enabled", rspamdServiceName]),
    commandOutput("systemctl", ["is-active", rspamdServiceName]),
    commandOutput("systemctl", ["is-enabled", redisServiceName]),
    commandOutput("systemctl", ["is-active", redisServiceName]),
    readFile(statePath, "utf8").catch(() => undefined),
    namedPackageTargetsInstalled(postfixPackageTargets),
    namedPackageTargetsInstalled(dovecotPackageTargets),
    namedPackageTargetsInstalled(rspamdPackageTargets),
    namedPackageTargetsInstalled(redisPackageTargets),
    pathExists(roundcubePackageRoot),
    pathExists(roundcubeConfigPath),
    pathExists(roundcubeDatabasePath),
    pathExists(statePath),
    Promise.all([
      pathExists(path.join(configRoot, "postfix", "vmail_domains")),
      pathExists(path.join(configRoot, "postfix", "vmail_mailboxes")),
      pathExists(path.join(configRoot, "postfix", "vmail_aliases")),
      pathExists(path.join(configRoot, "postfix", "main.cf.generated"))
    ]).then((values) => values.every(Boolean)),
    Promise.all([
      pathExists(path.join(configRoot, "dovecot", "passwd")),
      pathExists(path.join(configRoot, "dovecot", "conf.d", "90-simplehost-mail.conf"))
    ]).then((values) => values.every(Boolean)),
    Promise.all([
      pathExists(path.join(configRoot, "rspamd", "dkim_selectors.map")),
      pathExists(path.join(configRoot, "rspamd", "local.d", "actions.conf")),
      pathExists(path.join(configRoot, "rspamd", "local.d", "milter_headers.conf")),
      pathExists(path.join(configRoot, "rspamd", "local.d", "dkim_signing.conf")),
      pathExists(path.join(configRoot, "rspamd", "local.d", "multimap.conf")),
      pathExists(path.join(configRoot, "rspamd", "local.d", "ratelimit.conf"))
    ]).then((values) => values.every(Boolean)),
    readFile(path.join(configRoot, "postfix", "main.cf.generated"), "utf8").catch(() => undefined),
    commandOutput("firewall-cmd", [
      "--permanent",
      "--query-service",
      firewallServiceName
    ]).then((value) => value === "yes"),
    commandOutput("firewall-cmd", ["--permanent", `--info-service=${firewallServiceName}`]),
    readFile(firewallServicePath, "utf8").catch(() => undefined),
    inspectMailTcpListeners(),
    inspectMailQueue(),
    inspectRecentMailFailures(postfixServiceName)
  ]);

  const postfixInstalledResolved = postfixEnabledState !== undefined || postfixInstalled;
  const dovecotInstalledResolved = dovecotEnabledState !== undefined || dovecotInstalled;
  const rspamdInstalledResolved = rspamdEnabledState !== undefined || rspamdInstalled;
  const redisInstalledResolved = redisEnabledState !== undefined || redisInstalled;
  const runtimeConfigPresent =
    desiredStatePresent && postfixConfigPresent && dovecotConfigPresent && rspamdConfigPresent;
  const coreMailServicesActive =
    postfixActiveState === "active" &&
    dovecotActiveState === "active" &&
    rspamdActiveState === "active" &&
    redisActiveState === "active";
  const firewallExpectedPorts = expectedPublicMailPorts.map((entry) => entry.port);
  const firewallOpenPorts = (() => {
    const fromRuntime = parseFirewallPorts(firewallInfo);
    return fromRuntime.length > 0 ? fromRuntime : parseFirewallPortsFromXml(firewallServiceContent);
  })();
  const missingPublicMailPorts = expectedPublicMailPorts
    .map((entry) => {
      const listener = portListeners.find((candidate) => candidate.port === entry.port);

      return listener?.listening &&
        listener.addresses.some((address) => addressAcceptsPublicTraffic(address))
        ? undefined
        : entry.port;
    })
    .filter((port): port is number => typeof port === "number");
  const firewallPortsReady =
    firewallConfigured &&
    firewallExpectedPorts.every((port) => firewallOpenPorts.includes(port));
  const milterListener = portListeners.find((listener) => listener.port === 11332);
  const milterEndpoint = "inet:127.0.0.1:11332";
  const milter = {
    endpoint: milterEndpoint,
    postfixConfigured:
      readPostfixGeneratedSetting(postfixGeneratedContent, "smtpd_milters") === milterEndpoint &&
      readPostfixGeneratedSetting(postfixGeneratedContent, "non_smtpd_milters") ===
        milterEndpoint &&
      readPostfixGeneratedSetting(postfixGeneratedContent, "milter_default_action") ===
        "accept" &&
      readPostfixGeneratedSetting(postfixGeneratedContent, "milter_protocol") === "6",
    rspamdConfigPresent,
    listenerReady: Boolean(
      milterListener?.listening &&
        milterListener.addresses.some((address) => addressAcceptsLoopbackTraffic(address))
    )
  } satisfies NonNullable<MailServiceSnapshot["milter"]>;
  const roundcubePackaged =
    roundcubePackageRootExists && roundcubeConfigExists && roundcubeDatabaseExists;

  let managedDomains: MailServiceSnapshot["managedDomains"] = [];
  let configuredMailboxCount = 0;
  let missingMailboxCount = 0;
  let resetRequiredMailboxCount = 0;

  if (desiredStateContent) {
    try {
      const parsed = JSON.parse(desiredStateContent) as {
        domains?: Array<{
          domainName: string;
          tenantSlug: string;
          mailHost: string;
          webmailHostname: string;
          mtaStsHostname?: string;
          deliveryRole: MailSyncPayload["domains"][number]["deliveryRole"];
          dmarcReportAddress?: string;
          tlsReportAddress?: string;
          mtaStsMode?: MailSyncPayload["domains"][number]["mtaStsMode"];
          mtaStsMaxAgeSeconds?: number;
          dkimSelector?: string;
          aliases?: unknown[];
          mailboxes?: Array<{ localPart?: string; credentialState?: string }>;
        }>;
      };
      managedDomains = Array.isArray(parsed.domains)
        ? await Promise.all(
            parsed.domains.map(async (domain) => {
              const webmailDocumentRoot = path.join(
                roundcubeRoot,
                domain.tenantSlug,
                domain.domainName,
                "public"
              );
              const mtaStsDocumentRoot = path.join(
                policyRoot,
                domain.tenantSlug,
                domain.domainName,
                "public"
              );
              const mtaStsPolicyPath = path.join(
                mtaStsDocumentRoot,
                ".well-known",
                "mta-sts.txt"
              );
              const dkimDnsTxtValue =
                typeof domain.dkimSelector === "string"
                  ? await readFile(
                      path.join(dkimRoot, domain.domainName, `${domain.dkimSelector}.dns.txt`),
                      "utf8"
                    )
                      .then((content) => content.trim())
                      .catch(() => undefined)
                  : undefined;
              const maildirRoot = path.join(vmailRoot, domain.domainName);
              const [webmailDocumentPresent, mtaStsPolicyPresent, mailboxesReady] = await Promise.all([
                pathExists(webmailDocumentRoot),
                pathExists(mtaStsPolicyPath),
                Promise.all(
                  (domain.mailboxes ?? []).map((mailbox) => {
                    const localPart = mailbox.localPart?.trim();

                    if (!localPart) {
                      return Promise.resolve(false);
                    }

                    return pathExists(path.join(maildirRoot, localPart, "Maildir", "cur"));
                  })
                ).then((values) => values.every(Boolean))
              ]);
              const promotionBlockers: string[] = [];

              if (!coreMailServicesActive) {
                promotionBlockers.push("Core mail services are not active on this node.");
              }

              if (!firewallConfigured) {
                promotionBlockers.push("The managed mail firewall policy is not active on this node.");
              }

              if (missingPublicMailPorts.length > 0) {
                promotionBlockers.push(
                  `The intended public mail ports are not all listening (${missingPublicMailPorts.join(", ")}).`
                );
              }

              if (!firewallPortsReady) {
                promotionBlockers.push(
                  `The managed mail firewall service is missing ${firewallExpectedPorts.filter((port) => !firewallOpenPorts.includes(port)).join(", ")}.`
                );
              }

              if (!(milter.postfixConfigured && milter.rspamdConfigPresent && milter.listenerReady)) {
                promotionBlockers.push("Rspamd milter wiring is incomplete on this node.");
              }

              if (!runtimeConfigPresent) {
                promotionBlockers.push(
                  "Generated Postfix, Dovecot, or Rspamd runtime config is incomplete."
                );
              }

              if (!mailboxesReady) {
                promotionBlockers.push(
                  "One or more mailbox Maildir trees are missing on this node."
                );
              }

              if (!dkimDnsTxtValue) {
                promotionBlockers.push("DKIM key material is missing for this domain.");
              }

              if (!mtaStsPolicyPresent) {
                promotionBlockers.push("The node-local MTA-STS policy document is missing.");
              }

              if (!(roundcubePackaged && webmailDocumentPresent)) {
                promotionBlockers.push(
                  "Roundcube or the per-domain webmail document root is incomplete."
                );
              }

              return {
                domainName: domain.domainName,
                mailHost: domain.mailHost,
                webmailHostname: domain.webmailHostname,
                mtaStsHostname: domain.mtaStsHostname ?? `mta-sts.${domain.domainName}`,
                deliveryRole: domain.deliveryRole,
                mailboxCount: Array.isArray(domain.mailboxes) ? domain.mailboxes.length : 0,
                aliasCount: Array.isArray(domain.aliases) ? domain.aliases.length : 0,
                dkimSelector: domain.dkimSelector,
                dkimDnsTxtValue,
                dkimAvailable: Boolean(dkimDnsTxtValue),
                dmarcReportAddress: domain.dmarcReportAddress,
                tlsReportAddress: domain.tlsReportAddress,
                mtaStsMode: domain.mtaStsMode,
                mtaStsMaxAgeSeconds: domain.mtaStsMaxAgeSeconds,
                runtimeConfigPresent,
                maildirRoot,
                mailboxesReady,
                webmailDocumentRoot,
                webmailDocumentPresent,
                mtaStsDocumentRoot,
                mtaStsPolicyPath,
                mtaStsPolicyPresent,
                promotionReady: promotionBlockers.length === 0,
                promotionBlockers
              };
            })
          )
        : [];
      for (const domain of parsed.domains ?? []) {
        for (const mailbox of domain.mailboxes ?? []) {
          if (mailbox.credentialState === "configured") {
            configuredMailboxCount += 1;
          } else if (mailbox.credentialState === "missing") {
            missingMailboxCount += 1;
          } else {
            resetRequiredMailboxCount += 1;
          }
        }
      }
    } catch {
      managedDomains = [];
    }
  }

  const roundcubeDeployment: MailServiceSnapshot["roundcubeDeployment"] =
    roundcubePackaged
      ? "packaged"
      : managedDomains.length > 0
        ? "placeholder"
        : "absent";
  const policyDocumentCount = managedDomains.length;
  const healthyPolicyDocumentCount = managedDomains.filter(
    (domain) => domain.mtaStsPolicyPresent
  ).length;
  const webmailHealthy =
    roundcubeDeployment === "packaged" &&
    (managedDomains.length === 0 || managedDomains.every((domain) => domain.webmailDocumentPresent));

  return {
    postfixServiceName,
    postfixInstalled: postfixInstalledResolved,
    postfixEnabled: postfixEnabledState !== undefined && postfixEnabledState !== "disabled",
    postfixActive: postfixActiveState === "active",
    dovecotServiceName,
    dovecotInstalled: dovecotInstalledResolved,
    dovecotEnabled: dovecotEnabledState !== undefined && dovecotEnabledState !== "disabled",
    dovecotActive: dovecotActiveState === "active",
    rspamdServiceName,
    rspamdInstalled: rspamdInstalledResolved,
    rspamdEnabled: rspamdEnabledState !== undefined && rspamdEnabledState !== "disabled",
    rspamdActive: rspamdActiveState === "active",
    redisServiceName,
    redisInstalled: redisInstalledResolved,
    redisEnabled: redisEnabledState !== undefined && redisEnabledState !== "disabled",
    redisActive: redisActiveState === "active",
    configRoot,
    statePath,
    desiredStatePresent,
    runtimeConfigPresent,
    vmailRoot,
    policyRoot,
    dkimRoot,
    roundcubeRoot,
    roundcubeSharedRoot,
    roundcubeConfigPath,
    roundcubeDatabasePath,
    roundcubeDeployment,
    webmailHealthy,
    firewallServiceName,
    firewallConfigured,
    firewallExpectedPorts,
    firewallOpenPorts,
    portListeners,
    milter,
    configuredMailboxCount,
    missingMailboxCount,
    resetRequiredMailboxCount,
    policyDocumentCount,
    healthyPolicyDocumentCount,
    queue,
    recentDeliveryFailures,
    managedDomains,
    checkedAt
  };
}

function extractQuadletSetting(
  content: string | undefined,
  key: string
): string | undefined {
  if (!content) {
    return undefined;
  }

  const match = new RegExp(`^${key}=(.+)$`, "m").exec(content);
  return match?.[1]?.trim();
}

function parsePublishedBackendPort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/:(\d+):\d+(?:\/[A-Za-z0-9._-]+)?$/);

  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

async function inspectAppServices(): Promise<AppServiceSnapshot[]> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const rootDir = config.services.apps.rootDir;
  const servicePrefix = config.services.apps.servicePrefix;
  const appDirectories = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const slugs = appDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const snapshots = await Promise.all(
    slugs.map(async (slug) => {
      const serviceBaseName = `${servicePrefix}${slug}`;
      const serviceName = `${serviceBaseName}.service`;
      const quadletPath = path.join(
        config.services.containers.quadletDir,
        `${serviceBaseName}.container`
      );
      const envFilePath = path.join(
        config.services.containers.envDir,
        `${serviceBaseName}.env`
      );
      const [enabledState, activeState, quadletContent] = await Promise.all([
        commandOutput("systemctl", ["is-enabled", serviceName]),
        commandOutput("systemctl", ["is-active", serviceName]),
        readFile(quadletPath, "utf8").catch(() => undefined)
      ]);

      return {
        appSlug: slug,
        serviceName,
        containerName:
          extractQuadletSetting(quadletContent, "ContainerName") ?? serviceBaseName,
        enabled: enabledState !== undefined && enabledState !== "disabled",
        active: activeState === "active",
        image: extractQuadletSetting(quadletContent, "Image"),
        backendPort: parsePublishedBackendPort(
          extractQuadletSetting(quadletContent, "PublishPort")
        ),
        stateRoot: path.join(rootDir, slug),
        envFilePath,
        quadletPath,
        checkedAt
      } satisfies AppServiceSnapshot;
    })
  );

  return snapshots;
}

async function collectRuntimeSnapshot(): Promise<AgentNodeRuntimeSnapshot> {
  const [appServices, codeServer, rustdesk, mail] = await Promise.all([
    inspectAppServices(),
    inspectCodeServer(),
    inspectRustDesk(),
    inspectMail()
  ]);

  return {
    appServices,
    codeServer,
    rustdesk,
    mail
  };
}

async function deliverBufferedReport(
  reportFile: string,
  reportPayload: AgentBufferedReport,
  nodeToken: string
): Promise<boolean> {
  const config = createAgentRuntimeConfig();
  const request: AgentJobReportRequest = {
    nodeId: config.nodeId,
    result: reportPayload.result
  };

  try {
    await reportJob(config.controlPlaneUrl, request, nodeToken);
    await removeFileIfExists(reportFile);
    return true;
  } catch (error) {
    await writeJsonFileAtomic(reportFile, {
      ...reportPayload,
      deliveryAttempts: reportPayload.deliveryAttempts + 1,
      lastDeliveryError: error instanceof Error ? error.message : String(error)
    } satisfies AgentBufferedReport);
    return false;
  }
}

async function flushBufferedReports(): Promise<number> {
  const config = createAgentRuntimeConfig();
  const reportFiles = await listJsonFiles(getAgentStatePaths(config).reportBufferDir);
  let delivered = 0;
  const nodeToken = await readStoredNodeToken();

  if (!nodeToken) {
    return delivered;
  }

  for (const reportFile of reportFiles) {
    const payload = await readJsonFile<AgentBufferedReport>(reportFile);

    if (!payload) {
      await removeFileIfExists(reportFile);
      continue;
    }

    if (await deliverBufferedReport(reportFile, payload, nodeToken)) {
      delivered += 1;
    }
  }

  return delivered;
}

async function executeClaimedJob(job: AgentJobEnvelope): Promise<void> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);
  const claimedAt = new Date().toISOString();
  const spoolPath = `${statePaths.jobSpoolDir}/${job.id}.json`;
  const reportPath = `${statePaths.reportBufferDir}/${job.id}.json`;
  const nodeToken = await readStoredNodeToken();

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "claimed",
    claimedAt
  } satisfies AgentSpoolEntry);

  const result = await (async () => {
    try {
      return await executeAllowlistedJob(job, {
        nodeId: config.nodeId,
        hostname: config.hostname,
        stateDir: config.stateDir,
        services: config.services
      });
    } catch (error) {
      return {
        jobId: job.id,
        kind: job.kind,
        nodeId: config.nodeId,
        status: "failed" as const,
        summary: error instanceof Error ? error.message : String(error),
        details: {
          thrown: true
        },
        completedAt: new Date().toISOString()
      };
    }
  })();
  const bufferedAt = new Date().toISOString();

  await writeJsonFileAtomic(reportPath, {
    schemaVersion: 1,
    result,
    bufferedAt,
    deliveryAttempts: 0
  } satisfies AgentBufferedReport);

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "executed",
    claimedAt,
    executedAt: bufferedAt,
    resultStatus: result.status
  } satisfies AgentSpoolEntry);

  await writeLastAppliedState(job.desiredStateVersion, job.id);
  console.log(renderJobResult(result));

  if (
    nodeToken &&
    (await deliverBufferedReport(
      reportPath,
      {
        schemaVersion: 1,
        result,
        bufferedAt,
        deliveryAttempts: 0
      },
      nodeToken
    ))
  ) {
    await removeFileIfExists(spoolPath);
  }
}

export async function runManagerAgentCycle(): Promise<void> {
  const config = createAgentRuntimeConfig();
  const snapshot = await createNodeSnapshot();
  const runtimeSnapshot = await collectRuntimeSnapshot();
  const registrationToken = snapshot.nodeToken ?? config.enrollmentToken;

  if (!registrationToken) {
    throw new Error(
      "SIMPLEHOST_ENROLLMENT_TOKEN is required until SimpleHost Control issues a node bearer token."
    );
  }

  const registration = await registerNode(
    config.controlPlaneUrl,
    createRegistrationRequest(snapshot, runtimeSnapshot),
    registrationToken
  );
  const nodeToken = registration.nodeToken ?? snapshot.nodeToken;

  if (!nodeToken) {
    throw new Error(`SimpleHost Control did not issue a node token for ${config.nodeId}.`);
  }

  await writeJsonFileAtomic(getAgentStatePaths(config).nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken
  });

  console.log(renderNodeSnapshot(snapshot));
  console.log(
    `Registered with ${config.controlPlaneUrl} at ${registration.acceptedAt}. Poll every ${registration.pollIntervalMs}ms.`
  );

  const flushedReports = await flushBufferedReports();

  if (flushedReports > 0) {
    console.log(`Delivered ${flushedReports} buffered report(s).`);
  }

  const claimed = await claimJobs(config.controlPlaneUrl, {
    nodeId: config.nodeId,
    hostname: config.hostname,
    version: config.version,
    maxJobs: 4,
    runtimeSnapshot
  }, nodeToken);

  if (claimed.jobs.length === 0) {
    console.log("No jobs available.");
    return;
  }

  for (const job of claimed.jobs) {
    await executeClaimedJob(job);
  }
}

export async function startManagerAgent(): Promise<void> {
  const config = createAgentRuntimeConfig();
  const runOnce = process.env.SIMPLEHOST_RUN_ONCE === "true";

  do {
    try {
      await runManagerAgentCycle();
    } catch (error: unknown) {
      console.error(error);
    }

    if (runOnce) {
      break;
    }

    await sleep(config.heartbeatMs);
  } while (true);
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isMainModule()) {
  startManagerAgent().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
