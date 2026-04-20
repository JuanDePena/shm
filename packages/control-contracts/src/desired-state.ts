import type { DnsRecordPayload } from "./jobs.js";

export interface DesiredStateTenantInput {
  slug: string;
  displayName: string;
}

export interface DesiredStateNodeInput {
  nodeId: string;
  hostname: string;
  publicIpv4: string;
  wireguardAddress: string;
}

export interface DesiredStateZoneInput {
  zoneName: string;
  tenantSlug: string;
  primaryNodeId: string;
  records: DnsRecordPayload[];
}

export interface DesiredStateAppInput {
  slug: string;
  tenantSlug: string;
  zoneName: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  canonicalDomain: string;
  aliases: string[];
  backendPort: number;
  runtimeImage: string;
  storageRoot: string;
  mode: string;
}

export interface DesiredStateDatabaseInput {
  appSlug: string;
  engine: "postgresql" | "mariadb";
  databaseName: string;
  databaseUser: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  pendingMigrationTo?: "postgresql" | "mariadb";
  migrationCompletedFrom?: "postgresql" | "mariadb";
  migrationCompletedAt?: string;
  desiredPassword?: string;
}

export interface DesiredStateBackupPolicyInput {
  policySlug: string;
  tenantSlug: string;
  targetNodeId: string;
  schedule: string;
  retentionDays: number;
  storageLocation: string;
  resourceSelectors: string[];
}

export interface DesiredStateMailDomainInput {
  domainName: string;
  tenantSlug: string;
  zoneName: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  mailHost: string;
  dkimSelector: string;
}

export interface DesiredStateMailboxInput {
  address: string;
  domainName: string;
  localPart: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  desiredPassword?: string;
}

export interface DesiredStateMailAliasInput {
  address: string;
  domainName: string;
  localPart: string;
  destinations: string[];
}

export interface DesiredStateMailboxQuotaInput {
  mailboxAddress: string;
  storageBytes: number;
}

export interface DesiredStateSpec {
  tenants: DesiredStateTenantInput[];
  nodes: DesiredStateNodeInput[];
  zones: DesiredStateZoneInput[];
  apps: DesiredStateAppInput[];
  databases: DesiredStateDatabaseInput[];
  backupPolicies: DesiredStateBackupPolicyInput[];
  mailDomains: DesiredStateMailDomainInput[];
  mailboxes: DesiredStateMailboxInput[];
  mailAliases: DesiredStateMailAliasInput[];
  mailboxQuotas: DesiredStateMailboxQuotaInput[];
}

export interface DesiredStateApplyRequest {
  spec: DesiredStateSpec;
  reason?: string;
}

export interface DesiredStateApplySummary {
  tenantCount: number;
  nodeCount: number;
  zoneCount: number;
  recordCount: number;
  appCount: number;
  databaseCount: number;
  backupPolicyCount: number;
  mailDomainCount: number;
  mailboxCount: number;
  mailAliasCount: number;
  mailboxQuotaCount: number;
}

export interface DesiredStateApplyResponse {
  appliedAt: string;
  desiredStateVersion: string;
  summary: DesiredStateApplySummary;
}

export interface DesiredStateExportResponse {
  exportedAt: string;
  summary: DesiredStateApplySummary;
  spec: DesiredStateSpec;
  yaml: string;
}
