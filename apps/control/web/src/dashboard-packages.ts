import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { renderActionFacts, renderDetailGrid } from "./panel-renderers.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { createUniqueSelectOptions } from "./dashboard-utils.js";
import { type DashboardPackageFilters } from "./dashboard-view-model.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";
import { type WorkspaceFilterField } from "./web-types.js";

function buildPackageFocusKey(entry: DashboardData["packages"]["packages"][number]): string {
  return `${entry.nodeId}:${entry.packageName}:${entry.arch}`;
}

function renderNodeSelectionFieldset(
  copy: WebCopy,
  nodes: DashboardData["nodeHealth"]
): string {
  if (nodes.length === 0) {
    return `<div class="select-empty">${escapeHtml(copy.noNodes)}</div>`;
  }

  return `<fieldset class="selection-fieldset">
    <legend>${escapeHtml(copy.targetedNodesLabel)}</legend>
    <div class="selection-grid">
      ${nodes
        .map(
          (node) => `<label class="selection-option">
            <input type="checkbox" name="nodeIds" value="${escapeHtml(node.nodeId)}" checked />
            <span class="selection-option-copy">
              <strong>${escapeHtml(node.nodeId)}</strong>
              <small>${escapeHtml(node.hostname)}</small>
            </span>
          </label>`
        )
        .join("")}
    </div>
  </fieldset>`;
}

