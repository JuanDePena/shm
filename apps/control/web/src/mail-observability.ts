import type { DnsRecordPayload } from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";

export type MailObservabilityStatus = "ready" | "warning" | "missing" | "unreported";

export interface MailDeliverabilityCheck {
  status: MailObservabilityStatus;
  detail?: string;
}

export interface MailDeliverabilityRow {
  domainName: string;
  zoneName: string;
  primaryNodeId: string;
  checkedAt?: string;
  queueMessageCount?: number;
  recentFailureCount: number;
  topDeferReason?: string;
  spf: MailDeliverabilityCheck;
  dkim: MailDeliverabilityCheck;
  dmarc: MailDeliverabilityCheck;
  mtaSts: MailDeliverabilityCheck;
  tlsRpt: MailDeliverabilityCheck;
  webmail: MailDeliverabilityCheck;
  runtime: MailDeliverabilityCheck;
}

export interface MailHaNodeRow {
  nodeId: string;
  deliveryRole: "primary" | "standby";
  checkedAt?: string;
  services: MailDeliverabilityCheck;
  runtimeConfig: MailDeliverabilityCheck;
  mailboxes: MailDeliverabilityCheck;
  dkim: MailDeliverabilityCheck;
  policyDocuments: MailDeliverabilityCheck;
  webmail: MailDeliverabilityCheck;
  promotionReady: MailDeliverabilityCheck;
  blockers: string[];
}

export interface MailHaRow {
  domainName: string;
  mailHost: string;
  webmailHostname: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  primary: MailHaNodeRow;
  standby?: MailHaNodeRow;
}

export interface MailBackupArtifactRow {
  status: MailObservabilityStatus;
  detail: string;
  expectedPaths: string[];
  coveredPaths: string[];
}

export interface MailRestoreCheckRow {
  scope: "mailbox" | "domain" | "mail-stack";
  status: MailObservabilityStatus;
  target: string;
  summary: string;
  validatedAt?: string;
  runId?: string;
}

export interface MailBackupRow {
  domainName: string;
  tenantSlug: string;
  zoneName: string;
  policyCount: number;
  policySlugs: string[];
  latestSuccessfulRunId?: string;
  latestSuccessfulStartedAt?: string;
  latestFailureRunId?: string;
  latestFailureSummary?: string;
  artifacts: {
    maildir: MailBackupArtifactRow;
    dkim: MailBackupArtifactRow;
    runtimeConfig: MailBackupArtifactRow;
    webmailState: MailBackupArtifactRow;
  };
  restoreChecks: MailRestoreCheckRow[];
}

export interface MailValidationWarning {
  code: string;
  summary: string;
  detail: string;
  affectsDispatch: boolean;
}

export interface MailValidationRow {
  domainName: string;
  zoneName: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  warningCount: number;
  dispatchWarningCount: number;
  warnings: MailValidationWarning[];
}

export interface MailObservabilityModel {
  deliverabilityRows: MailDeliverabilityRow[];
  haRows: MailHaRow[];
  backupRows: MailBackupRow[];
  validationRows: MailValidationRow[];
  totalQueuedMessages: number;
  totalRecentFailures: number;
  totalWarnings: number;
  totalDispatchWarnings: number;
}

type DomainRuntimeMatch = {
  nodeId: string;
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>;
  managedDomain: NonNullable<DashboardData["nodeHealth"][number]["mail"]>["managedDomains"][number];
};

type BackupRun = DashboardData["backups"]["latestRuns"][number];
type ParsedMailBackupRestoreCheck = {
  scope: "mailbox" | "domain" | "mail-stack";
  target: string;
  status: "validated" | "warning" | "failed";
  summary: string;
  validatedAt: string;
  runId: string;
};

type ParsedMailBackupDetails = {
  artifactPaths: {
    maildir: string[];
    dkim: string[];
    runtimeConfig: string[];
    webmailState: string[];
  };
  restoreChecks: ParsedMailBackupRestoreCheck[];
};

function ready(detail?: string): MailDeliverabilityCheck {
  return { status: "ready", detail };
}

function warning(detail?: string): MailDeliverabilityCheck {
  return { status: "warning", detail };
}

function missing(detail?: string): MailDeliverabilityCheck {
  return { status: "missing", detail };
}

