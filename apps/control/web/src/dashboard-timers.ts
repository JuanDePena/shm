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

type SystemTimer = NonNullable<DashboardData["nodeHealth"][number]["timers"]>["timers"][number];
type TimerRecord = RuntimeSelectionRecord<SystemTimer>;

function timerTone(timer: SystemTimer): "default" | "success" | "danger" | "muted" {
  if (!timer.nextElapse && !timer.left) {
    return "muted";
  }

  return "success";
}

function buildTimerRows(args: {
  copy: WebCopy;
  records: TimerRecord[];
  selectedRecord: TimerRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderPill } = args;

  return records.map((record) => {
    const { node, item: timer, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        `<a href="${escapeHtml(buildDashboardViewUrl("timers", undefined, key))}" class="mono detail-link">${escapeHtml(node.nodeId)}</a>${selected ? ` ${renderPill(copy.selectedStateLabel, "success")}` : ""}`,
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
    };
  });
}

function renderSelectedNodeTimersPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: TimerRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noTimers)}</p></article>`;
  }

  const { node: selectedNode, item: timer } = selectedRecord;
  const card = `<article class="panel panel-nested detail-shell">
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
  </article>`;

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
        { label: copy.timersInventoryTitle, value: escapeHtml("1") },
        { label: copy.generatedAt, value: escapeHtml(formatDate(selectedNode.timers?.checkedAt, locale)) }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${card}</div>
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
  const timerRecords = data.nodeHealth.flatMap((node) =>
    (node.timers?.timers ?? []).map((timer) => ({
      node,
      item: timer,
      key: `${node.nodeId}:${timer.timerName}`
    }))
  );
  const selectedTimer = selectRuntimeRecord(timerRecords, focus);
  const timers = data.nodeHealth.flatMap((node) => node.timers?.timers ?? []);
  const scheduledCount = timers.filter((timer) => timer.nextElapse || timer.left).length;
  const serviceCount = new Set(timers.map((timer) => timer.activates).filter(Boolean)).size;
  const rows = buildTimerRows({
    copy,
    records: timerRecords,
    selectedRecord: selectedTimer,
    locale,
    formatDate,
    renderPill
  });

  const table = renderDataTable({
    id: "section-timers-table",
    heading: copy.timersInventoryTitle,
    description: copy.timersInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
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
      selectedRecord: selectedTimer,
      formatDate,
      renderPill
    })}
  </section>`;
}
