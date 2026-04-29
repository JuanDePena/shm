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

function sshServiceTone(active: boolean | undefined): "default" | "success" | "danger" | "muted" {
  if (active === undefined) {
    return "muted";
  }

  return active ? "success" : "danger";
}

function sshRiskTone(value: string | undefined): "default" | "success" | "danger" | "muted" {
  if (value === undefined) {
    return "muted";
  }

  return ["yes", "true"].includes(value.toLowerCase()) ? "danger" : "success";
}

function buildSshRows(args: {
  copy: WebCopy;
  data: DashboardData;
  selectedNode: DashboardData["nodeHealth"][number] | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, selectedNode, locale, formatDate, renderPill } = args;

  return data.nodeHealth.map((node) => {
    const ssh = node.ssh;
    const selected = selectedNode?.nodeId === node.nodeId;

    return {
      selectionKey: node.nodeId,
      selected,
      cells: [
        `<a href="${escapeHtml(buildDashboardViewUrl("ssh", undefined, node.nodeId))}" class="mono detail-link">${escapeHtml(node.nodeId)}</a>${selected ? ` ${renderPill(copy.selectedStateLabel, "success")}` : ""}`,
        escapeHtml(node.hostname),
        renderPill(ssh?.active ? "active" : copy.notReportedLabel, sshServiceTone(ssh?.active)),
        escapeHtml(String(ssh?.effective.port ?? copy.none)),
        renderPill(ssh?.effective.permitRootLogin ?? copy.none, sshRiskTone(ssh?.effective.permitRootLogin)),
        renderPill(ssh?.effective.passwordAuthentication ?? copy.none, sshRiskTone(ssh?.effective.passwordAuthentication)),
        escapeHtml(String(ssh?.rootAuthorizedKeyCount ?? copy.none)),
        escapeHtml(formatDate(ssh?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        ssh?.serviceName ?? "",
        ssh?.effective.permitRootLogin ?? "",
        ssh?.effective.passwordAuthentication ?? "",
        ssh?.effective.pubkeyAuthentication ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedNodeSshPanel(args: {
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

  const ssh = selectedNode.ssh;
  const effective = ssh?.effective;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.sshSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.serviceStateLabel, value: renderPill(ssh?.active ? "active" : copy.notReportedLabel, sshServiceTone(ssh?.active)) },
        { label: copy.enabledStateLabel, value: escapeHtml(ssh?.enabled === undefined ? copy.none : String(ssh.enabled)) },
        { label: copy.sshPortLabel, value: escapeHtml(String(effective?.port ?? copy.none)) },
        { label: copy.sshPermitRootLoginLabel, value: renderPill(effective?.permitRootLogin ?? copy.none, sshRiskTone(effective?.permitRootLogin)) },
        { label: copy.sshPasswordAuthLabel, value: renderPill(effective?.passwordAuthentication ?? copy.none, sshRiskTone(effective?.passwordAuthentication)) },
        { label: copy.sshPubkeyAuthLabel, value: escapeHtml(effective?.pubkeyAuthentication ?? copy.none) },
        { label: copy.sshTcpForwardingLabel, value: renderPill(effective?.allowTcpForwarding ?? copy.none, sshRiskTone(effective?.allowTcpForwarding)) },
        { label: copy.sshAgentForwardingLabel, value: renderPill(effective?.allowAgentForwarding ?? copy.none, sshRiskTone(effective?.allowAgentForwarding)) },
        { label: copy.sshX11ForwardingLabel, value: renderPill(effective?.x11Forwarding ?? copy.none, sshRiskTone(effective?.x11Forwarding)) },
        { label: copy.sshPermitOpenLabel, value: escapeHtml(effective?.permitOpen.join(", ") || copy.none) },
        { label: copy.sshRootKeysLabel, value: escapeHtml(String(ssh?.rootAuthorizedKeyCount ?? copy.none)) },
        { label: copy.generatedAt, value: escapeHtml(formatDate(ssh?.checkedAt, locale)) }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

export function renderSshWorkspace(args: {
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
  const reportedCount = data.nodeHealth.filter((node) => node.ssh).length;
  const activeCount = data.nodeHealth.filter((node) => node.ssh?.active).length;
  const passwordAuthCount = data.nodeHealth.filter(
    (node) => node.ssh?.effective.passwordAuthentication?.toLowerCase() === "yes"
  ).length;
  const rootLoginCount = data.nodeHealth.filter(
    (node) => node.ssh?.effective.permitRootLogin?.toLowerCase() === "yes"
  ).length;
  const rows = buildSshRows({ copy, data, selectedNode, locale, formatDate, renderPill });

  const table = renderDataTable({
    id: "section-ssh-table",
    heading: copy.sshInventoryTitle,
    description: copy.sshInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.serviceStateLabel },
      { label: copy.sshPortLabel },
      { label: copy.sshPermitRootLoginLabel },
      { label: copy.sshPasswordAuthLabel },
      { label: copy.sshRootKeysLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noSsh,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-ssh" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.sshReportedLabel, value: String(reportedCount), tone: reportedCount > 0 ? "success" : "muted" },
      { label: copy.serviceStateLabel, value: String(activeCount), tone: activeCount === data.nodeHealth.length ? "success" : "danger" },
      { label: copy.sshPasswordAuthLabel, value: String(passwordAuthCount), tone: passwordAuthCount > 0 ? "danger" : "success" },
      { label: copy.sshPermitRootLoginLabel, value: String(rootLoginCount), tone: rootLoginCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedNodeSshPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