function unreported(detail?: string): MailDeliverabilityCheck {
  return { status: "unreported", detail };
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function resolveZoneRecordName(fqdn: string, zoneName: string): string | undefined {
  if (fqdn === zoneName) {
    return "@";
  }

  if (!fqdn.endsWith(`.${zoneName}`)) {
    return undefined;
  }

  return fqdn.slice(0, -(`.${zoneName}`).length);
}

function normalizeHostnameValue(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function parseMxRecordTarget(value: string): string | undefined {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  if (parts.length === 1) {
    return normalizeHostnameValue(parts[0]!);
  }

  const priority = Number.parseInt(parts[0]!, 10);
  const target = Number.isInteger(priority) ? parts[1] : parts.at(-1);

  return target ? normalizeHostnameValue(target) : undefined;
}

function decodeDnsTxtRecordValue(value: string): string {
  const trimmed = value.trim();
  const quotedSegments = [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) =>
    (match[1] ?? "").replace(/\\(["\\])/g, "$1")
  );

  if (quotedSegments.length > 0) {
    return quotedSegments.join("").trim();
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1").trim();
  }

  return trimmed;
}

function normalizeTxtRecordValue(value: string): string {
  return decodeDnsTxtRecordValue(value).toLowerCase();
}

const expectedPublicMailPorts = [25, 465, 587, 993, 995];

function isWildcardAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return normalized === "*" || normalized === "0.0.0.0" || normalized === "::";
}

function isLoopbackAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
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

function getMailPortListener(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>,
  port: number
) {
  return mail.portListeners?.find((listener) => listener.protocol === "tcp" && listener.port === port);
}

function listenerAcceptsPublicTraffic(
  listener: ReturnType<typeof getMailPortListener>
): boolean {
  return Boolean(
    listener?.listening &&
      listener.exposure === "public" &&
      listener.addresses.some((address) => addressAcceptsPublicTraffic(address))
  );
}

function listenerIsLoopbackOnly(
  listener: ReturnType<typeof getMailPortListener>
): boolean {
  return Boolean(
    listener?.listening &&
      listener.exposure === "local" &&
      listener.addresses.length > 0 &&
      listener.addresses.every((address) => addressAcceptsLoopbackTraffic(address))
  );
}

function getMissingPublicMailPorts(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): number[] {
  return expectedPublicMailPorts.filter((port) => {
    const listener = getMailPortListener(mail, port);

    return !listenerAcceptsPublicTraffic(listener);
  });
}

function areExpectedPublicMailPortsReady(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): boolean {
  return getMissingPublicMailPorts(mail).length === 0;
}

function getExpectedFirewallPorts(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): number[] {
  const candidate: number[] = [...(mail.firewallExpectedPorts ?? expectedPublicMailPorts)];
  return [...new Set(candidate)].sort((left, right) => left - right);
}

function getMissingFirewallPorts(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): number[] {
  const openPorts = new Set(mail.firewallOpenPorts ?? []);
  return getExpectedFirewallPorts(mail).filter((port) => !openPorts.has(port));
}

function areFirewallPortsAligned(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): boolean {
  return mail.firewallConfigured === true && getMissingFirewallPorts(mail).length === 0;
}

function isMailMilterReady(
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>
): boolean {
  const listener = getMailPortListener(mail, 11332);

  return Boolean(
    mail.milter?.postfixConfigured &&
      mail.milter?.rspamdConfigPresent &&
      mail.milter?.listenerReady &&
      listenerIsLoopbackOnly(listener)
  );
}

function formatPortList(ports: number[]): string {
  return ports.map((port) => `${port}/tcp`).join(", ");
}

function sortRunsByStartedAtDescending(runs: BackupRun[]): BackupRun[] {
  return [...runs].sort(
    (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)
  );
}

function parseMailBackupDetails(run: BackupRun): ParsedMailBackupDetails | undefined {
  const details = run.details;

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const mail = (details as Record<string, unknown>).mail;

  if (!mail || typeof mail !== "object" || Array.isArray(mail)) {
    return undefined;
  }

  const artifactPathsCandidate = (mail as Record<string, unknown>).artifactPaths;
  const restoreChecksCandidate = (mail as Record<string, unknown>).restoreChecks;
  const artifactPathsRecord =
    artifactPathsCandidate &&
    typeof artifactPathsCandidate === "object" &&
    !Array.isArray(artifactPathsCandidate)
      ? (artifactPathsCandidate as Record<string, unknown>)
      : {};
  const restoreChecks = Array.isArray(restoreChecksCandidate)
    ? restoreChecksCandidate
        .flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return [];
          }

          const candidate = entry as Record<string, unknown>;

          if (
            (candidate.scope !== "mailbox" &&
              candidate.scope !== "domain" &&
              candidate.scope !== "mail-stack") ||
            typeof candidate.target !== "string" ||
            (candidate.status !== "validated" &&
              candidate.status !== "warning" &&
              candidate.status !== "failed") ||
            typeof candidate.summary !== "string" ||
            typeof candidate.validatedAt !== "string"
          ) {
            return [];
          }

          return [
            {
              scope: candidate.scope,
              target: candidate.target,
              status: candidate.status,
              summary: candidate.summary,
              validatedAt: candidate.validatedAt,
              runId: run.runId
            } satisfies ParsedMailBackupRestoreCheck
          ];
        })
        .sort(
          (left, right) => Date.parse(right.validatedAt) - Date.parse(left.validatedAt)
        )
    : [];

  return {
    artifactPaths: {
      maildir: uniqueStrings(
        Array.isArray(artifactPathsRecord.maildir)
          ? (artifactPathsRecord.maildir as Array<string | undefined>)
          : []
      ),
      dkim: uniqueStrings(
        Array.isArray(artifactPathsRecord.dkim)
          ? (artifactPathsRecord.dkim as Array<string | undefined>)
          : []
      ),
      runtimeConfig: uniqueStrings(
        Array.isArray(artifactPathsRecord.runtimeConfig)
          ? (artifactPathsRecord.runtimeConfig as Array<string | undefined>)
          : []
      ),
      webmailState: uniqueStrings(
        Array.isArray(artifactPathsRecord.webmailState)
          ? (artifactPathsRecord.webmailState as Array<string | undefined>)
          : []
      )
    },
    restoreChecks
  };
}

