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

type ConfigCheck = NonNullable<
  DashboardData["nodeHealth"][number]["configValidation"]
>["checks"][number];
type ConfigCheckRecord = RuntimeSelectionRecord<ConfigCheck>;

function configTone(check: ConfigCheck | undefined): "default" | "success" | "danger" | "muted" {
  switch (check?.status) {
    case "passed":
      return "success";
    case "failed":
      return "danger";
    case "unavailable":
    default:
      return "muted";
  }
}

function configStatusLabel(check: ConfigCheck | undefined, copy: WebCopy): string {
  switch (check?.status) {
    case "passed":
      return copy.configPassedLabel;
    case "failed":
      return copy.configFailedLabel;
    case "unavailable":
      return copy.configUnavailableLabel;
    default:
      return copy.notReportedLabel;
  }
}

function buildConfigValidationRows(args: {
  copy: WebCopy;
  records: ConfigCheckRecord[];
  selectedRecord: ConfigCheckRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: check, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("config", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        escapeHtml(check.label),
        renderPill(configStatusLabel(check, copy), configTone(check)),
        `<span class="mono">${escapeHtml(check.command)}</span>`,
        escapeHtml(check.summary ?? copy.none),
        escapeHtml(formatDate(check.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        check.label,
        check.command,
        check.status,
        check.summary ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedConfigValidationPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: ConfigCheckRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noConfigValidation)}</p></article>`;
  }

  const { node: selectedNode, item: check } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.configValidationSelectedCheckTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(check.label)}</h3>
          <p class="muted section-description">${escapeHtml(check.summary ?? copy.configValidationSelectedCheckDescription)}</p>
        </div>
        ${renderPill(configStatusLabel(check, copy), configTone(check))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.packageColNode, value: escapeHtml(selectedNode.nodeId) },
          { label: copy.packageColHostname, value: escapeHtml(selectedNode.hostname) },
          { label: copy.configCheckLabel, value: escapeHtml(check.checkId) },
          { label: copy.configCommandLabel, value: `<span class="mono">${escapeHtml(check.command)}</span>` },
          { label: copy.configStatusLabel, value: escapeHtml(configStatusLabel(check, copy)) },
          { label: copy.generatedAt, value: escapeHtml(formatDate(check.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderConfigValidationWorkspace(args: {
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
  const configRecords = data.nodeHealth.flatMap((node) =>
    (node.configValidation?.checks ?? []).map((check) => ({
      node,
      item: check,
      key: `${node.nodeId}:${check.checkId}`
    }))
  );
  const selectedCheck = selectRuntimeRecord(configRecords, focus);
  const failedCount = configRecords.filter((record) => record.item.status === "failed").length;
  const unavailableCount = configRecords.filter(
    (record) => record.item.status === "unavailable"
  ).length;
  const reportedNodes = data.nodeHealth.filter(
    (node) => (node.configValidation?.checks.length ?? 0) > 0
  ).length;
  const rows = buildConfigValidationRows({
    copy,
    records: configRecords,
    selectedRecord: selectedCheck,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-config-validation-table",
    heading: copy.configValidationInventoryTitle,
    description: copy.configValidationInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.configCheckLabel },
      { label: copy.configStatusLabel },
      { label: copy.configCommandLabel, className: "mono" },
      { label: copy.configSummaryLabel, className: "table-col-runtime-text-compact" },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noConfigValidation,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-config-validation" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.rebootsReportedLabel, value: String(reportedNodes), tone: reportedNodes > 0 ? "success" : "muted" },
      { label: copy.configFailedLabel, value: String(failedCount), tone: failedCount > 0 ? "danger" : "success" },
      { label: copy.configUnavailableLabel, value: String(unavailableCount), tone: unavailableCount > 0 ? "muted" : "success" }
    ])}
    ${table}
    ${renderSelectedConfigValidationPanel({
      copy,
      locale,
      selectedRecord: selectedCheck,
      formatDate,
      renderPill
    })}
  </section>`;
}
