import type {
  AuditEventSummary,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthLogoutResponse,
  AuthenticatedUserSummary,
  BackupRunRecordRequest,
  BackupRunSummary,
  BackupsOverview,
  InstalledPackageSummary,
  ControlPlaneStateSnapshot,
  CreateUserRequest,
  CreateUserResponse,
  DatabaseReconcileRequest,
  DesiredStateApplyRequest,
  DesiredStateApplyResponse,
  DesiredStateExportResponse,
  DispatchedJobEnvelope,
  Fail2BanApplyRequest,
  FirewallApplyRequest,
  InventoryImportRequest,
  InventoryImportSummary,
  InventoryStateSnapshot,
  JobClaimRequest,
  JobClaimResponse,
  JobDispatchResponse,
  JobHistoryEntry,
  MailboxCredentialMutationResult,
  MailboxCredentialReveal,
  MailboxWebmailAutologin,
  JobReportRequest,
  MailOverview,
  NodeHealthSnapshot,
  NodeRegistrationRequest,
  NodeRegistrationResponse,
  OperationsOverview,
  PackageInventoryRefreshRequest,
  PackageInventorySnapshot,
  PackageInstallRequest,
  ControlGlobalRole,
  ReconciliationRunSummary,
  ResetMailboxCredentialRequest,
  RotateMailboxCredentialRequest,
  ResourceDriftSummary,
  TenantMembershipRole,
  TenantMembershipSummary,
  UpsertMailAliasRequest,
  UpsertMailDomainRequest,
  UpsertMailPolicyRequest,
  UpsertMailboxQuotaRequest,
  UpsertMailboxRequest,
  AppReconcileRequest,
  CodeServerUpdateRequest,
  DnsRecordPayload,
  ProxyRenderPayload,
  MailSyncPayload,
  RegisteredNodeState,
  ReportedJobResult
} from "@simplehost/control-contracts";

import type { StoredPasswordHash } from "./auth.js";

export interface NodeRow {
  node_id: string;
  hostname: string;
  version: string;
  supported_job_kinds: unknown;
  accepted_at: Date | string;
  last_seen_at: Date | string;
  runtime_snapshot?: Record<string, unknown> | null;
}

export interface JobRow {
  id: string;
  desired_state_version: string;
  kind: string;
  node_id: string;
  created_at: Date | string;
  payload: Record<string, unknown>;
  resource_key?: string | null;
  resource_kind?: string | null;
  payload_hash?: string | null;
}

export interface ResultRow {
  job_id: string;
  kind: string;
  node_id: string;
  status: string;
  summary: string;
  details: Record<string, unknown> | null;
  completed_at: Date | string;
}

export interface NodeCredentialRow {
  node_id: string;
  token_hash: string;
}

export interface UserRow {
  user_id: string;
  email: string;
  display_name: string;
  status: string;
}

export interface UserCredentialRow {
  user_id: string;
  password_hash: string;
  password_salt: string;
  password_params: StoredPasswordHash["params"];
}

