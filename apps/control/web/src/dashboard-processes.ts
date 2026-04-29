import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { formatBytes } from "./dashboard-formatters.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type ProcessEntry = NonNullable<DashboardData["nodeHealth"][number]["processes"]>["processes"][number];

function formatPercent(value: number | undefined, copy: WebCopy): string {
  return value === undefined ? copy.none : `${value.toFixed(1)}%`;
}

function formatLoad(value: number | undefined, copy: WebCopy): string {
  return value === undefined ? copy.none : value.toFixed(2);
}

function formatDuration(seconds: number | undefined, copy: WebCopy): string {
  if (seconds === undefined) {
    return copy.none;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return [
    days > 0 ? `${days}d` : "",
    hours > 0 ? `${hours}h` : "",
    `${minutes}m`
  ].filter(Boolean).join(" ");
}

function buildProcessRows(args: {
  copy: WebCopy;
  data: DashboardData;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
}): DataTableRow[] {
  const { copy, data, renderFocusLink } = args;

  return data.nodeHealth.flatMap((node) => {
    return (node.processes?.processes ?? []).map((process) => ({
      selectionKey: `${node.nodeId}:${process.pid}:${process.command}`,
      selected: false,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("processes", undefined, node.nodeId),
          false,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(String(process.pid))}</span>`,
        escapeHtml(process.user ?? copy.none),
        escapeHtml(formatPercent(process.cpuPercent, copy)),
        escapeHtml(formatPercent(process.memoryPercent, copy)),
        escapeHtml(
          process.residentMemoryBytes === undefined
            ? copy.none
            : formatBytes(process.residentMemoryBytes)
        ),
        escapeHtml(process.command)
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        String(process.pid),
        process.user ?? "",
        process.command
      ].join(" ")
    }));
  });
}

function renderProcessCard(args: {
  copy: WebCopy;
  process: ProcessEntry;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, process, renderPill } = args;
  const cpuTone = (process.cpuPercent ?? 0) >= 80 ? "danger" : "muted";

  return `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(process.command)}</h3>
        <p class="muted section-description">${escapeHtml(`${copy.processPidLabel} ${process.pid}`)}</p>
      </div>
      ${renderPill(formatPercent(process.cpuPercent, copy), cpuTone)}
    </div>
    ${renderActionFacts(
      [
        { label: copy.processUserLabel, value: escapeHtml(process.user ?? copy.none) },
        { label: copy.processMemoryLabel, value: escapeHtml(formatPercent(process.memoryPercent, copy)) },
        {
          label: copy.processRssLabel,
          value: escapeHtml(
            process.residentMemoryBytes === undefined
              ? copy.none
              : formatBytes(process.residentMemoryBytes)
          )
        },
        {
          label: copy.processElapsedLabel,
          value: escapeHtml(formatDuration(process.elapsedSeconds, copy))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderSelectedNodeProcessesPanel(args: {
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

  const processes = selectedNode.processes;
  const processCards =
    processes?.processes.length
      ? processes.processes
          .slice(0, 12)
          .map((process) => renderProcessCard({ copy, process, renderPill }))
          .join("")
      : `<p class="empty">${escapeHtml(copy.noProcesses)}</p>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.processesSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.processLoadLabel,
          value: escapeHtml(
            [
              formatLoad(processes?.loadAverage1m, copy),
              formatLoad(processes?.loadAverage5m, copy),
              formatLoad(processes?.loadAverage15m, copy)
            ].join(" / ")
          )
        },
        {
          label: copy.processUptimeLabel,
          value: escapeHtml(formatDuration(processes?.uptimeSeconds, copy))
        },
        {
          label: copy.metricsMemoryTotal,
          value: escapeHtml(
            processes?.totalMemoryBytes === undefined
              ? copy.none
              : formatBytes(processes.totalMemoryBytes)
          )
        },
        {
          label: copy.processAvailableMemoryLabel,
          value: escapeHtml(
            processes?.availableMemoryBytes === undefined
              ? copy.none
              : formatBytes(processes.availableMemoryBytes)
          )
        },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(processes?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${processCards}</div>
  </article>`;
}

export function renderProcessesWorkspace(args: {
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
  const processEntries = data.nodeHealth.flatMap((node) => node.processes?.processes ?? []);
  const maxLoad1m = data.nodeHealth.reduce(
    (max, node) => Math.max(max, node.processes?.loadAverage1m ?? 0),
    0
  );
  const highCpuCount = processEntries.filter((process) => (process.cpuPercent ?? 0) >= 80).length;
  const rows = buildProcessRows({
    copy,
    data,
    renderFocusLink
  });

  const table = renderDataTable({
    id: "section-processes-table",
    heading: copy.processesInventoryTitle,
    description: copy.processesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.processPidLabel, className: "mono" },
      { label: copy.processUserLabel },
      { label: copy.processCpuLabel },
      { label: copy.processMemoryLabel },
      { label: copy.processRssLabel },
      { label: copy.processCommandLabel }
    ],
    rows,
    emptyMessage: copy.noProcesses,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-processes" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.processesInventoryTitle, value: String(processEntries.length), tone: processEntries.length > 0 ? "success" : "muted" },
      { label: copy.processLoadLabel, value: maxLoad1m.toFixed(2), tone: maxLoad1m >= 4 ? "danger" : "success" },
      { label: copy.processCpuLabel, value: String(highCpuCount), tone: highCpuCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedNodeProcessesPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
