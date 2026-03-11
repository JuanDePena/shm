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
