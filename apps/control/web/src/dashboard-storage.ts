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
import { type WebCopy } from "./web-copy.js";

type Filesystem = NonNullable<DashboardData["nodeHealth"][number]["storage"]>["filesystems"][number];
type StoragePath = NonNullable<DashboardData["nodeHealth"][number]["storage"]>["paths"][number];
type FilesystemRecord = RuntimeSelectionRecord<Filesystem>;
const storagePathPriority = ["/root", "/home", "/etc", "/opt", "/srv", "/var"];

function usageTone(percent: number | undefined): "default" | "success" | "danger" | "muted" {
  if (percent === undefined) {
    return "muted";
  }

  return percent >= 85 ? "danger" : "success";
}

function buildFilesystemRows(args: {
  copy: WebCopy;
  records: FilesystemRecord[];
  selectedRecord: FilesystemRecord | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: filesystem, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("storage", undefined, key),
          selected,
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
    };
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

function sortStoragePaths(paths: StoragePath[]): StoragePath[] {
  return [...paths].sort((left, right) => {
    const leftPriority = storagePathPriority.indexOf(left.path);
    const rightPriority = storagePathPriority.indexOf(right.path);
    const normalizedLeftPriority =
      leftPriority === -1 ? Number.POSITIVE_INFINITY : leftPriority;
    const normalizedRightPriority =
      rightPriority === -1 ? Number.POSITIVE_INFINITY : rightPriority;

    if (normalizedLeftPriority !== normalizedRightPriority) {
      return normalizedLeftPriority - normalizedRightPriority;
    }

    return left.path.localeCompare(right.path);
  });
}

function renderSelectedStoragePathPanel(args: {
  copy: WebCopy;
  selectedNode: DashboardData["nodeHealth"][number];
}): string {
  const { copy, selectedNode } = args;
  const paths = sortStoragePaths(selectedNode.storage?.paths ?? []);

  if (paths.length === 0) {
    return `<article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.storagePathsTitle)}</h3>
          <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
        </div>
      </div>
      <p class="empty">${escapeHtml(copy.noStorage)}</p>
    </article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.storagePathsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.storagePathsDescription)}</p>
      </div>
    </div>
    ${renderActionFacts(
      paths.map((entry) => ({
        label: entry.path,
        value: [
          escapeHtml(entry.usedBytes === undefined ? copy.none : formatBytes(entry.usedBytes)),
          entry.mountpoint
            ? `<span class="mono">${escapeHtml(entry.mountpoint)}</span>`
            : ""
        ]
          .filter(Boolean)
          .join(" ")
      })),
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
}

function renderSelectedNodeStoragePanels(args: {
  copy: WebCopy;
  selectedRecord: FilesystemRecord | undefined;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, selectedRecord, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noStorage)}</p></article>`;
  }

  const { node: selectedNode, item: filesystem } = selectedRecord;
  const filesystemCard = renderFilesystemCard(copy, renderPill, filesystem);

  return `<div class="grid-two-desktop">
    <article class="panel detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(copy.storageSelectedNodeTitle)}</h3>
          <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
        </div>
        <a class="button-link secondary" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
        )}">${escapeHtml(copy.openNodeHealth)}</a>
      </div>
      <div class="stack">${filesystemCard}</div>
    </article>
    ${renderSelectedStoragePathPanel({ copy, selectedNode })}
  </div>`;
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
  const filesystemRecords = data.nodeHealth.flatMap((node) =>
    (node.storage?.filesystems ?? []).map((filesystem) => ({
      node,
      item: filesystem,
      key: `${node.nodeId}:${filesystem.mountpoint}`
    }))
  );
  const selectedFilesystem = selectRuntimeRecord(filesystemRecords, focus);
  const filesystems = data.nodeHealth.flatMap((node) => node.storage?.filesystems ?? []);
  const pathCount = data.nodeHealth.reduce((count, node) => count + (node.storage?.paths.length ?? 0), 0);
  const warningFilesystems = filesystems.filter(
    (filesystem) =>
      (filesystem.usedPercent ?? 0) >= 85 || (filesystem.inodeUsedPercent ?? 0) >= 85
  );
  const rows = buildFilesystemRows({
    copy,
    records: filesystemRecords,
    selectedRecord: selectedFilesystem,
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
    ${renderSelectedNodeStoragePanels({
      copy,
      selectedRecord: selectedFilesystem,
      renderPill
    })}
  </section>`;
}
