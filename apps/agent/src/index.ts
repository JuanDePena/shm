import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { loadavg, totalmem, uptime } from "node:os";
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
  type ConfigValidationCheckSnapshot,
  type Fail2BanJailSnapshot,
  type Fail2BanSnapshot,
  type FirewalldZoneSnapshot,
  type HostFirewallSnapshot,
  type LocalAccountSnapshot,
  type LocalGroupSnapshot,
  type MailServiceSnapshot,
  type MailSyncPayload,
  type MountEntrySnapshot,
  type NetworkInterfaceAddressSnapshot,
  type NetworkInterfaceSnapshot,
  type NetworkListenerSnapshot,
  type NetworkRouteSnapshot,
  type PackageRepositorySnapshot,
  type PackageUpdateSnapshot,
  type ProcessEntrySnapshot,
  type RustDeskListenerSnapshot,
  type RustDeskServiceSnapshot,
  type SelinuxSnapshot,
  type SshEffectiveConfigSnapshot,
  type FilesystemUsageSnapshot,
  type JournalLogEntrySnapshot,
  type KernelModuleSnapshot,
  type KernelParameterSnapshot,
  type StoragePathUsageSnapshot,
  type ServiceUnitSnapshot,
  type SystemTimerSnapshot,
  type TimeSyncSourceSnapshot,
  type TlsCertificateSnapshot,
  type AgentBufferedReport,
  type AgentJobEnvelope,
  type AgentJobReportRequest,
  type AgentNodeRegistrationRequest,
  type AgentNodeRuntimeSnapshot,
  type AgentNodeSnapshot,
  type AgentSpoolEntry,
  type ContainerPortMappingSnapshot,
  type ContainerSnapshot
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
const mailboxUsageCacheSchemaVersion = 1;
const mailboxUsageCacheTtlMs = 5 * 60 * 1000;
const trackedSystemServices = [
  "simplehost-agent.service",
  "simplehost-control.service",
  "simplehost-worker.service",
  "httpd.service",
  "podman.service",
  "firewalld.service",
  "fail2ban.service",
  "postfix.service",
  "dovecot.service",
  "rspamd.service",
  "redis.service",
  "postgresql.service",
  "mariadb.service",
  "pdns.service",
  "named.service"
] as const;
const configValidationCheckDefinitions = [
  { checkId: "sshd", label: "OpenSSH daemon", command: "sshd", args: ["-t"] },
  { checkId: "httpd", label: "Apache HTTP Server", command: "httpd", args: ["-t"] },
  { checkId: "postfix", label: "Postfix", command: "postfix", args: ["check"] },
  { checkId: "dovecot", label: "Dovecot", command: "doveconf", args: ["-n"] },
  { checkId: "rspamd", label: "Rspamd", command: "rspamadm", args: ["configtest"] },
  { checkId: "named", label: "BIND named", command: "named-checkconf", args: [] },
  { checkId: "powerdns", label: "PowerDNS zones", command: "pdnsutil", args: ["check-all-zones"] },
  { checkId: "php-fpm", label: "PHP-FPM", command: "php-fpm", args: ["-t"] }
] as const;
const journalEntriesPerService = 8;
const journalEntryLimit = 120;
const packageUpdateLimit = 500;
const letsEncryptLiveDir = "/etc/letsencrypt/live";
const trackedStoragePaths = [
  "/",
  "/root",
  "/home",
  "/etc",
  "/opt",
  "/var",
  "/var/log",
  "/srv",
  "/srv/backups",
  "/opt/simplehostman",
  "/opt/simplehostman/release"
] as const;

type MailboxUsageEntry = NonNullable<MailServiceSnapshot["mailboxUsage"]>[number];

interface MailboxUsageTarget {
  address: string;
  domainName: string;
  localPart: string;
  maildirPath: string;
}

