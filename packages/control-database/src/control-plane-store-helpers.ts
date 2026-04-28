import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID
} from "node:crypto";

import type {
  AppServiceSnapshot,
  AuditEventSummary,
  BackupsOverview,
  CodeServerServiceSnapshot,
  DispatchedJobEnvelope,
  Fail2BanJailSnapshot,
  Fail2BanSnapshot,
  FirewallPortRuleSnapshot,
  FirewalldZoneSnapshot,
  HostFirewallSnapshot,
  InstalledPackageSummary,
  InventoryAppSummary,
  InventoryDatabaseSummary,
  InventoryExportSummary,
  InventoryImportSummary,
  InventoryNodeSummary,
  InventoryZoneSummary,
  JobHistoryEntry,
  MailDeliveryFailureSnapshot,
  MailManagedDomainSnapshot,
  MailQueueSnapshot,
  MailServiceSnapshot,
  NodeHealthSnapshot,
  ReconciliationRunSummary,
  RegisteredNodeState,
  ReportedJobResult,
  ResourceDriftSummary,
  RustDeskListenerSnapshot,
  RustDeskServiceSnapshot
} from "@simplehost/control-contracts";

import type {
  AppDispatchRow,
  AuditEventRow,
  BackupPolicyRow,
  BackupRunRow,
  DriftStatusRow,
  InventoryAppRow,
  InventoryDatabaseRow,
  InventoryExportRow,
  InventoryImportRow,
  InventoryNodeRow,
  InventoryZoneRow,
  InstalledPackageRow,
  JobHistoryRow,
  JobRow,
  NodeHealthRow,
  NodeRow,
  QueuedDispatchJob,
  ReconciliationRunRow,
  ResultRow
} from "./control-plane-store-types.js";

export function normalizeTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface EncryptedJobPayloadEnvelope {
  __simplehostEncryptedJobPayload: true;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

function isEncryptedJobPayloadEnvelope(
  value: unknown
): value is EncryptedJobPayloadEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.__simplehostEncryptedJobPayload === true &&
    record.alg === "aes-256-gcm" &&
    typeof record.iv === "string" &&
    typeof record.tag === "string" &&
    typeof record.ciphertext === "string"
  );
}

