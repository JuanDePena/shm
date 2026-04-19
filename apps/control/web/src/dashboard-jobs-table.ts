import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type JobHistoryWorkspaceArgs, type JobsCopy } from "./dashboard-jobs-types.js";

export function buildJobHistoryRows<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    "copy" | "currentJobFilters" | "filteredJobHistory" | "formatDate" | "locale" | "renderFocusLink" | "renderPill" | "selectedJob"
  >
): DataTableRow[] {
  const {
    copy,
    currentJobFilters,
    filteredJobHistory,
    formatDate,
    locale,
    renderFocusLink,
    renderPill,
    selectedJob
  } = args;

  return filteredJobHistory.map((job) => ({
    selectionKey: job.jobId,
    selected: selectedJob?.jobId === job.jobId,
    cells: [
      renderFocusLink(
        job.jobId,
        buildDashboardViewUrl("job-history", undefined, job.jobId, currentJobFilters),
        selectedJob?.jobId === job.jobId,
        copy.selectedStateLabel
      ),
      escapeHtml(job.kind),
      `<span class="mono">${escapeHtml(job.nodeId)}</span>`,
      job.status
        ? renderPill(
            job.status,
            job.status === "applied"
              ? "success"
              : job.status === "failed"
                ? "danger"
                : "muted"
          )
        : renderPill("queued", "muted"),
      escapeHtml(job.dispatchReason ?? "-"),
      escapeHtml(job.summary ?? "-"),
      escapeHtml(formatDate(job.createdAt, locale))
    ],
    searchText: [
      job.jobId,
      job.kind,
      job.nodeId,
      job.status ?? "queued",
      job.dispatchReason ?? "",
      job.summary ?? "",
      job.resourceKey ?? ""
    ].join(" ")
  }));
}

export function renderJobHistoryTable<Copy extends JobsCopy>(
  args: Pick<JobHistoryWorkspaceArgs<Copy>, "copy" | "renderDataTable"> & {
    jobRows: DataTableRow[];
  }
): string {
  const { copy, jobRows, renderDataTable } = args;

  return renderDataTable({
    id: "section-job-history-table",
    heading: copy.jobHistoryTitle,
    description: copy.jobHistoryDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.jobColJob, className: "mono" },
      { label: copy.jobColKind },
      { label: copy.jobColNode, className: "mono" },
      { label: copy.jobColStatus },
      { label: copy.jobColReason },
      { label: copy.jobColSummary },
      { label: copy.jobColCreated }
    ],
    rows: jobRows,
    emptyMessage: copy.noJobs,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 10
  });
}