function policyCoversMailDomain(
  policy: DashboardData["backups"]["policies"][number],
  tenantSlug: string,
  domainName: string
): boolean {
  if (policy.tenantSlug !== tenantSlug) {
    return false;
  }

  const selectors = policy.resourceSelectors.map((selector) => selector.trim().toLowerCase());

  if (selectors.length === 0) {
    return true;
  }

  return (
    selectors.includes(`tenant:${tenantSlug}`) ||
    selectors.includes("mail-stack") ||
    selectors.includes(`mail-domain:${domainName}`)
  );
}

function buildExpectedMailBackupPaths(
  data: DashboardData,
  domain: DashboardData["mail"]["domains"][number]
): MailBackupRow["artifacts"] {
  const runtime =
    findDomainRuntimeOnNode(data, domain.domainName, domain.primaryNodeId) ??
    findDomainRuntime(data, domain.domainName, domain.primaryNodeId);
  const dkimRoot = runtime?.mail.dkimRoot;

  return {
    maildir: {
      status: "unreported",
      detail: "Expected backup paths will appear after the primary mail runtime reports in.",
      expectedPaths: uniqueStrings([runtime?.managedDomain.maildirRoot]),
      coveredPaths: []
    },
    dkim: {
      status: "unreported",
      detail: "Expected backup paths will appear after the primary mail runtime reports in.",
      expectedPaths:
        dkimRoot && domain.dkimSelector
          ? [
              `${dkimRoot}/${domain.domainName}/${domain.dkimSelector}.key`,
              `${dkimRoot}/${domain.domainName}/${domain.dkimSelector}.dns.txt`
            ]
          : [],
      coveredPaths: []
    },
    runtimeConfig: {
      status: "unreported",
      detail: "Expected backup paths will appear after the primary mail runtime reports in.",
      expectedPaths: uniqueStrings([runtime?.mail.configRoot, runtime?.mail.policyRoot]),
      coveredPaths: []
    },
    webmailState: {
      status: "unreported",
      detail: "Expected backup paths will appear after the primary mail runtime reports in.",
      expectedPaths: uniqueStrings([
        runtime?.mail.roundcubeConfigPath,
        runtime?.mail.roundcubeDatabasePath,
        runtime?.mail.roundcubeSharedRoot,
        runtime?.managedDomain.webmailDocumentRoot
      ]),
      coveredPaths: []
    }
  };
}

function buildMailBackupArtifactRow(args: {
  categoryLabel: string;
  policyCount: number;
  expectedPaths: string[];
  coveredPaths: string[];
  latestSuccessfulRunId?: string;
}): MailBackupArtifactRow {
  const { categoryLabel, policyCount, expectedPaths, coveredPaths, latestSuccessfulRunId } = args;

  if (policyCount === 0) {
    return {
      status: "missing",
      detail: "No backup policy currently covers this mail domain.",
      expectedPaths,
      coveredPaths: []
    };
  }

  if (coveredPaths.length > 0) {
    return {
      status: "ready",
      detail: latestSuccessfulRunId
        ? `${categoryLabel} was reported by backup run ${latestSuccessfulRunId}.`
        : `${categoryLabel} was reported by the latest successful backup run.`,
      expectedPaths,
      coveredPaths
    };
  }

  return {
    status: latestSuccessfulRunId ? "warning" : "missing",
    detail: latestSuccessfulRunId
      ? `A successful backup run exists, but it did not report ${categoryLabel.toLowerCase()} coverage explicitly.`
      : `No successful backup run has reported ${categoryLabel.toLowerCase()} coverage yet.`,
    expectedPaths,
    coveredPaths: []
  };
}

function buildMailRestoreCheckRow(args: {
  scope: MailRestoreCheckRow["scope"];
  target: string;
  policyCount: number;
  checks: ParsedMailBackupRestoreCheck[];
}): MailRestoreCheckRow {
  const latestCheck = args.checks[0];

  if (args.policyCount === 0) {
    return {
      scope: args.scope,
      status: "missing",
      target: args.target,
      summary: "No backup policy currently covers this mail domain."
    };
  }

  if (!latestCheck) {
    return {
      scope: args.scope,
      status: "warning",
      target: args.target,
      summary: "No restore rehearsal has been recorded for this scope yet."
    };
  }

  return {
    scope: args.scope,
    status:
      latestCheck.status === "validated"
        ? "ready"
        : latestCheck.status === "warning"
          ? "warning"
          : "missing",
    target: latestCheck.target,
    summary: latestCheck.summary,
    validatedAt: latestCheck.validatedAt,
    runId: latestCheck.runId
  };
}

