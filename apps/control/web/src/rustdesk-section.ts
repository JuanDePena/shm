import { escapeHtml, renderDataTable, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type WebLocale } from "./request.js";

type PillTone = "default" | "success" | "danger" | "muted";
type RustDeskNode = DashboardData["rustdesk"]["nodes"][number];

interface RustDeskSectionCopy {
  none: string;
  navRustDesk: string;
  noNodes: string;
  dataFilterPlaceholder: string;
  rowsPerPage: string;
  showing: string;
  of: string;
  records: string;
  selectedStateLabel: string;
  generatedAt: string;
  openNodeHealth: string;
  nodeColNode: string;
  nodeColHostname: string;
  nodeColLastSeen: string;
}

interface RustDeskSectionRenderers {
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: PillTone) => string;
  renderSignalStrip: (
    entries: Array<{ label: string; value: string; tone?: PillTone }>
  ) => string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
}

export function renderRustDeskSection(
  data: DashboardData,
  copy: RustDeskSectionCopy,
  locale: WebLocale,
  focus: string | undefined,
  renderers: RustDeskSectionRenderers
): string {
  const selectedRustDeskNode =
    data.rustdesk.nodes.find((node) => node.nodeId === focus) ?? data.rustdesk.nodes[0];
  const rustDeskCopy =
    locale === "es"
      ? {
          title: "RustDesk",
          description:
            "Endpoint p\u00fablico, clave del servidor, estado por nodo y gu\u00eda operativa para failover manual.",
          connectionTitle: "Conexi\u00f3n del servicio",
          connectionDescription:
            "Comparte este hostname y clave con los clientes. El registro TXT queda como referencia operativa.",
          nodeTitle: "Nodo seleccionado",
          nodeDescription:
            "Inspecci\u00f3n runtime del par hbbs/hbbr, listeners observados y material de identidad disponible.",
          failoverTitle: "Failover manual",
          failoverDescription:
            "Mant\u00e9n los clientes apuntando al hostname estable y promueve el secundario solo despu\u00e9s de sincronizar la data.",
          instructionsTitle: "Instrucciones para clientes",
          instructionsDescription:
            "Configura el cliente OSS con el mismo hostname y la misma clave p\u00fablica del servidor.",
          publicHostnameLabel: "Hostname p\u00fablico",
          publicKeyLabel: "Clave p\u00fablica",
          txtRecordLabel: "FQDN TXT",
          txtValueLabel: "Valor TXT esperado",
          keyConsistencyLabel: "Consistencia de clave",
          dnsTargetLabel: "Destino DNS",
          listenersLabel: "Listeners",
          checkedAtLabel: "\u00daltima inspecci\u00f3n",
          publicKeyPathLabel: "Ruta de la clave",
          roleLabel: "Rol",
          hbbsLabel: "Servicio hbbs",
          hbbrLabel: "Servicio hbbr",
          primaryLabel: "primario",
          secondaryLabel: "secundario",
          activeLabel: "activo",
          degradedLabel: "degradado",
          inactiveLabel: "inactivo",
          disabledLabel: "deshabilitado",
          keyPresentLabel: "presente",
          keyMissingLabel: "faltante",
          keyMatchLabel: "coincide",
          keyMismatchLabel: "difiere",
          keyUnknownLabel: "sin dato",
          statusColumn: "Estado RustDesk",
          keyColumn: "Clave",
          listenersColumn: "Listeners",
          roleColumn: "Rol",
          dnsTargetColumn: "Destino DNS",
          nodesReportingLabel: "Nodos reportando",
          activeNodesLabel: "Nodos activos",
          nodesWithKeysLabel: "Nodos con clave",
          endpointLabel: "Endpoint p\u00fablico",
          readyLabel: "listo",
          missingLabel: "faltante",
          idServerLabel: "ID Server",
          relayServerLabel: "Relay Server",
          automaticLabel: "autom\u00e1tico",
          stepSyncData:
            "Det\u00e9n RustDesk en el secundario y sincroniza /srv/containers/rustdesk/data/ completo desde el primario.",
          stepFlipDns:
            "Cambia el CNAME de rustdesk.pyrosa.com.do para que apunte a rustdesk2.pyrosa.com.do.",
          stepKeepClients:
            "Los clientes siguen usando rustdesk.pyrosa.com.do y la misma clave p\u00fablica."
        }
      : {
          title: "RustDesk",
          description:
            "Public endpoint, server key, per-node runtime status and operator guidance for manual failover.",
          connectionTitle: "Service connection",
          connectionDescription:
            "Share this hostname and key with clients. The TXT record remains an operator-facing reference.",
          nodeTitle: "Selected node",
          nodeDescription:
            "Runtime inspection of the hbbs/hbbr pair, observed listeners and available identity material.",
          failoverTitle: "Manual failover",
          failoverDescription:
            "Keep clients pinned to the stable hostname and promote the secondary only after syncing the data directory.",
          instructionsTitle: "Client instructions",
          instructionsDescription:
            "Configure the OSS client with the same hostname and the same public server key.",
          publicHostnameLabel: "Public hostname",
          publicKeyLabel: "Public key",
          txtRecordLabel: "TXT FQDN",
          txtValueLabel: "Expected TXT value",
          keyConsistencyLabel: "Key consistency",
          dnsTargetLabel: "DNS target",
          listenersLabel: "Listeners",
          checkedAtLabel: "Last inspected",
          publicKeyPathLabel: "Key path",
          roleLabel: "Role",
          hbbsLabel: "hbbs service",
          hbbrLabel: "hbbr service",
          primaryLabel: "primary",
          secondaryLabel: "secondary",
          activeLabel: "active",
          degradedLabel: "degraded",
          inactiveLabel: "inactive",
          disabledLabel: "disabled",
          keyPresentLabel: "present",
          keyMissingLabel: "missing",
          keyMatchLabel: "match",
          keyMismatchLabel: "mismatch",
          keyUnknownLabel: "unknown",
          statusColumn: "RustDesk status",
          keyColumn: "Key",
          listenersColumn: "Listeners",
          roleColumn: "Role",
          dnsTargetColumn: "DNS target",
          nodesReportingLabel: "Nodes reporting",
          activeNodesLabel: "Active nodes",
          nodesWithKeysLabel: "Nodes with keys",
          endpointLabel: "Public endpoint",
          readyLabel: "ready",
          missingLabel: "missing",
          idServerLabel: "ID Server",
          relayServerLabel: "Relay Server",
          automaticLabel: "automatic",
          stepSyncData:
            "Stop RustDesk on the secondary and sync /srv/containers/rustdesk/data/ in full from the primary.",
          stepFlipDns:
            "Change the rustdesk.pyrosa.com.do CNAME so it points to rustdesk2.pyrosa.com.do.",
          stepKeepClients:
            "Clients keep using rustdesk.pyrosa.com.do and the same public key."
        };

  const summarizeRustDeskListeners = (node: RustDeskNode): string => {
    const listeners = node.rustdesk?.listeners ?? [];

    if (listeners.length === 0) {
      return copy.none;
    }

    return [...new Set(listeners.map((listener) => `${listener.port}/${listener.protocol}`))]
      .sort((left, right) => left.localeCompare(right))
      .join(", ");
  };

  const renderRustDeskRole = (node: RustDeskNode): string => {
    if (node.role === "primary") {
      return renderers.renderPill(rustDeskCopy.primaryLabel, "success");
    }

    if (node.role === "secondary") {
      return renderers.renderPill(rustDeskCopy.secondaryLabel, "muted");
    }

    return "-";
  };

  const renderRustDeskServiceStatus = (node: RustDeskNode): string => {
    const snapshot = node.rustdesk;

    if (!snapshot) {
      return "-";
    }

    if (!snapshot.hbbsEnabled && !snapshot.hbbrEnabled) {
      return renderers.renderPill(rustDeskCopy.disabledLabel, "danger");
    }

    if (snapshot.hbbsActive && snapshot.hbbrActive) {
      return renderers.renderPill(rustDeskCopy.activeLabel, "success");
    }

    if (!snapshot.hbbsActive && !snapshot.hbbrActive) {
      return renderers.renderPill(rustDeskCopy.inactiveLabel, "danger");
    }

    return renderers.renderPill(rustDeskCopy.degradedLabel, "danger");
  };

  const renderRustDeskManagedService = (
    serviceName: string | undefined,
    enabled: boolean | undefined,
    active: boolean | undefined
  ): string => {
    if (!serviceName) {
      return escapeHtml(copy.none);
    }

    return `<span class="mono">${escapeHtml(serviceName)}</span> ${renderers.renderPill(
      !enabled
        ? rustDeskCopy.disabledLabel
        : active
          ? rustDeskCopy.activeLabel
          : rustDeskCopy.inactiveLabel,
      !enabled ? "danger" : active ? "success" : "danger"
    )}`;
  };

  const renderRustDeskKeyStatus = (node: RustDeskNode): string => {
    const publicKey = node.rustdesk?.publicKey;

    if (!publicKey) {
      return renderers.renderPill(rustDeskCopy.keyMissingLabel, "danger");
    }

    if (!data.rustdesk.publicKey) {
      return renderers.renderPill(rustDeskCopy.keyPresentLabel, "success");
    }

    return renderers.renderPill(
      publicKey === data.rustdesk.publicKey
        ? rustDeskCopy.keyMatchLabel
        : rustDeskCopy.keyMismatchLabel,
      publicKey === data.rustdesk.publicKey ? "success" : "danger"
    );
  };

  const rustdeskRows: DataTableRow[] = data.rustdesk.nodes.map((node) => {
    const listenerSummary = summarizeRustDeskListeners(node);

    return {
      selectionKey: node.nodeId,
      selected: selectedRustDeskNode?.nodeId === node.nodeId,
      cells: [
        renderers.renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("rustdesk", undefined, node.nodeId),
          selectedRustDeskNode?.nodeId === node.nodeId,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        renderRustDeskRole(node),
        node.dnsTarget ? `<span class="mono">${escapeHtml(node.dnsTarget)}</span>` : "-",
        renderRustDeskServiceStatus(node),
        renderRustDeskKeyStatus(node),
        listenerSummary === copy.none
          ? escapeHtml(listenerSummary)
          : `<span class="mono">${escapeHtml(listenerSummary)}</span>`,
        escapeHtml(renderers.formatDate(node.lastSeenAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        node.role ?? "",
        node.dnsTarget ?? "",
        node.rustdesk?.publicKey ?? "",
        listenerSummary,
        node.rustdesk?.hbbsServiceName ?? "",
        node.rustdesk?.hbbrServiceName ?? ""
      ].join(" ")
    };
  });

  const rustdeskReportedNodeCount = data.rustdesk.nodes.filter((node) => node.rustdesk).length;
  const rustdeskActiveNodeCount = data.rustdesk.nodes.filter(
    (node) => node.rustdesk?.hbbsActive && node.rustdesk?.hbbrActive
  ).length;
  const rustdeskKeyNodeCount = data.rustdesk.nodes.filter((node) =>
    Boolean(node.rustdesk?.publicKey)
  ).length;
  const rustdeskConsistencyPill = (() => {
    switch (data.rustdesk.keyConsistency) {
      case "match":
        return renderers.renderPill(rustDeskCopy.keyMatchLabel, "success");
      case "mismatch":
        return renderers.renderPill(rustDeskCopy.keyMismatchLabel, "danger");
      case "unknown":
      default:
        return renderers.renderPill(rustDeskCopy.keyUnknownLabel, "muted");
    }
  })();

  const rustdeskConnectionPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(rustDeskCopy.connectionTitle)}</h3>
        <p class="muted section-description">${escapeHtml(rustDeskCopy.connectionDescription)}</p>
      </div>
    </div>
    ${renderers.renderActionFacts([
      {
        label: rustDeskCopy.publicHostnameLabel,
        value: data.rustdesk.publicHostname
          ? `<span class="mono">${escapeHtml(data.rustdesk.publicHostname)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.publicKeyLabel,
        value: data.rustdesk.publicKey
          ? `<span class="mono">${escapeHtml(data.rustdesk.publicKey)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.txtRecordLabel,
        value: data.rustdesk.txtRecordFqdn
          ? `<span class="mono">${escapeHtml(data.rustdesk.txtRecordFqdn)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.txtValueLabel,
        value: data.rustdesk.txtRecordValue
          ? `<span class="mono">${escapeHtml(data.rustdesk.txtRecordValue)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.keyConsistencyLabel,
        value: rustdeskConsistencyPill
      },
      {
        label: copy.generatedAt,
        value: escapeHtml(renderers.formatDate(data.rustdesk.generatedAt, locale))
      }
    ])}
  </article>`;

  const rustdeskSelectedNodePanel = selectedRustDeskNode
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(rustDeskCopy.nodeTitle)}</h3>
            <p class="muted section-description">${escapeHtml(rustDeskCopy.nodeDescription)}</p>
          </div>
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl("node-health", undefined, selectedRustDeskNode.nodeId)
          )}">${escapeHtml(copy.openNodeHealth)}</a>
        </div>
        ${renderers.renderDetailGrid(
          [
            {
              label: copy.nodeColNode,
              value: `<span class="mono">${escapeHtml(selectedRustDeskNode.nodeId)}</span>`
            },
            { label: copy.nodeColHostname, value: escapeHtml(selectedRustDeskNode.hostname) },
            { label: rustDeskCopy.roleLabel, value: renderRustDeskRole(selectedRustDeskNode) },
            {
              label: rustDeskCopy.dnsTargetLabel,
              value: selectedRustDeskNode.dnsTarget
                ? `<span class="mono">${escapeHtml(selectedRustDeskNode.dnsTarget)}</span>`
                : escapeHtml(copy.none)
            },
            {
              label: rustDeskCopy.hbbsLabel,
              value: renderRustDeskManagedService(
                selectedRustDeskNode.rustdesk?.hbbsServiceName,
                selectedRustDeskNode.rustdesk?.hbbsEnabled,
                selectedRustDeskNode.rustdesk?.hbbsActive
              )
            },
            {
              label: rustDeskCopy.hbbrLabel,
              value: renderRustDeskManagedService(
                selectedRustDeskNode.rustdesk?.hbbrServiceName,
                selectedRustDeskNode.rustdesk?.hbbrEnabled,
                selectedRustDeskNode.rustdesk?.hbbrActive
              )
            },
            {
              label: rustDeskCopy.listenersLabel,
              value:
                summarizeRustDeskListeners(selectedRustDeskNode) === copy.none
                  ? escapeHtml(copy.none)
                  : `<span class="mono">${escapeHtml(
                      summarizeRustDeskListeners(selectedRustDeskNode)
                    )}</span>`
            },
            {
              label: rustDeskCopy.publicKeyPathLabel,
              value: selectedRustDeskNode.rustdesk?.publicKeyPath
                ? `<span class="mono">${escapeHtml(
                    selectedRustDeskNode.rustdesk.publicKeyPath
                  )}</span>`
                : escapeHtml(copy.none)
            },
            {
              label: rustDeskCopy.checkedAtLabel,
              value: escapeHtml(
                renderers.formatDate(selectedRustDeskNode.rustdesk?.checkedAt, locale)
              )
            },
            {
              label: copy.nodeColLastSeen,
              value: escapeHtml(renderers.formatDate(selectedRustDeskNode.lastSeenAt, locale))
            }
          ],
          {
            className: "detail-grid-four"
          }
        )}
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noNodes)}</p></article>`;

  const rustdeskFailoverPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(rustDeskCopy.failoverTitle)}</h3>
        <p class="muted section-description">${escapeHtml(rustDeskCopy.failoverDescription)}</p>
      </div>
    </div>
    <ol>
      <li>${escapeHtml(rustDeskCopy.stepSyncData)}</li>
      <li>${escapeHtml(rustDeskCopy.stepFlipDns)}</li>
      <li>${escapeHtml(rustDeskCopy.stepKeepClients)}</li>
    </ol>
  </article>`;

  const rustdeskInstructionsPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(rustDeskCopy.instructionsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(rustDeskCopy.instructionsDescription)}</p>
      </div>
    </div>
    ${renderers.renderActionFacts([
      {
        label: rustDeskCopy.idServerLabel,
        value: data.rustdesk.publicHostname
          ? `<span class="mono">${escapeHtml(data.rustdesk.publicHostname)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.publicKeyLabel,
        value: data.rustdesk.publicKey
          ? `<span class="mono">${escapeHtml(data.rustdesk.publicKey)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: rustDeskCopy.relayServerLabel,
        value: data.rustdesk.publicHostname
          ? `<span class="mono">${escapeHtml(data.rustdesk.publicHostname)}</span>`
          : escapeHtml(rustDeskCopy.automaticLabel)
      }
    ])}
  </article>`;

  return `<section id="section-rustdesk" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(rustDeskCopy.title)}</h2>
        <p class="muted section-description">${escapeHtml(rustDeskCopy.description)}</p>
      </div>
    </div>
    ${renderers.renderSignalStrip([
      {
        label: rustDeskCopy.nodesReportingLabel,
        value: String(rustdeskReportedNodeCount),
        tone: rustdeskReportedNodeCount > 0 ? "success" : "danger"
      },
      {
        label: rustDeskCopy.activeNodesLabel,
        value: String(rustdeskActiveNodeCount),
        tone: rustdeskActiveNodeCount > 0 ? "success" : "danger"
      },
      {
        label: rustDeskCopy.nodesWithKeysLabel,
        value: String(rustdeskKeyNodeCount),
        tone: rustdeskKeyNodeCount > 0 ? "success" : "danger"
      },
      {
        label: rustDeskCopy.endpointLabel,
        value:
          data.rustdesk.publicHostname && data.rustdesk.publicKey
            ? rustDeskCopy.readyLabel
            : rustDeskCopy.missingLabel,
        tone:
          data.rustdesk.publicHostname && data.rustdesk.publicKey ? "success" : "danger"
      }
    ])}
    ${renderDataTable({
      id: "section-rustdesk-table",
      heading: copy.navRustDesk,
      description: rustDeskCopy.description,
      restoreSelectionHref: true,
      columns: [
        { label: copy.nodeColNode, className: "mono" },
        { label: copy.nodeColHostname },
        { label: rustDeskCopy.roleColumn },
        { label: rustDeskCopy.dnsTargetColumn },
        { label: rustDeskCopy.statusColumn },
        { label: rustDeskCopy.keyColumn },
        { label: rustDeskCopy.listenersColumn },
        { label: copy.nodeColLastSeen }
      ],
      rows: rustdeskRows,
      emptyMessage: copy.noNodes,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid grid-two">
      ${rustdeskConnectionPanel}
      <div class="stack">
        ${rustdeskSelectedNodePanel}
        ${rustdeskFailoverPanel}
        ${rustdeskInstructionsPanel}
      </div>
    </div>
  </section>`;
}
