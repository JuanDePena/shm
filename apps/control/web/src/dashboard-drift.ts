import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl, type DashboardView } from "./dashboard-routing.js";
import { createUniqueSelectOptions, groupItemsBy } from "./dashboard-utils.js";
import { type DashboardDriftFilters } from "./dashboard-view-model.js";
import { type WebLocale } from "./request.js";
import { type WorkspaceFilterField } from "./web-types.js";

type DriftCopy = {
  dataFilterPlaceholder: string;
  desiredHash: string;
  detailActionsTitle: string;
  dispatchRecommended: string;
  driftColDrift: string;
  driftColKind: string;
  driftColLatestStatus: string;
  driftColNode: string;
  driftColResource: string;
  driftColSummary: string;
  driftDiagnosticsDescription: string;
  driftDiagnosticsTitle: string;
  driftKindsDescription: string;
  driftKindsTitle: string;
  driftMissingSecrets: string;
  driftNodesDescription: string;
  driftNodesTitle: string;
  driftOutOfSync: string;
  driftPending: string;
  driftStatusesDescription: string;
  driftStatusesTitle: string;
  filterKindLabel: string;
  filterNodeLabel: string;
  filterStatusLabel: string;
  jobColJob: string;
  jobColSummary: string;
  linkedResource: string;
  latestHash: string;
  navNodeHealth: string;
  noDrift: string;
  noLabel: string;
  none: string;
  nodeColNode: string;
  of: string;
  openDesiredState: string;
  records: string;
  resourceDriftDescription: string;
  resourceDriftTitle: string;
  resourcesWithDrift: string;
  rowsPerPage: string;
  selectedResourceDescription: string;
  selectedStateLabel: string;
  showing: string;
  yesLabel: string;
};

type DriftAction = {
  path: string;
  fields: Record<string, string>;
  label: string;
  confirmMessage: string;
};

type DriftReference = {
  editorHref?: string;
  action?: DriftAction;
};