export function deriveJobPayloadKey(secret: string | null): Buffer | null {
  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function encodeStoredJobPayload(
  payload: Record<string, unknown>,
  key: Buffer | null
): Record<string, unknown> {
  if (!key) {
    return payload;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    __simplehostEncryptedJobPayload: true,
    alg: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

export function decodeStoredJobPayload(
  payload: Record<string, unknown>,
  key: Buffer | null
): Record<string, unknown> {
  if (!isEncryptedJobPayloadEnvelope(payload)) {
    return payload;
  }

  if (!key) {
    throw new Error("SimpleHost Control job payload secret is required to decrypt queued jobs.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
  const decoded = JSON.parse(plaintext) as unknown;

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("Stored SimpleHost Control job payload did not decode to an object.");
  }

  return decoded as Record<string, unknown>;
}

export function encodeDesiredPassword(
  password: string,
  key: Buffer | null
): Record<string, unknown> {
  return encodeStoredJobPayload({ password }, key);
}

export function decodeDesiredPassword(
  payload: Record<string, unknown> | null,
  key: Buffer | null
): string | null {
  if (!payload) {
    return null;
  }

  const decoded = decodeStoredJobPayload(payload, key);
  return typeof decoded.password === "string" ? decoded.password : null;
}

export function sanitizePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePayload(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    sanitized[key] =
      key.toLowerCase().includes("password") ||
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("token")
        ? "[redacted]"
        : sanitizePayload(entry);
  }

  return sanitized;
}

export function stripSensitivePayloadFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSensitivePayloadFields(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const stripped: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token")
    ) {
      continue;
    }

    stripped[key] = stripSensitivePayloadFields(entry);
  }

  return stripped;
}

export function toDispatchedJob(
  row: JobRow,
  payloadKey: Buffer | null,
  options: { sanitizeSecrets?: boolean } = {}
): DispatchedJobEnvelope {
  const { sanitizeSecrets = true } = options;
  const decodedPayload = decodeStoredJobPayload(row.payload, payloadKey);

  return {
    id: row.id,
    desiredStateVersion: row.desired_state_version,
    kind: row.kind as DispatchedJobEnvelope["kind"],
    nodeId: row.node_id,
    createdAt: normalizeTimestamp(row.created_at),
    payload: (sanitizeSecrets ? sanitizePayload(decodedPayload) : decodedPayload) as Record<
      string,
      unknown
    >
  };
}

export function toRegisteredNodeState(row: NodeRow): RegisteredNodeState {
  return {
    nodeId: row.node_id,
    hostname: row.hostname,
    version: row.version,
    supportedJobKinds: row.supported_job_kinds as RegisteredNodeState["supportedJobKinds"],
    acceptedAt: normalizeTimestamp(row.accepted_at),
    lastSeenAt: normalizeTimestamp(row.last_seen_at)
  };
}

export function toReportedJobResult(row: ResultRow): ReportedJobResult {
  return {
    jobId: row.job_id,
    kind: row.kind as ReportedJobResult["kind"],
    nodeId: row.node_id,
    status: row.status as ReportedJobResult["status"],
    summary: row.summary,
    details: row.details ?? undefined,
    completedAt: normalizeTimestamp(row.completed_at)
  };
}

export function toInventoryImportSummary(row: InventoryImportRow): InventoryImportSummary {
  return {
    importId: row.import_id,
    sourcePath: row.source_path,
    importedAt: normalizeTimestamp(row.imported_at),
    tenantCount: Number(row.summary.tenantCount ?? 0),
    nodeCount: Number(row.summary.nodeCount ?? 0),
    zoneCount: Number(row.summary.zoneCount ?? 0),
    appCount: Number(row.summary.appCount ?? 0),
    siteCount: Number(row.summary.siteCount ?? 0),
    databaseCount: Number(row.summary.databaseCount ?? 0)
  };
}

export function toInventoryExportSummary(row: InventoryExportRow): InventoryExportSummary {
  const summary =
    row.payload && typeof row.payload.summary === "object" && row.payload.summary
      ? (row.payload.summary as Record<string, unknown>)
      : {};

  return {
    exportId: row.event_id,
    exportedAt: normalizeTimestamp(row.occurred_at),
    tenantCount: Number(summary.tenantCount ?? 0),
    nodeCount: Number(summary.nodeCount ?? 0),
    zoneCount: Number(summary.zoneCount ?? 0),
    appCount: Number(summary.appCount ?? 0),
    siteCount: Number(summary.siteCount ?? 0),
    databaseCount: Number(summary.databaseCount ?? 0)
  };
}

export function toInventoryNodeSummary(row: InventoryNodeRow): InventoryNodeSummary {
  return {
    nodeId: row.node_id,
    hostname: row.hostname,
    publicIpv4: row.public_ipv4,
    wireguardAddress: row.wireguard_address
  };
}

export function toInventoryZoneSummary(row: InventoryZoneRow): InventoryZoneSummary {
  return {
    zoneName: row.zone_name,
    tenantSlug: row.tenant_slug,
    primaryNodeId: row.primary_node_id
  };
}

export function toInventoryAppSummary(row: InventoryAppRow): InventoryAppSummary {
  return {
    slug: row.slug,
    tenantSlug: row.tenant_slug,
    zoneName: row.zone_name,
    primaryNodeId: row.primary_node_id,
    standbyNodeId: row.standby_node_id ?? undefined,
    canonicalDomain: row.canonical_domain,
    aliases: row.aliases,
    backendPort: row.backend_port,
    runtimeImage: row.runtime_image,
    storageRoot: row.storage_root,
    mode: row.mode
  };
}

export function toInventoryDatabaseSummary(
  row: InventoryDatabaseRow
): InventoryDatabaseSummary {
  return {
    appSlug: row.app_slug,
    engine: row.engine,
    databaseName: row.database_name,
    databaseUser: row.database_user,
    primaryNodeId: row.primary_node_id,
    standbyNodeId: row.standby_node_id ?? undefined,
    pendingMigrationTo: row.pending_migration_to ?? undefined,
    migrationCompletedFrom: row.migration_completed_from ?? undefined,
    migrationCompletedAt: row.migration_completed_at
      ? normalizeTimestamp(row.migration_completed_at)
      : undefined
  };
}

export function toBackupPolicySummary(
  row: BackupPolicyRow
): BackupsOverview["policies"][number] {
  return {
    policySlug: row.policy_slug,
    tenantSlug: row.tenant_slug,
    targetNodeId: row.target_node_id,
    schedule: row.schedule,
    retentionDays: row.retention_days,
    storageLocation: row.storage_location,
    resourceSelectors: row.resource_selectors
  };
}

export function toBackupRunSummary(row: BackupRunRow): BackupsOverview["latestRuns"][number] {
  return {
    runId: row.run_id,
    policySlug: row.policy_slug,
    nodeId: row.node_id,
    status: row.status,
    summary: row.summary,
    startedAt: normalizeTimestamp(row.started_at),
    completedAt: row.completed_at ? normalizeTimestamp(row.completed_at) : undefined,
    details: row.details
      ? (sanitizePayload(row.details) as BackupsOverview["latestRuns"][number]["details"])
      : undefined
  };
}

export function toInstalledPackageSummary(
  row: InstalledPackageRow
): InstalledPackageSummary {
  return {
    nodeId: row.node_id,
    hostname: row.hostname,
    packageName: row.package_name,
    epoch: row.epoch ?? undefined,
    version: row.version,
    release: row.release,
    arch: row.arch,
    nevra: row.nevra,
    source: row.source ?? undefined,
    installedAt: row.installed_at ? normalizeTimestamp(row.installed_at) : undefined,
    lastCollectedAt: normalizeTimestamp(row.last_collected_at)
  };
}

export function toReconciliationRunSummary(
  row: ReconciliationRunRow
): ReconciliationRunSummary {
  return {
    runId: row.run_id,
    desiredStateVersion: row.desired_state_version,
    startedAt: normalizeTimestamp(row.started_at),
    completedAt: normalizeTimestamp(row.completed_at),
    generatedJobCount: row.generated_job_count,
    skippedJobCount: row.skipped_job_count,
    missingCredentialCount: row.missing_credential_count,
    jobs: Array.isArray(row.summary.jobs)
      ? (row.summary.jobs as ReconciliationRunSummary["jobs"])
      : []
  };
}

export function normalizeCodeServerSnapshot(
  value: unknown
): CodeServerServiceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.serviceName !== "string") {
    return undefined;
  }

  return {
    serviceName: record.serviceName,
    enabled: Boolean(record.enabled),
    active: Boolean(record.active),
    version: typeof record.version === "string" ? record.version : undefined,
    bindAddress: typeof record.bindAddress === "string" ? record.bindAddress : undefined,
    authMode: typeof record.authMode === "string" ? record.authMode : undefined,
    settingsProfileHash:
      typeof record.settingsProfileHash === "string"
        ? record.settingsProfileHash
        : undefined,
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

function normalizeAppServiceSnapshot(
  value: unknown
): AppServiceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.appSlug !== "string" ||
    typeof record.serviceName !== "string" ||
    typeof record.containerName !== "string"
  ) {
    return undefined;
  }

  return {
    appSlug: record.appSlug,
    serviceName: record.serviceName,
    containerName: record.containerName,
    enabled: Boolean(record.enabled),
    active: Boolean(record.active),
    image: typeof record.image === "string" ? record.image : undefined,
    backendPort:
      typeof record.backendPort === "number" ? record.backendPort : undefined,
    stateRoot: typeof record.stateRoot === "string" ? record.stateRoot : undefined,
    envFilePath:
      typeof record.envFilePath === "string" ? record.envFilePath : undefined,
    quadletPath:
      typeof record.quadletPath === "string" ? record.quadletPath : undefined,
    checkedAt:
      typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

function normalizeRustDeskListenerSnapshot(
  value: unknown
): RustDeskListenerSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    (record.protocol !== "tcp" && record.protocol !== "udp") ||
    typeof record.address !== "string" ||
    typeof record.port !== "number"
  ) {
    return undefined;
  }

  return {
    protocol: record.protocol,
    address: record.address,
    port: record.port
  };
}

