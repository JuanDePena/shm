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

type SystemTimer = NonNullable<DashboardData["nodeHealth"][number]["timers"]>["timers"][number];

function timerTone(timer: SystemTimer): "default" | "success" | "danger" | "muted" {
  if (!timer.nextElapse && !timer.left) {
    return "muted";
  }

  return "success";
}

function buildTimerRows(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderPill } = args;

  return data.nodeHealth.flatMap((node) =>
    (node.timers?.timers ?? []).map((timer) => ({
      selectionKey: `${node.nodeId}:${timer.timerName}`,
      selected: false,
      cells: [
        `<a href="${escapeHtml(buildDashboardViewUrl("timers", undefined, node.nodeId))}" class="mono detail-link">${escapeHtml(node.nodeId)}</a>`,
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(timer.timerName)}</span>`,
        escapeHtml(timer.activates ?? copy.none),
        renderPill(timer.left ?? copy.none, timerTone(timer)),
        escapeHtml(formatDate(timer.nextElapse, locale)),
        escapeHtml(formatDate(timer.lastTrigger, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        timer.timerName,
        timer.activates ?? "",
        timer.left ?? "",
        timer.passed ?? ""
      ].join(" ")
    }))
  );
}

function renderSelectedNodeTimersPanel(args: {
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

  const timers = selectedNode.timers?.timers ?? [];
  const cards =
    timers.length === 0
      ? `<p class="empty">${escapeHtml(copy.noTimers)}</p>`
      : timers
          .slice(0, 24)
          .map(
            (timer) => `<article class="panel panel-nested detail-shell">
              <div class="section-head">
                <div>
                  <h3>${escapeHtml(timer.timerName)}</h3>
                  <p class="muted section-description">${escapeHtml(timer.activates ?? copy.none)}</p>
                </div>
                ${renderPill(timer.left ?? copy.none, timerTone(timer))}
              </div>
              ${renderActionFacts(
                [
                  { label: copy.timerNextLabel, value: escapeHtml(formatDate(timer.nextElapse, locale)) },
                  { label: copy.timerLastLabel, value: escapeHtml(formatDate(timer.lastTrigger, locale)) },
                  { label: copy.timerPassedLabel, value: escapeHtml(timer.passed ?? copy.none) }
                ],
                { className: "action-card-facts-wide-labels" }
              )}
            </article>`
          )
          .join("");

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.timersSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.timersInventoryTitle, value: escapeHtml(String(timers.length)) },
        { label: copy.generatedAt, value: escapeHtml(formatDate(selectedNode.timers?.checkedAt, locale)) }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${cards}</div>
  </article>`;
}

export function renderTimersWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  focus?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const { copy, data, locale, focus, formatDate, renderPill, renderSignalStrip } = args;
  const selectedNode = data.nodeHealth.find((node) => node.nodeId === focus) ?? data.nodeHealth[0];
  const timers = data.nodeHealth.flatMap((node) => node.timers?.timers ?? []);
  const scheduledCount = timers.filter((timer) => timer.nextElapse || timer.left).length;
  const serviceCount = new Set(timers.map((timer) => timer.activates).filter(Boolean)).size;
  const rows = buildTimerRows({ copy, data, locale, formatDate, renderPill });

  const table = renderDataTable({
    id: "section-timers-table",
    heading: copy.timersInventoryTitle,
    description: copy.timersInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.timerNameLabel, className: "mono" },
      { label: copy.timerActivatesLabel },
      { label: copy.timerLeftLabel },
      { label: copy.timerNextLabel },
      { label: copy.timerLastLabel }
    ],
    rows,
    emptyMessage: copy.noTimers,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-timers" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.timersInventoryTitle, value: String(timers.length), tone: timers.length > 0 ? "success" : "muted" },
      { label: copy.timerScheduledLabel, value: String(scheduledCount), tone: scheduledCount > 0 ? "success" : "muted" },
      { label: copy.timerActivatesLabel, value: String(serviceCount), tone: serviceCount > 0 ? "success" : "muted" }
    ])}
    ${table}
    ${renderSelectedNodeTimersPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