type DataTableRenderer = (args: {
  id: string;
  heading: string;
  description: string;
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

export function renderResourceDriftWorkspace<Copy extends DriftCopy>(args: {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  filteredDrift: DashboardData["drift"];
  selectedDrift: DashboardData["drift"][number] | undefined;
  currentDriftFilters: DashboardDriftFilters;
  driftStatusFilter?: string;
  driftKindFilter?: string;
  driftNodeFilter?: string;
  findRelatedAuditEvents: (
    events: DashboardData["auditEvents"],
    needles: string[],
    limit?: number
  ) => DashboardData["auditEvents"];
  findRelatedJobs: (
    jobs: DashboardData["jobHistory"],
    options: {
      resourceKeys?: string[];
      resourcePrefixes?: string[];
      nodeId?: string;
      needles?: string[];
    },
    limit?: number
  ) => DashboardData["jobHistory"];
  parseDriftResourceReference: (entry: DashboardData["drift"][number]) => DriftReference;
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderActionForm: (
    action: string,
    fields: Record<string, string>,
    submitLabel: string,
    options?: { confirmMessage?: string }
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
  renderDataTable: DataTableRenderer;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderJobFeedPanel: (
    copy: Copy,
    locale: WebLocale,
    jobs: DashboardData["jobHistory"],
    title?: string
  ) => string;
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
}): string {
  const {
    copy,
    data,
    locale,
    filteredDrift,
    selectedDrift,
    currentDriftFilters,
    driftStatusFilter,
    driftKindFilter,
    driftNodeFilter,
    findRelatedAuditEvents,
    findRelatedJobs,
    parseDriftResourceReference,
    renderActionFacts,
    renderActionForm,
    renderActiveFiltersPanel,
    renderAuditPanel,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink,
    renderJobFeedPanel,
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const driftRows: DataTableRow[] = filteredDrift.map((entry) => ({
    selectionKey: entry.resourceKey,
    selected: selectedDrift?.resourceKey === entry.resourceKey,
    cells: [
      escapeHtml(entry.resourceKind),
      renderFocusLink(
        entry.resourceKey,
        buildDashboardViewUrl("resource-drift", undefined, entry.resourceKey, currentDriftFilters),
        selectedDrift?.resourceKey === entry.resourceKey,
        copy.selectedStateLabel
      ),
      `<span class="mono">${escapeHtml(entry.nodeId)}</span>`,
      renderPill(
        entry.driftStatus,
        entry.driftStatus === "in_sync"
          ? "success"
          : entry.driftStatus === "pending"
            ? "muted"
            : "danger"
      ),
      entry.latestJobStatus
        ? renderPill(
            entry.latestJobStatus,
            entry.latestJobStatus === "applied" ? "success" : "danger"
          )
        : "-",
      escapeHtml(entry.latestSummary ?? "-")
    ],
    searchText: [
      entry.resourceKind,
      entry.resourceKey,
      entry.nodeId,
      entry.driftStatus,
      entry.latestSummary ?? ""
    ].join(" ")
  }));

  const driftPendingCount = filteredDrift.filter((entry) => entry.driftStatus === "pending").length;
  const driftOutOfSyncCount = filteredDrift.filter((entry) => entry.driftStatus === "out_of_sync").length;
  const driftMissingSecretCount = filteredDrift.filter(
    (entry) => entry.driftStatus === "missing_secret"
  ).length;
  const selectedDriftReference = selectedDrift ? parseDriftResourceReference(selectedDrift) : {};
  const selectedDriftJobs = selectedDrift
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [selectedDrift.resourceKey, selectedDrift.latestJobId ?? ""],
          needles: [selectedDrift.resourceKey, selectedDrift.nodeId]
        },
        6
      )
    : [];
  const selectedDriftAuditEvents = selectedDrift
    ? findRelatedAuditEvents(
        data.auditEvents,
        [selectedDrift.resourceKey, selectedDrift.nodeId, selectedDrift.latestJobId ?? ""],
        8
      )
    : [];
  const driftStatusGroups = groupItemsBy(filteredDrift, (entry) => entry.driftStatus).slice(0, 4);
  const driftNodeGroups = groupItemsBy(filteredDrift, (entry) => entry.nodeId).slice(0, 6);
  const driftKindGroups = groupItemsBy(filteredDrift, (entry) => entry.resourceKind).slice(0, 6);
  const activeDriftFilterItems = [
    driftStatusFilter ? { label: copy.filterStatusLabel, value: driftStatusFilter } : undefined,
    driftKindFilter ? { label: copy.filterKindLabel, value: driftKindFilter } : undefined,
    driftNodeFilter ? { label: copy.filterNodeLabel, value: driftNodeFilter } : undefined
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const driftFilterForm = renderWorkspaceFilterForm(copy, {
    view: "resource-drift",
    clearHref: buildDashboardViewUrl("resource-drift"),
    fields: [
      {
        name: "driftStatus",
        label: copy.filterStatusLabel,
        value: driftStatusFilter,
        options: createUniqueSelectOptions(data.drift.map((entry) => entry.driftStatus))
      },
      {
        name: "driftKind",
        label: copy.filterKindLabel,
        value: driftKindFilter,
        options: createUniqueSelectOptions(data.drift.map((entry) => entry.resourceKind))
      },
      {
        name: "driftNode",
        label: copy.filterNodeLabel,
        value: driftNodeFilter,
        options: createUniqueSelectOptions([
          ...data.drift.map((entry) => entry.nodeId),
          ...data.nodeHealth.map((node) => node.nodeId)
        ])
      }
    ]
  });

  const selectedDriftPanel = selectedDrift
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.driftDiagnosticsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.driftDiagnosticsDescription)}</p>
          </div>
        </div>
        ${renderDetailGrid([
          { label: copy.driftColKind, value: escapeHtml(selectedDrift.resourceKind) },
          {
            label: copy.driftColResource,
            value: `<span class="mono">${escapeHtml(selectedDrift.resourceKey)}</span>`
          },
          {
            label: copy.driftColNode,
            value: `<span class="mono">${escapeHtml(selectedDrift.nodeId)}</span>`
          },
          {
            label: copy.driftColDrift,
            value: renderPill(
              selectedDrift.driftStatus,
              selectedDrift.driftStatus === "in_sync"
                ? "success"
                : selectedDrift.driftStatus === "pending"
                  ? "muted"
                  : "danger"
            )
          },
          {
            label: copy.driftColLatestStatus,
            value: selectedDrift.latestJobStatus
              ? renderPill(
                  selectedDrift.latestJobStatus,
                  selectedDrift.latestJobStatus === "applied"
                    ? "success"
                    : selectedDrift.latestJobStatus === "failed"
                      ? "danger"
                      : "muted"
                )
              : "-"
          },
          { label: copy.jobColSummary, value: escapeHtml(selectedDrift.latestSummary ?? "-") },
          {
            label: copy.jobColJob,
            value: selectedDrift.latestJobId
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedDrift.latestJobId)
                )}">${escapeHtml(selectedDrift.latestJobId)}</a>`
              : "-"
          },
          {
            label: copy.dispatchRecommended,
            value: renderPill(
              selectedDrift.dispatchRecommended ? copy.yesLabel : copy.noLabel,
              selectedDrift.dispatchRecommended ? "danger" : "success"
            )
          },
          {
            label: copy.desiredHash,
            value: selectedDrift.desiredPayloadHash
              ? `<span class="mono">${escapeHtml(selectedDrift.desiredPayloadHash)}</span>`
              : "-"
          },
          {
            label: copy.latestHash,
            value: selectedDrift.latestPayloadHash
              ? `<span class="mono">${escapeHtml(selectedDrift.latestPayloadHash)}</span>`
              : "-"
          }
        ])}
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noDrift)}</p></article>`;

  const selectedDriftActionPanel = selectedDrift
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
          </div>
        </div>
        ${renderActionFacts([
          {
            label: copy.linkedResource,
            value: selectedDriftReference.editorHref
              ? `<a class="detail-link" href="${escapeHtml(selectedDriftReference.editorHref)}">${escapeHtml(
                  copy.openDesiredState
                )}</a>`
              : escapeHtml(copy.none)
          },
          {
            label: copy.nodeColNode,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedDrift.nodeId)
            )}">${escapeHtml(selectedDrift.nodeId)}</a>`
          },
          {
            label: copy.filterStatusLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, undefined, {
                ...currentDriftFilters,
                driftStatus: selectedDrift.driftStatus
              })
            )}">${escapeHtml(selectedDrift.driftStatus)}</a>`
          },
          {
            label: copy.filterKindLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, undefined, {
                ...currentDriftFilters,
                driftKind: selectedDrift.resourceKind
              })
            )}">${escapeHtml(selectedDrift.resourceKind)}</a>`
          },
          {
            label: copy.filterNodeLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("resource-drift", undefined, undefined, {
                ...currentDriftFilters,
                driftNode: selectedDrift.nodeId
              })
            )}">${escapeHtml(selectedDrift.nodeId)}</a>`
          },
          {
            label: copy.jobColJob,
            value: selectedDrift.latestJobId
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, selectedDrift.latestJobId)
                )}">${escapeHtml(selectedDrift.latestJobId)}</a>`
              : escapeHtml(copy.none)
          }
        ])}
        <div class="toolbar">
          ${
            selectedDriftReference.editorHref
              ? `<a class="button-link secondary" href="${escapeHtml(
                  selectedDriftReference.editorHref
                )}">${escapeHtml(copy.openDesiredState)}</a>`
              : ""
          }
          ${
            selectedDriftReference.action
              ? renderActionForm(
                  selectedDriftReference.action.path,
                  selectedDriftReference.action.fields,
                  selectedDriftReference.action.label,
                  {
                    confirmMessage: selectedDriftReference.action.confirmMessage
                  }
                )
              : ""
          }
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("node-health", undefined, selectedDrift.nodeId)
          )}">${escapeHtml(copy.navNodeHealth)}</a>
        </div>
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noDrift)}</p></article>`;

  const driftStatusesPanel = renderRelatedPanel(
    copy.driftStatusesTitle,
    copy.driftStatusesDescription,
    driftStatusGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("resource-drift", undefined, undefined, {
          ...currentDriftFilters,
          driftStatus: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} drift item(s)`),
      summary: escapeHtml(
        group.items
          .slice(0, 2)
          .map((entry) => `${entry.resourceKind} · ${entry.nodeId}`)
          .join(" · ")
      ),
      tone:
        group.key === "out_of_sync" || group.key === "missing_secret"
          ? ("danger" as const)
          : group.key === "in_sync"
            ? ("success" as const)
            : ("default" as const)
    })),
    copy.noDrift
  );

  const driftNodesPanel = renderRelatedPanel(
    copy.driftNodesTitle,
    copy.driftNodesDescription,
    driftNodeGroups.map((group) => ({
      title: `<a class="detail-link mono" href="${escapeHtml(
        buildDashboardViewUrl("resource-drift", undefined, undefined, {
          ...currentDriftFilters,
          driftNode: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} drift item(s)`),
      summary: escapeHtml(
        groupItemsBy(group.items, (entry) => entry.driftStatus)
          .map((entry) => `${entry.key}:${entry.items.length}`)
          .join(" · ")
      ),
      tone: group.items.some(
        (entry) =>
          entry.driftStatus === "out_of_sync" || entry.driftStatus === "missing_secret"
      )
        ? ("danger" as const)
        : group.items.some((entry) => entry.driftStatus === "pending")
          ? ("default" as const)
          : ("success" as const)
    })),
    copy.noDrift
  );

  const driftKindsPanel = renderRelatedPanel(
    copy.driftKindsTitle,
    copy.driftKindsDescription,
    driftKindGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("resource-drift", undefined, undefined, {
          ...currentDriftFilters,
          driftKind: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} drift item(s)`),
      summary: escapeHtml(
        groupItemsBy(group.items, (entry) => entry.driftStatus)
          .map((entry) => `${entry.key}:${entry.items.length}`)
          .join(" · ")
      ),
      tone: group.items.some(
        (entry) =>
          entry.driftStatus === "out_of_sync" || entry.driftStatus === "missing_secret"
      )
        ? ("danger" as const)
        : group.items.some((entry) => entry.driftStatus === "pending")
          ? ("default" as const)
          : ("success" as const)
    })),
    copy.noDrift
  );

  const driftActiveFiltersPanel = renderActiveFiltersPanel(
    copy,
    activeDriftFilterItems,
    buildDashboardViewUrl("resource-drift")
  );
  const selectedDriftJobsPanel = renderJobFeedPanel(copy, locale, selectedDriftJobs);
  const selectedDriftAuditPanel = renderAuditPanel(copy, locale, selectedDriftAuditEvents);

  return `<section id="section-resource-drift" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.resourcesWithDrift, value: String(filteredDrift.length), tone: filteredDrift.length > 0 ? "danger" : "success" },
      { label: copy.driftPending, value: String(driftPendingCount), tone: driftPendingCount > 0 ? "muted" : "success" },
      { label: copy.driftOutOfSync, value: String(driftOutOfSyncCount), tone: driftOutOfSyncCount > 0 ? "danger" : "success" },
      { label: copy.driftMissingSecrets, value: String(driftMissingSecretCount), tone: driftMissingSecretCount > 0 ? "danger" : "success" }
    ])}
    ${driftFilterForm}
    ${driftActiveFiltersPanel}
    ${renderDataTable({
      id: "section-resource-drift-table",
      heading: copy.resourceDriftTitle,
      description: copy.resourceDriftDescription,
      restoreSelectionHref: true,
      columns: [
        { label: copy.driftColKind },
        { label: copy.driftColResource, className: "mono" },
        { label: copy.driftColNode, className: "mono" },
        { label: copy.driftColDrift },
        { label: copy.driftColLatestStatus },
        { label: copy.driftColSummary }
      ],
      rows: driftRows,
      emptyMessage: copy.noDrift,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid grid-two">
      ${selectedDriftPanel}
      <div class="stack">
        ${driftStatusesPanel}
        ${driftNodesPanel}
        ${driftKindsPanel}
        ${selectedDriftActionPanel}
        ${selectedDriftJobsPanel}
        ${selectedDriftAuditPanel}
      </div>
    </div>
  </section>`;
}