export function normalizeRustDeskSnapshot(
  value: unknown
): RustDeskServiceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.hbbsServiceName !== "string" ||
    typeof record.hbbrServiceName !== "string"
  ) {
    return undefined;
  }

  const listeners = Array.isArray(record.listeners)
    ? record.listeners
        .map(normalizeRustDeskListenerSnapshot)
        .filter((entry): entry is RustDeskListenerSnapshot => Boolean(entry))
    : [];

  return {
    hbbsServiceName: record.hbbsServiceName,
    hbbsEnabled: Boolean(record.hbbsEnabled),
    hbbsActive: Boolean(record.hbbsActive),
    hbbrServiceName: record.hbbrServiceName,
    hbbrEnabled: Boolean(record.hbbrEnabled),
    hbbrActive: Boolean(record.hbbrActive),
    publicKey: typeof record.publicKey === "string" ? record.publicKey : undefined,
    publicKeyPath:
      typeof record.publicKeyPath === "string" ? record.publicKeyPath : undefined,
    listeners,
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

function normalizeFirewallPortRuleSnapshot(
  value: unknown
): FirewallPortRuleSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.protocol !== "string" || typeof record.port !== "number") {
    return undefined;
  }

  return {
    protocol: record.protocol,
    port: Number(record.port)
  };
}

