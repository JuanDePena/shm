import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type WebLocale } from "./request.js";

type NodeHealthCopy = {
  backupPolicies: string;
  dataFilterPlaceholder: string;
  navApps: string;
  noLabel: string;
  noNodes: string;
  nodeColHostname: string;
  nodeColLastSeen: string;
  nodeColLatestStatus: string;
  nodeColLatestSummary: string;
  nodeColNode: string;
  nodeColPending: string;
  nodeColVersion: string;
  nodeDiagnosticsDescription: string;
  nodeDiagnosticsTitle: string;
  nodeHealthDescription: string;
  nodeHealthTitle: string;
  nodesWithFailures: string;
  nodesWithPendingJobs: string;
  of: string;
  records: string;
  resourcesWithDrift: string;
  rowsPerPage: string;
  selectedStateLabel: string;
  showing: string;
  staleNodes: string;
  healthyNodes: string;
  yesLabel: string;
  zoneColRecordCount: string;
  none: string;
};

type NodeHealthDataTableRenderer = (args: {
  id: string;
  heading: string;
  description: string;
  restoreSelectionHref?: boolean;
  columns: Array<{ label: string; className?: string }>;
  rows: DataTableRow[];
  emptyMessage: string;
  filterPlaceholder: string;
  rowsPerPageLabel: string;
  showingLabel: string;
  ofLabel: string;
  recordsLabel: string;
  defaultPageSize?: number;
}) => string;

type NodeHealthSignalItem = {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "muted";
};

type NodeHealthCodeServerCopy = {
  title: string;
  description: string;
  versionLabel: string;
  serviceLabel: string;
  bindLabel: string;
  authLabel: string;
  enabledLabel: string;
  checkedAtLabel: string;
  rpmUrlLabel: string;
  targetLabel: string;
  targetCurrent: string;
  targetAll: string;
  actionLabel: string;
  versionColumn: string;
  serviceColumn: string;
};

type NodeHealthAppServiceCopy = {
  title: string;
  description: string;
  servicesLabel: string;
  serviceColumn: string;
  imageLabel: string;
  stateRootLabel: string;
  checkedAtLabel: string;
};

function createCodeServerCopy(locale: WebLocale): NodeHealthCodeServerCopy {
  return locale === "es"
    ? {
        title: "Code-server",
        description:
          "Estado del servicio operator-facing, versión instalada y actualización controlada por URL de RPM.",
        versionLabel: "Versión code-server",
        serviceLabel: "Servicio",
        bindLabel: "Bind",
        authLabel: "Auth",
        enabledLabel: "Habilitado",
        checkedAtLabel: "Última inspección",
        rpmUrlLabel: "URL del RPM",
        targetLabel: "Objetivo",
        targetCurrent: "Nodo seleccionado",
        targetAll: "Todos los nodos gestionados",
        actionLabel: "Actualizar code-server",
        versionColumn: "Code-server",
        serviceColumn: "Servicio code-server"
      }
    : {
        title: "Code-server",
        description:
          "Operator-facing service state, installed version and controlled updates from an RPM URL.",
        versionLabel: "Code-server version",
        serviceLabel: "Service",
        bindLabel: "Bind",
        authLabel: "Auth",
        enabledLabel: "Enabled",
        checkedAtLabel: "Last inspected",
        rpmUrlLabel: "RPM URL",
        targetLabel: "Target",
        targetCurrent: "Selected node",
        targetAll: "All managed nodes",
        actionLabel: "Update code-server",
        versionColumn: "Code-server",
        serviceColumn: "Code-server service"
      };
}

