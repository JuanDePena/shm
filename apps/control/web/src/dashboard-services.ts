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

type ServiceUnit = NonNullable<DashboardData["nodeHealth"][number]["services"]>["units"][number];

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
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    const services = node.services?.units ?? [];

    return services.map((unit) => ({
      selectionKey: `${node.nodeId}:${unit.serviceName}`,
      selected: false,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("services", undefined, node.nodeId),
          false,
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
    }));
  });
}

function renderSelectedNodeServicesPanel(args: {
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

  const units = selectedNode.services?.units ?? [];
  const serviceCards =
    units.length === 0
      ? `<p class="empty">${escapeHtml(copy.notReportedLabel)}</p>`
      : units
          .map(
            (unit) => `<article class="panel panel-nested detail-shell">
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
            </article>`
          )
          .join("");

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
    <div class="stack">${serviceCards}</div>
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
  const selectedNode = data.nodeHealth.find((node) => node.nodeId === focus) ?? data.nodeHealth[0];
  const serviceUnits = data.nodeHealth.flatMap((node) => node.services?.units ?? []);
  const activeCount = serviceUnits.filter((unit) => unit.activeState === "active").length;
  const failedCount = serviceUnits.filter((unit) => unit.activeState === "failed").length;
  const inactiveCount = serviceUnits.filter(
    (unit) => unit.activeState && unit.activeState !== "active" && unit.activeState !== "failed"
  ).length;
  const rows = buildServiceRows({
    copy,
    data,
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
    ${renderSelectedNodeServicesPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