function normalizeFirewalldZoneSnapshot(
  value: unknown
): FirewalldZoneSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.zone !== "string") {
    return undefined;
  }

  return {
    zone: record.zone,
    target: typeof record.target === "string" ? record.target : undefined,
    interfaces: Array.isArray(record.interfaces)
      ? record.interfaces.filter((entry): entry is string => typeof entry === "string")
      : [],
    sources: Array.isArray(record.sources)
      ? record.sources.filter((entry): entry is string => typeof entry === "string")
      : [],
    services: Array.isArray(record.services)
      ? record.services.filter((entry): entry is string => typeof entry === "string")
      : [],
    ports: Array.isArray(record.ports)
      ? record.ports
          .map(normalizeFirewallPortRuleSnapshot)
          .filter((entry): entry is FirewallPortRuleSnapshot => Boolean(entry))
      : [],
    richRules: Array.isArray(record.richRules)
      ? record.richRules.filter((entry): entry is string => typeof entry === "string")
      : [],
    masquerade:
      typeof record.masquerade === "boolean" ? record.masquerade : undefined
  };
}

export function normalizeHostFirewallSnapshot(
  value: unknown
): HostFirewallSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.serviceName !== "string") {
    return undefined;
  }

  return {
    serviceName: record.serviceName,
    enabled: Boolean(record.enabled),
    active: Boolean(record.active),
    state: typeof record.state === "string" ? record.state : undefined,
    defaultZone: typeof record.defaultZone === "string" ? record.defaultZone : undefined,
    zones: Array.isArray(record.zones)
      ? record.zones
          .map(normalizeFirewalldZoneSnapshot)
          .filter((entry): entry is FirewalldZoneSnapshot => Boolean(entry))
      : [],
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

function normalizeFail2BanJailSnapshot(value: unknown): Fail2BanJailSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.jail !== "string") {
    return undefined;
  }

  return {
    jail: record.jail,
    currentFailed:
      typeof record.currentFailed === "number" ? Number(record.currentFailed) : undefined,
    totalFailed:
      typeof record.totalFailed === "number" ? Number(record.totalFailed) : undefined,
    currentBanned:
      typeof record.currentBanned === "number" ? Number(record.currentBanned) : undefined,
    totalBanned:
      typeof record.totalBanned === "number" ? Number(record.totalBanned) : undefined,
    bannedIps: Array.isArray(record.bannedIps)
      ? record.bannedIps.filter((entry): entry is string => typeof entry === "string")
      : [],
    actions: Array.isArray(record.actions)
      ? record.actions.filter((entry): entry is string => typeof entry === "string")
      : [],
    bantimeSeconds:
      typeof record.bantimeSeconds === "number" ? Number(record.bantimeSeconds) : undefined,
    findtimeSeconds:
      typeof record.findtimeSeconds === "number" ? Number(record.findtimeSeconds) : undefined,
    maxRetry: typeof record.maxRetry === "number" ? Number(record.maxRetry) : undefined
  };
}

