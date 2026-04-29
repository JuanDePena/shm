import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { formatBytes } from "./dashboard-formatters.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type Filesystem = NonNullable<DashboardData["nodeHealth"][number]["storage"]>["filesystems"][number];

function usageTone(percent: number | undefined): "default" | "success" | "danger" | "muted" {
  if (percent === undefined) {
    return "muted";
  }

  return percent >= 85 ? "danger" : "success";
}

function buildFilesystemRows(args: {
  copy: WebCopy;
  data: DashboardData;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, data, renderFocusLink, renderPill } = args;

  return data.nodeHealth.flatMap((node) => {
    return (node.storage?.filesystems ?? []).map((filesystem) => ({
      selectionKey: `${node.nodeId}:${filesystem.mountpoint}`,
      selected: false,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("storage", undefined, node.nodeId),
          false,
          copy.selectedStateLabel
        ),
        `<span class="mono">${escapeHtml(filesystem.mountpoint)}</span>`,
        escapeHtml(filesystem.type ?? copy.none),
        escapeHtml(formatBytes(filesystem.totalBytes)),
        escapeHtml(formatBytes(filesystem.availableBytes)),
        renderPill(`${filesystem.usedPercent ?? 0}%`, usageTone(filesystem.usedPercent)),
        renderPill(
          filesystem.inodeUsedPercent === undefined
            ? copy.none
            : `${filesystem.inodeUsedPercent}%`,
          usageTone(filesystem.inodeUsedPercent)
        )
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        filesystem.filesystem,
        filesystem.mountpoint,
        filesystem.type ?? ""
      ].join(" ")
    }));
  });
}

function renderFilesystemCard(copy: WebCopy, renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string, filesystem: Filesystem): string {
  return `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(filesystem.mountpoint)}</h3>
        <p class="muted section-description">${escapeHtml(filesystem.filesystem)}</p>
      </div>
      ${renderPill(`${filesystem.usedPercent ?? 0}%`, usageTone(filesystem.usedPercent))}
    </div>
    ${renderActionFacts(
      [
        { label: copy.storageTotalLabel, value: escapeHtml(formatBytes(filesystem.totalBytes)) },
        { label: copy.storageUsedLabel, value: escapeHtml(formatBytes(filesystem.usedBytes)) },
        { label: copy.storageAvailableLabel, value: escapeHtml(formatBytes(filesystem.availableBytes)) },
        {
          label: copy.storageInodesLabel,
          value: escapeHtml(
            filesystem.inodeUsedPercent === undefined
              ? copy.none
              : `${filesystem.inodeUsedPercent}%`
          )
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderSelectedNodeStoragePanel(args: {
  copy: WebCopy;
  selectedNode: DashboardData["nodeHealth"][number] | undefined;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, selectedNode, renderPill } = args;

  if (!selectedNode) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noNodes)}</p></article>`;
  }

  const filesystems = selectedNode.storage?.filesystems ?? [];
  const paths = selectedNode.storage?.paths ?? [];
  const filesystemCards =
    filesystems.length === 0
      ? `<p class="empty">${escapeHtml(copy.noStorage)}</p>`
      : filesystems.map((filesystem) => renderFilesystemCard(copy, renderPill, filesystem)).join("");
  const pathRows =
    paths.length === 0
      ? `<p class="empty">${escapeHtml(copy.noStorage)}</p>`
      : `<div class="grid grid-two">
          ${paths
            .map(
              (entry) => `<article class="panel panel-nested detail-shell">
                <h3>${escapeHtml(entry.path)}</h3>
                ${renderActionFacts(
                  [
                    {
                      label: copy.storageUsedLabel,
                      value: escapeHtml(entry.usedBytes === undefined ? copy.none : formatBytes(entry.usedBytes))
                    },
                    {
                      label: copy.storageMountLabel,
                      value: `<span class="mono">${escapeHtml(entry.mountpoint ?? copy.none)}</span>`
                    }
                  ],
                  { className: "action-card-facts-wide-labels" }
                )}
              </article>`
            )
            .join("")}
        </div>`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.storageSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <div class="stack">${filesystemCards}</div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.storagePathsTitle)}</h3>
          <p class="muted section-description">${escapeHtml(copy.storagePathsDescription)}</p>
        </div>
      </div>
      ${pathRows}
    </article>
  </article>`;
}

export function renderStorageWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  focus?: string;
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
  const { copy, data, focus, renderFocusLink, renderPill, renderSignalStrip } = args;
  const selectedNode = data.nodeHealth.find((node) => node.nodeId === focus) ?? data.nodeHealth[0];
  const filesystems = data.nodeHealth.flatMap((node) => node.storage?.filesystems ?? []);
  const pathCount = data.nodeHealth.reduce((count, node) => count + (node.storage?.paths.length ?? 0), 0);
  const warningFilesystems = filesystems.filter(
    (filesystem) =>
      (filesystem.usedPercent ?? 0) >= 85 || (filesystem.inodeUsedPercent ?? 0) >= 85
  );
  const rows = buildFilesystemRows({
    copy,
    data,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-storage-table",
    heading: copy.storageInventoryTitle,
    description: copy.storageInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.storageMountLabel, className: "mono" },
      { label: copy.storageTypeLabel },
      { label: copy.storageTotalLabel },
      { label: copy.storageAvailableLabel },
      { label: copy.storageUsedPercentLabel },
      { label: copy.storageInodesLabel }
    ],
    rows,
    emptyMessage: copy.noStorage,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-storage" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.storageMountLabel, value: String(filesystems.length), tone: filesystems.length > 0 ? "success" : "muted" },
      { label: copy.storagePathsTitle, value: String(pathCount), tone: pathCount > 0 ? "success" : "muted" },
      { label: copy.storagePressureLabel, value: String(warningFilesystems.length), tone: warningFilesystems.length > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedNodeStoragePanel({
      copy,
      selectedNode,
      renderPill
    })}
  </section>`;
}
