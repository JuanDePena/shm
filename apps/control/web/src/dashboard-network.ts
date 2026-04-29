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

type NetworkListener = NonNullable<DashboardData["nodeHealth"][number]["network"]>["listeners"][number];
type NetworkListenerRecord = RuntimeSelectionRecord<NetworkListener>;

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
  records: NetworkListenerRecord[];
  selectedRecord: NetworkListenerRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: listener, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("network", undefined, key),
          selected,
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
    };
  });
}

function renderSelectedNodeNetworkPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: NetworkListenerRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noNetwork)}</p></article>`;
  }

  const { node: selectedNode, item: listener } = selectedRecord;
  const network = selectedNode.network;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.networkSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(`${selectedNode.hostname} · ${formatListenerAddress(listener)}`)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderActionFacts(
      [
        { label: copy.networkProtocolLabel, value: renderPill(listener.protocol.toUpperCase(), "muted") },
        {
          label: copy.networkAddressLabel,
          value: `<span class="mono">${escapeHtml(listener.localAddress)}</span>`
        },
        {
          label: copy.networkPortLabel,
          value: `<span class="mono">${escapeHtml(String(listener.port ?? copy.none))}</span>`
        },
        { label: copy.networkStateLabel, value: escapeHtml(listener.state ?? copy.none) },
        { label: copy.networkProcessLabel, value: escapeHtml(listener.process ?? copy.none) },
        {
          label: copy.generatedAt,
          value: escapeHtml(formatDate(network?.checkedAt, locale))
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
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
  const listenerRecords = data.nodeHealth.flatMap((node) =>
    (node.network?.listeners ?? []).map((listener) => ({
      node,
      item: listener,
      key: `${node.nodeId}:${listener.protocol}:${formatListenerAddress(listener)}:${listener.process ?? ""}`
    }))
  );
  const selectedListener = selectRuntimeRecord(listenerRecords, focus);
  const interfaces = data.nodeHealth.flatMap((node) => node.network?.interfaces ?? []);
  const listeners = data.nodeHealth.flatMap((node) => node.network?.listeners ?? []);
  const routes = data.nodeHealth.flatMap((node) => node.network?.routes ?? []);
  const exposedListenerCount = listeners.filter(isExposedListener).length;
  const rows = buildNetworkListenerRows({
    copy,
    records: listenerRecords,
    selectedRecord: selectedListener,
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
      { label: copy.networkProcessLabel, className: "table-col-runtime-text-compact" },
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
      selectedRecord: selectedListener,
      formatDate,
      renderPill
    })}
  </section>`;
}