export function normalizeFail2BanSnapshot(value: unknown): Fail2BanSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.serviceName !== "string") {
    return undefined;
  }

  return {
    serviceName: record.serviceName,
    enabled: Boolean(record.enabled),
    active: Boolean(record.active),
    version: typeof record.version === "string" ? record.version : undefined,
    jails: Array.isArray(record.jails)
      ? record.jails
          .map(normalizeFail2BanJailSnapshot)
          .filter((entry): entry is Fail2BanJailSnapshot => Boolean(entry))
      : [],
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

function normalizeMailManagedDomainSnapshot(
  value: unknown
): MailManagedDomainSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.domainName !== "string" ||
    typeof record.mailHost !== "string" ||
    typeof record.webmailHostname !== "string" ||
    (record.deliveryRole !== "primary" && record.deliveryRole !== "standby")
  ) {
    return undefined;
  }

  return {
    domainName: record.domainName,
    mailHost: record.mailHost,
    webmailHostname: record.webmailHostname,
    mtaStsHostname:
      typeof record.mtaStsHostname === "string"
        ? record.mtaStsHostname
        : `mta-sts.${record.domainName}`,
    deliveryRole: record.deliveryRole,
    mailboxCount: Number(record.mailboxCount ?? 0),
    aliasCount: Number(record.aliasCount ?? 0),
    dkimSelector: typeof record.dkimSelector === "string" ? record.dkimSelector : undefined,
    dkimDnsTxtValue:
      typeof record.dkimDnsTxtValue === "string" ? record.dkimDnsTxtValue : undefined,
    dkimAvailable:
      typeof record.dkimAvailable === "boolean" ? record.dkimAvailable : undefined,
    dmarcReportAddress:
      typeof record.dmarcReportAddress === "string" ? record.dmarcReportAddress : undefined,
    tlsReportAddress:
      typeof record.tlsReportAddress === "string" ? record.tlsReportAddress : undefined,
    mtaStsMode:
      record.mtaStsMode === "enforce" ||
      record.mtaStsMode === "testing" ||
      record.mtaStsMode === "none"
        ? record.mtaStsMode
        : undefined,
    mtaStsMaxAgeSeconds:
      typeof record.mtaStsMaxAgeSeconds === "number"
        ? Number(record.mtaStsMaxAgeSeconds)
        : undefined,
    runtimeConfigPresent:
      typeof record.runtimeConfigPresent === "boolean"
        ? record.runtimeConfigPresent
        : undefined,
    maildirRoot: typeof record.maildirRoot === "string" ? record.maildirRoot : undefined,
    mailboxesReady:
      typeof record.mailboxesReady === "boolean" ? record.mailboxesReady : undefined,
    webmailDocumentRoot:
      typeof record.webmailDocumentRoot === "string" ? record.webmailDocumentRoot : undefined,
    webmailDocumentPresent:
      typeof record.webmailDocumentPresent === "boolean"
        ? record.webmailDocumentPresent
        : undefined,
    mtaStsDocumentRoot:
      typeof record.mtaStsDocumentRoot === "string" ? record.mtaStsDocumentRoot : undefined,
    mtaStsPolicyPath:
      typeof record.mtaStsPolicyPath === "string" ? record.mtaStsPolicyPath : undefined,
    mtaStsPolicyPresent:
      typeof record.mtaStsPolicyPresent === "boolean" ? record.mtaStsPolicyPresent : undefined,
    promotionReady:
      typeof record.promotionReady === "boolean" ? record.promotionReady : undefined,
    promotionBlockers: Array.isArray(record.promotionBlockers)
      ? record.promotionBlockers.filter((entry): entry is string => typeof entry === "string")
      : undefined
  };
}

function normalizeMailQueueSnapshot(value: unknown): MailQueueSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.messageCount !== "number" ||
    typeof record.activeCount !== "number" ||
    typeof record.deferredCount !== "number" ||
    typeof record.holdCount !== "number" ||
    typeof record.incomingCount !== "number" ||
    typeof record.maildropCount !== "number" ||
    !Array.isArray(record.topDeferReasons)
  ) {
    return undefined;
  }

  return {
    messageCount: Number(record.messageCount),
    activeCount: Number(record.activeCount),
    deferredCount: Number(record.deferredCount),
    holdCount: Number(record.holdCount),
    incomingCount: Number(record.incomingCount),
    maildropCount: Number(record.maildropCount),
    corruptCount:
      typeof record.corruptCount === "number" ? Number(record.corruptCount) : undefined,
    topDeferReasons: record.topDeferReasons
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, 8)
  };
}

function normalizeMailDeliveryFailureSnapshot(
  value: unknown
): MailDeliveryFailureSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.occurredAt !== "string" ||
    (record.status !== "deferred" && record.status !== "bounced" && record.status !== "expired") ||
    typeof record.reason !== "string"
  ) {
    return undefined;
  }

  return {
    occurredAt: record.occurredAt,
    status: record.status,
    queueId: typeof record.queueId === "string" ? record.queueId : undefined,
    recipient: typeof record.recipient === "string" ? record.recipient : undefined,
    relay: typeof record.relay === "string" ? record.relay : undefined,
    reason: record.reason
  };
}

function normalizeMailPortListenerSnapshot(
  value: unknown
): NonNullable<MailServiceSnapshot["portListeners"]>[number] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.label !== "string" ||
    record.protocol !== "tcp" ||
    typeof record.port !== "number" ||
    (record.exposure !== "public" && record.exposure !== "local")
  ) {
    return undefined;
  }

  return {
    label: record.label,
    protocol: "tcp",
    port: record.port,
    exposure: record.exposure,
    addresses: Array.isArray(record.addresses)
      ? record.addresses.filter((entry): entry is string => typeof entry === "string")
      : [],
    listening: Boolean(record.listening)
  };
}

