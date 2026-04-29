import { type DashboardData } from "./api-client.js";
import { renderBackupsFilterForm } from "./dashboard-backups-filters.js";
import {
  renderBackupRunPanel,
  renderSelectedBackupPolicyPanel
} from "./dashboard-backups-panels.js";
import { buildBackupRows, renderBackupsTable } from "./dashboard-backups-table.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

export function renderBackupsWorkspace<Copy extends BackupCopy>(
  args: BackupsWorkspaceArgs<Copy>
): string {
  const {
    copy,
    data,
    locale,
    filteredBackupPolicies,
    filteredBackupRuns,
    selectedBackupViewRun,
    selectedBackupPolicySummary,
    currentBackupFilters,
    backupStatusFilter,
    backupNodeFilter,
    backupTenantFilter,
    backupPolicyFilter,
    formatDate,
    renderActionFacts,
    renderDetailGrid,
    renderPill,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const backupRows = buildBackupRows({
    copy,
    currentBackupFilters,
    filteredBackupRuns,
    formatDate,
    locale,
    renderFocusLink: args.renderFocusLink,
    renderPill,
    selectedBackupViewRun
  });

  const backupSucceededCount = filteredBackupRuns.filter((run) => run.status === "succeeded").length;
  const backupFailedCount = filteredBackupRuns.filter((run) => run.status === "failed").length;
  const backupRunningCount = filteredBackupRuns.filter((run) => run.status === "running").length;
  const backupCoverageCount = filteredBackupPolicies.length;
  const selectedBackupPolicyRuns = selectedBackupPolicySummary
    ? data.backups.latestRuns.filter((run) => run.policySlug === selectedBackupPolicySummary.policySlug)
    : [];
  const selectedBackupPolicyLatestFailedRun = selectedBackupPolicyRuns.find(
    (run) => run.status === "failed"
  );
  const selectedBackupPolicyLatestSuccessRun = selectedBackupPolicyRuns.find(
    (run) => run.status === "succeeded"
  );
  const selectedBackupPolicyTargetHealth = selectedBackupPolicySummary
    ? data.nodeHealth.find((entry) => entry.nodeId === selectedBackupPolicySummary.targetNodeId)
    : undefined;
  const backupFilterForm = renderBackupsFilterForm({
    backupNodeFilter,
    backupPolicyFilter,
    backupStatusFilter,
    backupTenantFilter,
    copy,
    data,
    renderWorkspaceFilterForm
  });
  const backupsTable = renderBackupsTable({
    backupRows,
    copy,
    renderDataTable: args.renderDataTable
  });
  const backupRunPanel = renderBackupRunPanel({
    copy,
    currentBackupFilters,
    formatDate,
    locale,
    renderDetailGrid,
    renderPill,
    selectedBackupPolicySummary,
    selectedBackupViewRun
  });
  const selectedBackupPolicyPanel = renderSelectedBackupPolicyPanel({
    copy,
    currentBackupFilters,
    renderActionFacts,
    renderDetailGrid,
    renderPill,
    selectedBackupPolicyLatestFailedRun,
    selectedBackupPolicyLatestSuccessRun,
    selectedBackupPolicySummary,
    selectedBackupPolicyTargetHealth
  });

  return `<section id="section-backups" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.succeededBackups, value: String(backupSucceededCount), tone: backupSucceededCount > 0 ? "success" : "muted" },
      { label: copy.runningBackups, value: String(backupRunningCount), tone: backupRunningCount > 0 ? "muted" : "success" },
      { label: copy.failedBackups, value: String(backupFailedCount), tone: backupFailedCount > 0 ? "danger" : "success" },
      { label: copy.policyCoverage, value: String(backupCoverageCount), tone: backupCoverageCount > 0 ? "success" : "muted" }
    ])}
    ${backupFilterForm}
    ${backupsTable}
    ${backupRunPanel}
    ${selectedBackupPolicyPanel}
  </section>`;
}