export interface SessionRow {
  session_id: string;
  user_id: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export interface UserGlobalRoleRow {
  role: string;
}

export interface UserMembershipRow {
  tenant_id: string;
  tenant_slug: string;
  tenant_display_name: string;
  role: string;
}

export interface InventoryImportRow {
  import_id: string;
  source_path: string;
  summary: Record<string, unknown>;
  imported_at: Date | string;
}

export interface InventoryExportRow {
  event_id: string;
  payload: Record<string, unknown> | null;
  occurred_at: Date | string;
}

export interface InventoryNodeRow {
  node_id: string;
  hostname: string;
  public_ipv4: string;
  wireguard_address: string;
}

export interface InventoryZoneRow {
  zone_id: string;
  zone_name: string;
  tenant_slug: string;
  primary_node_id: string;
}

export interface InventoryAppRow {
  slug: string;
  tenant_slug: string;
  zone_name: string;
  primary_node_id: string;
  standby_node_id: string | null;
  canonical_domain: string;
  aliases: string[];
  backend_port: number;
  runtime_image: string;
  storage_root: string;
  mode: string;
}

export interface InventoryDatabaseRow {
  database_id: string;
  app_slug: string;
  engine: "postgresql" | "mariadb";
  database_name: string;
  database_user: string;
  primary_node_id: string;
  standby_node_id: string | null;
  pending_migration_to: "postgresql" | "mariadb" | null;
  migration_completed_from: "postgresql" | "mariadb" | null;
  migration_completed_at: Date | string | null;
  desired_password: Record<string, unknown> | null;
}

export interface ZoneDispatchRow {
  zone_name: string;
  primary_node_id: string;
  hostname: string;
  public_ipv4: string;
  wireguard_address: string;
  desired_updated_at: Date | string;
}

export interface AppDispatchRow {
  app_id: string;
  slug: string;
  backend_port: number;
  runtime_image: string;
  primary_node_id: string;
  standby_node_id: string | null;
  mode: string;
  zone_name: string;
  canonical_domain: string;
  aliases: string[];
  storage_root: string;
}

export interface AppContainerDispatchRow {
  slug: string;
  backend_port: number;
  runtime_image: string;
  storage_root: string;
  primary_node_id: string;
  standby_node_id: string | null;
  mode: string;
  canonical_domain: string;
  aliases: string[];
  database_engine: "postgresql" | "mariadb" | null;
  database_name: string | null;
  database_user: string | null;
  database_primary_node_id: string | null;
  database_primary_wireguard_address: string | null;
  desired_password: Record<string, unknown> | null;
}

export interface DatabaseDispatchRow {
  database_id: string;
  slug: string;
  engine: "postgresql" | "mariadb";
  database_name: string;
  database_user: string;
  primary_node_id: string;
  desired_password: Record<string, unknown> | null;
}

export interface InventoryRecordRow {
  zone_name: string;
  name: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
  value: string;
  ttl: number;
}

export interface BackupPolicyRow {
  policy_slug: string;
  tenant_slug: string;
  target_node_id: string;
  schedule: string;
  retention_days: number;
  storage_location: string;
  resource_selectors: string[];
}

export interface MailDomainRow {
  domain_name: string;
  tenant_slug: string;
  zone_name: string;
  primary_node_id: string;
  standby_node_id: string | null;
  mail_host: string;
  dkim_selector: string;
}

export interface MailPolicyRow {
  policy_id: string;
  reject_threshold: number | string;
  add_header_threshold: number | string;
  greylist_threshold: number | string | null;
  sender_allowlist: string[];
  sender_denylist: string[];
  rate_limit_burst: number | null;
  rate_limit_period_seconds: number | null;
}

export interface MailboxRow {
  address: string;
  domain_name: string;
  local_part: string;
  primary_node_id: string;
  standby_node_id: string | null;
  desired_password: Record<string, unknown> | null;
  credential_state: "missing" | "configured" | "reset_required" | null;
  credential_updated_at: Date | string | null;
}

export interface MailAliasRow {
  address: string;
  domain_name: string;
  local_part: string;
  destinations: string[];
}

export interface MailboxQuotaRow {
  mailbox_address: string;
  storage_bytes: number | string;
}

export interface MailDnsDomainRow {
  domain_name: string;
  tenant_slug: string;
  mail_host: string;
  dkim_selector: string;
  primary_node_id: string;
  public_ipv4: string;
}

export interface MailProxyDispatchRow {
  domain_name: string;
  tenant_slug: string;
  primary_node_id: string;
  standby_node_id: string | null;
}

export interface BackupRunRow {
  run_id: string;
  policy_slug: string;
  node_id: string;
  status: "running" | "succeeded" | "failed";
  summary: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  details: Record<string, unknown> | null;
}

export interface DriftStatusRow {
  id: string;
  payload_hash: string | null;
  completed_at: Date | string | null;
  status: string | null;
  summary: string | null;
}

export interface ReconciliationRunRow {
  run_id: string;
  desired_state_version: string;
  generated_job_count: number;
  skipped_job_count: number;
  missing_credential_count: number;
  summary: Record<string, unknown>;
  started_at: Date | string;
  completed_at: Date | string;
}

export interface JobHistoryRow {
  id: string;
  desired_state_version: string;
  kind: string;
  node_id: string;
  created_at: Date | string;
  claimed_at: Date | string | null;
  completed_at: Date | string | null;
  payload: Record<string, unknown>;
  status: string | null;
  summary: string | null;
  details: Record<string, unknown> | null;
  dispatch_reason: string | null;
  resource_key: string | null;
}

export interface NodeHealthRow {
  node_id: string;
  hostname: string;
  current_version: string | null;
  last_seen_at: Date | string | null;
  pending_job_count: number;
  latest_job_status: string | null;
  latest_job_summary: string | null;
  drifted_resource_count: number;
  primary_zone_count: number;
  primary_app_count: number;
  backup_policy_count: number;
  runtime_snapshot?: Record<string, unknown> | null;
}

export interface AppServiceGapRow {
  slug: string;
  primary_node_id: string;
  standby_node_id: string | null;
  mode: string;
}

export interface AuditEventRow {
  event_id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: Date | string;
}

export interface InstalledPackageRow {
  node_id: string;
  hostname: string;
  package_name: string;
  epoch: string | null;
  version: string;
  release: string;
  arch: string;
  nevra: string;
  source: string | null;
  installed_at: Date | string | null;
  last_collected_at: Date | string;
}

export interface AuditEventInput {
  actorType: string;
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export interface ControlPlaneStoreOptions {
  pollIntervalMs?: number;
  bootstrapEnrollmentToken: string | null;
  sessionTtlSeconds: number;
  bootstrapAdminEmail: string | null;
  bootstrapAdminPassword: string | null;
  bootstrapAdminName: string | null;
  defaultInventoryImportPath: string;
  jobPayloadSecret: string | null;
}

export interface ControlPlaneStore {
  registerNode(
    request: NodeRegistrationRequest,
    presentedToken: string | null
  ): Promise<NodeRegistrationResponse>;
  claimJobs(
    request: JobClaimRequest,
    presentedToken: string | null
  ): Promise<JobClaimResponse>;
  reportJob(
    request: JobReportRequest,
    presentedToken: string | null
  ): Promise<{ accepted: true }>;
  loginUser(request: AuthLoginRequest): Promise<AuthLoginResponse>;
  getCurrentUser(presentedToken: string | null): Promise<AuthenticatedUserSummary>;
  logoutUser(presentedToken: string | null): Promise<AuthLogoutResponse>;
  createUser(
    request: CreateUserRequest,
    presentedToken: string | null
  ): Promise<CreateUserResponse>;
  listUsers(presentedToken: string | null): Promise<AuthenticatedUserSummary[]>;
  importInventory(
    request: InventoryImportRequest,
    presentedToken: string | null
  ): Promise<InventoryImportSummary>;
  applyDesiredState(
    request: DesiredStateApplyRequest,
    presentedToken: string | null
  ): Promise<DesiredStateApplyResponse>;
  exportDesiredState(
    presentedToken: string | null
  ): Promise<DesiredStateExportResponse>;
  getInventorySnapshot(presentedToken: string | null): Promise<InventoryStateSnapshot>;
  dispatchZoneSync(
    zoneName: string,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchAppReconcile(
    appSlug: string,
    request: AppReconcileRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  getAppProxyPayload(
    appSlug: string,
    presentedToken: string | null
  ): Promise<ProxyRenderPayload>;
  dispatchDatabaseReconcile(
    appSlug: string,
    request: DatabaseReconcileRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchCodeServerUpdate(
    request: CodeServerUpdateRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchPackageInventoryRefresh(
    request: PackageInventoryRefreshRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchPackageInstall(
    request: PackageInstallRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchFirewallApply(
    request: FirewallApplyRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  dispatchFail2BanApply(
    request: Fail2BanApplyRequest,
    presentedToken: string | null
  ): Promise<JobDispatchResponse>;
  runReconciliationCycle(presentedToken?: string | null): Promise<ReconciliationRunSummary>;
  getOperationsOverview(presentedToken: string | null): Promise<OperationsOverview>;
  getResourceDrift(presentedToken: string | null): Promise<ResourceDriftSummary[]>;
  getNodeHealth(presentedToken: string | null): Promise<NodeHealthSnapshot[]>;
  getPackageInventory(presentedToken: string | null): Promise<PackageInventorySnapshot>;
  getRustDeskNodeHealth(): Promise<NodeHealthSnapshot[]>;
  getMailOverview(presentedToken: string | null): Promise<MailOverview>;
  upsertMailPolicy(
    request: UpsertMailPolicyRequest,
    presentedToken: string | null
  ): Promise<MailOverview>;
  upsertMailDomain(
    request: UpsertMailDomainRequest,
    presentedToken: string | null
  ): Promise<MailOverview>;
  deleteMailDomain(
    domainName: string,
    presentedToken: string | null
  ): Promise<MailOverview>;
  upsertMailbox(
    request: UpsertMailboxRequest,
    presentedToken: string | null
  ): Promise<MailboxCredentialMutationResult>;
  deleteMailbox(
    address: string,
    presentedToken: string | null
  ): Promise<MailOverview>;
  upsertMailAlias(
    request: UpsertMailAliasRequest,
    presentedToken: string | null
  ): Promise<MailOverview>;
  deleteMailAlias(
    address: string,
    presentedToken: string | null
  ): Promise<MailOverview>;
  upsertMailboxQuota(
    request: UpsertMailboxQuotaRequest,
    presentedToken: string | null
  ): Promise<MailOverview>;
  resetMailboxCredential(
    request: ResetMailboxCredentialRequest,
    presentedToken: string | null
  ): Promise<MailboxCredentialMutationResult>;
  rotateMailboxCredential(
    request: RotateMailboxCredentialRequest,
    presentedToken: string | null
  ): Promise<MailboxCredentialMutationResult>;
  getMailboxWebmailAutologin(
    mailboxAddress: string,
    presentedToken: string | null
  ): Promise<MailboxWebmailAutologin>;
  consumeMailboxCredentialReveal(
    revealId: string,
    presentedToken: string | null
  ): Promise<MailboxCredentialReveal | null>;
  deleteMailboxQuota(
    mailboxAddress: string,
    presentedToken: string | null
  ): Promise<MailOverview>;
  listJobHistory(
    presentedToken: string | null,
    limit?: number
  ): Promise<JobHistoryEntry[]>;
  listAuditEvents(
    presentedToken: string | null,
    limit?: number
  ): Promise<AuditEventSummary[]>;
  getBackupsOverview(presentedToken: string | null): Promise<BackupsOverview>;
  recordBackupRun(
    request: BackupRunRecordRequest,
    presentedToken: string | null
  ): Promise<BackupRunSummary>;
  getStateSnapshot(): Promise<ControlPlaneStateSnapshot>;
  close(): Promise<void>;
}

export type ControlPlaneAuthMethods = Pick<
  ControlPlaneStore,
  | "registerNode"
  | "claimJobs"
  | "reportJob"
  | "loginUser"
  | "getCurrentUser"
  | "logoutUser"
  | "createUser"
  | "listUsers"
>;

export type ControlPlaneSpecMethods = Pick<
  ControlPlaneStore,
  | "importInventory"
  | "getInventorySnapshot"
  | "applyDesiredState"
  | "exportDesiredState"
  | "getMailOverview"
  | "upsertMailPolicy"
  | "upsertMailDomain"
  | "deleteMailDomain"
  | "upsertMailbox"
  | "deleteMailbox"
  | "upsertMailAlias"
  | "deleteMailAlias"
  | "upsertMailboxQuota"
  | "resetMailboxCredential"
  | "rotateMailboxCredential"
  | "getMailboxWebmailAutologin"
  | "consumeMailboxCredentialReveal"
  | "deleteMailboxQuota"
>;

export type ControlPlaneOperationsMethods = Pick<
  ControlPlaneStore,
  | "dispatchZoneSync"
  | "dispatchAppReconcile"
  | "getAppProxyPayload"
  | "dispatchDatabaseReconcile"
  | "dispatchCodeServerUpdate"
  | "dispatchPackageInventoryRefresh"
  | "dispatchPackageInstall"
  | "dispatchFirewallApply"
  | "dispatchFail2BanApply"
  | "runReconciliationCycle"
  | "getOperationsOverview"
  | "getResourceDrift"
  | "getNodeHealth"
  | "getPackageInventory"
  | "getRustDeskNodeHealth"
  | "listJobHistory"
  | "listAuditEvents"
  | "getBackupsOverview"
  | "recordBackupRun"
  | "getStateSnapshot"
>;

export interface QueuedDispatchJob {
  envelope: DispatchedJobEnvelope;
  resourceKey: string;
  resourceKind: string;
  payloadHash: string;
}

export class NodeAuthorizationError extends Error {
  constructor(message = "Node authorization failed.") {
    super(message);
    this.name = "NodeAuthorizationError";
  }
}

export class UserAuthorizationError extends Error {
  constructor(message = "User authorization failed.") {
    super(message);
    this.name = "UserAuthorizationError";
  }
}

export type {
  DnsRecordPayload,
  MailSyncPayload,
  ControlGlobalRole,
  ProxyRenderPayload,
  RegisteredNodeState,
  ReportedJobResult,
  TenantMembershipRole,
  TenantMembershipSummary
};