function normalizeMailMilterSnapshot(
  value: unknown
): NonNullable<MailServiceSnapshot["milter"]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.endpoint !== "string") {
    return undefined;
  }

  return {
    endpoint: record.endpoint,
    postfixConfigured: Boolean(record.postfixConfigured),
    rspamdConfigPresent: Boolean(record.rspamdConfigPresent),
    listenerReady: Boolean(record.listenerReady)
  };
}

function normalizeMailboxUsageSnapshot(
  value: unknown
): NonNullable<MailServiceSnapshot["mailboxUsage"]>[number] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.address !== "string" ||
    typeof record.domainName !== "string" ||
    typeof record.localPart !== "string" ||
    typeof record.maildirPath !== "string" ||
    typeof record.checkedAt !== "string"
  ) {
    return undefined;
  }

  return {
    address: record.address,
    domainName: record.domainName,
    localPart: record.localPart,
    maildirPath: record.maildirPath,
    usedBytes:
      typeof record.usedBytes === "number" ? Number(record.usedBytes) : undefined,
    checkedAt: record.checkedAt
  };
}

export function normalizeMailSnapshot(value: unknown): MailServiceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.postfixServiceName !== "string" ||
    typeof record.dovecotServiceName !== "string" ||
    typeof record.rspamdServiceName !== "string" ||
    typeof record.redisServiceName !== "string"
  ) {
    return undefined;
  }

  const managedDomains = Array.isArray(record.managedDomains)
    ? record.managedDomains
        .map(normalizeMailManagedDomainSnapshot)
        .filter((entry): entry is MailManagedDomainSnapshot => Boolean(entry))
    : [];

  return {
    postfixServiceName: record.postfixServiceName,
    postfixEnabled: Boolean(record.postfixEnabled),
    postfixActive: Boolean(record.postfixActive),
    postfixInstalled: Boolean(record.postfixInstalled),
    dovecotServiceName: record.dovecotServiceName,
    dovecotEnabled: Boolean(record.dovecotEnabled),
    dovecotActive: Boolean(record.dovecotActive),
    dovecotInstalled: Boolean(record.dovecotInstalled),
    rspamdServiceName: record.rspamdServiceName,
    rspamdEnabled: Boolean(record.rspamdEnabled),
    rspamdActive: Boolean(record.rspamdActive),
    rspamdInstalled: Boolean(record.rspamdInstalled),
    redisServiceName: record.redisServiceName,
    redisEnabled: Boolean(record.redisEnabled),
    redisActive: Boolean(record.redisActive),
    redisInstalled: Boolean(record.redisInstalled),
    configRoot: typeof record.configRoot === "string" ? record.configRoot : undefined,
    statePath: typeof record.statePath === "string" ? record.statePath : undefined,
    desiredStatePresent:
      typeof record.desiredStatePresent === "boolean" ? record.desiredStatePresent : undefined,
    runtimeConfigPresent:
      typeof record.runtimeConfigPresent === "boolean" ? record.runtimeConfigPresent : undefined,
    vmailRoot: typeof record.vmailRoot === "string" ? record.vmailRoot : undefined,
    policyRoot: typeof record.policyRoot === "string" ? record.policyRoot : undefined,
    dkimRoot: typeof record.dkimRoot === "string" ? record.dkimRoot : undefined,
    roundcubeRoot:
      typeof record.roundcubeRoot === "string" ? record.roundcubeRoot : undefined,
    roundcubeSharedRoot:
      typeof record.roundcubeSharedRoot === "string" ? record.roundcubeSharedRoot : undefined,
    roundcubeConfigPath:
      typeof record.roundcubeConfigPath === "string" ? record.roundcubeConfigPath : undefined,
    roundcubeDatabasePath:
      typeof record.roundcubeDatabasePath === "string"
        ? record.roundcubeDatabasePath
        : undefined,
    roundcubeDeployment:
      record.roundcubeDeployment === "packaged" ||
      record.roundcubeDeployment === "placeholder" ||
      record.roundcubeDeployment === "absent"
        ? record.roundcubeDeployment
        : undefined,
    webmailHealthy:
      typeof record.webmailHealthy === "boolean" ? record.webmailHealthy : undefined,
    firewallServiceName:
      typeof record.firewallServiceName === "string" ? record.firewallServiceName : undefined,
    firewallConfigured:
      typeof record.firewallConfigured === "boolean"
        ? record.firewallConfigured
        : undefined,
    firewallExpectedPorts: Array.isArray(record.firewallExpectedPorts)
      ? record.firewallExpectedPorts
          .filter((entry): entry is number => typeof entry === "number")
          .sort((left, right) => left - right)
      : undefined,
    firewallOpenPorts: Array.isArray(record.firewallOpenPorts)
      ? record.firewallOpenPorts
          .filter((entry): entry is number => typeof entry === "number")
          .sort((left, right) => left - right)
      : undefined,
    portListeners: Array.isArray(record.portListeners)
      ? record.portListeners
          .map(normalizeMailPortListenerSnapshot)
          .filter(
            (entry): entry is NonNullable<MailServiceSnapshot["portListeners"]>[number] =>
              Boolean(entry)
          )
      : undefined,
    milter: normalizeMailMilterSnapshot(record.milter),
    configuredMailboxCount: Number(record.configuredMailboxCount ?? 0),
    missingMailboxCount: Number(record.missingMailboxCount ?? 0),
    resetRequiredMailboxCount: Number(record.resetRequiredMailboxCount ?? 0),
    policyDocumentCount: Number(record.policyDocumentCount ?? 0),
    healthyPolicyDocumentCount: Number(record.healthyPolicyDocumentCount ?? 0),
    queue: normalizeMailQueueSnapshot(record.queue),
    recentDeliveryFailures: Array.isArray(record.recentDeliveryFailures)
      ? record.recentDeliveryFailures
          .map(normalizeMailDeliveryFailureSnapshot)
          .filter((entry): entry is MailDeliveryFailureSnapshot => Boolean(entry))
      : undefined,
    mailboxUsage: Array.isArray(record.mailboxUsage)
      ? record.mailboxUsage
          .map(normalizeMailboxUsageSnapshot)
          .filter(
            (entry): entry is NonNullable<MailServiceSnapshot["mailboxUsage"]>[number] =>
              Boolean(entry)
          )
      : undefined,
    managedDomains,
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString()
  };
}

