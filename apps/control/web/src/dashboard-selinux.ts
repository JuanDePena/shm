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

function selinuxTone(mode: string | undefined): "default" | "success" | "danger" | "muted" {
  const normalized = mode?.toLowerCase();

  if (normalized === "enforcing") {
    return "success";
  }

  if (normalized === "permissive" || normalized === "disabled") {
    return "danger";
  }

  return "muted";
}

function buildSelinuxRows(args: {
  copy: WebCopy;
  data: DashboardData;
  selectedNode: DashboardData["nodeHealth"][number] | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, selectedNode, locale, formatDate, renderPill } = args;

  return data.nodeHealth.map((node) => {
    const selected = selectedNode?.nodeId === node.nodeId;

    return {
      selectionKey: node.nodeId,
      selected,
      cells: [
        `<a href="${escapeHtml(buildDashboardViewUrl("selinux", undefined, node.nodeId))}" class="mono detail-link">${escapeHtml(node.nodeId)}</a>${selected ? ` ${renderPill(copy.selectedStateLabel, "success")}` : ""}`,
        escapeHtml(node.hostname),
        renderPill(node.selinux?.currentMode ?? copy.notReportedLabel, selinuxTone(node.selinux?.currentMode)),
        escapeHtml(node.selinux?.configuredMode ?? copy.none),
        escapeHtml(node.selinux?.policyName ?? copy.none),
        escapeHtml(node.selinux?.policyVersion ?? copy.none),
        escapeHtml(formatDate(node.selinux?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        node.selinux?.status ?? "",
        node.selinux?.currentMode ?? "",
        node.selinux?.configuredMode ?? "",
        node.selinux?.policyName ?? "",
        node.selinux?.policyVersion ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedNodeSelinuxPanel(args: {
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

  const selinux = selectedNode.selinux;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selinuxSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.selinuxCurrentModeLabel,
          value: renderPill(selinux?.currentMode ?? copy.notReportedLabel, selinuxTone(selinux?.currentMode))
        },
        { label: copy.selinuxStatusLabel, value: escapeHtml(selinux?.status ?? copy.none) },
        { label: copy.selinuxConfiguredModeLabel, value: escapeHtml(selinux?.configuredMode ?? copy.none) },
        { label: copy.selinuxPolicyLabel, value: escapeHtml(selinux?.policyName ?? copy.none) },
        { label: copy.selinuxPolicyVersionLabel, value: escapeHtml(selinux?.policyVersion ?? copy.none) },
        { label: copy.generatedAt, value: escapeHtml(formatDate(selinux?.checkedAt, locale)) }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

export function renderSelinuxWorkspace(args: {
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
  const enforcingCount = data.nodeHealth.filter(
    (node) => node.selinux?.currentMode?.toLowerCase() === "enforcing"
  ).length;
  const weakCount = data.nodeHealth.filter((node) =>
    ["permissive", "disabled"].includes(node.selinux?.currentMode?.toLowerCase() ?? "")
  ).length;
  const reportedCount = data.nodeHealth.filter((node) => node.selinux).length;
  const rows = buildSelinuxRows({ copy, data, selectedNode, locale, formatDate, renderPill });

  const table = renderDataTable({
    id: "section-selinux-table",
    heading: copy.selinuxInventoryTitle,
    description: copy.selinuxInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.selinuxCurrentModeLabel },
      { label: copy.selinuxConfiguredModeLabel },
      { label: copy.selinuxPolicyLabel },
      { label: copy.selinuxPolicyVersionLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noSelinux,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-selinux" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.selinuxReportedLabel, value: String(reportedCount), tone: reportedCount > 0 ? "success" : "muted" },
      { label: copy.selinuxEnforcingLabel, value: String(enforcingCount), tone: enforcingCount === data.nodeHealth.length ? "success" : "default" },
      { label: copy.selinuxWeakModeLabel, value: String(weakCount), tone: weakCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedNodeSelinuxPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
