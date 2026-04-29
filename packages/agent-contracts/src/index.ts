export const supportedJobKinds = [
  "dns.sync",
  "proxy.render",
  "certificate.renew",
  "container.reconcile",
  "postgres.reconcile",
  "mariadb.reconcile",
  "code-server.update",
  "package.inventory.collect",
  "package.install",
  "firewall.apply",
  "fail2ban.apply",
  "backup.trigger",
  "mail.sync"
] as const;

export type AgentJobKind = (typeof supportedJobKinds)[number];
export type AgentJobStatus = "applied" | "skipped" | "failed";

export interface AgentJobEnvelope {
  id: string;
  desiredStateVersion: string;
  kind: AgentJobKind;
  nodeId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface AgentJobResult {
  jobId: string;
  kind: AgentJobKind;
  nodeId: string;
  status: AgentJobStatus;
  summary: string;
  details?: Record<string, unknown>;
  completedAt: string;
}

export interface AgentNodeSnapshot {
  nodeId: string;
  hostname: string;
  status: "ready";
  stateDir: string;
  reportBufferDir: string;
  generatedAt: string;
  nodeToken?: string;
}

export interface AgentNodeRegistrationRequest {
  nodeId: string;
  hostname: string;
  version: string;
  supportedJobKinds: AgentJobKind[];
  generatedAt: string;
  runtimeSnapshot?: AgentNodeRuntimeSnapshot;
}

export interface AgentNodeRegistrationResponse {
  nodeId: string;
  acceptedAt: string;
  pollIntervalMs: number;
  nodeToken?: string;
}

export interface AgentJobClaimRequest {
  nodeId: string;
  hostname: string;
  version: string;
  maxJobs: number;
  runtimeSnapshot?: AgentNodeRuntimeSnapshot;
}

export interface AgentJobClaimResponse {
  nodeId: string;
  claimedAt: string;
  jobs: AgentJobEnvelope[];
}

export interface AgentJobReportRequest {
  nodeId: string;
  result: AgentJobResult;
}

export interface AgentSpoolEntry {
  schemaVersion: 1;
  job: AgentJobEnvelope;
  state: "claimed" | "executed";
  claimedAt: string;
  executedAt?: string;
  resultStatus?: AgentJobStatus;
}

export interface AgentBufferedReport {
  schemaVersion: 1;
  result: AgentJobResult;
  bufferedAt: string;
  deliveryAttempts: number;
  lastDeliveryError?: string;
}

export function isSupportedJobKind(value: string): value is AgentJobKind {
  return supportedJobKinds.includes(value as AgentJobKind);
}

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
  deliveryRole?: "primary" | "secondary";
  primaryAddresses?: string[];
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

export interface FirewallApplyPayload {
  installPackage?: boolean;
  enableService?: boolean;
  applyPublicZone?: boolean;
  applyWireGuardZone?: boolean;
  reload?: boolean;
}

export interface Fail2BanApplyPayload {
  installPackage?: boolean;
  applySshdJail?: boolean;
  enableService?: boolean;
  restartService?: boolean;
}

export interface InstalledPackageSummary {
  packageName: string;
  epoch?: string;
  version: string;
  release: string;
  arch: string;
  nevra: string;
  source?: string;
  installedAt?: string;
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

export interface MailSyncMailboxPayload {
  address: string;
  localPart: string;
  credentialState?: "missing" | "configured" | "reset_required";
  desiredPassword?: string;
  quotaBytes?: number;
}

export interface MailSyncAliasPayload {
  address: string;
  localPart: string;
  destinations: string[];
}

export interface MailSyncPolicyRateLimitPayload {
  burst: number;
  periodSeconds: number;
}

export interface MailSyncPolicyPayload {
  rejectThreshold: number;
  addHeaderThreshold: number;
  greylistThreshold?: number;
  senderAllowlist: string[];
  senderDenylist: string[];
  rateLimit?: MailSyncPolicyRateLimitPayload;
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

export interface AgentNodeRuntimeSnapshot {
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  firewall?: HostFirewallSnapshot;
  fail2ban?: Fail2BanSnapshot;
  services?: SystemServicesSnapshot;
  logs?: SystemLogsSnapshot;
  mail?: MailServiceSnapshot;
}

export interface MailSyncPayload {
  policy: MailSyncPolicyPayload;
  domains: MailSyncDomainPayload[];
}

export function isProxyRenderPayload(value: unknown): value is ProxyRenderPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  const hasDocumentRoot = typeof payload.documentRoot === "string";
  const hasProxyPassUrl = typeof payload.proxyPassUrl === "string";
  return (
    typeof payload.vhostName === "string" &&
    typeof payload.serverName === "string" &&
    (hasDocumentRoot || hasProxyPassUrl) &&
    (payload.serverAliases === undefined ||
      (Array.isArray(payload.serverAliases) &&
        payload.serverAliases.every((item) => typeof item === "string"))) &&
    (payload.proxyPreserveHost === undefined ||
      typeof payload.proxyPreserveHost === "boolean") &&
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
    payload.nameservers.every((item) => typeof item === "string") &&
    (payload.deliveryRole === undefined ||
      payload.deliveryRole === "primary" ||
      payload.deliveryRole === "secondary") &&
    (payload.primaryAddresses === undefined ||
      (Array.isArray(payload.primaryAddresses) &&
        payload.primaryAddresses.every((item) => typeof item === "string")))
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

export function isContainerReconcilePayload(
  value: unknown
): value is ContainerReconcilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const environment = payload.environment;

  return (
    typeof payload.serviceName === "string" &&
    typeof payload.containerName === "string" &&
    typeof payload.image === "string" &&
    (payload.description === undefined || typeof payload.description === "string") &&
    (payload.exec === undefined || typeof payload.exec === "string") &&
    (payload.network === undefined || typeof payload.network === "string") &&
    (payload.publishPorts === undefined ||
      (Array.isArray(payload.publishPorts) &&
        payload.publishPorts.every((item) => typeof item === "string"))) &&
    (payload.volumes === undefined ||
      (Array.isArray(payload.volumes) &&
        payload.volumes.every((item) => typeof item === "string"))) &&
    (payload.hostDirectories === undefined ||
      (Array.isArray(payload.hostDirectories) &&
        payload.hostDirectories.every((item) => typeof item === "string"))) &&
    (environment === undefined ||
      (!Array.isArray(environment) &&
        environment !== null &&
        Object.values(environment as Record<string, unknown>).every(
          (item) => typeof item === "string"
        ))) &&
    (payload.envFileName === undefined || typeof payload.envFileName === "string") &&
    (payload.restart === undefined ||
      payload.restart === "always" ||
      payload.restart === "on-failure" ||
      payload.restart === "no") &&
    (payload.restartSec === undefined || typeof payload.restartSec === "number") &&
    (payload.wantedBy === undefined || typeof payload.wantedBy === "string") &&
    (payload.enable === undefined || typeof payload.enable === "boolean") &&
    (payload.start === undefined || typeof payload.start === "boolean")
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

export function isPackageInventoryCollectPayload(
  value: unknown
): value is PackageInventoryCollectPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    payload.includePackagePatterns === undefined ||
    (Array.isArray(payload.includePackagePatterns) &&
      payload.includePackagePatterns.every((item) => typeof item === "string"))
  );
}

export function isPackageInstallPayload(
  value: unknown
): value is PackageInstallPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const hasPackageNames =
    Array.isArray(payload.packageNames) &&
    payload.packageNames.length > 0 &&
    payload.packageNames.every((item) => typeof item === "string");
  const hasRpmUrl = typeof payload.rpmUrl === "string" && payload.rpmUrl.length > 0;