export function toNodeHealthSnapshot(row: NodeHealthRow): NodeHealthSnapshot {
  const runtimeSnapshot =
    row.runtime_snapshot && typeof row.runtime_snapshot === "object"
      ? row.runtime_snapshot
      : {};

  return {
    nodeId: row.node_id,
    hostname: row.hostname,
    desiredRole: "inventory",
    currentVersion: row.current_version ?? undefined,
    desiredVersion: undefined,
    lastSeenAt: row.last_seen_at ? normalizeTimestamp(row.last_seen_at) : undefined,
    pendingJobCount: Number(row.pending_job_count),
    latestJobStatus: (row.latest_job_status as NodeHealthSnapshot["latestJobStatus"]) ?? undefined,
    latestJobSummary: row.latest_job_summary ?? undefined,
    driftedResourceCount: Number(row.drifted_resource_count ?? 0),
    primaryZoneCount: Number(row.primary_zone_count ?? 0),
    primaryAppCount: Number(row.primary_app_count ?? 0),
    backupPolicyCount: Number(row.backup_policy_count ?? 0),
    appServices: Array.isArray((runtimeSnapshot as Record<string, unknown>).appServices)
      ? ((runtimeSnapshot as Record<string, unknown>).appServices as unknown[])
          .map(normalizeAppServiceSnapshot)
          .filter((entry): entry is AppServiceSnapshot => Boolean(entry))
      : [],
    codeServer: normalizeCodeServerSnapshot(
      (runtimeSnapshot as Record<string, unknown>).codeServer
    ),
    rustdesk: normalizeRustDeskSnapshot(
      (runtimeSnapshot as Record<string, unknown>).rustdesk
    ),
    firewall: normalizeHostFirewallSnapshot(
      (runtimeSnapshot as Record<string, unknown>).firewall
    ),
    fail2ban: normalizeFail2BanSnapshot(
      (runtimeSnapshot as Record<string, unknown>).fail2ban
    ),
    mail: normalizeMailSnapshot((runtimeSnapshot as Record<string, unknown>).mail)
  };
}

export function toJobHistoryEntry(
  row: JobHistoryRow,
  payloadKey: Buffer | null
): JobHistoryEntry {
  return {
    jobId: row.id,
    desiredStateVersion: row.desired_state_version,
    kind: row.kind as JobHistoryEntry["kind"],
    nodeId: row.node_id,
    createdAt: normalizeTimestamp(row.created_at),
    claimedAt: row.claimed_at ? normalizeTimestamp(row.claimed_at) : undefined,
    completedAt: row.completed_at ? normalizeTimestamp(row.completed_at) : undefined,
    status: (row.status as JobHistoryEntry["status"]) ?? undefined,
    summary: row.summary ?? undefined,
    dispatchReason: row.dispatch_reason ?? undefined,
    resourceKey: row.resource_key ?? undefined,
    payload: sanitizePayload(
      decodeStoredJobPayload(row.payload, payloadKey)
    ) as Record<string, unknown>,
    details: row.details
      ? (sanitizePayload(row.details) as Record<string, unknown>)
      : undefined
  };
}

