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

type NetworkInterface = NonNullable<DashboardData["nodeHealth"][number]["network"]>["interfaces"][number];
type NetworkListener = NonNullable<DashboardData["nodeHealth"][number]["network"]>["listeners"][number];
type NetworkRoute = NonNullable<DashboardData["nodeHealth"][number]["network"]>["routes"][number];

function formatInterfaceAddresses(networkInterface: NetworkInterface, copy: WebCopy): string {
  if (networkInterface.addresses.length === 0) {
    return copy.none;
  }

  return networkInterface.addresses
    .map((address) =>
      [
        address.family,
        `${address.address}${address.prefixLength === undefined ? "" : `/${address.prefixLength}`}`
      ].join(" ")
    )
    .join(", ");
}

function formatListenerAddress(listener: NetworkListener): string {
  return listener.port === undefined
    ? listener.localAddress
    : `${listener.localAddress}:${listener.port}`;
}

function isExposedListener(listener: NetworkListener): boolean {
  const address = listener.localAddress.toLowerCase();

  return !(
    address === "localhost" ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("fe80:")
  );
}

function buildNetworkListenerRows(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    return (node.network?.listeners ?? []).map((listener) => ({
      selectionKey: `${node.nodeId}:${listener.protocol}:${formatListenerAddress(listener)}:${listener.process ?? ""}`,
      selected: false,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("network", undefined, node.nodeId),
          false,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        renderPill(listener.protocol.toUpperCase(), "muted"),
        `<span class="mono">${escapeHtml(listener.localAddress)}</span>`,
        `<span class="mono">${escapeHtml(String(listener.port ?? copy.none))}</span>`,
        escapeHtml(listener.state ?? copy.none),
        escapeHtml(listener.process ?? copy.none),
        escapeHtml(formatDate(node.network?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        listener.protocol,
        listener.localAddress,
        String(listener.port ?? ""),
        listener.state ?? "",
        listener.process ?? ""
      ].join(" ")
    }));
  });
}

function renderInterfaceCard(args: {
  copy: WebCopy;
  networkInterface: NetworkInterface;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, networkInterface, renderPill } = args;
  const state = networkInterface.state ?? copy.none;

  return `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(networkInterface.name)}</h3>
        <p class="muted section-description">${escapeHtml(formatInterfaceAddresses(networkInterface, copy))}</p>
      </div>
      ${renderPill(state, state.toLowerCase() === "up" ? "success" : "muted")}
    </div>
    ${renderActionFacts(
      [
        { label: copy.networkAddressLabel, value: escapeHtml(formatInterfaceAddresses(networkInterface, copy)) },
        { label: copy.networkMtuLabel, value: escapeHtml(String(networkInterface.mtu ?? copy.none)) },
        {
          label: copy.networkMacLabel,
          value: `<span class="mono">${escapeHtml(networkInterface.macAddress ?? copy.none)}</span>`
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderRouteCard(copy: WebCopy, route: NetworkRoute): string {
  return `<article class="panel panel-nested detail-shell">
    <h3>${escapeHtml(route.destination)}</h3>
    ${renderActionFacts(
      [
        {
          label: copy.networkGatewayLabel,
          value: `<span class="mono">${escapeHtml(route.gateway ?? copy.none)}</span>`
        },
        {
          label: copy.networkDeviceLabel,
          value: `<span class="mono">${escapeHtml(route.device ?? copy.none)}</span>`
        },
        { label: copy.networkProtocolLabel, value: escapeHtml(route.protocol ?? route.family ?? copy.none) },
        {
          label: copy.networkAddressLabel,
          value: `<span class="mono">${escapeHtml(route.source ?? copy.none)}</span>`
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderSelectedNodeNetworkPanel(args: {
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

  const network = selectedNode.network;
  const interfaces = network?.interfaces ?? [];
  const routes = network?.routes ?? [];
  const interfaceCards =
    interfaces.length === 0
      ? `<p class="empty">${escapeHtml(copy.noNetwork)}</p>`
      : interfaces
          .map((networkInterface) =>
            renderInterfaceCard({ copy, networkInterface, renderPill })
          )
          .join("");
  const routeCards =
    routes.length === 0
      ? `<p class="empty">${escapeHtml(copy.noNetwork)}</p>`
      : `<div class="grid grid-two">${routes.map((route) => renderRouteCard(copy, route)).join("")}</div>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.networkSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.networkInterfacesTitle, value: escapeHtml(String(interfaces.length)) },
        { label: copy.networkRoutesTitle, value: escapeHtml(String(routes.length)) },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(network?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.networkInterfacesTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.networkSelectedNodeTitle)}</p>
        </div>
      </div>
      <div class="stack">${interfaceCards}</div>
    </article>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.networkRoutesTitle)}</h3>
          <p class="muted section-description">${escapeHtml(selectedNode.nodeId)}</p>
        </div>
      </div>
      ${routeCards}
    </article>
  </article>`;
}

export function renderNetworkWorkspace(args: {
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
  const interfaces = data.nodeHealth.flatMap((node) => node.network?.interfaces ?? []);
  const listeners = data.nodeHealth.flatMap((node) => node.network?.listeners ?? []);
  const routes = data.nodeHealth.flatMap((node) => node.network?.routes ?? []);
  const exposedListenerCount = listeners.filter(isExposedListener).length;
  const rows = buildNetworkListenerRows({
    copy,
    data,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-network-table",
    heading: copy.networkListenersTitle,
    description: copy.networkListenersDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.networkProtocolLabel },
      { label: copy.networkAddressLabel, className: "mono" },
      { label: copy.networkPortLabel, className: "mono" },
      { label: copy.networkStateLabel },
      { label: copy.networkProcessLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noNetwork,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-network" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.networkInterfacesTitle, value: String(interfaces.length), tone: interfaces.length > 0 ? "success" : "muted" },
      { label: copy.networkListenersTitle, value: String(listeners.length), tone: listeners.length > 0 ? "success" : "muted" },
      { label: copy.networkExposedListenersLabel, value: String(exposedListenerCount), tone: exposedListenerCount > 0 ? "default" : "success" },
      { label: copy.networkRoutesTitle, value: String(routes.length), tone: routes.length > 0 ? "success" : "muted" }
    ])}
    ${table}
    ${renderSelectedNodeNetworkPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
