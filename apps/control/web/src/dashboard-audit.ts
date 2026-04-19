import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl, type DashboardView } from "./dashboard-routing.js";
import { groupItemsBy, createUniqueSelectOptions } from "./dashboard-utils.js";
import { type DashboardJobFilters } from "./dashboard-view-model.js";
import { type WebCopy } from "./web-copy.js";
import { type WebLocale } from "./request.js";
import { type WorkspaceFilterField } from "./web-types.js";

type CurrentAuditFilters = Pick<
  DashboardJobFilters,
  "auditType" | "auditActor" | "auditEntity"
>;

function formatActorLabel(event: DashboardData["auditEvents"][number]): string {
  return `${event.actorType}:${event.actorId ?? "unknown"}`;
}

function formatEntityKey(event: DashboardData["auditEvents"][number]): string {
  if (event.entityType && event.entityId) {
    return `${event.entityType}:${event.entityId}`;
  }

  return event.entityType ?? event.entityId ?? "";
}

function formatEntityLabel(
  copy: WebCopy,
  event: DashboardData["auditEvents"][number]
): string {
  return formatEntityKey(event) || copy.none;
}

function buildActiveAuditFilterItems(
  copy: WebCopy,
  filters: CurrentAuditFilters
): Array<{ label: string; value: string }> {
  return [
    filters.auditType ? { label: copy.filterEventLabel, value: filters.auditType } : undefined,
    filters.auditActor ? { label: copy.filterActorLabel, value: filters.auditActor } : undefined,
    filters.auditEntity ? { label: copy.filterEntityLabel, value: filters.auditEntity } : undefined
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function renderAuditFilterForm(args: {
  copy: WebCopy;
  data: DashboardData;
  auditTypeFilter?: string;
  auditActorFilter?: string;
  auditEntityFilter?: string;
  renderWorkspaceFilterForm: (
    copy: WebCopy,
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
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    renderWorkspaceFilterForm
  } = args;

  return renderWorkspaceFilterForm(copy, {
    view: "audit",
    clearHref: buildDashboardViewUrl("audit"),
    fields: [
      {
        name: "auditType",
        label: copy.filterEventLabel,
        value: auditTypeFilter,
        options: createUniqueSelectOptions(data.auditEvents.map((event) => event.eventType))
      },
      {
        name: "auditActor",
        label: copy.filterActorLabel,
        type: "search",
        value: auditActorFilter,
        placeholder: copy.filterActorLabel
      },
      {
        name: "auditEntity",
        label: copy.filterEntityLabel,
        type: "search",
        value: auditEntityFilter,
        placeholder: copy.filterEntityLabel
      }
    ]
  });
}

function buildAuditRows(args: {
  copy: WebCopy;
  locale: WebLocale;
  filteredAuditEvents: DashboardData["auditEvents"];
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  currentAuditFilters: CurrentAuditFilters;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
}): DataTableRow[] {
  const {
    copy,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderFocusLink
  } = args;

  return filteredAuditEvents.map((event) => ({
    selectionKey: event.eventId,
    selected: selectedAuditEvent?.eventId === event.eventId,
    cells: [
      renderFocusLink(
        event.eventType,
        buildDashboardViewUrl("audit", undefined, event.eventId, currentAuditFilters),
        selectedAuditEvent?.eventId === event.eventId,
        copy.selectedStateLabel
      ),
      `<span class="mono">${escapeHtml(formatActorLabel(event))}</span>`,
      `<span class="mono">${escapeHtml(formatEntityLabel(copy, event))}</span>`,
      escapeHtml(formatDate(event.occurredAt, locale))
    ],
    searchText: [
      event.eventId,
      event.eventType,
      formatActorLabel(event),
      formatEntityKey(event),
      JSON.stringify(event.payload)
    ].join(" ")
  }));
}

function renderSelectedAuditPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  selectedAuditRelatedJobs: DashboardData["jobHistory"];
  currentAuditFilters: CurrentAuditFilters;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderCodeBlock: (value: unknown) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
}): string {
  const {
    copy,
    locale,
    selectedAuditEvent,
    selectedAuditRelatedJobs,
    currentAuditFilters,
    formatDate,
    renderActionFacts,
    renderCodeBlock,
    renderDetailGrid
  } = args;

  if (!selectedAuditEvent) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noRelatedRecords)}</p></article>`;
  }

  const actorLabel = formatActorLabel(selectedAuditEvent);
  const entityLabel = formatEntityLabel(copy, selectedAuditEvent);
  const jobsHref =
    selectedAuditRelatedJobs.length > 0
      ? buildDashboardViewUrl("jobs", undefined, selectedAuditRelatedJobs[0]?.jobId)
      : undefined;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.auditTrailTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.auditTrailDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedAuditEvent.eventType)}</h3>
      <p class="muted mono">${escapeHtml(selectedAuditEvent.eventId)}</p>
    </div>
    ${renderDetailGrid([
      {
        label: copy.filterEventLabel,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("audit", undefined, undefined, {
            ...currentAuditFilters,
            auditType: selectedAuditEvent.eventType
          })
        )}">${escapeHtml(selectedAuditEvent.eventType)}</a>`
      },
      {
        label: copy.filterActorLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("audit", undefined, undefined, {
            ...currentAuditFilters,
            auditActor: actorLabel
          })
        )}">${escapeHtml(actorLabel)}</a>`
      },
      {
        label: copy.filterEntityLabel,
        value:
          entityLabel !== copy.none
            ? `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("audit", undefined, undefined, {
                  ...currentAuditFilters,
                  auditEntity: selectedAuditEvent.entityId ?? formatEntityKey(selectedAuditEvent)
                })
              )}">${escapeHtml(entityLabel)}</a>`
            : escapeHtml(copy.none)
      },
      {
        label: copy.jobColCreated,
        value: escapeHtml(formatDate(selectedAuditEvent.occurredAt, locale))
      }
    ])}
    <div class="grid grid-two">
      <article class="panel detail-shell panel-nested">
        <h4>${escapeHtml(copy.payloadTitle)}</h4>
        ${renderCodeBlock(selectedAuditEvent.payload)}
      </article>
      <article class="panel detail-shell panel-nested">
        <h4>${escapeHtml(copy.linkedOperationsTitle)}</h4>
        ${renderActionFacts([
          {
            label: copy.relatedJobsTitle,
            value: jobsHref
              ? `<a class="detail-link" href="${escapeHtml(jobsHref)}">${escapeHtml(
                  copy.openJobHistory
                )}</a>`
              : escapeHtml(copy.none)
          },
          {
            label: copy.filterActorLabel,
            value: escapeHtml(actorLabel)
          },
          {
            label: copy.filterEntityLabel,
            value: escapeHtml(entityLabel)
          }
        ])}
      </article>
    </div>
  </article>`;
}

export function renderAuditWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  filteredAuditEvents: DashboardData["auditEvents"];
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  currentAuditFilters: CurrentAuditFilters;
  auditTypeFilter?: string;
  auditActorFilter?: string;
  auditEntityFilter?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
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
  payloadContainsValue: (payload: unknown, needle: string) => boolean;
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderActiveFiltersPanel: (
    copy: WebCopy,
    items: Array<{ label: string; value: string }>,
    clearHref: string
  ) => string;
  renderCodeBlock: (value: unknown) => string;
  renderDataTable: (args: {
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
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderJobFeedPanel: (
    copy: WebCopy,
    locale: WebLocale,
    jobs: DashboardData["jobHistory"],
    title?: string
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
    copy: WebCopy,
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
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    formatDate,
    findRelatedJobs,
    payloadContainsValue,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink,
    renderJobFeedPanel,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const auditRows = buildAuditRows({
    copy,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderFocusLink
  });

  const selectedAuditNeedles = selectedAuditEvent
    ? [
        selectedAuditEvent.eventId,
        selectedAuditEvent.actorId ?? "",
        selectedAuditEvent.entityId ?? "",
        formatActorLabel(selectedAuditEvent),
        formatEntityKey(selectedAuditEvent)
      ].filter(Boolean)
    : [];
  const selectedAuditDirectJobs = selectedAuditEvent
    ? data.jobHistory.filter(
        (job) =>
          job.jobId === selectedAuditEvent.entityId ||
          job.jobId === selectedAuditEvent.actorId ||
          job.resourceKey === selectedAuditEvent.entityId ||
          payloadContainsValue(selectedAuditEvent.payload, job.jobId) ||
          (job.resourceKey
            ? payloadContainsValue(selectedAuditEvent.payload, job.resourceKey)
            : false)
      )
    : [];
  const selectedAuditRelatedJobs = Array.from(
    new Map(
      [
        ...selectedAuditDirectJobs,
        ...findRelatedJobs(
          data.jobHistory,
          {
            resourceKeys: selectedAuditEvent?.entityId ? [selectedAuditEvent.entityId] : [],
            needles: selectedAuditNeedles
          },
          8
        )
      ].map((job) => [job.jobId, job] as const)
    ).values()
  ).slice(0, 8);

  const auditEventGroups = groupItemsBy(filteredAuditEvents, (event) => event.eventType).slice(0, 6);
  const auditActorGroups = groupItemsBy(filteredAuditEvents, formatActorLabel).slice(0, 6);
  const auditEntityGroups = groupItemsBy(
    filteredAuditEvents.filter((event) => Boolean(formatEntityKey(event))),
    formatEntityKey
  ).slice(0, 6);
  const activeAuditFilterItems = buildActiveAuditFilterItems(copy, currentAuditFilters);
  const auditFilterForm = renderAuditFilterForm({
    copy,
    data,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    renderWorkspaceFilterForm
  });
  const selectedAuditPanel = renderSelectedAuditPanel({
    copy,
    locale,
    selectedAuditEvent,
    selectedAuditRelatedJobs,
    currentAuditFilters,
    formatDate,
    renderActionFacts,
    renderCodeBlock,
    renderDetailGrid
  });
  const activeAuditFiltersPanel = renderActiveFiltersPanel(
    copy,
    activeAuditFilterItems,
    buildDashboardViewUrl("audit")
  );
  const selectedAuditJobsPanel = renderJobFeedPanel(copy, locale, selectedAuditRelatedJobs);

  const eventTypeCount = new Set(filteredAuditEvents.map((event) => event.eventType)).size;
  const actorCount = new Set(filteredAuditEvents.map((event) => formatActorLabel(event))).size;
  const entityCount = new Set(
    filteredAuditEvents.map((event) => formatEntityKey(event)).filter(Boolean)
  ).size;

  return `<section id="section-audit-history" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.auditTrailTitle, value: String(filteredAuditEvents.length), tone: filteredAuditEvents.length > 0 ? "default" : "muted" },
      { label: copy.auditSignalsTitle, value: String(eventTypeCount), tone: eventTypeCount > 0 ? "default" : "muted" },
      { label: copy.auditActorsTitle, value: String(actorCount), tone: actorCount > 0 ? "default" : "muted" },
      { label: copy.auditEntitiesTitle, value: String(entityCount), tone: entityCount > 0 ? "default" : "muted" }
    ])}
    ${auditFilterForm}
    ${activeAuditFiltersPanel}
    ${renderDataTable({
      id: "section-audit-history-table",
      heading: copy.auditTrailTitle,
      description: copy.auditTrailDescription,
      headingBadgeClassName: "section-badge-lime",
      restoreSelectionHref: true,
      columns: [
        { label: copy.filterEventLabel },
        { label: copy.filterActorLabel, className: "mono" },
        { label: copy.filterEntityLabel, className: "mono" },
        { label: copy.jobColCreated }
      ],
      rows: auditRows,
      emptyMessage: copy.noRelatedRecords,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid-two-desktop">
      ${selectedAuditPanel}
      <div class="stack">
        ${renderRelatedPanel(
          copy.auditSignalsTitle,
          copy.auditSignalsDescription,
          auditEventGroups.map((group) => ({
            title: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("audit", undefined, undefined, {
                ...currentAuditFilters,
                auditType: group.key
              })
            )}">${escapeHtml(group.key)}</a>`,
            meta: escapeHtml(String(group.items.length)),
            summary: escapeHtml(formatDate(group.items[0]?.occurredAt, locale)),
            tone: "default" as const
          })),
          copy.noRelatedRecords
        )}
        ${renderRelatedPanel(
          copy.auditActorsTitle,
          copy.auditActorsDescription,
          auditActorGroups.map((group) => ({
            title: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("audit", undefined, undefined, {
                ...currentAuditFilters,
                auditActor: group.key
              })
            )}">${escapeHtml(group.key)}</a>`,
            meta: escapeHtml(String(group.items.length)),
            summary: escapeHtml(
              groupItemsBy(
                group.items.filter((event) => Boolean(formatEntityKey(event))),
                formatEntityKey
              )
                .slice(0, 2)
                .map((entry) => entry.key)
                .join(" · ") || copy.none
            ),
            tone: "default" as const
          })),
          copy.noRelatedRecords
        )}
        ${renderRelatedPanel(
          copy.auditEntitiesTitle,
          copy.auditEntitiesDescription,
          auditEntityGroups.map((group) => ({
            title: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("audit", undefined, undefined, {
                ...currentAuditFilters,
                auditEntity: group.key.includes(":") ? group.key.split(":").slice(1).join(":") : group.key
              })
            )}">${escapeHtml(group.key)}</a>`,
            meta: escapeHtml(String(group.items.length)),
            summary: escapeHtml(
              groupItemsBy(group.items, (event) => event.eventType)
                .slice(0, 3)
                .map((entry) => `${entry.key}:${entry.items.length}`)
                .join(" · ")
            ),
            tone: "default" as const
          })),
          copy.noRelatedRecords
        )}
        ${selectedAuditEvent ? selectedAuditJobsPanel : ""}
      </div>
    </div>
  </section>`;
}
