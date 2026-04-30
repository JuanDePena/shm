import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { formatBytes } from "./dashboard-formatters.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  isRuntimeRecordSelected,
  selectRuntimeRecord,
  type RuntimeSelectionRecord
} from "./dashboard-runtime-selection.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type KernelSnapshot = NonNullable<DashboardData["nodeHealth"][number]["kernel"]>;
type KernelRecord = RuntimeSelectionRecord<KernelSnapshot>;

function kernelParameterValue(
  kernel: KernelSnapshot | undefined,
  key: string,
  copy: WebCopy
): string {
  return kernel?.parameters.find((parameter) => parameter.key === key)?.value ?? copy.none;
}

function enabledTone(value: string): "default" | "success" | "danger" | "muted" {
  if (value === "1") {
    return "success";
  }

  if (value === "0") {
    return "muted";
  }

  return "default";
}

function buildKernelRows(args: {
  copy: WebCopy;
  records: KernelRecord[];
  selectedRecord: KernelRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: kernel, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);
    const ipForward = kernelParameterValue(kernel, "net.ipv4.ip_forward", copy);
    const syncookies = kernelParameterValue(kernel, "net.ipv4.tcp_syncookies", copy);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("kernel", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(kernel.release ?? copy.none)}</span>`,
        escapeHtml(kernel.architecture ?? copy.none),
        renderPill(ipForward, enabledTone(ipForward)),
        renderPill(syncookies, enabledTone(syncookies)),
        escapeHtml(String(kernel.modules.length)),
        escapeHtml(formatDate(kernel.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        kernel.release ?? "",
        kernel.version ?? "",
        kernel.architecture ?? "",
        kernel.parameters.map((parameter) => `${parameter.key}=${parameter.value ?? ""}`).join(" "),
        kernel.modules.map((module) => module.name).join(" ")
      ].join(" ")
    };
  });
}

function renderSelectedKernelPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: KernelRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
}): string {
  const { copy, locale, selectedRecord, formatDate } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noKernel)}</p></article>`;
  }

  const { node: selectedNode, item: kernel } = selectedRecord;
  const moduleFacts = kernel.modules.slice(0, 40).map((module) => ({
    label: module.name,
    value: [
      module.sizeBytes === undefined ? copy.none : escapeHtml(formatBytes(module.sizeBytes)),
      module.usedBy.length > 0
        ? `${escapeHtml(copy.kernelUsedByLabel)}: ${escapeHtml(module.usedBy.join(", "))}`
        : ""
    ]
      .filter(Boolean)
      .join(" ")
  }));

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.kernelSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <div class="grid-two-desktop">
      <article class="panel panel-nested detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(kernel.release ?? copy.kernelReleaseLabel)}</h3>
            <p class="muted section-description">${escapeHtml(kernel.architecture ?? copy.none)}</p>
          </div>
        </div>
        ${renderActionFacts(
          [
            { label: copy.kernelReleaseLabel, value: `<span class="mono">${escapeHtml(kernel.release ?? copy.none)}</span>` },
            { label: copy.kernelVersionLabel, value: `<span class="mono">${escapeHtml(kernel.version ?? copy.none)}</span>` },
            { label: copy.kernelArchitectureLabel, value: escapeHtml(kernel.architecture ?? copy.none) },
            { label: copy.kernelIpForwardLabel, value: escapeHtml(kernelParameterValue(kernel, "net.ipv4.ip_forward", copy)) },
            { label: copy.kernelSyncookiesLabel, value: escapeHtml(kernelParameterValue(kernel, "net.ipv4.tcp_syncookies", copy)) },
            { label: copy.kernelSwappinessLabel, value: escapeHtml(kernelParameterValue(kernel, "vm.swappiness", copy)) },
            { label: copy.kernelAslrLabel, value: escapeHtml(kernelParameterValue(kernel, "kernel.randomize_va_space", copy)) },
            { label: copy.generatedAt, value: escapeHtml(formatDate(kernel.checkedAt, locale)) }
          ],
          { className: "action-card-facts-wide-labels" }
        )}
      </article>
      <article class="panel panel-nested detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.kernelParametersTitle)}</h3>
            <p class="muted section-description">${escapeHtml(String(kernel.parameters.length))}</p>
          </div>
        </div>
        ${renderActionFacts(
          kernel.parameters.map((parameter) => ({
            label: parameter.key,
            value: `<span class="mono">${escapeHtml(parameter.value ?? copy.none)}</span>`
          })),
          { className: "action-card-facts-wide-labels" }
        )}
      </article>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.kernelModulesTitle)}</h3>
          <p class="muted section-description">${escapeHtml(String(kernel.modules.length))}</p>
        </div>
      </div>
      ${
        moduleFacts.length > 0
          ? renderActionFacts(moduleFacts, { className: "action-card-facts-wide-labels" })
          : `<p class="empty">${escapeHtml(copy.none)}</p>`
      }
    </article>
  </article>`;
}

export function renderKernelWorkspace(args: {
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
  const kernelRecords = data.nodeHealth.flatMap((node) =>
    node.kernel
      ? [
          {
            node,
            item: node.kernel,
            key: node.nodeId
          }
        ]
      : []
  );
  const selectedKernel = selectRuntimeRecord(kernelRecords, focus);
  const forwardingCount = kernelRecords.filter(
    (record) => kernelParameterValue(record.item, "net.ipv4.ip_forward", copy) === "1"
  ).length;
  const moduleCount = kernelRecords.reduce((count, record) => count + record.item.modules.length, 0);
  const rows = buildKernelRows({
    copy,
    records: kernelRecords,
    selectedRecord: selectedKernel,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-kernel-table",
    heading: copy.kernelInventoryTitle,
    description: copy.kernelInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.kernelReleaseLabel, className: "mono" },
      { label: copy.kernelArchitectureLabel },
      { label: copy.kernelIpForwardLabel },
      { label: copy.kernelSyncookiesLabel },
      { label: copy.kernelModulesTitle },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noKernel,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-kernel" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.kernelReleaseLabel, value: String(kernelRecords.length), tone: kernelRecords.length > 0 ? "success" : "muted" },
      { label: copy.kernelIpForwardLabel, value: String(forwardingCount), tone: forwardingCount > 0 ? "danger" : "success" },
      { label: copy.kernelModulesTitle, value: String(moduleCount), tone: moduleCount > 0 ? "success" : "muted" }
    ])}
    ${table}
    ${renderSelectedKernelPanel({
      copy,
      locale,
      selectedRecord: selectedKernel,
      formatDate
    })}
  </section>`;
}
