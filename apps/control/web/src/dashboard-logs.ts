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

type LogEntry = NonNullable<DashboardData["nodeHealth"][number]["logs"]>["entries"][number];
type LogRecord = RuntimeSelectionRecord<LogEntry>;

function logTone(entry: LogEntry): "default" | "success" | "danger" | "muted" {
  if (entry.priority !== undefined && entry.priority <= 3) {
    return "danger";
  }

  if (entry.priority === 4) {
    return "muted";
  }

  return "default";
}

function buildLogRows(args: {
  copy: WebCopy;
  records: LogRecord[];
  selectedRecord: LogRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: entry, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("logs", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        `<span class="mono">${escapeHtml(entry.unit ?? copy.none)}</span>`,
        renderPill(entry.priorityLabel ?? String(entry.priority ?? copy.none), logTone(entry)),
        escapeHtml(formatDate(entry.occurredAt, locale)),
        escapeHtml(entry.message)
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        entry.unit ?? "",
        entry.priorityLabel ?? "",
        entry.message
      ].join(" ")
    };
  });
}

function renderSelectedLogPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: LogRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noLogs)}</p></article>`;
  }

  const { node: selectedNode, item: entry } = selectedRecord;
  const logItem = `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(entry.unit ?? copy.none)}</h3>
        <p class="muted section-description">${escapeHtml(formatDate(entry.occurredAt, locale))}</p>
      </div>
      ${renderPill(entry.priorityLabel ?? String(entry.priority ?? copy.none), logTone(entry))}
    </div>
    <p>${escapeHtml(entry.message)}</p>
  </article>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.logsSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.records, value: escapeHtml("1") },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(selectedNode.logs?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${logItem}</div>
  </article>`;
}

export function renderLogsWorkspace(args: {
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
  const logRecords = data.nodeHealth.flatMap((node) =>
    (node.logs?.entries ?? []).map((entry) => ({
      node,
      item: entry,
      key: `${node.nodeId}:${entry.occurredAt}:${entry.unit ?? ""}:${entry.message}`
    }))
  );
  const selectedLog = selectRuntimeRecord(logRecords, focus);
  const entries = data.nodeHealth.flatMap((node) => node.logs?.entries ?? []);
  const errorCount = entries.filter((entry) => entry.priority !== undefined && entry.priority <= 3).length;
  const warningCount = entries.filter((entry) => entry.priority === 4).length;
  const unitCount = new Set(entries.map((entry) => entry.unit).filter(Boolean)).size;
  const rows = buildLogRows({
    copy,
    records: logRecords,
    selectedRecord: selectedLog,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-logs-table",
    heading: copy.logsInventoryTitle,
    description: copy.logsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.serviceNameLabel, className: "mono" },
      { label: copy.logPriorityLabel },
      { label: copy.generatedAt },
      { label: copy.logMessageLabel, className: "table-col-runtime-text-compact" }
    ],
    rows,
    emptyMessage: copy.noLogs,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-logs" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.records, value: String(entries.length), tone: entries.length > 0 ? "success" : "muted" },
      { label: copy.serviceNameLabel, value: String(unitCount), tone: unitCount > 0 ? "success" : "muted" },
      { label: copy.warningLogsLabel, value: String(warningCount), tone: warningCount > 0 ? "danger" : "success" },
      { label: copy.errorLogsLabel, value: String(errorCount), tone: errorCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedLogPanel({
      copy,
      locale,
      selectedRecord: selectedLog,
      formatDate,
      renderPill
    })}
  </section>`;
}
