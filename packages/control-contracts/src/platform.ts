import type {
  DispatchedJobStatus,
  ControlHealthStatus,
  ControlServiceName
} from "./core.js";

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

export interface RustDeskListenerSnapshot {
  protocol: "tcp" | "udp";
  address: string;
  port: number;
}

export interface RustDeskServiceSnapshot {
  hbbsServiceName: string;
  hbbsEnabled: boolean;
  hbbsActive: boolean;
  hbbrServiceName: string;
  hbbrEnabled: boolean;
  hbbrActive: boolean;
  publicKey?: string;
  publicKeyPath?: string;
  listeners: RustDeskListenerSnapshot[];
  checkedAt: string;
}

export interface MailManagedDomainSnapshot {
  domainName: string;
  mailHost: string;
  webmailHostname: string;
  mtaStsHostname: string;
  deliveryRole: "primary" | "standby";
  mailboxCount: number;
  aliasCount: number;
  dkimSelector?: string;
  dkimDnsTxtValue?: string;
  dkimAvailable?: boolean;
  dmarcReportAddress?: string;
  tlsReportAddress?: string;
  mtaStsMode?: "enforce" | "testing" | "none";
  mtaStsMaxAgeSeconds?: number;
  runtimeConfigPresent?: boolean;
  maildirRoot?: string;
  mailboxesReady?: boolean;
  webmailDocumentRoot?: string;
  webmailDocumentPresent?: boolean;
  mtaStsDocumentRoot?: string;
  mtaStsPolicyPath?: string;
  mtaStsPolicyPresent?: boolean;
  promotionReady?: boolean;
  promotionBlockers?: string[];
}

export interface MailQueueSnapshot {
  messageCount: number;
  activeCount: number;
  deferredCount: number;
  holdCount: number;
  incomingCount: number;
  maildropCount: number;
  corruptCount?: number;
  topDeferReasons: string[];
}

export interface MailDeliveryFailureSnapshot {
  occurredAt: string;
  status: "deferred" | "bounced" | "expired";
  queueId?: string;
  recipient?: string;
  relay?: string;
  reason: string;
}

export interface MailServiceSnapshot {
  postfixServiceName: string;
  postfixEnabled: boolean;
  postfixActive: boolean;
  postfixInstalled?: boolean;
  dovecotServiceName: string;
  dovecotEnabled: boolean;
  dovecotActive: boolean;
  dovecotInstalled?: boolean;
  rspamdServiceName: string;
  rspamdEnabled: boolean;
  rspamdActive: boolean;
  rspamdInstalled?: boolean;
  redisServiceName: string;
  redisEnabled: boolean;
  redisActive: boolean;
  redisInstalled?: boolean;
  configRoot?: string;
  statePath?: string;
  desiredStatePresent?: boolean;
  runtimeConfigPresent?: boolean;
  vmailRoot?: string;
  policyRoot?: string;
  dkimRoot?: string;
  roundcubeRoot?: string;
  roundcubeSharedRoot?: string;
  roundcubeConfigPath?: string;
  roundcubeDatabasePath?: string;
  roundcubeDeployment?: "packaged" | "placeholder" | "absent";
  webmailHealthy?: boolean;
  firewallServiceName?: string;
  firewallConfigured?: boolean;
  configuredMailboxCount?: number;
  missingMailboxCount?: number;
  resetRequiredMailboxCount?: number;
  policyDocumentCount?: number;
  healthyPolicyDocumentCount?: number;
  queue?: MailQueueSnapshot;
  recentDeliveryFailures?: MailDeliveryFailureSnapshot[];
  managedDomains: MailManagedDomainSnapshot[];
  checkedAt: string;
}

export interface AppServiceSnapshot {
  appSlug: string;
  serviceName: string;
  containerName: string;
  enabled: boolean;
  active: boolean;
  image?: string;
  backendPort?: number;
  stateRoot?: string;
  envFilePath?: string;
  quadletPath?: string;
  checkedAt: string;
}

export interface NodeRuntimeSnapshot {
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  mail?: MailServiceSnapshot;
}

export interface ControlHealthSnapshot {
  service: ControlServiceName;
  status: ControlHealthStatus;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface NodeHealthSnapshot {
  nodeId: string;
  hostname: string;
  desiredRole: "inventory";
  currentVersion?: string;
  desiredVersion?: string;
  lastSeenAt?: string;
  pendingJobCount: number;
  latestJobStatus?: DispatchedJobStatus;
  latestJobSummary?: string;
  driftedResourceCount?: number;
  primaryZoneCount?: number;
  primaryAppCount?: number;
  backupPolicyCount?: number;
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  mail?: MailServiceSnapshot;
}

export interface RustDeskNodeSummary {
  nodeId: string;
  hostname: string;
  role?: "primary" | "secondary";
  dnsTarget?: string;
  lastSeenAt?: string;
  rustdesk?: RustDeskServiceSnapshot;
}

export interface RustDeskOverview {
  generatedAt: string;
  publicHostname?: string;
  txtRecordFqdn?: string;
  txtRecordValue?: string;
  publicKey?: string;
  keyConsistency: "match" | "mismatch" | "unknown";
  nodes: RustDeskNodeSummary[];
}

export interface RustDeskPublicConnectionInfo {
  generatedAt: string;
  publicHostname?: string;
  publicKey?: string;
  relayHostname?: string;
  txtRecordFqdn?: string;
  txtRecordValue?: string;
  status: "ready" | "incomplete";
}

export interface ControlApiMetadata {
  product: "SimpleHost";
  service: ControlServiceName;
  runtime: "nodejs";
  version: string;
}

export function createControlApiMetadata(
  service: ControlServiceName,
  version: string
): ControlApiMetadata {
  return {
    product: "SimpleHost",
    service,
    runtime: "nodejs",
    version
  };
}
