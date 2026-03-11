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

export function isSupportedJobKind(value: string): value is ShmJobKind {
  return supportedJobKinds.includes(value as ShmJobKind);
}
