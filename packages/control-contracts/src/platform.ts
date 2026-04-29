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

export interface FirewallPortRuleSnapshot {
  protocol: string;
  port: number;
}

export interface FirewalldZoneSnapshot {
  zone: string;
  target?: string;
  interfaces: string[];
  sources: string[];
  services: string[];
  ports: FirewallPortRuleSnapshot[];
  richRules: string[];
  masquerade?: boolean;
}

export interface HostFirewallSnapshot {
  serviceName: string;
  enabled: boolean;
  active: boolean;
  state?: string;
  defaultZone?: string;
  zones: FirewalldZoneSnapshot[];
  checkedAt: string;
}

export interface Fail2BanJailSnapshot {
  jail: string;
  currentFailed?: number;
  totalFailed?: number;
  currentBanned?: number;
  totalBanned?: number;
  bannedIps: string[];
  actions: string[];
  bantimeSeconds?: number;
  findtimeSeconds?: number;
  maxRetry?: number;
}

export interface Fail2BanSnapshot {
  serviceName: string;
  enabled: boolean;
  active: boolean;
  version?: string;
  jails: Fail2BanJailSnapshot[];
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

export interface MailPortListenerSnapshot {
  label: string;
  protocol: "tcp";
  port: number;
  exposure: "public" | "local";
  addresses: string[];
  listening: boolean;
}

export interface MailMilterSnapshot {
  endpoint: string;
  postfixConfigured: boolean;
  rspamdConfigPresent: boolean;
  listenerReady: boolean;
}

export interface MailboxUsageSnapshot {
  address: string;
  domainName: string;
  localPart: string;
  maildirPath: string;
  usedBytes?: number;
  checkedAt: string;
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
  firewallExpectedPorts?: number[];
  firewallOpenPorts?: number[];
  portListeners?: MailPortListenerSnapshot[];
  milter?: MailMilterSnapshot;
  configuredMailboxCount?: number;
  missingMailboxCount?: number;
  resetRequiredMailboxCount?: number;
  policyDocumentCount?: number;
  healthyPolicyDocumentCount?: number;
  queue?: MailQueueSnapshot;
  recentDeliveryFailures?: MailDeliveryFailureSnapshot[];
  mailboxUsage?: MailboxUsageSnapshot[];
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

export interface ServiceUnitSnapshot {
  serviceName: string;
  description?: string;
  loadState?: string;
  activeState?: string;
  subState?: string;
  unitFileState?: string;
  fragmentPath?: string;
  mainPid?: number;
  restartCount?: number;
  exitStatus?: number;
  activeEnterTimestamp?: string;
  checkedAt: string;
}

export interface SystemServicesSnapshot {
  units: ServiceUnitSnapshot[];
  checkedAt: string;
}

export interface JournalLogEntrySnapshot {
  unit?: string;
  priority?: number;
  priorityLabel?: string;
  occurredAt: string;
  message: string;
}

export interface SystemLogsSnapshot {
  entries: JournalLogEntrySnapshot[];
  checkedAt: string;
}

export interface TlsCertificateSnapshot {
  name: string;
  path: string;
  subject?: string;
  issuer?: string;
  serial?: string;
  fingerprintSha256?: string;
  notBefore?: string;
  notAfter?: string;
  dnsNames: string[];
  checkedAt: string;
}

export interface TlsCertificatesSnapshot {
  certificates: TlsCertificateSnapshot[];
  checkedAt: string;
}

export interface FilesystemUsageSnapshot {
  filesystem: string;
  mountpoint: string;
  type?: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent?: number;
  totalInodes?: number;
  usedInodes?: number;
  availableInodes?: number;
  inodeUsedPercent?: number;
}

export interface StoragePathUsageSnapshot {
  path: string;
  usedBytes?: number;
  filesystem?: string;
  mountpoint?: string;
  checkedAt: string;
}

export interface StorageSnapshot {
  filesystems: FilesystemUsageSnapshot[];
  paths: StoragePathUsageSnapshot[];
  checkedAt: string;
}

export interface NetworkInterfaceAddressSnapshot {
  family: string;
  address: string;
  prefixLength?: number;
  scope?: string;
}

export interface NetworkInterfaceSnapshot {
  name: string;
  state?: string;
  mtu?: number;
  macAddress?: string;
  addresses: NetworkInterfaceAddressSnapshot[];
}

export interface NetworkRouteSnapshot {
  destination: string;
  gateway?: string;
  device?: string;
  protocol?: string;
  scope?: string;
  source?: string;
  metric?: number;
  family?: string;
}

export interface NetworkListenerSnapshot {
  protocol: string;
  state?: string;
  localAddress: string;
  port?: number;
  process?: string;
}

export interface NetworkSnapshot {
  interfaces: NetworkInterfaceSnapshot[];
  routes: NetworkRouteSnapshot[];
  listeners: NetworkListenerSnapshot[];
  checkedAt: string;
}

export interface ProcessEntrySnapshot {
  pid: number;
  user?: string;
  command: string;
  cpuPercent?: number;
  memoryPercent?: number;
  residentMemoryBytes?: number;
  elapsedSeconds?: number;
}

export interface SystemProcessesSnapshot {
  loadAverage1m?: number;
  loadAverage5m?: number;
  loadAverage15m?: number;
  uptimeSeconds?: number;
  totalMemoryBytes?: number;
  availableMemoryBytes?: number;
  processes: ProcessEntrySnapshot[];
  checkedAt: string;
}

export interface ContainerPortMappingSnapshot {
  hostIp?: string;
  hostPort?: number;
  containerPort?: number;
  protocol?: string;
  raw?: string;
}

export interface ContainerSnapshot {
  id: string;
  name?: string;
  image?: string;
  state?: string;
  status?: string;
  createdAt?: string;
  startedAt?: string;
  ports: ContainerPortMappingSnapshot[];
  networks: string[];
}

export interface ContainerRuntimeSnapshot {
  containers: ContainerSnapshot[];
  checkedAt: string;
}

export interface SystemTimerSnapshot {
  timerName: string;
  activates?: string;
  nextElapse?: string;
  lastTrigger?: string;
  left?: string;
  passed?: string;
}

export interface SystemTimersSnapshot {
  timers: SystemTimerSnapshot[];
  checkedAt: string;
}

export interface NodeRuntimeSnapshot {
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  firewall?: HostFirewallSnapshot;
  fail2ban?: Fail2BanSnapshot;
  services?: SystemServicesSnapshot;
  logs?: SystemLogsSnapshot;
  tls?: TlsCertificatesSnapshot;
  storage?: StorageSnapshot;
  network?: NetworkSnapshot;
  processes?: SystemProcessesSnapshot;
  containers?: ContainerRuntimeSnapshot;
  timers?: SystemTimersSnapshot;
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
  firewall?: HostFirewallSnapshot;
  fail2ban?: Fail2BanSnapshot;
  services?: SystemServicesSnapshot;
  logs?: SystemLogsSnapshot;
  tls?: TlsCertificatesSnapshot;
  storage?: StorageSnapshot;
  network?: NetworkSnapshot;
  processes?: SystemProcessesSnapshot;
  containers?: ContainerRuntimeSnapshot;
  timers?: SystemTimersSnapshot;
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