  return (
    (hasPackageNames || hasRpmUrl) &&
    (payload.packageNames === undefined ||
      (Array.isArray(payload.packageNames) &&
        payload.packageNames.every((item) => typeof item === "string"))) &&
    (payload.rpmUrl === undefined || typeof payload.rpmUrl === "string") &&
    (payload.expectedSha256 === undefined || typeof payload.expectedSha256 === "string") &&
    (payload.allowReinstall === undefined || typeof payload.allowReinstall === "boolean")
  );
}

export function isFirewallApplyPayload(
  value: unknown
): value is FirewallApplyPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    (payload.installPackage === undefined || typeof payload.installPackage === "boolean") &&
    (payload.enableService === undefined || typeof payload.enableService === "boolean") &&
    (payload.applyPublicZone === undefined || typeof payload.applyPublicZone === "boolean") &&
    (payload.applyWireGuardZone === undefined ||
      typeof payload.applyWireGuardZone === "boolean") &&
    (payload.reload === undefined || typeof payload.reload === "boolean")
  );
}

export function isFail2BanApplyPayload(
  value: unknown
): value is Fail2BanApplyPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    (payload.installPackage === undefined || typeof payload.installPackage === "boolean") &&
    (payload.applySshdJail === undefined || typeof payload.applySshdJail === "boolean") &&
    (payload.enableService === undefined || typeof payload.enableService === "boolean") &&
    (payload.restartService === undefined || typeof payload.restartService === "boolean")
  );
}