function findRecord(
  records: DnsRecordPayload[] | undefined,
  zoneName: string,
  fqdn: string,
  type: DnsRecordPayload["type"],
  predicate: (value: string) => boolean
): boolean {
  const recordName = resolveZoneRecordName(fqdn, zoneName);

  if (!records || !recordName) {
    return false;
  }

  return records.some(
    (record) =>
      record.type === type &&
      record.name === recordName &&
      predicate(type === "TXT" ? normalizeTxtRecordValue(record.value) : record.value)
  );
}

function hasAddressRecord(
  records: DnsRecordPayload[] | undefined,
  zoneName: string,
  fqdn: string
): boolean {
  const recordName = resolveZoneRecordName(fqdn, zoneName);

  if (!records || !recordName) {
    return false;
  }

  return records.some(
    (record) =>
      (record.type === "A" || record.type === "AAAA" || record.type === "CNAME") &&
      record.name.toLowerCase() === recordName.toLowerCase()
  );
}

function hasMxRecordForTarget(
  records: DnsRecordPayload[] | undefined,
  zoneName: string,
  fqdn: string,
  targetFqdn: string
): boolean {
  const recordName = resolveZoneRecordName(fqdn, zoneName);

  if (!records || !recordName) {
    return false;
  }

  return records.some(
    (record) =>
      record.type === "MX" &&
      record.name.toLowerCase() === recordName.toLowerCase() &&
      parseMxRecordTarget(record.value) === normalizeHostnameValue(targetFqdn)
  );
}

function statusFromPresence(
  sourceAvailable: boolean,
  present: boolean,
  detail?: string
): MailDeliverabilityCheck {
  if (!sourceAvailable) {
    return unreported(detail);
  }

  return present ? ready(detail) : missing(detail);
}

function combineStatus(
  left: MailDeliverabilityCheck,
  right: MailDeliverabilityCheck,
  detail?: string
): MailDeliverabilityCheck {
  if (left.status === "unreported" && right.status === "unreported") {
    return unreported(detail);
  }

  if (left.status === "ready" && right.status === "ready") {
    return ready(detail);
  }

  if (
    (left.status === "ready" && right.status === "unreported") ||
    (left.status === "unreported" && right.status === "ready")
  ) {
    return warning(detail);
  }

  if (left.status === "missing" || right.status === "missing") {
    return missing(detail);
  }

  return warning(detail);
}

function getLatestAppliedDnsRecordsByZone(
  data: DashboardData
): Map<string, DnsRecordPayload[]> {
  const latestRecordsByZone = new Map<
    string,
    { occurredAt: number; records: DnsRecordPayload[] }
  >();

  for (const job of data.jobHistory) {
    if (job.kind !== "dns.sync" || job.status !== "applied") {
      continue;
    }

    const zoneName = typeof job.payload.zoneName === "string" ? job.payload.zoneName : undefined;
    const records = Array.isArray(job.payload.records)
      ? (job.payload.records.filter(
          (record): record is DnsRecordPayload =>
            Boolean(record) &&
            typeof record === "object" &&
            typeof (record as Record<string, unknown>).name === "string" &&
            typeof (record as Record<string, unknown>).type === "string" &&
            typeof (record as Record<string, unknown>).value === "string" &&
            typeof (record as Record<string, unknown>).ttl === "number"
        ) as DnsRecordPayload[])
      : undefined;

    if (!zoneName || !records) {
      continue;
    }

    const occurredAt = Date.parse(job.completedAt ?? job.createdAt);
    const previous = latestRecordsByZone.get(zoneName);

    if (previous && previous.occurredAt >= occurredAt) {
      continue;
    }

    latestRecordsByZone.set(zoneName, {
      occurredAt,
      records
    });
  }

  return new Map(
    Array.from(latestRecordsByZone.entries(), ([zoneName, value]) => [
      zoneName,
      value.records
    ])
  );
}

function findDomainRuntime(
  data: DashboardData,
  domainName: string,
  primaryNodeId: string
): DomainRuntimeMatch | undefined {
  const exactPrimary = findDomainRuntimeOnNode(data, domainName, primaryNodeId);

  if (exactPrimary) {
    return exactPrimary;
  }

  for (const node of data.nodeHealth) {
    const managedDomain = node.mail?.managedDomains.find((domain) => domain.domainName === domainName);

    if (node.mail && managedDomain) {
      return {
        nodeId: node.nodeId,
        mail: node.mail,
        managedDomain
      };
    }
  }

  return undefined;
}

function findDomainRuntimeOnNode(
  data: DashboardData,
  domainName: string,
  nodeId: string
): DomainRuntimeMatch | undefined {
  const exactPrimary = data.nodeHealth.find(
    (node) =>
      node.nodeId === nodeId &&
      node.mail?.managedDomains.some((domain) => domain.domainName === domainName)
  );

  if (exactPrimary?.mail) {
    const managedDomain = exactPrimary.mail.managedDomains.find(
      (domain) => domain.domainName === domainName
    );

    if (managedDomain) {
      return {
        nodeId: exactPrimary.nodeId,
        mail: exactPrimary.mail,
        managedDomain
      };
    }
  }

  return undefined;
}

