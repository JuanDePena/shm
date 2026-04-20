import type { DispatchedJobStatus } from "./core.js";
import type { NodeRuntimeSnapshot } from "./platform.js";

export type PlannedResourceKind =
  | "dns"
  | "site"
  | "certificate"
  | "app"
  | "database"
  | "backup";

export const dispatchedJobKinds = [
  "dns.sync",
  "proxy.render",
  "certificate.renew",
  "container.reconcile",
  "postgres.reconcile",
  "mariadb.reconcile",
  "code-server.update",
  "package.inventory.collect",
  "package.install",
  "backup.trigger",
  "mail.sync"
] as const;

export type DispatchedJobKind = (typeof dispatchedJobKinds)[number];

export interface ProxyRenderPayload {
  vhostName: string;
  serverName: string;
  serverAliases?: string[];
  documentRoot?: string;
  proxyPassUrl?: string;
  proxyPreserveHost?: boolean;
  tls?: boolean;
}

export interface DnsRecordPayload {
  name: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
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

export interface ContainerReconcilePayload {
  serviceName: string;
  containerName: string;
  image: string;
  description?: string;
  exec?: string;
  network?: string;
  publishPorts?: string[];
  volumes?: string[];
  hostDirectories?: string[];
  environment?: Record<string, string>;
  envFileName?: string;
  restart?: "always" | "on-failure" | "no";
  restartSec?: number;
  wantedBy?: string;
  enable?: boolean;
  start?: boolean;
}

export interface CodeServerUpdatePayload {
  rpmUrl: string;
  expectedSha256?: string;
}

export interface PackageInventoryCollectPayload {
  includePackagePatterns?: string[];
}

export interface PackageInstallPayload {
  packageNames?: string[];
  rpmUrl?: string;
  expectedSha256?: string;
  allowReinstall?: boolean;
}

export interface MailSyncMailboxPayload {
  address: string;
  localPart: string;
  desiredPassword?: string;
  quotaBytes?: number;
}

export interface MailSyncAliasPayload {
  address: string;
  localPart: string;
  destinations: string[];
}

export interface MailSyncDomainPayload {
  domainName: string;
  tenantSlug: string;
  zoneName: string;
  mailHost: string;
  webmailHostname: string;
  mtaStsHostname: string;
  dkimSelector: string;
  dmarcReportAddress: string;
  tlsReportAddress: string;
  mtaStsMode: "enforce" | "testing" | "none";
  mtaStsMaxAgeSeconds: number;
  deliveryRole: "primary" | "standby";
  mailboxes: MailSyncMailboxPayload[];
  aliases: MailSyncAliasPayload[];
}

export interface MailSyncPayload {
  domains: MailSyncDomainPayload[];
}

export interface PlannedOperation {
  resource: PlannedResourceKind;
  action: string;
  nodeId: string;
  summary: string;
}

export interface PlannedJobEnvelope {
  id: string;
  desiredStateVersion: string;
  nodeId: string;
  operations: PlannedOperation[];
  createdAt: string;
}

export interface DispatchedJobEnvelope {
  id: string;
  desiredStateVersion: string;
  kind: DispatchedJobKind;
  nodeId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface NodeRegistrationRequest {
  nodeId: string;
  hostname: string;
  version: string;
  supportedJobKinds: DispatchedJobKind[];
  generatedAt: string;
  runtimeSnapshot?: NodeRuntimeSnapshot;
}

export interface NodeRegistrationResponse {
  nodeId: string;
  acceptedAt: string;
  pollIntervalMs: number;
  nodeToken?: string;
}

export interface JobClaimRequest {
  nodeId: string;
  hostname: string;
  version: string;
  maxJobs: number;
  runtimeSnapshot?: NodeRuntimeSnapshot;
}

export interface JobClaimResponse {
  nodeId: string;
  claimedAt: string;
  jobs: DispatchedJobEnvelope[];
}

export interface ReportedJobResult {
  jobId: string;
  kind: DispatchedJobKind;
  nodeId: string;
  status: DispatchedJobStatus;
  summary: string;
  details?: Record<string, unknown>;
  completedAt: string;
}

export interface JobReportRequest {
  nodeId: string;
  result: ReportedJobResult;
}

export interface JobDispatchResponse {
  desiredStateVersion: string;
  jobs: DispatchedJobEnvelope[];
}

export interface RegisteredNodeState {
  nodeId: string;
  hostname: string;
  version: string;
  supportedJobKinds: DispatchedJobKind[];
  acceptedAt: string;
  lastSeenAt: string;
}

export interface ControlPlaneStateSnapshot {
  nodes: RegisteredNodeState[];
  pendingJobs: Record<string, DispatchedJobEnvelope[]>;
  reportedResults: ReportedJobResult[];
}

export function createBootstrapDispatchedJob(
  nodeId: string,
  kind: DispatchedJobKind = "proxy.render"
): DispatchedJobEnvelope {
  if (kind === "proxy.render") {
    return {
      id: `bootstrap-${nodeId}-${kind.replace(/\./g, "-")}`,
      desiredStateVersion: "bootstrap-v1",
      kind,
      nodeId,
      createdAt: new Date().toISOString(),
      payload: {
        vhostName: `${nodeId}-bootstrap`,
        serverName: `${nodeId}.bootstrap.simplehost.test`,
        serverAliases: [`www.${nodeId}.bootstrap.simplehost.test`],
        documentRoot: `/srv/www/${nodeId}/current/public`,
        tls: false
      } satisfies ProxyRenderPayload
    };
  }

  if (kind === "dns.sync") {
    return {
      id: `bootstrap-${nodeId}-${kind.replace(/\./g, "-")}`,
      desiredStateVersion: "bootstrap-v1",
      kind,
      nodeId,
      createdAt: new Date().toISOString(),
      payload: {
        zoneName: `${nodeId}.bootstrap.simplehost.test`,
        serial: 2026031201,
        nameservers: [
          `ns1.${nodeId}.bootstrap.simplehost.test`,
          `ns2.${nodeId}.bootstrap.simplehost.test`
        ],
        records: [
          {
            name: "@",
            type: "A",
            value: "127.0.0.1",
            ttl: 300
          }
        ]
      } satisfies DnsSyncPayload
    };
  }

  return {
    id: `bootstrap-${nodeId}-${kind.replace(/\./g, "-")}`,
    desiredStateVersion: "bootstrap-v1",
    kind,
    nodeId,
    createdAt: new Date().toISOString(),
    payload: {
      requestedBy: "bootstrap",
      dryRun: true
    }
  };
}

export function createDispatchedJobEnvelope(
  kind: DispatchedJobKind,
  nodeId: string,
  desiredStateVersion: string,
  payload: Record<string, unknown>
): DispatchedJobEnvelope {
  return {
    id: `${desiredStateVersion}-${nodeId}-${kind.replace(/\./g, "-")}`,
    desiredStateVersion,
    kind,
    nodeId,
    createdAt: new Date().toISOString(),
    payload
  };
}
