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

type ContainerEntry = NonNullable<DashboardData["nodeHealth"][number]["containers"]>["containers"][number];

function containerStateTone(
  state: string | undefined
): "default" | "success" | "danger" | "muted" {
  const normalized = state?.toLowerCase();

  if (normalized === "running") {
    return "success";
  }

  if (normalized === "exited" || normalized === "stopped" || normalized === "dead") {
    return "danger";
  }

  return "muted";
}

function shortContainerId(containerId: string): string {
  return containerId.slice(0, 12);
}

function formatContainerPorts(container: ContainerEntry, copy: WebCopy): string {
  if (container.ports.length === 0) {
    return copy.none;
  }

  return container.ports
    .map((port) => {
      if (port.raw) {
        return port.raw;
      }

      const target = [
        port.containerPort === undefined ? copy.none : String(port.containerPort),
        port.protocol
      ].filter(Boolean).join("/");
      const host =
        port.hostPort === undefined
          ? undefined
          : `${port.hostIp ?? "0.0.0.0"}:${port.hostPort}`;

      return host ? `${host}->${target}` : target;
    })
    .join(", ");
}

function buildContainerRows(args: {
  copy: WebCopy;
  data: DashboardData;
  selectedNodeId?: string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, selectedNodeId, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    const selected = selectedNodeId === node.nodeId;

    return (node.containers?.containers ?? []).map((container) => ({
      selectionKey: `${node.nodeId}:${container.id}`,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("containers", undefined, node.nodeId),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        escapeHtml(container.name ?? shortContainerId(container.id)),
        escapeHtml(container.image ?? copy.none),
        renderPill(container.state ?? copy.none, containerStateTone(container.state)),
        escapeHtml(formatContainerPorts(container, copy)),
        escapeHtml(container.networks.length > 0 ? container.networks.join(", ") : copy.none),
        escapeHtml(container.status ?? copy.none)
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        container.id,
        container.name ?? "",
        container.image ?? "",
        container.state ?? "",
        container.status ?? "",
        container.networks.join(" "),
        formatContainerPorts(container, copy)
      ].join(" ")
    }));
  });
}

function renderContainerCard(args: {
  copy: WebCopy;
  container: ContainerEntry;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, container, locale, formatDate, renderPill } = args;

  return `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(container.name ?? shortContainerId(container.id))}</h3>
        <p class="muted section-description">${escapeHtml(container.image ?? copy.none)}</p>
      </div>
      ${renderPill(container.state ?? copy.none, containerStateTone(container.state))}
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.containerIdLabel,
          value: `<span class="mono">${escapeHtml(shortContainerId(container.id))}</span>`
        },
        { label: copy.containerPortsLabel, value: escapeHtml(formatContainerPorts(container, copy)) },
        {
          label: copy.containerNetworksLabel,
          value: escapeHtml(container.networks.length > 0 ? container.networks.join(", ") : copy.none)
        },
        { label: copy.containerStartedLabel, value: escapeHtml(formatDate(container.startedAt, locale)) },
        { label: copy.containerCreatedLabel, value: escapeHtml(formatDate(container.createdAt, locale)) }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderSelectedNodeContainersPanel(args: {
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

  const containers = selectedNode.containers?.containers ?? [];
  const containerCards =
    containers.length === 0
      ? `<p class="empty">${escapeHtml(copy.noContainers)}</p>`
      : containers
          .map((container) =>
            renderContainerCard({ copy, container, locale, formatDate, renderPill })
          )
          .join("");

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.containersSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.containersInventoryTitle, value: escapeHtml(String(containers.length)) },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(selectedNode.containers?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="stack">${containerCards}</div>
  </article>`;
}

export function renderContainersWorkspace(args: {
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
  const containers = data.nodeHealth.flatMap((node) => node.containers?.containers ?? []);
  const runningCount = containers.filter((container) => container.state?.toLowerCase() === "running").length;
  const stoppedCount = containers.filter((container) =>
    ["exited", "stopped", "dead"].includes(container.state?.toLowerCase() ?? "")
  ).length;
  const imageCount = new Set(containers.map((container) => container.image).filter(Boolean)).size;
  const rows = buildContainerRows({
    copy,
    data,
    selectedNodeId: selectedNode?.nodeId,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-containers-table",
    heading: copy.containersInventoryTitle,
    description: copy.containersInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.containerNameLabel },
      { label: copy.containerImageLabel },
      { label: copy.containerStateLabel },
      { label: copy.containerPortsLabel },
      { label: copy.containerNetworksLabel },
      { label: copy.containerStatusLabel }
    ],
    rows,
    emptyMessage: copy.noContainers,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-containers" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.containersInventoryTitle, value: String(containers.length), tone: containers.length > 0 ? "success" : "muted" },
      { label: copy.containerRunningLabel, value: String(runningCount), tone: runningCount > 0 ? "success" : "muted" },
      { label: copy.containerStoppedLabel, value: String(stoppedCount), tone: stoppedCount > 0 ? "danger" : "success" },
      { label: copy.containerImageLabel, value: String(imageCount), tone: imageCount > 0 ? "success" : "muted" }
    ])}
    ${table}
    ${renderSelectedNodeContainersPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
