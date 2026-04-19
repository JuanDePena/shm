import { type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { type DashboardView } from "./dashboard-routing.js";
import { type DashboardBackupFilters } from "./dashboard-view-model.js";
import { type WebLocale } from "./request.js";
import { type WorkspaceFilterField } from "./web-types.js";

export type BackupCopy = {
  backupColNode: string;
  backupColPolicy: string;
  backupColStarted: string;
  backupColStatus: string;
  backupColSummary: string;
  backupCoverageByTenantDescription: string;
  backupCoverageByTenantTitle: string;
  backupCoverageDescription: string;
  backupCoverageTitle: string;
  backupNodesDescription: string;
  backupNodesTitle: string;
  backupPolicyColRetention: string;
  backupPolicyColSchedule: string;
  backupPolicyColSlug: string;
  backupPolicyColTargetNode: string;
  backupPolicyColTenant: string;
  backupPolicyContextDescription: string;
  backupPolicyContextTitle: string;
  backupPolicySignalsDescription: string;
  backupPolicySignalsTitle: string;
  backupRunDescription: string;
  backupRunSignalsDescription: string;
  backupRunSignalsTitle: string;
  backupRunTitle: string;
  backupTargetPostureDescription: string;
  backupTargetPostureTitle: string;
  backupsDescription: string;
  backupsTitle: string;
  dataFilterPlaceholder: string;
  effectiveStateDescription: string;
  effectiveStateTitle: string;
  failedBackups: string;
  failureFocusDescription: string;
  failureFocusTitle: string;
  filterNodeLabel: string;
  filterPolicyLabel: string;
  filterStatusLabel: string;
  filterTenantLabel: string;
  latestCompleted: string;
  latestFailureLabel: string;
  latestSuccessLabel: string;
  navBackupPolicies: string;
  navTenants: string;
  noBackupPolicies: string;
  noBackups: string;
  noRelatedRecords: string;
  none: string;
  nodeColPending: string;
  nodeColVersion: string;
  nodeHealthTitle: string;
  of: string;
  openDesiredState: string;
  openNodeHealth: string;
  plannedChangesDescription: string;
  plannedChangesTitle: string;
  policyCoverage: string;
  records: string;
  relatedJobsTitle: string;
  relatedResourcesDescription: string;
  relatedResourcesTitle: string;
  resourceSelectorsLabel: string;
  rowsPerPage: string;
  runningBackups: string;
  selectedStateLabel: string;
  showing: string;
  storageLocationLabel: string;
  succeededBackups: string;
  targetedNodesLabel: string;
};

export type BackupDataTableRenderer = (args: {
  id: string;
  heading: string;
  description: string;
  headingBadgeClassName?: string;
  restoreSelectionHref?: boolean;
  columns: Array<{ label: string; className?: string }>;
  rows: DataTableRow[];
  emptyMessage: string;
  filterPlaceholder: string;
  rowsPerPageLabel: string;
  showingLabel: string;
  ofLabel: string;
  recordsLabel: string;
  defaultPageSize?: number;
}) => string;

export type BackupsWorkspaceArgs<Copy extends BackupCopy> = {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  filteredBackupPolicies: DashboardData["backups"]["policies"];
  filteredBackupRuns: DashboardData["backups"]["latestRuns"];
  selectedBackupViewRun: DashboardData["backups"]["latestRuns"][number] | undefined;
  selectedBackupPolicySummary: DashboardData["backups"]["policies"][number] | undefined;
  currentBackupFilters: DashboardBackupFilters;
  backupStatusFilter?: string;
  backupNodeFilter?: string;
  backupTenantFilter?: string;
  backupPolicyFilter?: string;
  findRelatedAuditEvents: (
    events: DashboardData["auditEvents"],
    needles: string[],
    limit?: number
  ) => DashboardData["auditEvents"];
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderActiveFiltersPanel: (
    copy: Copy,
    items: Array<{ label: string; value: string }>,
    clearHref: string
  ) => string;
  renderAuditPanel: (
    copy: Copy,
    locale: WebLocale,
    events: DashboardData["auditEvents"]
  ) => string;
  renderDataTable: BackupDataTableRenderer;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (
    value: string,
    tone?: "default" | "success" | "danger" | "muted"
  ) => string;
  renderRelatedPanel: (
    title: string,
    description: string | undefined,
    items: Array<{
      title: string;
      meta?: string;
      summary?: string;
      summaryHtml?: string;
      tone?: "default" | "danger" | "success";
    }>,
    emptyMessage: string
  ) => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
  renderWorkspaceFilterForm: (
    copy: Copy,
    props: {
      view: DashboardView;
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
};
