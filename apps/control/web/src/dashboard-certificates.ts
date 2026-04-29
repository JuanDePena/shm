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

type Certificate = NonNullable<DashboardData["nodeHealth"][number]["tls"]>["certificates"][number];

function daysUntil(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const expiresAt = Date.parse(value);
  return Number.isFinite(expiresAt)
    ? Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
    : undefined;
}

function certificateTone(days: number | undefined): "default" | "success" | "danger" | "muted" {
  if (days === undefined) {
    return "muted";
  }

  return days <= 14 ? "danger" : "success";
}

function buildCertificateRows(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, locale, formatDate, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    return (node.tls?.certificates ?? []).map((certificate) => {
      const days = daysUntil(certificate.notAfter);

      return {
        selectionKey: `${node.nodeId}:${certificate.name}`,
        selected: false,
        cells: [
          renderFocusLink(
            node.nodeId,
            buildDashboardViewUrl("certificates", undefined, node.nodeId),
            false,
            copy.selectedStateLabel
          ),
          `<span class="mono">${escapeHtml(certificate.name)}</span>`,
          escapeHtml(certificate.dnsNames.slice(0, 3).join(", ") || copy.none),
          renderPill(days === undefined ? copy.none : `${days}d`, certificateTone(days)),
          escapeHtml(formatDate(certificate.notAfter, locale)),
          escapeHtml(certificate.issuer ?? copy.none)
        ],
        searchText: [
          node.nodeId,
          node.hostname,
          certificate.name,
          certificate.dnsNames.join(" "),
          certificate.subject ?? "",
          certificate.issuer ?? "",
          certificate.path
        ].join(" ")
      };
    });
  });
}

function renderSelectedNodeCertificatesPanel(args: {
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

  const certificates = selectedNode.tls?.certificates ?? [];
  const cards =
    certificates.length === 0
      ? `<p class="empty">${escapeHtml(copy.noCertificates)}</p>`
      : certificates
          .map((certificate) => {
            const days = daysUntil(certificate.notAfter);

            return `<article class="panel panel-nested detail-shell">
              <div class="section-head">
                <div>
                  <h3>${escapeHtml(certificate.name)}</h3>
                  <p class="muted section-description">${escapeHtml(certificate.path)}</p>
                </div>
                ${renderPill(days === undefined ? copy.none : `${days}d`, certificateTone(days))}
              </div>
              ${renderActionFacts(
                [
                  {
                    label: copy.certificateDnsNamesLabel,
                    value: escapeHtml(certificate.dnsNames.join(", ") || copy.none)
                  },
                  {
                    label: copy.certificateExpiresLabel,
                    value: escapeHtml(formatDate(certificate.notAfter, locale))
                  },
                  {
                    label: copy.certificateIssuerLabel,
                    value: escapeHtml(certificate.issuer ?? copy.none)
                  },
                  {
                    label: copy.certificateFingerprintLabel,
                    value: `<span class="mono">${escapeHtml(certificate.fingerprintSha256 ?? copy.none)}</span>`
                  }
                ],
                { className: "action-card-facts-wide-labels" }
              )}
            </article>`;
          })
          .join("");

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.certificatesSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <div class="stack">${cards}</div>
  </article>`;
}

export function renderCertificatesWorkspace(args: {
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
  const certificates = data.nodeHealth.flatMap((node) => node.tls?.certificates ?? []);
  const expiringCount = certificates.filter((certificate) => {
    const days = daysUntil(certificate.notAfter);
    return days !== undefined && days <= 14;
  }).length;
  const rows = buildCertificateRows({
    copy,
    data,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-certificates-table",
    heading: copy.certificatesInventoryTitle,
    description: copy.certificatesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.certificateNameLabel, className: "mono" },
      { label: copy.certificateDnsNamesLabel },
      { label: copy.certificateDaysRemainingLabel },
      { label: copy.certificateExpiresLabel },
      { label: copy.certificateIssuerLabel }
    ],
    rows,
    emptyMessage: copy.noCertificates,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-certificates" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.records, value: String(certificates.length), tone: certificates.length > 0 ? "success" : "muted" },
      { label: copy.certificateDnsNamesLabel, value: String(new Set(certificates.flatMap((certificate) => certificate.dnsNames)).size), tone: "muted" },
      { label: copy.certificatesExpiringLabel, value: String(expiringCount), tone: expiringCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedNodeCertificatesPanel({
      copy,
      locale,
      selectedNode,
      formatDate,
      renderPill
    })}
  </section>`;
}