function buildActivePackageFilterItems(
  copy: WebCopy,
  filters: DashboardPackageFilters
): Array<{ label: string; value: string }> {
  return [
    filters.packageNode ? { label: copy.filterNodeLabel, value: filters.packageNode } : undefined,
    filters.packageName ? { label: copy.filterPackageLabel, value: filters.packageName } : undefined,
    filters.packageArch ? { label: copy.packageColArch, value: filters.packageArch } : undefined
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function renderPackagesFilterForm(args: {
  copy: WebCopy;
  data: DashboardData;
  packageNodeFilter?: string;
  packageNameFilter?: string;
  packageArchFilter?: string;
  renderWorkspaceFilterForm: (
    copy: WebCopy,
    props: {
      view: "packages";
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
}): string {
  const {
    copy,
    data,
    packageNodeFilter,
    packageNameFilter,
    packageArchFilter,
    renderWorkspaceFilterForm
  } = args;

  return renderWorkspaceFilterForm(copy, {
    view: "packages",
    clearHref: buildDashboardViewUrl("packages"),
    fields: [
      {
        name: "packageNode",
        label: copy.filterNodeLabel,
        value: packageNodeFilter,
        options: data.nodeHealth
          .slice()
          .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
          .map((node) => ({
            value: node.nodeId,
            label: `${node.nodeId} · ${node.hostname}`
          }))
      },
      {
        name: "packageName",
        label: copy.filterPackageLabel,
        type: "search",
        value: packageNameFilter,
        placeholder: copy.filterPackageLabel
      },
      {
        name: "packageArch",
        label: copy.packageColArch,
        value: packageArchFilter,
        options: createUniqueSelectOptions(data.packages.packages.map((entry) => entry.arch))
      }
    ]
  });
}

function buildPackageRows(args: {
  copy: WebCopy;
  filteredPackages: DashboardData["packages"]["packages"];
  selectedPackage: DashboardData["packages"]["packages"][number] | undefined;
  currentPackageFilters: DashboardPackageFilters;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
}): DataTableRow[] {
  const {
    copy,
    filteredPackages,
    selectedPackage,
    currentPackageFilters,
    locale,
    formatDate,
    renderFocusLink
  } = args;

  return filteredPackages.map((entry) => {
    const focusKey = buildPackageFocusKey(entry);
    const active = selectedPackage ? buildPackageFocusKey(selectedPackage) === focusKey : false;

    return {
      selectionKey: focusKey,
      selected: active,
      cells: [
        renderFocusLink(
          entry.packageName,
          buildDashboardViewUrl("packages", undefined, focusKey, currentPackageFilters),
          active,
          copy.selectedStateLabel
        ),
        `<span class="mono">${escapeHtml(`${entry.version}-${entry.release}`)}</span>`,
        `<span class="mono">${escapeHtml(entry.arch)}</span>`,
        `<span class="mono">${escapeHtml(entry.nodeId)}</span>`,
        escapeHtml(entry.hostname),
        escapeHtml(formatDate(entry.installedAt, locale)),
        escapeHtml(formatDate(entry.lastCollectedAt, locale))
      ],
      searchText: [
        entry.packageName,
        entry.version,
        entry.release,
        entry.arch,
        entry.nodeId,
        entry.hostname,
        entry.nevra,
        entry.source ?? ""
      ].join(" ")
    };
  });
}

export function renderPackagesWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  filteredPackages: DashboardData["packages"]["packages"];
  selectedPackage: DashboardData["packages"]["packages"][number] | undefined;
  currentPackageFilters: DashboardPackageFilters;
  packageNodeFilter?: string;
  packageNameFilter?: string;
  packageArchFilter?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  findRelatedJobs: (
    jobs: DashboardData["jobHistory"],
    options: {
      resourceKeys?: string[];
      resourcePrefixes?: string[];
      nodeId?: string;
      needles?: string[];
    },
    limit?: number
  ) => DashboardData["jobHistory"];
  findRelatedAuditEvents: (
    events: DashboardData["auditEvents"],
    needles: string[],
    limit?: number
  ) => DashboardData["auditEvents"];
  renderActiveFiltersPanel: (
    copy: WebCopy,
    items: Array<{ label: string; value: string }>,
    clearHref: string
  ) => string;
  renderWorkspaceFilterForm: (
    copy: WebCopy,
    props: {
      view: "packages";
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
}): string {
  const {
    copy,
    data,
    locale,
    filteredPackages,
    selectedPackage,
    currentPackageFilters,
    packageNodeFilter,
    packageNameFilter,
    packageArchFilter,
    formatDate,
    findRelatedJobs,
    findRelatedAuditEvents,
    renderActiveFiltersPanel,
    renderWorkspaceFilterForm,
    renderSignalStrip,
    renderFocusLink
  } = args;

  const distinctNodeCount = new Set(filteredPackages.map((entry) => entry.nodeId)).size;
  const distinctPackageCount = new Set(filteredPackages.map((entry) => entry.packageName)).size;
  const distinctArchCount = new Set(filteredPackages.map((entry) => entry.arch)).size;
  const selectedPackageFocus = selectedPackage ? buildPackageFocusKey(selectedPackage) : undefined;
  const selectedPackageJobs = selectedPackage
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [`node:${selectedPackage.nodeId}:packages`],
          nodeId: selectedPackage.nodeId,
          needles: [selectedPackage.packageName, selectedPackage.nevra]
        },
        8
      )
    : [];
  const selectedPackageAuditEvents = selectedPackage
    ? findRelatedAuditEvents(
        data.auditEvents,
        [selectedPackage.nodeId, selectedPackage.packageName, selectedPackage.nevra],
        8
      )
    : [];
  const packagesReturnTo = buildDashboardViewUrl(
    "packages",
    undefined,
    selectedPackageFocus,
    currentPackageFilters
  );
  const jobsHref = selectedPackage
    ? buildDashboardViewUrl("jobs", undefined, undefined, {
        jobNode: selectedPackage.nodeId,
        jobResource: `node:${selectedPackage.nodeId}:packages`
      })
    : buildDashboardViewUrl("jobs");
  const auditHref = selectedPackage
    ? buildDashboardViewUrl("audit", undefined, undefined, {
        auditEntity: selectedPackage.nodeId
      })
    : buildDashboardViewUrl("audit");
  const packageRows = buildPackageRows({
    copy,
    filteredPackages,
    selectedPackage,
    currentPackageFilters,
    locale,
    formatDate,
    renderFocusLink
  });
  const activeFilterItems = buildActivePackageFilterItems(copy, currentPackageFilters);
  const packageFilterForm = renderPackagesFilterForm({
    copy,
    data,
    packageNodeFilter,
    packageNameFilter,
    packageArchFilter,
    renderWorkspaceFilterForm
  });
  const packageTable = renderDataTable({
    id: "section-packages-table",
    heading: copy.packagesInventoryTitle,
    description: copy.packagesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    restoreSelectionHref: true,
    columns: [
      { label: copy.packageColPackage, className: "mono" },
      { label: copy.packageColVersion, className: "mono" },
      { label: copy.packageColArch, className: "mono" },
      { label: copy.packageColNode, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.packageColInstalled },
      { label: copy.packageColCollected }
    ],
    rows: packageRows,
    emptyMessage: copy.noPackages,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  const selectedPackagePanel = selectedPackage
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.selectedPackageTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.selectedPackageDescription)}</p>
          </div>
        </div>
        <div>
          <h3>${escapeHtml(selectedPackage.packageName)}</h3>
          <p class="muted mono">${escapeHtml(selectedPackage.nevra)}</p>
        </div>
        ${renderDetailGrid(
          [
            { label: copy.packageColNode, value: escapeHtml(selectedPackage.nodeId) },
            { label: copy.packageColHostname, value: escapeHtml(selectedPackage.hostname) },
            {
              label: copy.packageColVersion,
              value: escapeHtml(`${selectedPackage.version}-${selectedPackage.release}`)
            },
            { label: copy.packageColArch, value: escapeHtml(selectedPackage.arch) },
            {
              label: copy.packageSourceLabel,
              value: escapeHtml(selectedPackage.source ?? copy.none)
            },
            {
              label: copy.packageColInstalled,
              value: escapeHtml(formatDate(selectedPackage.installedAt, locale))
            },
            {
              label: copy.packageColCollected,
              value: escapeHtml(formatDate(selectedPackage.lastCollectedAt, locale))
            },
            {
              label: copy.packageNevraLabel,
              value: escapeHtml(selectedPackage.nevra),
              className: "detail-item-span-full"
            }
          ],
          { className: "detail-grid-compact" }
        )}
      </article>`
    : `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.selectedPackageTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.selectedPackageDescription)}</p>
          </div>
        </div>
        <p class="empty">${escapeHtml(copy.noPackages)}</p>
      </article>`;

  const packageActionsPanel = `<article class="panel detail-shell panel-nested">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.packageActionsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.packageActionsDescription)}</p>
      </div>
    </div>
    ${renderActionFacts([
      {
        label: copy.targetedNodesLabel,
        value: escapeHtml(String(data.nodeHealth.length))
      },
      {
        label: copy.relatedJobsTitle,
        value: escapeHtml(String(selectedPackageJobs.length))
      },
      {
        label: copy.auditTrailTitle,
        value: escapeHtml(String(selectedPackageAuditEvents.length))
      }
    ])}
    <form method="post" action="/actions/package-inventory-refresh" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(packagesReturnTo)}" />
      ${renderNodeSelectionFieldset(copy, data.nodeHealth)}
      <div class="resource-actions-toolbar">
        <button type="submit">${escapeHtml(copy.refreshInventoryLabel)}</button>
        <a class="button-link secondary" href="${escapeHtml(jobsHref)}">${escapeHtml(
          copy.openJobHistory
        )}</a>
        <a class="button-link secondary" href="${escapeHtml(auditHref)}">${escapeHtml(
          copy.openAuditHistory
        )}</a>
      </div>
    </form>
  </article>`;

  const packageInstallRepoPanel = `<article class="panel detail-shell panel-nested">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.packageInstallRepoTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.packageInstallRepoDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/package-install" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(packagesReturnTo)}" />
      ${renderNodeSelectionFieldset(copy, data.nodeHealth)}
      <div class="form-grid">
        <label class="form-field-span-full">${escapeHtml(copy.packageNamesLabel)}
          <input
            type="text"
            name="packageNames"
            placeholder="${escapeHtml(copy.packageNamesPlaceholder)}"
          />
        </label>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" name="allowReinstall" />
        <span>${escapeHtml(copy.packageAllowReinstallLabel)}</span>
      </label>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.installFromRepoLabel)}</button>
      </div>
    </form>
  </article>`;

  const packageInstallUrlPanel = `<article class="panel detail-shell panel-nested">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.packageInstallUrlTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.packageInstallUrlDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/package-install" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(packagesReturnTo)}" />
      ${renderNodeSelectionFieldset(copy, data.nodeHealth)}
      <div class="form-grid">
        <label class="form-field-span-full">${escapeHtml(copy.packageRpmUrlLabel)}
          <input
            type="url"
            name="rpmUrl"
            placeholder="${escapeHtml(copy.packageRpmUrlPlaceholder)}"
          />
        </label>
        <label class="form-field-span-full">${escapeHtml(copy.packageExpectedSha256Label)}
          <input type="text" name="expectedSha256" />
        </label>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" name="allowReinstall" />
        <span>${escapeHtml(copy.packageAllowReinstallLabel)}</span>
      </label>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.installFromUrlLabel)}</button>
      </div>
    </form>
  </article>`;

  return `<section id="section-packages" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.filterNodeLabel, value: String(distinctNodeCount), tone: distinctNodeCount > 0 ? "success" : "muted" },
      { label: copy.filterPackageLabel, value: String(distinctPackageCount), tone: distinctPackageCount > 0 ? "success" : "muted" },
      { label: copy.packageColArch, value: String(distinctArchCount), tone: distinctArchCount > 0 ? "muted" : "success" },
      { label: copy.records, value: String(filteredPackages.length), tone: filteredPackages.length > 0 ? "muted" : "success" }
    ])}
    ${packageFilterForm}
    ${packageTable}
    <div class="grid-two-desktop">
      ${selectedPackagePanel}
      <div class="stack">
        ${renderActiveFiltersPanel(copy, activeFilterItems, buildDashboardViewUrl("packages"))}
        ${packageActionsPanel}
        ${packageInstallRepoPanel}
        ${packageInstallUrlPanel}
      </div>
    </div>
  </section>`;
}
