export const supportedJobKinds = [
  "dns.sync",
  "proxy.render",
  "certificate.renew",
  "container.reconcile",
  "postgres.reconcile",
  "mariadb.reconcile",
  "code-server.update",
  "backup.trigger",
  "mail.sync"
] as const;

export type ShmJobKind = (typeof supportedJobKinds)[number];
export type ShmJobStatus = "applied" | "skipped" | "failed";

export interface ShmJobEnvelope {
  id: string;
  desiredStateVersion: string;
  kind: ShmJobKind;
  nodeId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface ShmJobResult {
  jobId: string;
  kind: ShmJobKind;
  nodeId: string;
  status: ShmJobStatus;
  summary: string;
  details?: Record<string, unknown>;
  completedAt: string;
}

export interface ShmNodeSnapshot {
  nodeId: string;
  hostname: string;
  status: "ready";
  stateDir: string;
  reportBufferDir: string;
  generatedAt: string;
  nodeToken?: string;
}

export interface ShmNodeRegistrationRequest {
  nodeId: string;
  hostname: string;
  version: string;
  supportedJobKinds: ShmJobKind[];
  generatedAt: string;
  runtimeSnapshot?: ShmNodeRuntimeSnapshot;
}

export interface ShmNodeRegistrationResponse {
  nodeId: string;
  acceptedAt: string;
  pollIntervalMs: number;
  nodeToken?: string;
}

export interface ShmJobClaimRequest {
  nodeId: string;
  hostname: string;
  version: string;
  maxJobs: number;
  runtimeSnapshot?: ShmNodeRuntimeSnapshot;
}

export interface ShmJobClaimResponse {
  nodeId: string;
  claimedAt: string;
  jobs: ShmJobEnvelope[];
}

export interface ShmJobReportRequest {
  nodeId: string;
  result: ShmJobResult;
}

export interface ShmSpoolEntry {
  schemaVersion: 1;
  job: ShmJobEnvelope;
  state: "claimed" | "executed";
  claimedAt: string;
  executedAt?: string;
  resultStatus?: ShmJobStatus;
}

export interface ShmBufferedReport {
  schemaVersion: 1;
  result: ShmJobResult;
  bufferedAt: string;
  deliveryAttempts: number;
  lastDeliveryError?: string;
}

export function isSupportedJobKind(value: string): value is ShmJobKind {
  return supportedJobKinds.includes(value as ShmJobKind);
}

export interface ProxyRenderPayload {
  vhostName: string;
  serverName: string;
  serverAliases?: string[];
  documentRoot: string;
  tls?: boolean;
}

export interface DnsRecordPayload {
  name: string;
  type: "A" | "AAAA" | "CNAME" | "TXT";
  value: string;
  ttl: number;
}

export interface DnsSyncPayload {
  zoneName: string;
  serial: number;
  nameservers: string[];
  records: DnsRecordPayload[];
}

export interface PostgresReconcilePayload {
  appSlug: string;
  databaseName: string;
  roleName: string;
  password: string;
}

export interface MariadbReconcilePayload {
  appSlug: string;
  databaseName: string;
  userName: string;
  password: string;
}

export interface CodeServerUpdatePayload {
  rpmUrl: string;
  expectedSha256?: string;
}

export interface CodeServerServiceSnapshot {
  serviceName: string;
  enabled: boolean;
  active: boolean;
  version?: string;
  bindAddress?: string;
  authMode?: string;
  settingsProfileHash?: string;
  checkedAt: string;
}

export interface ShmNodeRuntimeSnapshot {
  codeServer?: CodeServerServiceSnapshot;
}

export function isProxyRenderPayload(value: unknown): value is ProxyRenderPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.vhostName === "string" &&
    typeof payload.serverName === "string" &&
    typeof payload.documentRoot === "string" &&
    (payload.serverAliases === undefined ||
      (Array.isArray(payload.serverAliases) &&
        payload.serverAliases.every((item) => typeof item === "string"))) &&
    (payload.tls === undefined || typeof payload.tls === "boolean")
  );
}

export function isDnsSyncPayload(value: unknown): value is DnsSyncPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.zoneName === "string" &&
    typeof payload.serial === "number" &&
    Array.isArray(payload.records) &&
    payload.records.every((record) => {
      if (!record || typeof record !== "object") {
        return false;
      }

      const candidate = record as Record<string, unknown>;

      return (
        typeof candidate.name === "string" &&
        typeof candidate.type === "string" &&
        typeof candidate.value === "string" &&
        typeof candidate.ttl === "number"
      );
    }) &&
    Array.isArray(payload.nameservers) &&
    payload.nameservers.every((item) => typeof item === "string")
  );
}

export function isPostgresReconcilePayload(
  value: unknown
): value is PostgresReconcilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.appSlug === "string" &&
    typeof payload.databaseName === "string" &&
    typeof payload.roleName === "string" &&
    typeof payload.password === "string"
  );
}

export function isMariadbReconcilePayload(
  value: unknown
): value is MariadbReconcilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.appSlug === "string" &&
    typeof payload.databaseName === "string" &&
    typeof payload.userName === "string" &&
    typeof payload.password === "string"
  );
}

export function isCodeServerUpdatePayload(
  value: unknown
): value is CodeServerUpdatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.rpmUrl === "string" &&
    (payload.expectedSha256 === undefined || typeof payload.expectedSha256 === "string")
  );
}