export function toAuditEventSummary(row: AuditEventRow): AuditEventSummary {
  return {
    eventId: row.event_id,
    actorType: row.actor_type,
    actorId: row.actor_id ?? undefined,
    eventType: row.event_type,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    occurredAt: normalizeTimestamp(row.occurred_at)
  };
}

export function titleizeSlug(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function createDesiredStateVersion(): string {
  return `dispatch-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function hashDesiredPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function createStableId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 16)}`;
}

export function relativeRecordNameForZone(hostname: string, zoneName: string): string {
  const normalizedHost = hostname.replace(/\.$/, "").toLowerCase();
  const normalizedZone = zoneName.replace(/\.$/, "").toLowerCase();

  if (normalizedHost === normalizedZone) {
    return "@";
  }

  const suffix = `.${normalizedZone}`;

  if (!normalizedHost.endsWith(suffix)) {
    throw new Error(`${hostname} does not belong to zone ${zoneName}.`);
  }

  return normalizedHost.slice(0, -suffix.length);
}

export function createQueuedDispatchJob(
  envelope: DispatchedJobEnvelope,
  resourceKey: string,
  resourceKind: string
): QueuedDispatchJob {
  const resourceSuffix = createHash("sha256")
    .update(resourceKey)
    .digest("hex")
    .slice(0, 12);

  return {
    envelope: {
      ...envelope,
      id: `${envelope.id}-${resourceSuffix}`
    },
    resourceKey,
    resourceKind,
    payloadHash: hashDesiredPayload(envelope.payload)
  };
}

export function createResourceDriftSummary(
  job: QueuedDispatchJob,
  latest: DriftStatusRow | null
): ResourceDriftSummary {
  if (!latest) {
    return {
      resourceKind: job.resourceKind as ResourceDriftSummary["resourceKind"],
      resourceKey: job.resourceKey,
      nodeId: job.envelope.nodeId,
      driftStatus: "out_of_sync",
      desiredPayloadHash: job.payloadHash,
      dispatchRecommended: true
    };
  }

  if (!latest.completed_at) {
    return {
      resourceKind: job.resourceKind as ResourceDriftSummary["resourceKind"],
      resourceKey: job.resourceKey,
      nodeId: job.envelope.nodeId,
      driftStatus: "pending",
      desiredPayloadHash: job.payloadHash,
      latestPayloadHash: latest.payload_hash ?? undefined,
      latestJobId: latest.id,
      dispatchRecommended: latest.payload_hash !== job.payloadHash
    };
  }

  if (latest.payload_hash !== job.payloadHash) {
    return {
      resourceKind: job.resourceKind as ResourceDriftSummary["resourceKind"],
      resourceKey: job.resourceKey,
      nodeId: job.envelope.nodeId,
      driftStatus: "out_of_sync",
      desiredPayloadHash: job.payloadHash,
      latestPayloadHash: latest.payload_hash ?? undefined,
      latestJobId: latest.id,
      latestJobStatus: (latest.status as ResourceDriftSummary["latestJobStatus"]) ?? undefined,
      latestSummary: latest.summary ?? undefined,
      dispatchRecommended: true
    };
  }

  if (latest.status !== "applied") {
    return {
      resourceKind: job.resourceKind as ResourceDriftSummary["resourceKind"],
      resourceKey: job.resourceKey,
      nodeId: job.envelope.nodeId,
      driftStatus: "failed",
      desiredPayloadHash: job.payloadHash,
      latestPayloadHash: latest.payload_hash ?? undefined,
      latestJobId: latest.id,
      latestJobStatus: (latest.status as ResourceDriftSummary["latestJobStatus"]) ?? undefined,
      latestSummary: latest.summary ?? undefined,
      dispatchRecommended: true
    };
  }

  return {
    resourceKind: job.resourceKind as ResourceDriftSummary["resourceKind"],
    resourceKey: job.resourceKey,
    nodeId: job.envelope.nodeId,
    driftStatus: "in_sync",
    desiredPayloadHash: job.payloadHash,
    latestPayloadHash: latest.payload_hash ?? undefined,
    latestJobId: latest.id,
    latestJobStatus: "applied",
    latestSummary: latest.summary ?? undefined,
    dispatchRecommended: false
  };
}