function buildMailHaNodeRow(args: {
  runtime: DomainRuntimeMatch | undefined;
  nodeId: string;
  deliveryRole: "primary" | "standby";
}): MailHaNodeRow {
  const { runtime, nodeId, deliveryRole } = args;

  if (!runtime) {
    return {
      nodeId,
      deliveryRole,
      services: unreported("No node runtime snapshot for this mail role."),
      runtimeConfig: unreported("No node runtime snapshot for this mail role."),
      mailboxes: unreported("No node runtime snapshot for this mail role."),
      dkim: unreported("No node runtime snapshot for this mail role."),
      policyDocuments: unreported("No node runtime snapshot for this mail role."),
      webmail: unreported("No node runtime snapshot for this mail role."),
      promotionReady: unreported("No node runtime snapshot for this mail role."),
      blockers: ["No node runtime snapshot for this mail role."]
    };
  }

  const servicesReady =
    runtime.mail.postfixActive &&
    runtime.mail.dovecotActive &&
    runtime.mail.rspamdActive &&
    runtime.mail.redisActive;
  const runtimeConfig = statusFromPresence(
    true,
    runtime.managedDomain.runtimeConfigPresent === true && runtime.mail.runtimeConfigPresent === true,
    runtime.mail.runtimeConfigPresent
      ? "Generated Postfix, Dovecot, and Rspamd config is present."
      : "Generated mail runtime config is incomplete."
  );
  const mailboxes = statusFromPresence(
    true,
    runtime.managedDomain.mailboxesReady === true,
    runtime.managedDomain.mailboxesReady
      ? "Expected Maildir scaffolds are present on this node."
      : "One or more expected Maildir trees are missing."
  );
  const dkim = statusFromPresence(
    true,
    Boolean(runtime.managedDomain.dkimAvailable || runtime.managedDomain.dkimDnsTxtValue),
    runtime.managedDomain.dkimAvailable
      ? "DKIM key material is present."
      : "DKIM key material is missing."
  );
  const policyDocuments = statusFromPresence(
    true,
    runtime.managedDomain.mtaStsPolicyPresent === true,
    runtime.managedDomain.mtaStsPolicyPresent
      ? "The node-local MTA-STS policy is present."
      : "The node-local MTA-STS policy is missing."
  );
  const webmail = statusFromPresence(
    true,
    runtime.mail.webmailHealthy === true && runtime.managedDomain.webmailDocumentPresent === true,
    runtime.mail.webmailHealthy && runtime.managedDomain.webmailDocumentPresent
      ? "Roundcube and the domain webmail root are present."
      : "Roundcube or the domain webmail root is incomplete."
  );
  const blockers = runtime.managedDomain.promotionBlockers ?? [];

  return {
    nodeId,
    deliveryRole,
    checkedAt: runtime.mail.checkedAt,
    services: statusFromPresence(
      true,
      servicesReady,
      servicesReady
        ? "Postfix, Dovecot, Rspamd, and Redis are active."
        : "Core mail services are not fully active."
    ),
    runtimeConfig,
    mailboxes,
    dkim,
    policyDocuments,
    webmail,
    promotionReady: statusFromPresence(
      true,
      runtime.managedDomain.promotionReady === true,
      runtime.managedDomain.promotionReady
        ? "This node satisfies the current promotion checks."
        : blockers[0] ?? "This node is not ready for mail promotion."
    ),
    blockers
  };
}

