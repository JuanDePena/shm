import { type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { type DesiredStateTabId } from "./dashboard-routing.js";
import {
  type DesiredStateComparisonOptions,
  type DesiredStateComparisonRow,
  type DesiredStateRelatedPanelItem,
  type DesiredStateSelectOption
} from "./desired-state-shared.js";

export type DesiredStateModelCopy = {
  aliasesLabel: string;
  appColDomain: string;
  appColMode: string;
  databaseColDatabase: string;
  databaseColEngine: string;
  databaseColUser: string;
  migrationCompletedLabel: string;
  migrationPendingLabel: string;
  none: string;
  recordPreviewTitle: string;
  selectedStateLabel: string;
  storageRootLabel: string;
  targetedNodesLabel: string;
  zoneColRecordCount: string;
  zoneColZone: string;
};

export type Tenant = DashboardData["desiredState"]["spec"]["tenants"][number];
export type Node = DashboardData["desiredState"]["spec"]["nodes"][number];
export type Zone = DashboardData["desiredState"]["spec"]["zones"][number];
export type App = DashboardData["desiredState"]["spec"]["apps"][number];
export type Database = DashboardData["desiredState"]["spec"]["databases"][number];
export type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
export type Job = DashboardData["jobHistory"][number];
export type AuditEvent = DashboardData["auditEvents"][number];
export type NodeHealth = DashboardData["nodeHealth"][number];
export type DriftEntry = DashboardData["drift"][number];

export interface BuildDesiredStateModelArgs<Copy extends DesiredStateModelCopy> {
  data: DashboardData;
  copy: Copy;
  defaultTabId: DesiredStateTabId;
  focus?: string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (
    value: string,
    tone?: "default" | "success" | "danger" | "muted"
  ) => string;
  findRelatedJobs: (
    jobs: Job[],
    options: {
      resourceKeys?: string[];
      resourcePrefixes?: string[];
      nodeId?: string;
      needles?: string[];
    },
    limit?: number
  ) => Job[];
  findRelatedAuditEvents: (
    events: AuditEvent[],
    needles: string[],
    limit?: number
  ) => AuditEvent[];
  findLatestJobWithStatus: (jobs: Job[], status: Job["status"]) => Job | undefined;
  createComparisonRow: (
    label: string,
    desiredValue: string,
    appliedValue?: string | null,
    options?: DesiredStateComparisonOptions
  ) => DesiredStateComparisonRow;
  createComparisonDeltaItems: (
    copy: Copy,
    rows: DesiredStateComparisonRow[],
    limit?: number
  ) => DesiredStateRelatedPanelItem[];
  summarizeComparisonRows: (
    copy: Copy,
    rows: DesiredStateComparisonRow[]
  ) => string;
  readStringPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => string | null;
  readBooleanPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => boolean | null;
  readStringArrayPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => string[];
  readObjectArrayPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => Array<Record<string, unknown>>;
  formatDnsRecordPreview: (
    record:
      | DashboardData["desiredState"]["spec"]["zones"][number]["records"][number]
      | Record<string, unknown>
      | undefined
  ) => string;
}

export interface DesiredStateSelectionModel {
  tenantOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  zoneOptions: DesiredStateSelectOption[];
  appOptions: DesiredStateSelectOption[];
  selectedTenant: Tenant | undefined;
  selectedNode: Node | undefined;
  selectedZone: Zone | undefined;
  selectedApp: App | undefined;
  selectedDatabase: Database | undefined;
  selectedBackupPolicy: BackupPolicy | undefined;
  selectedDatabaseApp: App | undefined;
  selectedAppZone: Zone | undefined;
  selectedTenantApps: App[];
  selectedTenantZones: Zone[];
  selectedTenantBackupPolicies: BackupPolicy[];
  selectedTenantBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedNodePrimaryApps: App[];
  selectedNodePrimaryZones: Zone[];
  selectedNodeBackupPolicies: BackupPolicy[];
  selectedNodeBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedZoneApps: App[];
  selectedZoneBackupPolicies: BackupPolicy[];
  selectedZoneBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedAppDatabases: Database[];
  selectedAppBackupPolicies: BackupPolicy[];
  selectedAppBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedBackupTenantApps: App[];
  selectedBackupTenantZones: Zone[];
  selectedBackupTenantDatabases: Database[];
  selectedDatabaseBackupPolicies: BackupPolicy[];
  selectedDatabaseBackupRuns: DashboardData["backups"]["latestRuns"];
  tenantCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
  nodeCounts: {
    apps: number;
    zones: number;
    backupPolicies: number;
  };
}

export interface DesiredStateTableModel {
  tenantTableRows: DataTableRow[];
  nodeTableRows: DataTableRow[];
  zoneTableRows: DataTableRow[];
  appTableRows: DataTableRow[];
  proxyTableRows: DataTableRow[];
  databaseTableRows: DataTableRow[];
  backupTableRows: DataTableRow[];
}

export interface DesiredStateActivityModel {
  selectedTenantJobs: Job[];
  selectedTenantAuditEvents: AuditEvent[];
  selectedNodeDesiredJobs: Job[];
  selectedNodeDesiredAuditEvents: AuditEvent[];
  selectedNodeDesiredDrift: DriftEntry[];
  selectedZoneJobs: Job[];
  selectedZoneAuditEvents: AuditEvent[];
  selectedAppJobs: Job[];
  selectedAppAuditEvents: AuditEvent[];
  selectedDatabaseJobs: Job[];
  selectedDatabaseAuditEvents: AuditEvent[];
  selectedBackupRun: DashboardData["backups"]["latestRuns"][number] | undefined;
  selectedBackupAuditEvents: AuditEvent[];
  selectedTenantLatestFailure: Job | undefined;
  selectedTenantLatestSuccess: Job | undefined;
  selectedNodeLatestFailure: Job | undefined;
  selectedNodeLatestSuccess: Job | undefined;
  selectedZoneLatestFailure: Job | undefined;
  selectedZoneLatestSuccess: Job | undefined;
  selectedAppLatestFailure: Job | undefined;
  selectedAppLatestSuccess: Job | undefined;
  selectedDatabaseLatestFailure: Job | undefined;
  selectedDatabaseLatestSuccess: Job | undefined;
  selectedBackupLatestFailureRun: DashboardData["backups"]["latestRuns"][number] | undefined;
  selectedBackupLatestSuccessRun: DashboardData["backups"]["latestRuns"][number] | undefined;
  selectedNodeHealthSnapshot: NodeHealth | undefined;
  selectedBackupTargetHealth: NodeHealth | undefined;
  selectedZonePrimaryNodeHealth: NodeHealth | undefined;
  selectedAppPrimaryNodeHealth: NodeHealth | undefined;
  selectedDatabasePrimaryNodeHealth: NodeHealth | undefined;
  selectedZoneDrift: DriftEntry | undefined;
  selectedAppProxyDrifts: DriftEntry[];
  selectedDatabaseDrift: DriftEntry | undefined;
  selectedZoneLatestAppliedDnsJob: Job | undefined;
  selectedAppLatestAppliedProxyJob: Job | undefined;
  selectedDatabaseLatestAppliedReconcileJob: Job | undefined;
}

export interface DesiredStateActionModel {
  selectedAppPlanItems: DesiredStateRelatedPanelItem[];
  selectedDatabasePlanItems: DesiredStateRelatedPanelItem[];
  selectedZonePlanItems: DesiredStateRelatedPanelItem[];
  zoneComparisonRows: DesiredStateComparisonRow[];
  appComparisonRows: DesiredStateComparisonRow[];
  databaseComparisonRows: DesiredStateComparisonRow[];
  selectedTenantActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedNodeActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedZoneActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedAppActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedDatabaseActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedBackupActionPreviewItems: DesiredStateRelatedPanelItem[];
}

export type DesiredStateViewModel = DesiredStateSelectionModel &
  DesiredStateTableModel &
  DesiredStateActivityModel &
  DesiredStateActionModel;