interface MailboxUsageCachePayload {
  schemaVersion: typeof mailboxUsageCacheSchemaVersion;
  generatedAt: string;
  entries: MailboxUsageEntry[];
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

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

async function commandOutputWithExitCodes(
  command: string,
  args: string[],
  allowedExitCodes: number[],
  timeoutMs?: number
): Promise<string | undefined> {
  const result = await commandResultWithExitCodes(command, args, allowedExitCodes, timeoutMs);
  return result?.stdout;
}

async function commandResultWithExitCodes(
  command: string,
  args: string[],
  allowedExitCodes: number[],
  timeoutMs?: number
): Promise<CommandResult | undefined> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      timeout: timeoutMs
    });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: 0
    };
  } catch (error) {
    const candidate = error as { code?: unknown; stdout?: unknown; stderr?: unknown };

    if (
      typeof candidate.code === "number" &&
      allowedExitCodes.includes(candidate.code) &&
      typeof candidate.stdout === "string"
    ) {
      return {
        stdout: candidate.stdout.trim(),
        stderr: typeof candidate.stderr === "string" ? candidate.stderr.trim() : "",
        exitCode: candidate.code
      };
    }

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

function splitListValue(value: string | undefined): string[] {
  return (value ?? "")
    .trim()
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function parseIntegerValue(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseFirewalldPorts(value: string | undefined): FirewalldZoneSnapshot["ports"] {
  return splitListValue(value)
    .map((entry) => {
      const match = /^(\d+)\/([A-Za-z0-9_-]+)$/.exec(entry);

      if (!match?.[1] || !match[2]) {
        return undefined;
      }

      return {
        port: Number.parseInt(match[1], 10),
        protocol: match[2]
      };
    })
    .filter((entry): entry is FirewalldZoneSnapshot["ports"][number] => Boolean(entry))
    .sort((left, right) => left.port - right.port || left.protocol.localeCompare(right.protocol));
}

function parseFirewalldActiveZones(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const zones: string[] = [];

  for (const line of value.split(/\r?\n/g)) {
    if (line.trim().length === 0 || /^\s/.test(line)) {
      continue;
    }

    const zoneName = line.trim().split(/\s+/)[0];

    if (zoneName) {
      zones.push(zoneName);
    }
  }

  return [...new Set(zones)].sort((left, right) => left.localeCompare(right));
}

function parseFirewalldZone(value: string | undefined, zone: string): FirewalldZoneSnapshot {
  const details = new Map<string, string>();
  const richRules: string[] = [];

  for (const rawLine of (value ?? "").split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("rule ")) {
      richRules.push(line);
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const nextValue = line.slice(separatorIndex + 1).trim();

    if ((key === "rule" || key === "rich rules") && nextValue) {
      richRules.push(nextValue);
    } else {
      details.set(key, nextValue);
    }
  }

  return {
    zone,
    target: details.get("target") || undefined,
    interfaces: splitListValue(details.get("interfaces")),
    sources: splitListValue(details.get("sources")),
    services: splitListValue(details.get("services")),
    ports: parseFirewalldPorts(details.get("ports")),
    richRules,
    masquerade: details.get("masquerade") === "yes"
  };
}

async function inspectFirewalldZone(zone: string): Promise<FirewalldZoneSnapshot> {
  const output = await commandOutput("firewall-cmd", ["--zone", zone, "--list-all"]);
  return parseFirewalldZone(output, zone);
}

async function inspectFirewall(): Promise<HostFirewallSnapshot> {
  const checkedAt = new Date().toISOString();
  const serviceName = "firewalld";
  const [enabledState, activeState, state, defaultZone, activeZonesOutput] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", serviceName]),
    commandOutput("systemctl", ["is-active", serviceName]),
    commandOutput("firewall-cmd", ["--state"]),
    commandOutput("firewall-cmd", ["--get-default-zone"]),
    commandOutput("firewall-cmd", ["--get-active-zones"])
  ]);
  const zoneNames = [
    ...new Set([
      ...parseFirewalldActiveZones(activeZonesOutput),
      ...(defaultZone ? [defaultZone] : [])
    ])
  ].sort((left, right) => left.localeCompare(right));
  const zones =
    activeState === "active" || state === "running"
      ? await Promise.all(zoneNames.map((zone) => inspectFirewalldZone(zone)))
      : [];

  return {
    serviceName,
    enabled: enabledState !== undefined && enabledState !== "disabled",
    active: activeState === "active",
    state,
    defaultZone,
    zones,
    checkedAt
  };
}

function parseFail2BanJails(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const match = /Jail list:\s*(.+)$/m.exec(value);

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function parseFail2BanStatusLine(value: string, label: string): string | undefined {
  const prefix = `${label}:`.toLowerCase();

  for (const rawLine of value.split(/\r?\n/g)) {
    const normalizedLine = rawLine.replace(/^[\s|`\\-]+/, "");

    if (normalizedLine.toLowerCase().startsWith(prefix)) {
      return normalizedLine.slice(prefix.length).trim();
    }
  }

  return undefined;
}

function parseSystemctlShowOutput(value: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of (value ?? "").split(/\r?\n/g)) {
    const separatorIndex = rawLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    result[rawLine.slice(0, separatorIndex)] = rawLine.slice(separatorIndex + 1);
  }

  return result;
}

function normalizeDateTimeValue(value: string | undefined): string | undefined {
  if (!value || value === "n/a") {
    return undefined;
  }

  const parsed = Date.parse(value);
  const parsedWithoutWeekday = Number.isFinite(parsed)
    ? parsed
    : Date.parse(value.replace(/^[A-Za-z]{3}\s+/, ""));

  return Number.isFinite(parsedWithoutWeekday)
    ? new Date(parsedWithoutWeekday).toISOString()
    : undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function inspectServiceUnit(serviceName: string): Promise<ServiceUnitSnapshot | undefined> {
  const checkedAt = new Date().toISOString();
  const output = await commandOutput("systemctl", [
    "show",
    serviceName,
    "--no-page",
    "--property=Id,Description,LoadState,ActiveState,SubState,UnitFileState,FragmentPath,MainPID,NRestarts,ExecMainStatus,ActiveEnterTimestamp"
  ]);
  const fields = parseSystemctlShowOutput(output);

  if (!fields.Id && !fields.LoadState) {
    return undefined;
  }

  return {
    serviceName: fields.Id || serviceName,
    description: fields.Description || undefined,
    loadState: fields.LoadState || undefined,
    activeState: fields.ActiveState || undefined,
    subState: fields.SubState || undefined,
    unitFileState: fields.UnitFileState || undefined,
    fragmentPath: fields.FragmentPath || undefined,
    mainPid: parseOptionalNumber(fields.MainPID),
    restartCount: parseOptionalNumber(fields.NRestarts),
    exitStatus: parseOptionalNumber(fields.ExecMainStatus),
    activeEnterTimestamp: normalizeDateTimeValue(fields.ActiveEnterTimestamp),
    checkedAt
  };
}

async function inspectSystemServices(): Promise<AgentNodeRuntimeSnapshot["services"]> {
  const checkedAt = new Date().toISOString();
  const units = (
    await Promise.all(trackedSystemServices.map((serviceName) => inspectServiceUnit(serviceName)))
  )
    .filter((entry): entry is ServiceUnitSnapshot => Boolean(entry))
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName));

  return {
    units,
    checkedAt
  };
}

interface InstalledPackageVersion {
  packageName: string;
  arch: string;
  epoch?: string;
  version: string;
  release: string;
}

interface PackageAdvisoryInfo {
  packageToken: string;
  advisoryId?: string;
  advisorySeverity?: string;
  advisoryType?: string;
  summary?: string;
}

function normalizeRpmEpoch(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized !== "0" && normalized !== "(none)" ? normalized : undefined;
}

function splitPackageArch(value: string): { packageName: string; arch?: string } {
  const index = value.lastIndexOf(".");

  if (index <= 0 || index === value.length - 1) {
    return { packageName: value };
  }

  return {
    packageName: value.slice(0, index),
    arch: value.slice(index + 1)
  };
}

function parseRpmVersionRelease(value: string): {
  epoch?: string;
  version?: string;
  release?: string;
} {
  const epochMatch = /^([0-9]+):(.+)$/.exec(value);
  const epoch = normalizeRpmEpoch(epochMatch?.[1]);
  const versionRelease = epochMatch?.[2] ?? value;
  const releaseIndex = versionRelease.lastIndexOf("-");

  if (releaseIndex <= 0 || releaseIndex === versionRelease.length - 1) {
    return {
      epoch,
      version: versionRelease || undefined
    };
  }

  return {
    epoch,
    version: versionRelease.slice(0, releaseIndex),
    release: versionRelease.slice(releaseIndex + 1)
  };
}

function parseInstalledPackageVersions(output: string | undefined): Map<string, InstalledPackageVersion> {
  const packages = new Map<string, InstalledPackageVersion>();

  for (const line of (output ?? "").split(/\r?\n/g)) {
    const [packageName, rawEpoch, version, release, arch] = line.split("\t");

    if (!packageName || !version || !release || !arch) {
      continue;
    }

    packages.set(`${packageName}:${arch}`, {
      packageName,
      arch,
      epoch: normalizeRpmEpoch(rawEpoch),
      version,
      release
    });
  }

  return packages;
}

function parseAvailablePackageUpdates(
  output: string | undefined,
  installedPackages: Map<string, InstalledPackageVersion>
): PackageUpdateSnapshot[] {
  const updates: PackageUpdateSnapshot[] = [];

  for (const line of (output ?? "").split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("Last metadata") ||
      trimmed.startsWith("Obsoleting Packages")
    ) {
      continue;
    }

    const parts = trimmed.split(/\s+/g);
    const packageArch = parts[0];
    const versionRelease = parts[1];
    const repository = parts.slice(2).join(" ");

    if (!packageArch || !versionRelease || !repository) {
      continue;
    }

    const { packageName, arch } = splitPackageArch(packageArch);
    const available = parseRpmVersionRelease(versionRelease);
    const installed = arch ? installedPackages.get(`${packageName}:${arch}`) : undefined;

    updates.push({
      packageName,
      arch,
      epoch: available.epoch ?? installed?.epoch,
      currentVersion: installed?.version,
      currentRelease: installed?.release,
      availableVersion: available.version,
      availableRelease: available.release,
      repository
    });
  }

  return updates
    .sort((left, right) =>
      `${left.packageName}:${left.arch ?? ""}`.localeCompare(
        `${right.packageName}:${right.arch ?? ""}`
      )
    )
    .slice(0, packageUpdateLimit);
}

function classifyPackageAdvisory(value: string | undefined, advisoryId: string | undefined): {
  advisorySeverity?: string;
  advisoryType?: string;
} {
  const normalized = value?.trim();
  const lower = `${normalized ?? ""} ${advisoryId ?? ""}`.toLowerCase();
  const advisoryType =
    lower.includes("sec") || lower.includes("elsa") || lower.includes("alsa")
      ? "security"
      : lower.includes("bug")
        ? "bugfix"
        : lower.includes("enhancement")
          ? "enhancement"
          : undefined;
  const advisorySeverity = normalized
    ?.replace(/\/?sec\.?/i, "")
    .replace(/bugfix/i, "")
    .replace(/enhancement/i, "")
    .trim();

  return {
    advisorySeverity: advisorySeverity || undefined,
    advisoryType
  };
}

function parsePackageAdvisories(output: string | undefined): PackageAdvisoryInfo[] {
  const advisories: PackageAdvisoryInfo[] = [];

  for (const line of (output ?? "").split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("Last metadata")) {
      continue;
    }

    const parts = trimmed.split(/\s+/g);
    const advisoryId = parts[0];
    const classifier = parts[1];
    const packageToken = parts.at(-1);

    if (!advisoryId || !packageToken || parts.length < 2) {
      continue;
    }

    const { advisorySeverity, advisoryType } = classifyPackageAdvisory(
      classifier,
      advisoryId
    );

    advisories.push({
      packageToken,
      advisoryId,
      advisorySeverity,
      advisoryType,
      summary: parts.slice(1, -1).join(" ") || undefined
    });
  }

  return advisories;
}

function packageTokenMatchesUpdate(token: string, update: PackageUpdateSnapshot): boolean {
  const packageName = update.packageName;

  return (
    token === packageName ||
    token.startsWith(`${packageName}.`) ||
    token.startsWith(`${packageName}-`) ||
    token.includes(` ${packageName}.`) ||
    token.includes(` ${packageName}-`)
  );
}

function applyPackageAdvisories(
  updates: PackageUpdateSnapshot[],
  advisories: PackageAdvisoryInfo[]
): PackageUpdateSnapshot[] {
  return updates.map((update) => {
    const advisory =
      advisories.find(
        (candidate) =>
          candidate.advisoryType === "security" &&
          packageTokenMatchesUpdate(candidate.packageToken, update)
      ) ??
      advisories.find((candidate) => packageTokenMatchesUpdate(candidate.packageToken, update));

    if (!advisory) {
      return update;
    }

    return {
      ...update,
      advisoryId: advisory.advisoryId,
      advisorySeverity: advisory.advisorySeverity,
      advisoryType: advisory.advisoryType,
      summary: advisory.summary
    };
  });
}

async function inspectPackageUpdates(): Promise<AgentNodeRuntimeSnapshot["packageUpdates"]> {
  const checkedAt = new Date().toISOString();
  const installedOutputPromise = commandOutput("rpm", [
    "-qa",
    "--qf",
    "%{NAME}\t%{EPOCHNUM}\t%{VERSION}\t%{RELEASE}\t%{ARCH}\n"
  ]);
  const checkUpdateOutput = await commandOutputWithExitCodes(
    "dnf",
    ["-q", "check-update"],
    [0, 100],
    45000
  );
  const updateInfoOutput =
    checkUpdateOutput === undefined
      ? undefined
      : await commandOutputWithExitCodes(
          "dnf",
          ["-q", "updateinfo", "list", "updates"],
          [0, 100],
          45000
        );
  const installedOutput = await installedOutputPromise;
  const installedPackages = parseInstalledPackageVersions(installedOutput);
  const updates = parseAvailablePackageUpdates(checkUpdateOutput, installedPackages);

  return {
    updates: applyPackageAdvisories(updates, parsePackageAdvisories(updateInfoOutput)),
    checkedAt
  };
}

function parseRepositoryBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["1", "yes", "true", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "no", "false", "disabled"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseRepositoryPackageCount(value: string | undefined): number | undefined {
  const normalized = value?.replace(/,/g, "").trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitRepositoryValues(value: string | undefined): string[] {
  return uniqueOrderedStrings((value ?? "").split(/[\s,]+/g));
}

function pushRepositoryRecord(
  repositories: PackageRepositorySnapshot[],
  record: Partial<PackageRepositorySnapshot>
): void {
  if (!record.repoId) {
    return;
  }

  repositories.push({
    repoId: record.repoId,
    name: record.name,
    enabled: record.enabled,
    status: record.status,
    revision: record.revision,
    updated: record.updated,
    packageCount: record.packageCount,
    size: record.size,
    baseUrl: record.baseUrl,
    metalink: record.metalink,
    mirrorList: record.mirrorList,
    repoFile: record.repoFile,
    gpgCheck: record.gpgCheck,
    repoGpgCheck: record.repoGpgCheck,
    gpgKeys: record.gpgKeys ?? []
  });
}

function parseDnfRepoInfo(output: string | undefined): PackageRepositorySnapshot[] {
  const repositories: PackageRepositorySnapshot[] = [];
  let current: Partial<PackageRepositorySnapshot> = {};

  for (const rawLine of (output ?? "").split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match = /^Repo-([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const field = match[1]?.toLowerCase();
    const value = match[2]?.trim();

    if (field === "id") {
      pushRepositoryRecord(repositories, current);
      current = {
        repoId: value,
        gpgKeys: []
      };
      continue;
    }

    if (!current.repoId) {
      continue;
    }

    switch (field) {
      case "name":
        current.name = value || undefined;
        break;
      case "status":
        current.status = value || undefined;
        current.enabled = parseRepositoryBoolean(value);
        break;
      case "revision":
        current.revision = value || undefined;
        break;
      case "updated":
        current.updated = value || undefined;
        break;
      case "pkgs":
        current.packageCount = parseRepositoryPackageCount(value);
        break;
      case "size":
        current.size = value || undefined;
        break;
      case "baseurl":
        current.baseUrl = value || undefined;
        break;
      case "metalink":
        current.metalink = value || undefined;
        break;
      case "mirrors":
      case "mirrorlist":
        current.mirrorList = value || undefined;
        break;
      case "filename":
        current.repoFile = value || undefined;
        break;
      case "gpgcheck":
        current.gpgCheck = parseRepositoryBoolean(value);
        break;
      case "repo-gpgcheck":
        current.repoGpgCheck = parseRepositoryBoolean(value);
        break;
      case "gpgkey":
        current.gpgKeys = uniqueOrderedStrings([
          ...(current.gpgKeys ?? []),
          ...splitRepositoryValues(value)
        ]);
        break;
      default:
        break;
    }
  }

  pushRepositoryRecord(repositories, current);

  return repositories.sort((left, right) => left.repoId.localeCompare(right.repoId));
}

function parseDnfRepoList(output: string | undefined): PackageRepositorySnapshot[] {
  const repositories: PackageRepositorySnapshot[] = [];

  for (const rawLine of (output ?? "").split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line || /^repo\s+id/i.test(line)) {
      continue;
    }

    const columns = line.split(/\s{2,}/g);

    if (columns.length < 2 || !columns[0]) {
      continue;
    }

    const status = columns.at(-1);
    const name = columns.slice(1, -1).join(" ") || undefined;

    repositories.push({
      repoId: columns[0],
      name,
      enabled: parseRepositoryBoolean(status),
      status,
      gpgKeys: []
    });
  }

  return repositories.sort((left, right) => left.repoId.localeCompare(right.repoId));
}

async function inspectPackageRepositories(): Promise<
  AgentNodeRuntimeSnapshot["packageRepositories"]
> {
  const checkedAt = new Date().toISOString();
  const repoInfoOutput = await commandOutputWithExitCodes(
    "dnf",
    ["-q", "repoinfo", "--all"],
    [0],
    60000
  );
  let repositories = parseDnfRepoInfo(repoInfoOutput);

  if (repositories.length === 0) {
    const repoListOutput = await commandOutputWithExitCodes(
      "dnf",
      ["-q", "repolist", "--all"],
      [0],
      30000
    );
    repositories = parseDnfRepoList(repoListOutput);
  }

  return {
    repositories,
    checkedAt
  };
}

function parseLatestKernelRelease(output: string | undefined, packageName: string): string | undefined {
  const firstLine = output
    ?.split(/\r?\n/g)
    .map((line) => line.trim())
    .find(Boolean);
  const packageToken = firstLine?.split(/\s+/g)[0];

  if (!packageToken?.startsWith(`${packageName}-`)) {
    return undefined;
  }

  return packageToken.slice(packageName.length + 1);
}

async function readLatestKernelRelease(): Promise<string | undefined> {
  const kernelCoreOutput = await commandOutput("rpm", ["-q", "--last", "kernel-core"]);
  const kernelCoreRelease = parseLatestKernelRelease(kernelCoreOutput, "kernel-core");

  if (kernelCoreRelease) {
    return kernelCoreRelease;
  }

  const kernelOutput = await commandOutput("rpm", ["-q", "--last", "kernel"]);
  return parseLatestKernelRelease(kernelOutput, "kernel");
}

function summarizeNeedsRestartingResult(
  result: CommandResult | undefined
): string | undefined {
  if (!result || result.exitCode === 0) {
    return undefined;
  }

  return (
    result.stdout
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean) ??
    result.stderr
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean) ??
    "needs-restarting reported that a reboot is required"
  );
}

async function inspectRebootState(): Promise<AgentNodeRuntimeSnapshot["rebootState"]> {
  const checkedAt = new Date().toISOString();
  const uptimeSeconds = Math.round(uptime());
  const [kernelRelease, latestKernelRelease, bootIdContent, needsRestartingResult] =
    await Promise.all([
      commandOutput("uname", ["-r"]),
      readLatestKernelRelease(),
      readFile("/proc/sys/kernel/random/boot_id", "utf8").catch(() => undefined),
      commandResultWithExitCodes("needs-restarting", ["-r"], [0, 1], 30000)
    ]);
  const kernelMismatch = Boolean(
    kernelRelease && latestKernelRelease && kernelRelease !== latestKernelRelease
  );
  const needsRestartingReason = summarizeNeedsRestartingResult(needsRestartingResult);
  const needsReboot = needsRestartingResult?.exitCode === 1 || kernelMismatch;

  return {
    kernelRelease,
    latestKernelRelease,
    bootId: bootIdContent?.trim() || undefined,
    bootedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    uptimeSeconds,
    needsReboot,
    needsRebootReason:
      needsRestartingReason ??
      (kernelMismatch
        ? `Running kernel ${kernelRelease} differs from latest installed kernel ${latestKernelRelease}.`
        : undefined),
    checkedAt
  };
}

function truncateValidationSummary(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

function summarizeValidationResult(
  result: CommandResult | undefined,
  status: ConfigValidationCheckSnapshot["status"]
): string {
  if (!result) {
    return "Validation command is not available on this node.";
  }

  const firstLine = [result.stdout, result.stderr]
    .join("\n")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    return truncateValidationSummary(firstLine);
  }

  return status === "passed"
    ? "Configuration check passed."
    : `Configuration check exited with code ${result.exitCode}.`;
}

async function inspectConfigValidationCheck(
  definition: (typeof configValidationCheckDefinitions)[number]
): Promise<ConfigValidationCheckSnapshot> {
  const checkedAt = new Date().toISOString();
  const result = await commandResultWithExitCodes(
    definition.command,
    [...definition.args],
    [0, 1, 2, 3, 4, 5],
    30000
  );
  const status: ConfigValidationCheckSnapshot["status"] = !result
    ? "unavailable"
    : result.exitCode === 0
      ? "passed"
      : "failed";

  return {
    checkId: definition.checkId,
    label: definition.label,
    command: [definition.command, ...definition.args].join(" "),
    status,
    summary: summarizeValidationResult(result, status),
    checkedAt
  };
}

async function inspectConfigValidation(): Promise<AgentNodeRuntimeSnapshot["configValidation"]> {
  const checkedAt = new Date().toISOString();
  const checks = await Promise.all(
    configValidationCheckDefinitions.map((definition) =>
      inspectConfigValidationCheck(definition)
    )
  );

  return {
    checks,
    checkedAt
  };
}

function parseBooleanText(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseChronyTrackingSummary(output: string | undefined): string | undefined {
  const selectedLines = (output ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) =>
      /^(Reference ID|System time|Last offset|Root dispersion|Leap status)\s*:/i.test(line)
    );

  return selectedLines.length > 0 ? selectedLines.join("; ") : undefined;
}

function parseChronySources(output: string | undefined): TimeSyncSourceSnapshot[] {
  const sources: TimeSyncSourceSnapshot[] = [];

  for (const rawLine of (output ?? "").split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("MS ") || line.startsWith("===")) {
      continue;
    }

    const parts = line.split(/\s+/g);
    const marker = parts[0];
    const name = parts[1];

    if (!marker || !name || !/^[\^=#?~x+*-]{2}$/.test(marker)) {
      continue;
    }

    sources.push({
      marker,
      name,
      stratum: parseOptionalNumber(parts[2]),
      poll: parseOptionalNumber(parts[3]),
      reach: parseOptionalNumber(parts[4]),
      lastRx: parts[5],
      lastSample: parts.slice(6).join(" ") || undefined
    });
  }

  return sources;
}

async function inspectTimeSync(): Promise<AgentNodeRuntimeSnapshot["timeSync"]> {
  const checkedAt = new Date().toISOString();
  const [
    timedatectlOutput,
    chronydActive,
    systemdTimesyncdActive,
    trackingOutput,
    sourcesOutput
  ] = await Promise.all([
    commandOutput("timedatectl", [
      "show",
      "--property=Timezone,NTP,Synchronized,NTPSynchronized,LocalRTC",
      "--no-pager"
    ]),
    commandOutput("systemctl", ["is-active", "chronyd.service"]),
    commandOutput("systemctl", ["is-active", "systemd-timesyncd.service"]),
    commandOutput("chronyc", ["tracking"]),
    commandOutput("chronyc", ["sources", "-n"])
  ]);
  const fields = parseSystemctlShowOutput(timedatectlOutput);
  const serviceName =
    chronydActive !== undefined
      ? "chronyd.service"
      : systemdTimesyncdActive !== undefined
        ? "systemd-timesyncd.service"
        : undefined;
  const serviceActive =
    serviceName === "chronyd.service"
      ? chronydActive === "active"
      : serviceName === "systemd-timesyncd.service"
        ? systemdTimesyncdActive === "active"
        : undefined;

  return {
    timezone: fields.Timezone || undefined,
    ntpEnabled: parseBooleanText(fields.NTP),
    synchronized: parseBooleanText(fields.NTPSynchronized ?? fields.Synchronized),
    localRtc: parseBooleanText(fields.LocalRTC),
    serviceName,
    serviceActive,
    trackingSummary: parseChronyTrackingSummary(trackingOutput),
    sources: parseChronySources(sourcesOutput),
    checkedAt
  };
}

function uniqueOrderedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function parseResolvConf(content: string | undefined): {
  nameservers: string[];
  searchDomains: string[];
  options: string[];
} {
  const nameservers: string[] = [];
  const searchDomains: string[] = [];
  const options: string[] = [];

  for (const rawLine of (content ?? "").split(/\r?\n/g)) {
    const line = rawLine.replace(/[#;].*$/, "").trim();

    if (!line) {
      continue;
    }

    const [directive, ...values] = line.split(/\s+/g);

    if (directive === "nameserver") {
      nameservers.push(...values);
    } else if (directive === "search" || directive === "domain") {
      searchDomains.push(...values);
    } else if (directive === "options") {
      options.push(...values);
    }
  }

  return {
    nameservers: uniqueOrderedStrings(nameservers),
    searchDomains: uniqueOrderedStrings(searchDomains),
    options: uniqueOrderedStrings(options)
  };
}

function parseResolvectlValues(output: string | undefined): string[] {
  const values: string[] = [];

  for (const rawLine of (output ?? "").split(/\r?\n/g)) {
    const separatorIndex = rawLine.indexOf(":");

    if (separatorIndex < 0) {
      continue;
    }

    values.push(...rawLine.slice(separatorIndex + 1).trim().split(/\s+/g));
  }

  return uniqueOrderedStrings(values.filter((value) => value !== "~."));
}

async function inspectDnsResolver(): Promise<AgentNodeRuntimeSnapshot["dnsResolver"]> {
  const checkedAt = new Date().toISOString();
  const resolvConfPath = "/etc/resolv.conf";
  const [
    resolvConfContent,
    systemdResolvedState,
    resolvedServersOutput,
    resolvedDomainsOutput
  ] = await Promise.all([
    readFile(resolvConfPath, "utf8").catch(() => undefined),
    commandOutput("systemctl", ["is-active", "systemd-resolved.service"]),
    commandOutput("resolvectl", ["dns"]),
    commandOutput("resolvectl", ["domain"])
  ]);
  const resolvConf = parseResolvConf(resolvConfContent);

  return {
    resolvConfPath,
    ...resolvConf,
    resolvedServers: parseResolvectlValues(resolvedServersOutput),
    resolvedDomains: parseResolvectlValues(resolvedDomainsOutput),
    systemdResolvedActive:
      systemdResolvedState === undefined ? undefined : systemdResolvedState === "active",
    checkedAt
  };
}

function loginShellEnabled(shell: string | undefined): boolean {
  if (!shell) {
    return false;
  }

  return !/(?:^|\/)(nologin|false|sync|shutdown|halt)$/.test(shell);
}

function parsePasswordStatusOutput(output: string | undefined): Map<string, string> {
  const statuses = new Map<string, string>();

  for (const line of (output ?? "").split(/\r?\n/g)) {
    const parts = line.trim().split(/\s+/g);
    const username = parts[0];
    const status = parts[1];

    if (!username || !status) {
      continue;
    }

    statuses.set(username, status);
  }

  return statuses;
}

function parseLocalAccounts(
  passwdOutput: string | undefined,
  passwordStatuses: Map<string, string>
): LocalAccountSnapshot[] {
  return (passwdOutput ?? "")
    .split(/\r?\n/g)
    .map((line): LocalAccountSnapshot | undefined => {
      const [username, , rawUid, rawGid, gecos, homeDirectory, shell] = line.split(":");
      const uid = Number.parseInt(rawUid ?? "", 10);
      const gid = Number.parseInt(rawGid ?? "", 10);

      if (!username || !Number.isInteger(uid) || !Number.isInteger(gid)) {
        return undefined;
      }

      return {
        username,
        uid,
        gid,
        gecos: gecos || undefined,
        homeDirectory: homeDirectory || undefined,
        shell: shell || undefined,
        systemAccount: uid < 1000 && uid !== 0,
        loginEnabled: loginShellEnabled(shell),
        passwordStatus: passwordStatuses.get(username)
      };
    })
    .filter((entry): entry is LocalAccountSnapshot => Boolean(entry))
    .sort((left, right) => left.uid - right.uid || left.username.localeCompare(right.username));
}

function parseLocalGroup(output: string | undefined): LocalGroupSnapshot | undefined {
  const [groupName, , rawGid, rawMembers] = (output ?? "").trim().split(":");
  const gid = Number.parseInt(rawGid ?? "", 10);

  if (!groupName) {
    return undefined;
  }

  return {
    groupName,
    gid: Number.isInteger(gid) ? gid : undefined,
    members: uniqueOrderedStrings((rawMembers ?? "").split(","))
  };
}

function summarizeSudoersResult(result: CommandResult | undefined): {
  sudoersValid?: boolean;
  sudoersSummary?: string;
} {
  if (!result) {
    return {
      sudoersSummary: "visudo is not available on this node."
    };
  }

  const summary = [result.stdout, result.stderr]
    .join("\n")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("; ");

  return {
    sudoersValid: result.exitCode === 0,
    sudoersSummary:
      truncateValidationSummary(summary || `visudo exited with code ${result.exitCode}.`)
  };
}

async function inspectAccounts(): Promise<AgentNodeRuntimeSnapshot["accounts"]> {
  const checkedAt = new Date().toISOString();
  const [
    passwdOutput,
    passwordStatusOutput,
    wheelGroup,
    sudoGroup,
    adminGroup,
    sudoersResult
  ] = await Promise.all([
    commandOutput("getent", ["passwd"]),
    commandOutput("passwd", ["-S", "-a"]),
    commandOutput("getent", ["group", "wheel"]),
    commandOutput("getent", ["group", "sudo"]),
    commandOutput("getent", ["group", "admin"]),
    commandResultWithExitCodes("visudo", ["-c"], [0, 1], 30000)
  ]);
  const passwordStatuses = parsePasswordStatusOutput(passwordStatusOutput);
  const sudoers = summarizeSudoersResult(sudoersResult);

  return {
    users: parseLocalAccounts(passwdOutput, passwordStatuses),
    adminGroups: [wheelGroup, sudoGroup, adminGroup]
      .map(parseLocalGroup)
      .filter((entry): entry is LocalGroupSnapshot => Boolean(entry)),
    ...sudoers,
    checkedAt
  };
}

function formatJournalTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const micros = Number.parseInt(value, 10);
  return Number.isFinite(micros) ? new Date(Math.floor(micros / 1000)).toISOString() : undefined;
}

function priorityLabel(priority: number | undefined): string | undefined {
  switch (priority) {
    case 0:
      return "emerg";
    case 1:
      return "alert";
    case 2:
      return "crit";
    case 3:
      return "err";
    case 4:
      return "warning";
    case 5:
      return "notice";
    case 6:
      return "info";
    case 7:
      return "debug";
    default:
      return undefined;
  }
}

function parseJournalJsonLines(
  output: string | undefined,
  fallbackUnit: string
): JournalLogEntrySnapshot[] {
  const entries: JournalLogEntrySnapshot[] = [];

  for (const line of (output ?? "").split(/\r?\n/g)) {
    if (!line.trim()) {
      continue;
    }

    try {
      const record = JSON.parse(line) as Record<string, unknown>;
      const message = typeof record.MESSAGE === "string" ? record.MESSAGE : undefined;
      const occurredAt = formatJournalTimestamp(record.__REALTIME_TIMESTAMP);
      const priority =
        typeof record.PRIORITY === "string"
          ? Number.parseInt(record.PRIORITY, 10)
          : typeof record.PRIORITY === "number"
            ? record.PRIORITY
            : undefined;

      if (!message || !occurredAt) {
        continue;
      }

      entries.push({
        unit:
          typeof record._SYSTEMD_UNIT === "string" ? record._SYSTEMD_UNIT : fallbackUnit,
        priority: Number.isFinite(priority) ? priority : undefined,
        priorityLabel: priorityLabel(Number.isFinite(priority) ? priority : undefined),
        occurredAt,
        message
      });
    } catch {
      continue;
    }
  }

  return entries;
}

async function inspectJournalForService(serviceName: string): Promise<JournalLogEntrySnapshot[]> {
  const output = await commandOutput("journalctl", [
    "--unit",
    serviceName,
    "--no-pager",
    "--output=json",
    "--since=-24h",
    "-n",
    String(journalEntriesPerService)
  ]);

  return parseJournalJsonLines(output, serviceName);
}

async function inspectSystemLogs(): Promise<AgentNodeRuntimeSnapshot["logs"]> {
  const checkedAt = new Date().toISOString();
  const entries = (await Promise.all(trackedSystemServices.map(inspectJournalForService)))
    .flat()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, journalEntryLimit);

  return {
    entries,
    checkedAt
  };
}

function parseOpenSslCertificateOutput(
  name: string,
  certPath: string,
  output: string | undefined,
  checkedAt: string
): TlsCertificateSnapshot | undefined {
  if (!output) {
    return undefined;
  }

  const dnsNames: string[] = [];
  let subject: string | undefined;
  let issuer: string | undefined;
  let serial: string | undefined;
  let fingerprintSha256: string | undefined;
  let notBefore: string | undefined;
  let notAfter: string | undefined;

  for (const rawLine of output.split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (line.startsWith("subject=")) {
      subject = line.slice("subject=".length).trim();
    } else if (line.startsWith("issuer=")) {
      issuer = line.slice("issuer=".length).trim();
    } else if (line.startsWith("serial=")) {
      serial = line.slice("serial=".length).trim();
    } else if (line.startsWith("sha256 Fingerprint=")) {
      fingerprintSha256 = line.slice("sha256 Fingerprint=".length).trim();
    } else if (line.startsWith("notBefore=")) {
      const parsed = new Date(line.slice("notBefore=".length).trim());
      notBefore = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
    } else if (line.startsWith("notAfter=")) {
      const parsed = new Date(line.slice("notAfter=".length).trim());
      notAfter = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
    } else if (line.includes("DNS:")) {
      for (const match of line.matchAll(/DNS:([^,\s]+)/g)) {
        if (match[1]) {
          dnsNames.push(match[1]);
        }
      }
    }
  }

  return {
    name,
    path: certPath,
    subject,
    issuer,
    serial,
    fingerprintSha256,
    notBefore,
    notAfter,
    dnsNames: [...new Set(dnsNames)].sort((left, right) => left.localeCompare(right)),
    checkedAt
  };
}

async function inspectTlsCertificate(
  name: string,
  certPath: string
): Promise<TlsCertificateSnapshot | undefined> {
  const checkedAt = new Date().toISOString();
  const output = await commandOutput("openssl", [
    "x509",
    "-in",
    certPath,
    "-noout",
    "-subject",
    "-issuer",
    "-serial",
    "-dates",
    "-fingerprint",
    "-sha256",
    "-ext",
    "subjectAltName"
  ]);

  return parseOpenSslCertificateOutput(name, certPath, output, checkedAt);
}

async function inspectTlsCertificates(): Promise<AgentNodeRuntimeSnapshot["tls"]> {
  const checkedAt = new Date().toISOString();
  const entries = await readdir(letsEncryptLiveDir, { withFileTypes: true }).catch(() => []);
  const certificates = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) =>
          inspectTlsCertificate(entry.name, path.join(letsEncryptLiveDir, entry.name, "cert.pem"))
        )
    )
  )
    .filter((entry): entry is TlsCertificateSnapshot => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    certificates,
    checkedAt
  };
}

function parsePercent(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value.replace("%", ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDfBytes(output: string | undefined): FilesystemUsageSnapshot[] {
  const lines = (output ?? "").split(/\r?\n/g).slice(1);

  return lines
    .map((line) => line.trim().split(/\s+/g))
    .filter((parts) => parts.length >= 7)
    .map((parts) => ({
      filesystem: parts[0] ?? "",
      type: parts[1],
      totalBytes: Number.parseInt(parts[2] ?? "0", 10),
      usedBytes: Number.parseInt(parts[3] ?? "0", 10),
      availableBytes: Number.parseInt(parts[4] ?? "0", 10),
      usedPercent: parsePercent(parts[5]),
      mountpoint: parts.slice(6).join(" ")
    }))
    .filter((entry) => entry.filesystem && entry.mountpoint && Number.isFinite(entry.totalBytes));
}

function applyDfInodes(
  filesystems: FilesystemUsageSnapshot[],
  output: string | undefined
): FilesystemUsageSnapshot[] {
  const inodeRows = new Map(
    (output ?? "")
      .split(/\r?\n/g)
      .slice(1)
      .map((line) => line.trim().split(/\s+/g))
      .filter((parts) => parts.length >= 6)
      .map((parts) => [
        parts.slice(5).join(" "),
        {
          totalInodes: Number.parseInt(parts[1] ?? "0", 10),
          usedInodes: Number.parseInt(parts[2] ?? "0", 10),
          availableInodes: Number.parseInt(parts[3] ?? "0", 10),
          inodeUsedPercent: parsePercent(parts[4])
        }
      ] as const)
  );

  return filesystems.map((filesystem) => ({
    ...filesystem,
    ...inodeRows.get(filesystem.mountpoint)
  }));
}

function findFilesystemForPath(
  filesystems: FilesystemUsageSnapshot[],
  targetPath: string
): FilesystemUsageSnapshot | undefined {
  return [...filesystems]
    .filter((filesystem) =>
      targetPath === filesystem.mountpoint ||
      targetPath.startsWith(`${filesystem.mountpoint.replace(/\/$/, "")}/`)
    )
    .sort((left, right) => right.mountpoint.length - left.mountpoint.length)[0];
}

async function inspectStoragePath(
  targetPath: string,
  filesystems: FilesystemUsageSnapshot[]
): Promise<StoragePathUsageSnapshot | undefined> {
  const checkedAt = new Date().toISOString();

  if (!(await pathExists(targetPath))) {
    return undefined;
  }

  const output = await commandOutput("du", ["-sB1", "-x", targetPath]);
  const usedBytes = output ? Number.parseInt(output.split(/\s+/g)[0] ?? "", 10) : undefined;
  const filesystem = findFilesystemForPath(filesystems, targetPath);

  return {
    path: targetPath,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : undefined,
    filesystem: filesystem?.filesystem,
    mountpoint: filesystem?.mountpoint,
    checkedAt
  };
}

async function inspectStorage(): Promise<AgentNodeRuntimeSnapshot["storage"]> {
  const checkedAt = new Date().toISOString();
  const [dfBytes, dfInodes] = await Promise.all([
    commandOutput("df", ["-B1", "-PT", "-x", "tmpfs", "-x", "devtmpfs"]),
    commandOutput("df", ["-Pi", "-x", "tmpfs", "-x", "devtmpfs"])
  ]);
  const filesystems = applyDfInodes(parseDfBytes(dfBytes), dfInodes);
  const paths = (
    await Promise.all(trackedStoragePaths.map((targetPath) => inspectStoragePath(targetPath, filesystems)))
  )
    .filter((entry): entry is StoragePathUsageSnapshot => Boolean(entry))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    filesystems,
    paths,
    checkedAt
  };
}

interface FstabEntry {
  source: string;
  mountpoint: string;
  filesystemType: string;
  options: string[];
  dump?: string;
  pass?: string;
}

const ignoredMountTypes = new Set([
  "autofs",
  "bpf",
  "binfmt_misc",
  "cgroup",
  "cgroup2",
  "configfs",
  "debugfs",
  "devpts",
  "devtmpfs",
  "fusectl",
  "hugetlbfs",
  "mqueue",
  "nsfs",
  "overlay",
  "proc",
  "pstore",
  "rpc_pipefs",
  "securityfs",
  "squashfs",
  "sysfs",
  "tmpfs",
  "tracefs"
]);
const ignoredMountPrefixes = ["/dev", "/proc", "/run", "/sys"];
const trackedKernelParameters = [
  "net.ipv4.ip_forward",
  "net.ipv6.conf.all.forwarding",
  "net.ipv4.conf.all.rp_filter",
  "net.ipv4.tcp_syncookies",
  "net.ipv4.tcp_tw_reuse",
  "vm.swappiness",
  "fs.file-max",
  "kernel.panic",
  "kernel.randomize_va_space"
] as const;

function decodeFstabToken(value: string): string {
  return value
    .replace(/\\040/g, " ")
    .replace(/\\011/g, "\t")
    .replace(/\\012/g, "\n")
    .replace(/\\134/g, "\\");
}

function splitMountOptions(value: string | undefined): string[] {
  return uniqueOrderedStrings((value ?? "").split(","));
}

function parseFstab(content: string | undefined): FstabEntry[] {
  const entries: FstabEntry[] = [];

  for (const rawLine of (content ?? "").split(/\r?\n/g)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const parts = line.split(/\s+/g);

    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      continue;
    }

    entries.push({
      source: decodeFstabToken(parts[0]),
      mountpoint: decodeFstabToken(parts[1]),
      filesystemType: parts[2],
      options: splitMountOptions(parts[3]),
      dump: parts[4],
      pass: parts[5]
    });
  }

  return entries;
}

function parseFindmntPairs(line: string): Record<string, string> {
  const pairs: Record<string, string> = {};

  for (const match of line.matchAll(/([A-Z0-9_]+)="((?:\\.|[^"])*)"/g)) {
    if (!match[1]) {
      continue;
    }

    pairs[match[1]] = (match[2] ?? "")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }

  return pairs;
}

function parseFindmntOutput(output: string | undefined): MountEntrySnapshot[] {
  const entries: MountEntrySnapshot[] = [];

  for (const rawLine of (output ?? "").split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const pairs = parseFindmntPairs(line);
    const mountpoint = pairs.TARGET;

    if (!mountpoint) {
      continue;
    }

    entries.push({
      mountpoint,
      source: pairs.SOURCE || undefined,
      filesystemType: pairs.FSTYPE || undefined,
      options: splitMountOptions(pairs.OPTIONS),
      mounted: true,
      inFstab: false,
      fstabOptions: []
    });
  }

  return entries;
}

function shouldReportMount(
  entry: MountEntrySnapshot,
  fstabMountpoints: Set<string>
): boolean {
  if (fstabMountpoints.has(entry.mountpoint) || entry.mountpoint === "/") {
    return true;
  }

  if (entry.filesystemType && ignoredMountTypes.has(entry.filesystemType)) {
    return false;
  }

  return !ignoredMountPrefixes.some(
    (prefix) => entry.mountpoint === prefix || entry.mountpoint.startsWith(`${prefix}/`)
  );
}

function mergeMountEntries(
  mountedEntries: MountEntrySnapshot[],
  fstabEntries: FstabEntry[]
): MountEntrySnapshot[] {
  const merged = new Map<string, MountEntrySnapshot>();
  const fstabMountpoints = new Set(fstabEntries.map((entry) => entry.mountpoint));

  for (const entry of mountedEntries) {
    merged.set(entry.mountpoint, entry);
  }

  for (const entry of fstabEntries) {
    const existing = merged.get(entry.mountpoint);

    merged.set(entry.mountpoint, {
      ...(existing ?? {
        mountpoint: entry.mountpoint,
        options: [],
        mounted: false
      }),
      inFstab: true,
      fstabSource: entry.source,
      fstabType: entry.filesystemType,
      fstabOptions: entry.options,
      fstabDump: entry.dump,
      fstabPass: entry.pass
    });
  }

  return [...merged.values()]
    .filter((entry) => shouldReportMount(entry, fstabMountpoints))
    .sort((left, right) => left.mountpoint.localeCompare(right.mountpoint));
}

async function inspectMounts(): Promise<AgentNodeRuntimeSnapshot["mounts"]> {
  const checkedAt = new Date().toISOString();
  const [findmntOutput, fstabContent] = await Promise.all([
    commandOutputWithExitCodes(
      "findmnt",
      ["-P", "-o", "TARGET,SOURCE,FSTYPE,OPTIONS"],
      [0],
      30000
    ),
    readFile("/etc/fstab", "utf8").catch(() => undefined)
  ]);

  return {
    entries: mergeMountEntries(parseFindmntOutput(findmntOutput), parseFstab(fstabContent)),
    checkedAt
  };
}

async function inspectKernelParameter(key: string): Promise<KernelParameterSnapshot> {
  const value = await commandOutput("sysctl", ["-n", key]);

  return {
    key,
    value
  };
}

function parseKernelModules(output: string | undefined): KernelModuleSnapshot[] {
  return (output ?? "")
    .split(/\r?\n/g)
    .slice(1)
    .map((line): KernelModuleSnapshot | undefined => {
      const parts = line.trim().split(/\s+/g);
      const name = parts[0];

      if (!name) {
        return undefined;
      }

      return {
        name,
        sizeBytes: parseOptionalNumber(parts[1]),
        usedBy: uniqueOrderedStrings((parts[3] ?? "").split(",").filter((entry) => entry !== "-"))
      };
    })
    .filter((entry): entry is KernelModuleSnapshot => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 150);
}

async function inspectKernel(): Promise<AgentNodeRuntimeSnapshot["kernel"]> {
  const checkedAt = new Date().toISOString();
  const [release, version, architecture, modulesOutput, parameters] = await Promise.all([
    commandOutput("uname", ["-r"]),
    commandOutput("uname", ["-v"]),
    commandOutput("uname", ["-m"]),
    commandOutput("lsmod", []),
    Promise.all(trackedKernelParameters.map((key) => inspectKernelParameter(key)))
  ]);

  return {
    release,
    version,
    architecture,
    parameters,
    modules: parseKernelModules(modulesOutput),
    checkedAt
  };
}

function parseJsonArray(value: string | undefined): unknown[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStringField(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function readNumberField(record: Record<string, unknown>, key: string): number | undefined {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? Number(record[key])
    : undefined;
}

function parseNetworkInterfaces(value: string | undefined): NetworkInterfaceSnapshot[] {
  return parseJsonArray(value)
    .map((entry): NetworkInterfaceSnapshot | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }

      const record = entry as Record<string, unknown>;
      const name = readStringField(record, "ifname");

      if (!name) {
        return undefined;
      }

      const addresses = Array.isArray(record.addr_info)
        ? record.addr_info
            .map((addressEntry): NetworkInterfaceAddressSnapshot | undefined => {
              if (
                !addressEntry ||
                typeof addressEntry !== "object" ||
                Array.isArray(addressEntry)
              ) {
                return undefined;
              }

              const addressRecord = addressEntry as Record<string, unknown>;
              const family = readStringField(addressRecord, "family");
              const address = readStringField(addressRecord, "local");

              if (!family || !address) {
                return undefined;
              }

              return {
                family,
                address,
                prefixLength: readNumberField(addressRecord, "prefixlen"),
                scope: readStringField(addressRecord, "scope")
              };
            })
            .filter((address): address is NetworkInterfaceAddressSnapshot => Boolean(address))
        : [];

      return {
        name,
        state: readStringField(record, "operstate"),
        mtu: readNumberField(record, "mtu"),
        macAddress: readStringField(record, "address"),
        addresses: addresses.sort((left, right) =>
          `${left.family}:${left.address}`.localeCompare(`${right.family}:${right.address}`)
        )
      } satisfies NetworkInterfaceSnapshot;
    })
    .filter((entry): entry is NetworkInterfaceSnapshot => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseNetworkRoutes(
  value: string | undefined,
  family: "inet" | "inet6"
): NetworkRouteSnapshot[] {
  return parseJsonArray(value)
    .map((entry): NetworkRouteSnapshot | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }

      const record = entry as Record<string, unknown>;

      return {
        destination: readStringField(record, "dst") ?? "default",
        gateway: readStringField(record, "gateway"),
        device: readStringField(record, "dev"),
        protocol: readStringField(record, "protocol") ?? readStringField(record, "proto"),
        scope: readStringField(record, "scope"),
        source: readStringField(record, "prefsrc"),
        metric: readNumberField(record, "metric"),
        family
      } satisfies NetworkRouteSnapshot;
    })
    .filter((entry): entry is NetworkRouteSnapshot => Boolean(entry))
    .sort((left, right) =>
      `${left.family}:${left.destination}:${left.device ?? ""}`.localeCompare(
        `${right.family}:${right.destination}:${right.device ?? ""}`
      )
    );
}

function parseListenerAddress(value: string | undefined): {
  localAddress: string;
  port?: number;
} {
  if (!value) {
    return { localAddress: "" };
  }

  const bracketMatch = /^\[(.*)\]:(\d+|\*)$/.exec(value);

  if (bracketMatch?.[1] && bracketMatch[2]) {
    return {
      localAddress: bracketMatch[1],
      port: bracketMatch[2] === "*" ? undefined : Number.parseInt(bracketMatch[2], 10)
    };
  }

  const separatorIndex = value.lastIndexOf(":");

  if (separatorIndex > -1) {
    const portValue = value.slice(separatorIndex + 1);

    if (portValue === "*" || /^\d+$/.test(portValue)) {
      return {
        localAddress: value.slice(0, separatorIndex),
        port: portValue === "*" ? undefined : Number.parseInt(portValue, 10)
      };
    }
  }

  return { localAddress: value };
}

function parseNetworkListeners(value: string | undefined): NetworkListenerSnapshot[] {
  return (value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): NetworkListenerSnapshot | undefined => {
      const parts = line.split(/\s+/g);
      const protocol = parts[0]?.toLowerCase();
      const state = parts[1];
      const local = parseListenerAddress(parts[4]);

      if (!protocol || !local.localAddress) {
        return undefined;
      }

      return {
        protocol,
        state,
        localAddress: local.localAddress,
        port: local.port,
        process: parts.slice(6).join(" ") || undefined
      } satisfies NetworkListenerSnapshot;
    })
    .filter((entry): entry is NetworkListenerSnapshot => Boolean(entry))
    .sort((left, right) =>
      `${left.protocol}:${left.port ?? 0}:${left.localAddress}`.localeCompare(
        `${right.protocol}:${right.port ?? 0}:${right.localAddress}`
      )
    );
}

async function inspectNetwork(): Promise<AgentNodeRuntimeSnapshot["network"]> {
  const checkedAt = new Date().toISOString();
  const [addressOutput, ipv4RoutesOutput, ipv6RoutesOutput, listenersOutput] = await Promise.all([
    commandOutput("ip", ["-j", "address", "show"]),
    commandOutput("ip", ["-j", "route", "show"]),
    commandOutput("ip", ["-6", "-j", "route", "show"]),
    commandOutput("ss", ["-H", "-lntup"])
  ]);

  return {
    interfaces: parseNetworkInterfaces(addressOutput),
    routes: [
      ...parseNetworkRoutes(ipv4RoutesOutput, "inet"),
      ...parseNetworkRoutes(ipv6RoutesOutput, "inet6")
    ],
    listeners: parseNetworkListeners(listenersOutput),
    checkedAt
  };
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProcessRows(value: string | undefined): ProcessEntrySnapshot[] {
  return (value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): ProcessEntrySnapshot | undefined => {
      const parts = line.split(/\s+/g);
      const pid = parseOptionalNumber(parts[0]);
      const command = parts.slice(6).join(" ");

      if (pid === undefined || !command) {
        return undefined;
      }

      const rssKb = parseOptionalNumber(parts[4]);

      return {
        pid,
        user: parts[1],
        cpuPercent: parseOptionalFloat(parts[2]),
        memoryPercent: parseOptionalFloat(parts[3]),
        residentMemoryBytes: rssKb === undefined ? undefined : rssKb * 1024,
        elapsedSeconds: parseOptionalNumber(parts[5]),
        command
      };
    })
    .filter((entry): entry is ProcessEntrySnapshot => Boolean(entry))
    .slice(0, 30);
}

function parseMemAvailableBytes(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(value);
  const kibibytes = match?.[1] ? Number.parseInt(match[1], 10) : undefined;

  return kibibytes === undefined || !Number.isFinite(kibibytes)
    ? undefined
    : kibibytes * 1024;
}

async function inspectProcesses(): Promise<AgentNodeRuntimeSnapshot["processes"]> {
  const checkedAt = new Date().toISOString();
  const [oneMinute, fiveMinutes, fifteenMinutes] = loadavg();
  const [processOutput, memInfo] = await Promise.all([
    commandOutput("ps", [
      "-eo",
      "pid=,user=,pcpu=,pmem=,rss=,etimes=,args=",
      "--sort=-pcpu"
    ]),
    readFile("/proc/meminfo", "utf8").catch(() => undefined)
  ]);

  return {
    loadAverage1m: oneMinute,
    loadAverage5m: fiveMinutes,
    loadAverage15m: fifteenMinutes,
    uptimeSeconds: Math.floor(uptime()),
    totalMemoryBytes: totalmem(),
    availableMemoryBytes: parseMemAvailableBytes(memInfo),
    processes: parseProcessRows(processOutput),
    checkedAt
  };
}

function readStringListValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function readNumberLikeValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readPodmanTimestamp(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalizeDateTimeValue(readStringField(record, key));

    if (value && !value.startsWith("0001-01-01")) {
      return value;
    }
  }

  return undefined;
}

function parsePodmanPorts(value: unknown): ContainerPortMappingSnapshot[] {
  if (typeof value === "string") {
    return value.trim() ? [{ raw: value.trim() }] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): ContainerPortMappingSnapshot | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }

      const record = entry as Record<string, unknown>;

      return {
        hostIp: readStringField(record, "host_ip") ?? readStringField(record, "hostIp"),
        hostPort:
          readNumberLikeValue(record.host_port) ?? readNumberLikeValue(record.hostPort),
        containerPort:
          readNumberLikeValue(record.container_port) ??
          readNumberLikeValue(record.containerPort),
        protocol: readStringField(record, "protocol")
      };
    })
    .filter((entry): entry is ContainerPortMappingSnapshot => Boolean(entry));
}

function parsePodmanContainers(value: string | undefined): ContainerSnapshot[] {
  return parseJsonArray(value)
    .map((entry): ContainerSnapshot | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }

      const record = entry as Record<string, unknown>;
      const id = readStringField(record, "Id") ?? readStringField(record, "ID");

      if (!id) {
        return undefined;
      }

      return {
        id,
        name: readStringListValue(record.Names)[0] ?? readStringField(record, "Name"),
        image: readStringField(record, "Image"),
        state: readStringField(record, "State"),
        status: readStringField(record, "Status"),
        createdAt: readPodmanTimestamp(record, "CreatedAt", "Created"),
        startedAt: readPodmanTimestamp(record, "StartedAt"),
        ports: parsePodmanPorts(record.Ports),
        networks: readStringListValue(record.Networks).sort((left, right) =>
          left.localeCompare(right)
        )
      };
    })
    .filter((entry): entry is ContainerSnapshot => Boolean(entry))
    .sort((left, right) => (left.name ?? left.id).localeCompare(right.name ?? right.id));
}

async function inspectContainers(): Promise<AgentNodeRuntimeSnapshot["containers"]> {
  const checkedAt = new Date().toISOString();
  const output = await commandOutput("podman", ["ps", "--all", "--format", "json"]);

  return {
    containers: parsePodmanContainers(output),
    checkedAt
  };
}

function parseSystemTimerTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value === "n/a") {
    return undefined;
  }

  return normalizeDateTimeValue(value);
}

function parseSystemTimers(value: string | undefined): SystemTimerSnapshot[] {
  return parseJsonArray(value)
    .map((entry): SystemTimerSnapshot | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }

      const record = entry as Record<string, unknown>;
      const timerName =
        readStringField(record, "unit") ??
        readStringField(record, "UNIT") ??
        readStringField(record, "timer");

      if (!timerName) {
        return undefined;
      }

      return {
        timerName,
        activates:
          readStringField(record, "activates") ??
          readStringField(record, "ACTIVATES"),
        nextElapse: parseSystemTimerTimestamp(record.next ?? record.NEXT),
        lastTrigger: parseSystemTimerTimestamp(record.last ?? record.LAST),
        left: readStringField(record, "left") ?? readStringField(record, "LEFT"),
        passed: readStringField(record, "passed") ?? readStringField(record, "PASSED")
      };
    })
    .filter((entry): entry is SystemTimerSnapshot => Boolean(entry))
    .sort((left, right) => left.timerName.localeCompare(right.timerName));
}

async function inspectSystemTimers(): Promise<AgentNodeRuntimeSnapshot["timers"]> {
  const checkedAt = new Date().toISOString();
  const output = await commandOutput("systemctl", [
    "list-timers",
    "--all",
    "--no-pager",
    "--output=json"
  ]);

  return {
    timers: parseSystemTimers(output),
    checkedAt
  };
}

function parseSestatus(value: string | undefined): Partial<SelinuxSnapshot> {
  const result: Partial<SelinuxSnapshot> = {};

  for (const rawLine of (value ?? "").split(/\r?\n/g)) {
    const separatorIndex = rawLine.indexOf(":");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim().toLowerCase();
    const fieldValue = rawLine.slice(separatorIndex + 1).trim();

    if (key === "selinux status") {
      result.status = fieldValue;
    } else if (key === "current mode") {
      result.currentMode = fieldValue;
    } else if (key === "mode from config file") {
      result.configuredMode = fieldValue;
    } else if (key === "loaded policy name") {
      result.policyName = fieldValue;
    } else if (key === "policy version") {
      result.policyVersion = fieldValue;
    }
  }

  return result;
}

async function inspectSelinux(): Promise<AgentNodeRuntimeSnapshot["selinux"]> {
  const checkedAt = new Date().toISOString();
  const [getenforceOutput, sestatusOutput] = await Promise.all([
    commandOutput("getenforce", []),
    commandOutput("sestatus", [])
  ]);
  const parsed = parseSestatus(sestatusOutput);

  return {
    status: parsed.status,
    currentMode: getenforceOutput ?? parsed.currentMode,
    configuredMode: parsed.configuredMode,
    policyName: parsed.policyName,
    policyVersion: parsed.policyVersion,
    checkedAt
  };
}

function parseSshdEffectiveConfig(value: string | undefined): SshEffectiveConfigSnapshot {
  const fields = new Map<string, string[]>();

  for (const rawLine of (value ?? "").split(/\r?\n/g)) {
    const [key, ...rest] = rawLine.trim().split(/\s+/g);

    if (!key || rest.length === 0) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    fields.set(normalizedKey, [...(fields.get(normalizedKey) ?? []), rest.join(" ")]);
  }

  const first = (key: string): string | undefined => fields.get(key)?.[0];

  return {
    port: parseOptionalNumber(first("port")),
    permitRootLogin: first("permitrootlogin"),
    passwordAuthentication: first("passwordauthentication"),
    pubkeyAuthentication: first("pubkeyauthentication"),
    allowTcpForwarding: first("allowtcpforwarding"),
    allowAgentForwarding: first("allowagentforwarding"),
    x11Forwarding: first("x11forwarding"),
    permitOpen: fields.get("permitopen") ?? []
  };
}

function countAuthorizedKeys(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")).length;
}

async function inspectSshAccess(): Promise<AgentNodeRuntimeSnapshot["ssh"]> {
  const checkedAt = new Date().toISOString();
  const serviceName = "sshd.service";
  const [enabledState, activeState, effectiveConfig, rootAuthorizedKeys] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", serviceName]),
    commandOutput("systemctl", ["is-active", serviceName]),
    commandOutput("sshd", ["-T"]),
    readFile("/root/.ssh/authorized_keys", "utf8").catch(() => undefined)
  ]);

  return {
    serviceName,
    enabled: enabledState === undefined ? undefined : enabledState !== "disabled",
    active: activeState === undefined ? undefined : activeState === "active",
    effective: parseSshdEffectiveConfig(effectiveConfig),
    rootAuthorizedKeyCount: countAuthorizedKeys(rootAuthorizedKeys),
    checkedAt
  };
}

async function inspectFail2BanJail(jail: string): Promise<Fail2BanJailSnapshot> {
  const [status, actions, bantime, findtime, maxRetry] = await Promise.all([
    commandOutput("fail2ban-client", ["status", jail]),
    commandOutput("fail2ban-client", ["get", jail, "actions"]),
    commandOutput("fail2ban-client", ["get", jail, "bantime"]),
    commandOutput("fail2ban-client", ["get", jail, "findtime"]),
    commandOutput("fail2ban-client", ["get", jail, "maxretry"])
  ]);

  return {
    jail,
    currentFailed: parseIntegerValue(parseFail2BanStatusLine(status ?? "", "Currently failed")),
    totalFailed: parseIntegerValue(parseFail2BanStatusLine(status ?? "", "Total failed")),
    currentBanned: parseIntegerValue(parseFail2BanStatusLine(status ?? "", "Currently banned")),
    totalBanned: parseIntegerValue(parseFail2BanStatusLine(status ?? "", "Total banned")),
    bannedIps: splitListValue(parseFail2BanStatusLine(status ?? "", "Banned IP list")),
    actions: splitListValue(actions),
    bantimeSeconds: parseIntegerValue(bantime),
    findtimeSeconds: parseIntegerValue(findtime),
    maxRetry: parseIntegerValue(maxRetry)
  };
}

async function inspectFail2Ban(): Promise<Fail2BanSnapshot> {
  const checkedAt = new Date().toISOString();
  const serviceName = "fail2ban";
  const [enabledState, activeState, versionOutput, status] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", serviceName]),
    commandOutput("systemctl", ["is-active", serviceName]),
    commandOutput("fail2ban-client", ["version"]),
    commandOutput("fail2ban-client", ["status"])
  ]);
  const jailNames = parseFail2BanJails(status);
  const jails =
    activeState === "active"
      ? await Promise.all(jailNames.map((jail) => inspectFail2BanJail(jail)))
      : [];

  return {
    serviceName,
    enabled: enabledState !== undefined && enabledState !== "disabled",
    active: activeState === "active",
    version: versionOutput?.replace(/^Fail2Ban\s+v?/i, "").trim() || undefined,
    jails,
    checkedAt
  };
}

function getMailboxUsageCachePath(stateDir: string): string {
  return path.join(stateDir, "mailbox-usage-cache.json");
}

function hasFreshMailboxUsageCache(
  cache: MailboxUsageCachePayload | null,
  targets: MailboxUsageTarget[],
  nowMs: number
): cache is MailboxUsageCachePayload {
  if (cache?.schemaVersion !== mailboxUsageCacheSchemaVersion) {
    return false;
  }

  const generatedAtMs = Date.parse(cache.generatedAt);

  if (!Number.isFinite(generatedAtMs) || nowMs - generatedAtMs > mailboxUsageCacheTtlMs) {
    return false;
  }

  if (cache.entries.length !== targets.length) {
    return false;
  }

  const cachedPathsByAddress = new Map(
    cache.entries.map((entry) => [entry.address, entry.maildirPath] as const)
  );

  return targets.every((target) => cachedPathsByAddress.get(target.address) === target.maildirPath);
}

function parseDuOutput(output: string, blockSizeBytes: number): Map<string, number> {
  const sizesByPath = new Map<string, number>();

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match = /^(\d+)\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const sizeValue = Number.parseInt(match[1] ?? "", 10);
    const targetPath = match[2]?.trim();

    if (!Number.isFinite(sizeValue) || !targetPath) {
      continue;
    }

    sizesByPath.set(targetPath, sizeValue * blockSizeBytes);
  }

  return sizesByPath;
}

async function queryDirectorySizes(targetPaths: string[]): Promise<Map<string, number>> {
  if (targetPaths.length === 0) {
    return new Map();
  }

  const candidates: Array<{ args: string[]; blockSizeBytes: number }> = [
    { args: ["-sB1", "--", ...targetPaths], blockSizeBytes: 1 },
    { args: ["-sk", "--", ...targetPaths], blockSizeBytes: 1024 }
  ];

  for (const candidate of candidates) {
    try {
      const result = await execFileAsync("du", candidate.args, {
        encoding: "utf8"
      });
      return parseDuOutput(result.stdout, candidate.blockSizeBytes);
    } catch {
      continue;
    }
  }

  return new Map();
}

async function collectMailboxUsageSnapshot(
  stateDir: string,
  targets: MailboxUsageTarget[]
): Promise<MailboxUsageEntry[]> {
  if (targets.length === 0) {
    return [];
  }

  const cachePath = getMailboxUsageCachePath(stateDir);
  const nowMs = Date.now();
  const cached = await readJsonFile<MailboxUsageCachePayload>(cachePath);

  if (hasFreshMailboxUsageCache(cached, targets, nowMs)) {
    return cached.entries.map((entry) => ({ ...entry }));
  }

  const presentTargets = await Promise.all(
    targets.map(async (target) =>
      (await pathExists(target.maildirPath)) ? target : undefined
    )
  ).then((values) =>
    values.filter((entry): entry is MailboxUsageTarget => Boolean(entry))
  );
  const sizesByPath = await queryDirectorySizes(
    presentTargets.map((target) => target.maildirPath)
  );
  const generatedAt = new Date().toISOString();
  const entries = targets.map((target) => ({
    address: target.address,
    domainName: target.domainName,
    localPart: target.localPart,
    maildirPath: target.maildirPath,
    usedBytes: sizesByPath.get(target.maildirPath),
    checkedAt: generatedAt
  }));

  await writeJsonFileAtomic(cachePath, {
    schemaVersion: mailboxUsageCacheSchemaVersion,
    generatedAt,
    entries
  } satisfies MailboxUsageCachePayload);

  return entries;
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

function isWildcardAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return normalized === "*" || normalized === "0.0.0.0" || normalized === "::";
}

function isPrivateIpv4Address(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  const candidate = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    return false;
  }

  const octets = candidate.split(".").map((segment) => Number.parseInt(segment, 10));

  if (octets.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isPrivateIpv6Address(address: string): boolean {
  const normalized = address.trim().toLowerCase();

  if (!normalized.includes(":")) {
    return false;
  }

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4Address(normalized);
  }

  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

function addressAcceptsPublicTraffic(address: string): boolean {
  const normalized = address.trim().toLowerCase();

  if (isWildcardAddress(normalized)) {
    return true;
  }

  return (
    normalized.length > 0 &&
    !isLoopbackAddress(normalized) &&
    !isPrivateIpv4Address(normalized) &&
    !isPrivateIpv6Address(normalized)
  );
}

function addressAcceptsLoopbackTraffic(address: string): boolean {
  return isLoopbackAddress(address);
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
        milterListener.addresses.length > 0 &&
        milterListener.addresses.every((address) => addressAcceptsLoopbackTraffic(address))
    )
  } satisfies NonNullable<MailServiceSnapshot["milter"]>;
  const roundcubePackaged =
    roundcubePackageRootExists && roundcubeConfigExists && roundcubeDatabaseExists;

  let managedDomains: MailServiceSnapshot["managedDomains"] = [];
  let mailboxUsage: MailboxUsageEntry[] = [];
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
      const parsedDomains = Array.isArray(parsed.domains) ? parsed.domains : [];
      const mailboxTargets = parsedDomains.flatMap((domain) =>
        (domain.mailboxes ?? [])
          .map((mailbox) => {
            const localPart = mailbox.localPart?.trim();

            if (!localPart) {
              return undefined;
            }

            return {
              address: `${localPart}@${domain.domainName}`,
              domainName: domain.domainName,
              localPart,
              maildirPath: path.join(vmailRoot, domain.domainName, localPart, "Maildir")
            } satisfies MailboxUsageTarget;
          })
          .filter((entry): entry is MailboxUsageTarget => Boolean(entry))
      );
      managedDomains = Array.isArray(parsed.domains)
        ? await Promise.all(
            parsedDomains.map(async (domain) => {
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
      mailboxUsage = await collectMailboxUsageSnapshot(config.stateDir, mailboxTargets);
      for (const domain of parsedDomains) {
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
      mailboxUsage = [];
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
    mailboxUsage,
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
  const [
    appServices,
    codeServer,
    rustdesk,
    firewall,
    fail2ban,
    services,
    packageUpdates,
    packageRepositories,
    rebootState,
    configValidation,
    timeSync,
    dnsResolver,
    accounts,
    logs,
    tls,
    storage,
    mounts,
    kernel,
    network,
    processes,
    containers,
    timers,
    selinux,
    ssh,
    mail
  ] = await Promise.all([
    inspectAppServices(),
    inspectCodeServer(),
    inspectRustDesk(),
    inspectFirewall(),
    inspectFail2Ban(),
    inspectSystemServices(),
    inspectPackageUpdates(),
    inspectPackageRepositories(),
    inspectRebootState(),
    inspectConfigValidation(),
    inspectTimeSync(),
    inspectDnsResolver(),
    inspectAccounts(),
    inspectSystemLogs(),
    inspectTlsCertificates(),
    inspectStorage(),
    inspectMounts(),
    inspectKernel(),
    inspectNetwork(),
    inspectProcesses(),
    inspectContainers(),
    inspectSystemTimers(),
    inspectSelinux(),
    inspectSshAccess(),
    inspectMail()
  ]);

  return {
    appServices,
    codeServer,
    rustdesk,
    firewall,
    fail2ban,
    services,
    packageUpdates,
    packageRepositories,
    rebootState,
    configValidation,
    timeSync,
    dnsResolver,
    accounts,
    logs,
    tls,
    storage,
    mounts,
    kernel,
    network,
    processes,
    containers,
    timers,
    selinux,
    ssh,
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
