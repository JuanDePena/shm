import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

export function buildBackupRows<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    | "copy"
    | "currentBackupFilters"
    | "filteredBackupRuns"
    | "formatDate"
    | "locale"
    | "renderFocusLink"
    | "renderPill"
    | "selectedBackupViewRun"
  >
): DataTableRow[] {
  const {
    copy,
    currentBackupFilters,
    filteredBackupRuns,
    formatDate,
    locale,
    renderFocusLink,
    renderPill,
    selectedBackupViewRun
  } = args;

  return filteredBackupRuns.map((run) => ({
    selectionKey: run.runId,
    selected: selectedBackupViewRun?.policySlug === run.policySlug,
    cells: [
      renderFocusLink(
        run.policySlug,
        buildDashboardViewUrl("backups", undefined, run.policySlug, currentBackupFilters),
        selectedBackupViewRun?.policySlug === run.policySlug,
        copy.selectedStateLabel
      ),
      `<span class="mono">${escapeHtml(run.nodeId)}</span>`,
      renderPill(
        run.status,
        run.status === "succeeded"
          ? "success"
          : run.status === "failed"
            ? "danger"
            : "muted"
      ),
      escapeHtml(run.summary),
      escapeHtml(formatDate(run.startedAt, locale))
    ],
    searchText: [run.policySlug, run.nodeId, run.status, run.summary].join(" ")
  }));
}

export function renderBackupsTable<Copy extends BackupCopy>(
  args: Pick<BackupsWorkspaceArgs<Copy>, "copy" | "renderDataTable"> & {
    backupRows: DataTableRow[];
  }
): string {
  const { backupRows, copy, renderDataTable } = args;

  return renderDataTable({
    id: "section-backups-table",
    heading: copy.backupsTitle,
    description: copy.backupsDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.backupColPolicy, className: "mono" },
      { label: copy.backupColNode, className: "mono" },
      { label: copy.backupColStatus },
      { label: copy.backupColSummary },
      { label: copy.backupColStarted }
    ],
    rows: backupRows,
    emptyMessage: copy.noBackups,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 10
  });
}
