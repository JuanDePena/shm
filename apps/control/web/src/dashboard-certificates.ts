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

type Certificate = NonNullable<DashboardData["nodeHealth"][number]["tls"]>["certificates"][number];
type CertificateRecord = RuntimeSelectionRecord<Certificate>;

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
  records: CertificateRecord[];
  selectedRecord: CertificateRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: certificate, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);
      const days = daysUntil(certificate.notAfter);

      return {
        selectionKey: key,
        selected,
        cells: [
          renderFocusLink(
            node.nodeId,
            buildDashboardViewUrl("certificates", undefined, key),
            selected,
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
}

function renderSelectedCertificatePanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: CertificateRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noCertificates)}</p></article>`;
  }

  const { node: selectedNode, item: certificate } = selectedRecord;
  const days = daysUntil(certificate.notAfter);
  const card = `<article class="panel panel-nested detail-shell">
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
    <div class="stack">${card}</div>
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
  const certificateRecords = data.nodeHealth.flatMap((node) =>
    (node.tls?.certificates ?? []).map((certificate) => ({
      node,
      item: certificate,
      key: `${node.nodeId}:${certificate.name}`
    }))
  );
  const selectedCertificate = selectRuntimeRecord(certificateRecords, focus);
  const certificates = data.nodeHealth.flatMap((node) => node.tls?.certificates ?? []);
  const expiringCount = certificates.filter((certificate) => {
    const days = daysUntil(certificate.notAfter);
    return days !== undefined && days <= 14;
  }).length;
  const rows = buildCertificateRows({
    copy,
    records: certificateRecords,
    selectedRecord: selectedCertificate,
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
    ${renderSelectedCertificatePanel({
      copy,
      locale,
      selectedRecord: selectedCertificate,
      formatDate,
      renderPill
    })}
  </section>`;
}
