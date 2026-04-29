import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  isRuntimeRecordSelected,
  selectRuntimeRecord,
  type RuntimeSelectionRecord
} from "./dashboard-runtime-selection.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type TimeSync = NonNullable<DashboardData["nodeHealth"][number]["timeSync"]>;
type TimeSyncRecord = RuntimeSelectionRecord<TimeSync>;

function booleanLabel(value: boolean | undefined, copy: WebCopy): string {
  if (value === undefined) {
    return copy.notReportedLabel;
  }

  return value ? copy.yesLabel : copy.noLabel;
}

function syncTone(timeSync: TimeSync | undefined): "default" | "success" | "danger" | "muted" {
  if (!timeSync || timeSync.synchronized === undefined) {
    return "muted";
  }

  return timeSync.synchronized ? "success" : "danger";
}

function syncLabel(timeSync: TimeSync | undefined, copy: WebCopy): string {
  if (!timeSync || timeSync.synchronized === undefined) {
    return copy.notReportedLabel;
  }

  return timeSync.synchronized ? copy.timeSynchronizedLabel : copy.timeUnsynchronizedLabel;
}

function buildTimeRows(args: {
  copy: WebCopy;
  records: TimeSyncRecord[];
  selectedRecord: TimeSyncRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: timeSync, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("time", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        renderPill(syncLabel(timeSync, copy), syncTone(timeSync)),
        renderPill(booleanLabel(timeSync.ntpEnabled, copy), timeSync.ntpEnabled ? "success" : "muted"),
        escapeHtml(timeSync.serviceName ?? copy.none),
        escapeHtml(timeSync.timezone ?? copy.none),
        escapeHtml(String(timeSync.sources.length)),
        escapeHtml(formatDate(timeSync.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        timeSync.timezone ?? "",
        timeSync.serviceName ?? "",
        timeSync.trackingSummary ?? "",
        ...timeSync.sources.map((source) => source.name)
      ].join(" ")
    };
  });
}

function renderSelectedTimePanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: TimeSyncRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noTimeSync)}</p></article>`;
  }

  const { node: selectedNode, item: timeSync } = selectedRecord;
  const sources = timeSync.sources.length > 0
    ? renderActionFacts(
        timeSync.sources.map((source) => ({
          label: source.name,
          value: escapeHtml(
            [
              source.marker,
              source.stratum === undefined ? "" : `stratum ${source.stratum}`,
              source.reach === undefined ? "" : `reach ${source.reach}`,
              source.lastRx ? `rx ${source.lastRx}` : "",
              source.lastSample ?? ""
            ]
              .filter(Boolean)
              .join(" ")
          )
        })),
        { className: "action-card-facts-wide-labels" }
      )
    : `<p class="empty">${escapeHtml(copy.noRelatedRecords)}</p>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.timeSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(selectedNode.nodeId)}</h3>
          <p class="muted section-description">${escapeHtml(timeSync.trackingSummary ?? copy.timeSelectedNodeDescription)}</p>
        </div>
        ${renderPill(syncLabel(timeSync, copy), syncTone(timeSync))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.timeTimezoneLabel, value: escapeHtml(timeSync.timezone ?? copy.none) },
          { label: copy.timeNtpLabel, value: escapeHtml(booleanLabel(timeSync.ntpEnabled, copy)) },
          { label: copy.timeSynchronizedLabel, value: escapeHtml(booleanLabel(timeSync.synchronized, copy)) },
          { label: copy.timeLocalRtcLabel, value: escapeHtml(booleanLabel(timeSync.localRtc, copy)) },
          { label: copy.timeServiceLabel, value: escapeHtml(timeSync.serviceName ?? copy.none) },
          { label: copy.serviceStateLabel, value: escapeHtml(booleanLabel(timeSync.serviceActive, copy)) },
          { label: copy.generatedAt, value: escapeHtml(formatDate(timeSync.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.timeSourcesLabel)}</h3>
          <p class="muted section-description">${escapeHtml(copy.timeSourcesDescription)}</p>
        </div>
      </div>
      ${sources}
    </article>
  </article>`;
}

export function renderTimeWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  focus?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const {
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink,
    renderPill,
    renderSignalStrip
  } = args;
  const timeRecords = data.nodeHealth.flatMap((node) =>
    node.timeSync
      ? [
          {
            node,
            item: node.timeSync,
            key: node.nodeId
          }
        ]
      : []
  );
  const selectedTime = selectRuntimeRecord(timeRecords, focus);
  const unsynchronizedCount = timeRecords.filter(
    (record) => record.item.synchronized === false
  ).length;
  const localRtcCount = timeRecords.filter((record) => record.item.localRtc === true).length;
  const activeServiceCount = timeRecords.filter((record) => record.item.serviceActive).length;
  const rows = buildTimeRows({
    copy,
    records: timeRecords,
    selectedRecord: selectedTime,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-time-table",
    heading: copy.timeInventoryTitle,
    description: copy.timeInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.timeSynchronizedLabel },
      { label: copy.timeNtpLabel },
      { label: copy.timeServiceLabel },
      { label: copy.timeTimezoneLabel },
      { label: copy.timeSourcesLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noTimeSync,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-time" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.rebootsReportedLabel, value: String(timeRecords.length), tone: timeRecords.length > 0 ? "success" : "muted" },
      { label: copy.timeServiceActiveLabel, value: String(activeServiceCount), tone: activeServiceCount > 0 ? "success" : "muted" },
      { label: copy.timeUnsynchronizedLabel, value: String(unsynchronizedCount), tone: unsynchronizedCount > 0 ? "danger" : "success" },
      { label: copy.timeLocalRtcLabel, value: String(localRtcCount), tone: localRtcCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedTimePanel({
      copy,
      locale,
      selectedRecord: selectedTime,
      formatDate,
      renderPill
    })}
  </section>`;
}