export function isMailSyncPayload(value: unknown): value is MailSyncPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    payload.policy !== null &&
    typeof payload.policy === "object" &&
    Array.isArray(payload.domains) &&
    typeof (payload.policy as Record<string, unknown>).rejectThreshold === "number" &&
    typeof (payload.policy as Record<string, unknown>).addHeaderThreshold === "number" &&
    (((payload.policy as Record<string, unknown>).greylistThreshold === undefined) ||
      typeof (payload.policy as Record<string, unknown>).greylistThreshold === "number") &&
    Array.isArray((payload.policy as Record<string, unknown>).senderAllowlist) &&
    ((payload.policy as Record<string, unknown>).senderAllowlist as unknown[]).every(
      (item) => typeof item === "string"
    ) &&
    Array.isArray((payload.policy as Record<string, unknown>).senderDenylist) &&
    ((payload.policy as Record<string, unknown>).senderDenylist as unknown[]).every(
      (item) => typeof item === "string"
    ) &&
    (((payload.policy as Record<string, unknown>).rateLimit === undefined) ||
      (!Array.isArray((payload.policy as Record<string, unknown>).rateLimit) &&
        (payload.policy as Record<string, unknown>).rateLimit !== null &&
        typeof ((payload.policy as Record<string, unknown>).rateLimit as Record<string, unknown>)
          .burst === "number" &&
        typeof ((payload.policy as Record<string, unknown>).rateLimit as Record<string, unknown>)
          .periodSeconds === "number")) &&
    payload.domains.every((domain) => {
      if (!domain || typeof domain !== "object") {
        return false;
      }

      const candidate = domain as Record<string, unknown>;

      return (
        typeof candidate.domainName === "string" &&
        typeof candidate.tenantSlug === "string" &&
        typeof candidate.zoneName === "string" &&
        typeof candidate.mailHost === "string" &&
        typeof candidate.webmailHostname === "string" &&
        typeof candidate.mtaStsHostname === "string" &&
        typeof candidate.dkimSelector === "string" &&
        typeof candidate.dmarcReportAddress === "string" &&
        typeof candidate.tlsReportAddress === "string" &&
        (candidate.mtaStsMode === "enforce" ||
          candidate.mtaStsMode === "testing" ||
          candidate.mtaStsMode === "none") &&
        typeof candidate.mtaStsMaxAgeSeconds === "number" &&
        (candidate.deliveryRole === "primary" || candidate.deliveryRole === "standby") &&
        Array.isArray(candidate.mailboxes) &&
        candidate.mailboxes.every((mailbox) => {
          if (!mailbox || typeof mailbox !== "object") {
            return false;
          }

          const mailboxCandidate = mailbox as Record<string, unknown>;

          return (
            typeof mailboxCandidate.address === "string" &&
            typeof mailboxCandidate.localPart === "string" &&
            (mailboxCandidate.credentialState === undefined ||
              mailboxCandidate.credentialState === "missing" ||
              mailboxCandidate.credentialState === "configured" ||
              mailboxCandidate.credentialState === "reset_required") &&
            (mailboxCandidate.desiredPassword === undefined ||
              typeof mailboxCandidate.desiredPassword === "string") &&
            (mailboxCandidate.quotaBytes === undefined ||
              typeof mailboxCandidate.quotaBytes === "number")
          );
        }) &&
        Array.isArray(candidate.aliases) &&
        candidate.aliases.every((alias) => {
          if (!alias || typeof alias !== "object") {
            return false;
          }

          const aliasCandidate = alias as Record<string, unknown>;

          return (
            typeof aliasCandidate.address === "string" &&
            typeof aliasCandidate.localPart === "string" &&
            Array.isArray(aliasCandidate.destinations) &&
            aliasCandidate.destinations.every((destination) => typeof destination === "string")
          );
        })
      );
    })
  );
}
