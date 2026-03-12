export const supportedJobKinds = [
  "dns.sync",
  "proxy.render",
  "certificate.renew",
  "container.reconcile",
  "postgres.reconcile",
  "mariadb.reconcile",
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
  records: DnsRecordPayload[];
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
    })
  );
}
