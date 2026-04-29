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

type ServiceUnit = NonNullable<DashboardData["nodeHealth"][number]["services"]>["units"][number];
type ServiceRecord = RuntimeSelectionRecord<ServiceUnit>;

function serviceTone(
  unit: ServiceUnit | undefined
): "default" | "success" | "danger" | "muted" {
  if (!unit || unit.loadState === "not-found") {
    return "muted";
  }

  return unit.activeState === "active" ? "success" : "danger";
}

function serviceStateLabel(unit: ServiceUnit | undefined, copy: WebCopy): string {
  if (!unit) {
    return copy.notReportedLabel;
  }

  if (unit.loadState === "not-found") {
    return copy.notInstalledLabel;
  }

  return [unit.activeState, unit.subState].filter(Boolean).join("/") || copy.none;
}

function serviceEnabledLabel(unit: ServiceUnit | undefined, copy: WebCopy): string {
  return unit?.unitFileState ?? copy.none;
}

function buildServiceRows(args: {
  copy: WebCopy;
  records: ServiceRecord[];
  selectedRecord: ServiceRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: unit, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("services", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(unit.serviceName)}</span>`,
        renderPill(serviceStateLabel(unit, copy), serviceTone(unit)),
        renderPill(
          serviceEnabledLabel(unit, copy),
          unit.unitFileState === "enabled" ? "success" : "muted"
        ),
        escapeHtml(unit.description ?? copy.none),
        escapeHtml(formatDate(unit.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        unit.serviceName,
        unit.description ?? "",
        unit.activeState ?? "",
        unit.subState ?? "",
        unit.unitFileState ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedServicePanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: ServiceRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noServices)}</p></article>`;
  }

  const { node: selectedNode, item: unit } = selectedRecord;
  const serviceCard = `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(unit.serviceName)}</h3>
        <p class="muted section-description">${escapeHtml(unit.description ?? copy.none)}</p>
      </div>
      ${renderPill(serviceStateLabel(unit, copy), serviceTone(unit))}
    </div>
    ${renderActionFacts(
      [
        { label: copy.enabledStateLabel, value: escapeHtml(serviceEnabledLabel(unit, copy)) },
        { label: copy.loadStateLabel, value: escapeHtml(unit.loadState ?? copy.none) },
        { label: copy.mainPidLabel, value: escapeHtml(String(unit.mainPid ?? copy.none)) },
        { label: copy.restartCountLabel, value: escapeHtml(String(unit.restartCount ?? 0)) },
        {
          label: copy.activeSinceLabel,
          value: escapeHtml(formatDate(unit.activeEnterTimestamp, locale))
        },
        {
          label: copy.unitPathLabel,
          value: `<span class="mono">${escapeHtml(unit.fragmentPath ?? copy.none)}</span>`
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.servicesSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <div class="stack">${serviceCard}</div>
  </article>`;
}

export function renderServicesWorkspace(args: {
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
  const serviceRecords = data.nodeHealth.flatMap((node) =>
    (node.services?.units ?? []).map((unit) => ({
      node,
      item: unit,
      key: `${node.nodeId}:${unit.serviceName}`
    }))
  );
  const selectedService = selectRuntimeRecord(serviceRecords, focus);
  const serviceUnits = data.nodeHealth.flatMap((node) => node.services?.units ?? []);
  const activeCount = serviceUnits.filter((unit) => unit.activeState === "active").length;
  const failedCount = serviceUnits.filter((unit) => unit.activeState === "failed").length;
  const inactiveCount = serviceUnits.filter(
    (unit) => unit.activeState && unit.activeState !== "active" && unit.activeState !== "failed"
  ).length;
  const rows = buildServiceRows({
    copy,
    records: serviceRecords,
    selectedRecord: selectedService,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-services-table",
    heading: copy.servicesInventoryTitle,
    description: copy.servicesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.serviceNameLabel, className: "mono" },
      { label: copy.serviceStateLabel },
      { label: copy.enabledStateLabel },
      { label: copy.serviceDescriptionLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noServices,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-services" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.serviceStateLabel, value: String(activeCount), tone: activeCount > 0 ? "success" : "muted" },
      { label: copy.inactiveServicesLabel, value: String(inactiveCount), tone: inactiveCount > 0 ? "danger" : "success" },
      { label: copy.failedServicesLabel, value: String(failedCount), tone: failedCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedServicePanel({
      copy,
      locale,
      selectedRecord: selectedService,
      formatDate,
      renderPill
    })}
  </section>`;
}