export function buildMailObservabilityModel(data: DashboardData): MailObservabilityModel {
  const dnsRecordsByZone = getLatestAppliedDnsRecordsByZone(data);
  const deliverabilityRows: MailDeliverabilityRow[] = data.mail.domains.map((domain) => {
    const runtime = findDomainRuntime(data, domain.domainName, domain.primaryNodeId);
    const dnsRecords = dnsRecordsByZone.get(domain.zoneName);
    const dnsReported = Boolean(dnsRecords);
    const spf = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, domain.domainName, "TXT", (value) =>
        value.toLowerCase().includes("v=spf1")
      ),
      dnsReported ? "Derived SPF TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const dmarc = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_dmarc.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=dmarc1")
      ),
      dnsReported ? "DMARC TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const tlsRpt = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_smtp._tls.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=tlsrptv1")
      ),
      dnsReported ? "TLS-RPT TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const mtaStsDns = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_mta-sts.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=stsv1")
      ) &&
        findRecord(dnsRecords, domain.zoneName, `mta-sts.${domain.domainName}`, "A", () => true),
      dnsReported
        ? "MTA-STS TXT and host A record in last applied dns.sync."
        : "No applied dns.sync payload."
    );
    const dkim = runtime
      ? statusFromPresence(
          true,
          Boolean(runtime.managedDomain.dkimAvailable || runtime.managedDomain.dkimDnsTxtValue),
          "DKIM TXT reported by SimpleHost Agent."
        )
      : unreported("No node runtime snapshot for the domain.");
    const mtaStsPolicy = runtime
      ? statusFromPresence(
          true,
          Boolean(runtime.managedDomain.mtaStsPolicyPresent),
          "Node-local mta-sts.txt policy document."
        )
      : unreported("No node runtime snapshot for the domain.");
    const mtaSts = combineStatus(mtaStsDns, mtaStsPolicy, "DNS posture plus local policy document.");
    const webmail = runtime
      ? runtime.mail.webmailHealthy && runtime.managedDomain.webmailDocumentPresent
        ? ready("Roundcube deployment and domain document root are present.")
        : runtime.mail.roundcubeDeployment === "packaged" || runtime.mail.webmailHealthy
          ? warning("Roundcube is present but the domain root looks incomplete.")
          : missing("Roundcube is not fully deployed on the primary node.")
      : unreported("No node runtime snapshot for the domain.");
    const runtimeStatus = runtime
      ? runtime.mail.postfixActive &&
        runtime.mail.dovecotActive &&
        runtime.mail.rspamdActive &&
        runtime.mail.redisActive &&
        areExpectedPublicMailPortsReady(runtime.mail) &&
        areFirewallPortsAligned(runtime.mail) &&
        isMailMilterReady(runtime.mail)
        ? ready("Core mail services, intended ports, firewall policy, and Rspamd milter are ready.")
        : warning("Runtime mail posture is missing service, listener, firewall, or milter readiness.")
      : unreported("No node runtime snapshot for the domain.");

    return {
      domainName: domain.domainName,
      zoneName: domain.zoneName,
      primaryNodeId: domain.primaryNodeId,
      checkedAt: runtime?.mail.checkedAt,
      queueMessageCount: runtime?.mail.queue?.messageCount,
      recentFailureCount: runtime?.mail.recentDeliveryFailures?.length ?? 0,
      topDeferReason: runtime?.mail.queue?.topDeferReasons[0],
      spf,
      dkim,
      dmarc,
      mtaSts,
      tlsRpt,
      webmail,
      runtime: runtimeStatus
    };
  });
  const haRows: MailHaRow[] = data.mail.domains.map((domain) => {
    const primaryRuntime = findDomainRuntimeOnNode(data, domain.domainName, domain.primaryNodeId);
    const standbyRuntime = domain.standbyNodeId
      ? findDomainRuntimeOnNode(data, domain.domainName, domain.standbyNodeId)
      : undefined;
    const primary = buildMailHaNodeRow({
      runtime: primaryRuntime,
      nodeId: domain.primaryNodeId,
      deliveryRole: "primary"
    });
    const standby = domain.standbyNodeId
      ? buildMailHaNodeRow({
          runtime: standbyRuntime,
          nodeId: domain.standbyNodeId,
          deliveryRole: "standby"
        })
      : undefined;

    return {
      domainName: domain.domainName,
      mailHost: domain.mailHost,
      webmailHostname: primaryRuntime?.managedDomain.webmailHostname ?? `webmail.${domain.domainName}`,
      primaryNodeId: domain.primaryNodeId,
      standbyNodeId: domain.standbyNodeId,
      primary,
      standby
    };
  });
  const backupRows: MailBackupRow[] = data.mail.domains.map((domain) => {
    const relevantPolicies = data.backups.policies.filter((policy) =>
      policyCoversMailDomain(policy, domain.tenantSlug, domain.domainName)
    );
    const relevantPolicySlugs = new Set(relevantPolicies.map((policy) => policy.policySlug));
    const relevantRuns = sortRunsByStartedAtDescending(
      data.backups.latestRuns.filter((run) => relevantPolicySlugs.has(run.policySlug))
    );
    const successfulRuns = relevantRuns.filter((run) => run.status === "succeeded");
    const latestSuccessfulRun = successfulRuns[0];
    const latestFailureRun = relevantRuns.find((run) => run.status === "failed");
    const expectedArtifacts = buildExpectedMailBackupPaths(data, domain);
    const parsedSuccessfulRuns = successfulRuns.map((run) => ({
      run,
      details: parseMailBackupDetails(run)
    }));
    const collectCoveredPaths = (
      key: keyof ParsedMailBackupDetails["artifactPaths"]
    ): string[] =>
      uniqueStrings(
        parsedSuccessfulRuns.flatMap((entry) => entry.details?.artifactPaths[key] ?? [])
      );
    const restoreChecks = parsedSuccessfulRuns.flatMap(
      (entry) => entry.details?.restoreChecks ?? []
    );
    const mailboxesForDomain = data.mail.mailboxes.filter(
      (mailbox) => mailbox.domainName === domain.domainName
    );
    const mailboxTarget = mailboxesForDomain[0]?.address ?? `mailbox@${domain.domainName}`;

    return {
      domainName: domain.domainName,
      tenantSlug: domain.tenantSlug,
      zoneName: domain.zoneName,
      policyCount: relevantPolicies.length,
      policySlugs: relevantPolicies.map((policy) => policy.policySlug).sort((left, right) =>
        left.localeCompare(right)
      ),
      latestSuccessfulRunId: latestSuccessfulRun?.runId,
      latestSuccessfulStartedAt: latestSuccessfulRun?.startedAt,
      latestFailureRunId: latestFailureRun?.runId,
      latestFailureSummary: latestFailureRun?.summary,
      artifacts: {
        maildir: buildMailBackupArtifactRow({
          categoryLabel: "Maildir coverage",
          policyCount: relevantPolicies.length,
          expectedPaths: expectedArtifacts.maildir.expectedPaths,
          coveredPaths: collectCoveredPaths("maildir"),
          latestSuccessfulRunId: latestSuccessfulRun?.runId
        }),
        dkim: buildMailBackupArtifactRow({
          categoryLabel: "DKIM coverage",
          policyCount: relevantPolicies.length,
          expectedPaths: expectedArtifacts.dkim.expectedPaths,
          coveredPaths: collectCoveredPaths("dkim"),
          latestSuccessfulRunId: latestSuccessfulRun?.runId
        }),
        runtimeConfig: buildMailBackupArtifactRow({
          categoryLabel: "Runtime config coverage",
          policyCount: relevantPolicies.length,
          expectedPaths: expectedArtifacts.runtimeConfig.expectedPaths,
          coveredPaths: collectCoveredPaths("runtimeConfig"),
          latestSuccessfulRunId: latestSuccessfulRun?.runId
        }),
        webmailState: buildMailBackupArtifactRow({
          categoryLabel: "Webmail state coverage",
          policyCount: relevantPolicies.length,
          expectedPaths: expectedArtifacts.webmailState.expectedPaths,
          coveredPaths: collectCoveredPaths("webmailState"),
          latestSuccessfulRunId: latestSuccessfulRun?.runId
        })
      },
      restoreChecks: [
        buildMailRestoreCheckRow({
          scope: "mailbox",
          target: mailboxTarget,
          policyCount: relevantPolicies.length,
          checks: restoreChecks.filter((check) => check.scope === "mailbox")
        }),
        buildMailRestoreCheckRow({
          scope: "domain",
          target: domain.domainName,
          policyCount: relevantPolicies.length,
          checks: restoreChecks.filter((check) => check.scope === "domain")
        }),
        buildMailRestoreCheckRow({
          scope: "mail-stack",
          target: domain.tenantSlug,
          policyCount: relevantPolicies.length,
          checks: restoreChecks.filter((check) => check.scope === "mail-stack")
        })
      ]
    };
  });
  const deliverabilityByDomain = new Map(
    deliverabilityRows.map((row) => [row.domainName, row] as const)
  );
  const haByDomain = new Map(haRows.map((row) => [row.domainName, row] as const));
  const validationRows: MailValidationRow[] = data.mail.domains.map((domain) => {
    const deliverability = deliverabilityByDomain.get(domain.domainName);
    const ha = haByDomain.get(domain.domainName);
    const dnsRecords = dnsRecordsByZone.get(domain.zoneName);
    const primaryRuntime = findDomainRuntimeOnNode(data, domain.domainName, domain.primaryNodeId);
    const standbyRuntime = domain.standbyNodeId
      ? findDomainRuntimeOnNode(data, domain.domainName, domain.standbyNodeId)
      : undefined;
    const warnings: MailValidationWarning[] = [];
    const pushWarning = (
      code: string,
      summary: string,
      detail: string,
      affectsDispatch: boolean
    ): void => {
      warnings.push({
        code,
        summary,
        detail,
        affectsDispatch
      });
    };

    if (!dnsRecords) {
      pushWarning(
        "dns-sync-missing",
        "DNS validation is missing for this domain.",
        "SimpleHostMan has no applied dns.sync payload for the zone yet, so it cannot confirm the published MX and mail host records before dispatch.",
        true
      );
    } else {
      if (!hasMxRecordForTarget(dnsRecords, domain.zoneName, domain.domainName, domain.mailHost)) {
        pushWarning(
          "mx-mismatch",
          "MX no longer points to the configured mail host.",
          `The latest dns.sync payload for ${domain.zoneName} does not point ${domain.domainName} at ${domain.mailHost}.`,
          true
        );
      }

      if (!hasAddressRecord(dnsRecords, domain.zoneName, domain.mailHost)) {
        pushWarning(
          "mail-host-missing",
          "The configured mail host no longer has a published address record.",
          `The latest dns.sync payload for ${domain.zoneName} does not publish an A, AAAA, or CNAME record for ${domain.mailHost}.`,
          true
        );
      }

      if (deliverability && deliverability.spf.status !== "ready") {
        pushWarning(
          "spf-missing",
          "SPF is not fully published.",
          deliverability.spf.detail ?? "The latest dns.sync payload is missing the strict SPF record.",
          true
        );
      }

      if (deliverability && deliverability.dmarc.status !== "ready") {
        pushWarning(
          "dmarc-missing",
          "DMARC is not fully published.",
          deliverability.dmarc.detail ?? "The latest dns.sync payload is missing the DMARC record.",
          true
        );
      }

      if (deliverability && deliverability.tlsRpt.status !== "ready") {
        pushWarning(
          "tls-rpt-missing",
          "TLS-RPT is not fully published.",
          deliverability.tlsRpt.detail ?? "The latest dns.sync payload is missing the TLS-RPT record.",
          true
        );
      }

      if (primaryRuntime && deliverability && deliverability.mtaSts.status !== "ready") {
        pushWarning(
          "mta-sts-dns",
          "MTA-STS is only partially published.",
          "The current domain posture is missing either the MTA-STS DNS records or the primary-node policy document.",
          true
        );
      }
    }

    if (!primaryRuntime) {
      pushWarning(
        "primary-runtime-missing",
        "The primary mail node has not reported runtime yet.",
        `SimpleHostMan has no mail runtime snapshot for primary node ${domain.primaryNodeId}, so dispatch would proceed without a fresh readiness signal.`,
        true
      );
    } else if (ha) {
      if (ha.primary.services.status !== "ready") {
        pushWarning(
          "primary-services",
          "The primary mail node is not fully healthy.",
          ha.primary.services.detail ?? "Core mail services are not fully active on the primary node.",
          true
        );
      }

      if (ha.primary.runtimeConfig.status !== "ready") {
        pushWarning(
          "primary-runtime-config",
          "Generated mail runtime config is incomplete on the primary node.",
          ha.primary.runtimeConfig.detail ?? "SimpleHost Agent has not finished rendering the expected mail runtime config.",
          true
        );
      }

      if (ha.primary.mailboxes.status !== "ready") {
        pushWarning(
          "primary-maildir",
          "Mailbox storage is incomplete on the primary node.",
          ha.primary.mailboxes.detail ?? "One or more expected Maildir trees are missing on the primary node.",
          true
        );
      }

      if (ha.primary.dkim.status !== "ready") {
        pushWarning(
          "dkim-missing",
          "DKIM signing material is missing on the primary node.",
          ha.primary.dkim.detail ?? "SimpleHost Agent did not report DKIM key material for this domain on the primary node.",
          true
        );
      }

      if (!areExpectedPublicMailPortsReady(primaryRuntime.mail)) {
        pushWarning(
          "primary-public-ports",
          "The intended public mail ports are not all listening.",
          `SimpleHost Agent did not confirm public listeners for ${formatPortList(
            getMissingPublicMailPorts(primaryRuntime.mail)
          )} on primary node ${domain.primaryNodeId}.`,
          true
        );
      }

      if (!areFirewallPortsAligned(primaryRuntime.mail)) {
        pushWarning(
          "primary-firewall-ports",
          "The primary firewall service is not aligned with the intended mail ports.",
          `The primary node firewall policy is missing ${formatPortList(
            getMissingFirewallPorts(primaryRuntime.mail)
          )} from ${primaryRuntime.mail.firewallServiceName ?? "the managed mail service"}.`,
          true
        );
      }

      if (!isMailMilterReady(primaryRuntime.mail)) {
        pushWarning(
          "primary-milter",
          "Rspamd milter wiring is incomplete on the primary node.",
          `SimpleHost Agent did not confirm a ready Postfix-to-Rspamd milter path on ${domain.primaryNodeId}.`,
          true
        );
      }
    }

    if (domain.standbyNodeId) {
      if (!standbyRuntime) {
        pushWarning(
          "standby-runtime-missing",
          "The standby mail node has not reported runtime yet.",
          `SimpleHostMan has no mail runtime snapshot for standby node ${domain.standbyNodeId}, so failover readiness is unknown.`,
          false
        );
      } else if (ha?.standby && ha.standby.promotionReady.status !== "ready") {
        pushWarning(
          "standby-not-promotable",
          "The standby node is not ready for promotion.",
          ha.standby.blockers[0] ??
            ha.standby.promotionReady.detail ??
            "One or more promotion checks are still failing on the standby node.",
          false
        );
      }
    }

    const dispatchWarningCount = warnings.filter((entry) => entry.affectsDispatch).length;

    return {
      domainName: domain.domainName,
      zoneName: domain.zoneName,
      primaryNodeId: domain.primaryNodeId,
      standbyNodeId: domain.standbyNodeId,
      warningCount: warnings.length,
      dispatchWarningCount,
      warnings
    };
  });

  return {
    deliverabilityRows,
    haRows,
    backupRows,
    validationRows,
    totalQueuedMessages: data.nodeHealth.reduce(
      (total, node) => total + (node.mail?.queue?.messageCount ?? 0),
      0
    ),
    totalRecentFailures: data.nodeHealth.reduce(
      (total, node) => total + (node.mail?.recentDeliveryFailures?.length ?? 0),
      0
    ),
    totalWarnings: validationRows.reduce((total, row) => total + row.warningCount, 0),
    totalDispatchWarnings: validationRows.reduce(
      (total, row) => total + row.dispatchWarningCount,
      0
    )
  };
}

export function toneForMailObservabilityStatus(
  status: MailObservabilityStatus
): "success" | "danger" | "muted" | "default" {
  switch (status) {
    case "ready":
      return "success";
    case "warning":
      return "default";
    case "missing":
      return "danger";
    case "unreported":
    default:
      return "muted";
  }
}