function createAppServiceCopy(locale: WebLocale): NodeHealthAppServiceCopy {
  return locale === "es"
    ? {
        title: "Servicios de apps",
        description:
          "Servicios `app-<slug>.service` gestionados por SimpleHost Agent y visibles en el snapshot de runtime del nodo.",
        servicesLabel: "Servicios app",
        serviceColumn: "Apps",
        imageLabel: "Imagen runtime",
        stateRootLabel: "Raíz de estado",
        checkedAtLabel: "Última inspección"
      }
    : {
        title: "App services",
        description:
          "Managed `app-<slug>.service` runtimes reported by SimpleHost Agent as part of the node snapshot.",
        servicesLabel: "App services",
        serviceColumn: "Apps",
        imageLabel: "Runtime image",
        stateRootLabel: "State root",
        checkedAtLabel: "Last inspected"
      };
}

export function renderNodeHealthWorkspace<Copy extends NodeHealthCopy>(args: {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  selectedNodeHealth: DashboardData["nodeHealth"][number] | undefined;
  healthyNodeCount: number;
  staleNodeCount: number;
  pendingNodeCount: number;
  failingNodeCount: number;
  specPanelHtml: string;
  renderDataTable: NodeHealthDataTableRenderer;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (
    value: string,
    tone?: "default" | "success" | "danger" | "muted"
  ) => string;
  renderSignalStrip: (items: NodeHealthSignalItem[]) => string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
}): {
  nodeHealthSection: string;
  nodesSection: string;
} {
  const {
    copy,
    data,
    locale,
    selectedNodeHealth,
    healthyNodeCount,
    staleNodeCount,
    pendingNodeCount,
    failingNodeCount,
    specPanelHtml,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink,
    renderPill,
    renderSignalStrip,
    formatDate
  } = args;

  const codeServerCopy = createCodeServerCopy(locale);
  const appServiceCopy = createAppServiceCopy(locale);
  const renderCodeServerVersion = (node: DashboardData["nodeHealth"][number]): string =>
    node.codeServer?.version ? renderPill(node.codeServer.version, "muted") : "-";
  const renderCodeServerServiceStatus = (node: DashboardData["nodeHealth"][number]): string => {
    if (!node.codeServer) {
      return "-";
    }

    if (!node.codeServer.enabled) {
      return renderPill("disabled", "danger");
    }

    return renderPill(
      node.codeServer.active ? "active" : "inactive",
      node.codeServer.active ? "success" : "danger"
    );
  };
  const renderCodeServerCell = (node: DashboardData["nodeHealth"][number]): string => {
    if (!node.codeServer) {
      return "-";
    }

    return `<div class="node-health-code-server-cell">
      <div>${renderCodeServerVersion(node)}</div>
      <div>${renderCodeServerServiceStatus(node)}</div>
    </div>`;
  };
  const renderAppServiceStatus = (
    service: NonNullable<DashboardData["nodeHealth"][number]["appServices"]>[number]
  ): string => {
    if (!service.enabled) {
      return renderPill("disabled", "danger");
    }

    return renderPill(
      service.active ? "active" : "inactive",
      service.active ? "success" : "danger"
    );
  };
  const renderAppServiceSummary = (node: DashboardData["nodeHealth"][number]): string => {
    const services = node.appServices ?? [];

    if (services.length === 0) {
      return "-";
    }

    const activeCount = services.filter((service) => service.active).length;
    return renderPill(
      `${activeCount}/${services.length}`,
      activeCount === services.length ? "success" : activeCount > 0 ? "muted" : "danger"
    );
  };

  const nodeHealthRows: DataTableRow[] = data.nodeHealth.map((node) => ({
    selectionKey: node.nodeId,
    selected: selectedNodeHealth?.nodeId === node.nodeId,
    cells: [
      renderFocusLink(
        node.nodeId,
        buildDashboardViewUrl("node-health", undefined, node.nodeId),
        selectedNodeHealth?.nodeId === node.nodeId,
        copy.selectedStateLabel
      ),
      escapeHtml(node.hostname),
      node.currentVersion ? renderPill(node.currentVersion, "muted") : "-",
      renderCodeServerCell(node),
      renderAppServiceSummary(node),
      renderPill(String(node.pendingJobCount), node.pendingJobCount > 0 ? "danger" : "success"),
      node.latestJobStatus
        ? renderPill(
            node.latestJobStatus,
            node.latestJobStatus === "failed"
              ? "danger"
              : node.latestJobStatus === "applied"
                ? "success"
                : "muted"
          )
        : "-",
      `<span class="node-health-summary-cell" title="${escapeHtml(
        node.latestJobSummary ?? "-"
      )}">${escapeHtml(node.latestJobSummary ?? "-")}</span>`,
      escapeHtml(formatDate(node.lastSeenAt, locale))
    ],
    searchText: [
      node.nodeId,
      node.hostname,
      node.currentVersion ?? "",
      node.codeServer?.version ?? "",
      node.codeServer?.active ? "active" : node.codeServer ? "inactive" : "",
      ...(node.appServices ?? []).map((service) => service.appSlug),
      node.latestJobStatus ?? "",
      node.latestJobSummary ?? "",
      String(node.driftedResourceCount ?? 0)
    ].join(" ")
  }));

  const selectedNodeDrift = selectedNodeHealth
    ? data.drift.filter((entry) => entry.nodeId === selectedNodeHealth.nodeId)
    : [];
  const selectedNodeAppServices = selectedNodeHealth?.appServices ?? [];
  const appServicesValue = selectedNodeAppServices.length > 0
    ? selectedNodeAppServices
        .map(
          (service) =>
            `<div><span class="mono">${escapeHtml(service.appSlug)}</span> ${renderAppServiceStatus(
              service
            )}${
              service.backendPort
                ? ` <span class="muted mono">127.0.0.1:${escapeHtml(
                    String(service.backendPort)
                  )}</span>`
                : ""
            }</div>`
        )
        .join("")
    : "-";
  const appImagesValue = selectedNodeAppServices.length > 0
    ? selectedNodeAppServices
        .map(
          (service) =>
            `<div><span class="mono">${escapeHtml(service.appSlug)}</span> ${escapeHtml(
              service.image ?? copy.none
            )}</div>`
        )
        .join("")
    : "-";
  const appStateRootsValue = selectedNodeAppServices.length > 0
    ? selectedNodeAppServices
        .map(
          (service) =>
            `<div><span class="mono">${escapeHtml(service.appSlug)}</span> <span class="mono">${escapeHtml(
              service.stateRoot ?? copy.none
            )}</span></div>`
        )
        .join("")
    : "-";
  const appCheckedAtValue = selectedNodeAppServices.length > 0
    ? escapeHtml(
        formatDate(
          selectedNodeAppServices
            .map((service) => service.checkedAt)
            .sort()
            .slice(-1)[0],
          locale
        )
      )
    : "-";

  const nodeDiagnosticsPanel = selectedNodeHealth
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.nodeDiagnosticsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.nodeDiagnosticsDescription)}</p>
          </div>
        </div>
        ${renderDetailGrid(
          [
            { label: copy.nodeColNode, value: `<span class="mono">${escapeHtml(selectedNodeHealth.nodeId)}</span>` },
            { label: copy.nodeColHostname, value: escapeHtml(selectedNodeHealth.hostname) },
            {
              label: copy.nodeColVersion,
              value: selectedNodeHealth.currentVersion
                ? renderPill(selectedNodeHealth.currentVersion, "muted")
                : "-"
            },
            {
              label: codeServerCopy.versionLabel,
              value: selectedNodeHealth.codeServer?.version
                ? renderPill(selectedNodeHealth.codeServer.version, "muted")
                : "-"
            },
            {
              label: codeServerCopy.serviceLabel,
              value: renderCodeServerServiceStatus(selectedNodeHealth)
            },
            {
              label: codeServerCopy.bindLabel,
              value: selectedNodeHealth.codeServer?.bindAddress
                ? `<span class="mono">${escapeHtml(selectedNodeHealth.codeServer.bindAddress)}</span>`
                : "-"
            },
            {
              label: codeServerCopy.authLabel,
              value: escapeHtml(selectedNodeHealth.codeServer?.authMode ?? copy.none)
            },
            {
              label: codeServerCopy.enabledLabel,
              value: renderPill(
                selectedNodeHealth.codeServer?.enabled ? copy.yesLabel : copy.noLabel,
                selectedNodeHealth.codeServer?.enabled ? "success" : "danger"
              )
            },
            {
              label: codeServerCopy.checkedAtLabel,
              value: escapeHtml(formatDate(selectedNodeHealth.codeServer?.checkedAt, locale))
            },
            {
              label: appServiceCopy.servicesLabel,
              value: appServicesValue
            },
            {
              label: appServiceCopy.imageLabel,
              value: appImagesValue
            },
            {
              label: appServiceCopy.stateRootLabel,
              value: appStateRootsValue
            },
            {
              label: appServiceCopy.checkedAtLabel,
              value: appCheckedAtValue
            },
            {
              label: copy.nodeColPending,
              value: renderPill(
                String(selectedNodeHealth.pendingJobCount),
                selectedNodeHealth.pendingJobCount > 0 ? "danger" : "success"
              )
            },
            {
              label: copy.resourcesWithDrift,
              value: renderPill(
                String(selectedNodeDrift.length),
                selectedNodeDrift.length > 0 ? "danger" : "success"
              )
            },
            {
              label: copy.zoneColRecordCount,
              value: escapeHtml(String(selectedNodeHealth.primaryZoneCount ?? 0))
            },
            {
              label: copy.navApps,
              value: escapeHtml(String(selectedNodeHealth.primaryAppCount ?? 0))
            },
            {
              label: copy.backupPolicies,
              value: escapeHtml(String(selectedNodeHealth.backupPolicyCount ?? 0))
            },
            {
              label: copy.nodeColLastSeen,
              value: escapeHtml(formatDate(selectedNodeHealth.lastSeenAt, locale))
            }
          ],
          {
            className: "detail-grid-four"
          }
        )}
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noNodes)}</p></article>`;

  const nodeHealthSection = `<section id="section-node-health" class="panel section-panel">
    ${renderSignalStrip([
      {
        label: copy.healthyNodes,
        value: String(healthyNodeCount),
        tone: healthyNodeCount > 0 ? "success" : "muted"
      },
      {
        label: copy.staleNodes,
        value: String(staleNodeCount),
        tone: staleNodeCount > 0 ? "danger" : "success"
      },
      {
        label: copy.nodesWithPendingJobs,
        value: String(pendingNodeCount),
        tone: pendingNodeCount > 0 ? "danger" : "success"
      },
      {
        label: copy.nodesWithFailures,
        value: String(failingNodeCount),
        tone: failingNodeCount > 0 ? "danger" : "success"
      }
    ])}
    ${renderDataTable({
      id: "section-node-health-table",
      heading: copy.nodeHealthTitle,
      description: copy.nodeHealthDescription,
      restoreSelectionHref: true,
      columns: [
        { label: copy.nodeColNode, className: "mono" },
        { label: copy.nodeColHostname },
        { label: copy.nodeColVersion },
        { label: codeServerCopy.versionColumn, className: "table-col-node-health-codeserver" },
        { label: appServiceCopy.serviceColumn },
        { label: copy.nodeColPending },
        { label: copy.nodeColLatestStatus },
        { label: copy.nodeColLatestSummary, className: "table-col-node-summary" },
        { label: copy.nodeColLastSeen }
      ],
      rows: nodeHealthRows,
      emptyMessage: copy.noNodes,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="stack">
      ${nodeDiagnosticsPanel}
      ${specPanelHtml}
    </div>
  </section>`;

  return {
    nodeHealthSection,
    nodesSection: nodeHealthSection
  };
}
