import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type LogEntry = NonNullable<DashboardData["nodeHealth"][number]["logs"]>["entries"][number];

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
  data: DashboardData;
  locale: WebLocale;
  selectedNodeId?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, selectedNodeId, formatDate, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    const selected = selectedNodeId === node.nodeId;

    return (node.logs?.entries ?? []).map((entry) => ({
      selectionKey: `${node.nodeId}:${entry.occurredAt}:${entry.unit ?? ""}:${entry.message}`,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("logs", undefined, node.nodeId),
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
    }));
  });
}

function renderSelectedNodeLogsPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedNode: DashboardData["nodeHealth"][number] | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedNode, formatDate, renderPill } = args;

  if (!selectedNode) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noNodes)}</p></article>`;
  }

  const entries = selectedNode.logs?.entries ?? [];
  const logItems =
    entries.length === 0
      ? `<p class="empty">${escapeHtml(copy.noLogs)}</p>`
      : entries
          .slice(0, 24)
          .map(
            (entry) => `<article class="panel panel-nested detail-shell">
              <div class="section-head">
                <div>
                  <h3>${escapeHtml(entry.unit ?? copy.none)}</h3>
                  <p class="muted section-description">${escapeHtml(formatDate(entry.occurredAt, locale))}</p>
                </div>
                ${renderPill(entry.priorityLabel ?? String(entry.priority ?? copy.none), logTone(entry))}
              </div>
              <p>${escapeHtml(entry.message)}</p>
            </article>`
          )
          .join("");

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
        { label: copy.records, value: escapeHtml(String(entries.length)) },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(selectedNode.logs?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${logItems}</div>
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
  const selectedNode = data.nodeHealth.find((node) => node.nodeId === focus) ?? data.nodeHealth[0];
  const entries = data.nodeHealth.flatMap((node) => node.logs?.entries ?? []);
  const errorCount = entries.filter((entry) => entry.priority !== undefined && entry.priority <= 3).length;
  const warningCount = entries.filter((entry) => entry.priority === 4).length;
  const unitCount = new Set(entries.map((entry) => entry.unit).filter(Boolean)).size;
  const rows = buildLogRows({
    copy,
    data,
    locale,
    selectedNodeId: selectedNode?.nodeId,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-logs-table",
    heading: copy.logsInventoryTitle,
    description: copy.logsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.serviceNameLabel, className: "mono" },
      { label: copy.logPriorityLabel },
      { label: copy.generatedAt },
      { label: copy.logMessageLabel }
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
    ${renderSelectedNodeLogsPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
