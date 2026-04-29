import {
  escapeHtml,
  renderDataTable,
  type PanelNotice
} from "@simplehost/ui";
import type { MailboxCredentialReveal } from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";
import {
  buildDashboardViewUrl,
  type DashboardView,
  type DesiredStateTabId
} from "./dashboard-routing.js";
import { renderAuditWorkspace } from "./dashboard-audit.js";
import { renderBackupsWorkspace } from "./dashboard-backups.js";
import { renderResourceDriftWorkspace } from "./dashboard-drift.js";
import { renderJobHistoryWorkspace } from "./dashboard-jobs.js";
import { renderNodeHealthWorkspace } from "./dashboard-node-health.js";
import { renderPackagesWorkspace } from "./dashboard-packages.js";
import {
  renderFail2BanWorkspace,
  renderFirewallWorkspace
} from "./dashboard-security.js";
import { renderServicesWorkspace } from "./dashboard-services.js";
import { renderLogsWorkspace } from "./dashboard-logs.js";
import { renderCertificatesWorkspace } from "./dashboard-certificates.js";
import { renderStorageWorkspace } from "./dashboard-storage.js";
import { renderNetworkWorkspace } from "./dashboard-network.js";
import { renderProcessesWorkspace } from "./dashboard-processes.js";
import { renderContainersWorkspace } from "./dashboard-containers.js";
import { renderDashboardShell } from "./dashboard-shell.js";
import { buildDashboardViewModel } from "./dashboard-view-model.js";
import {
  formatDate,
  formatDnsRecordPreview,
  formatList,
  getInitials,
  interpolateCopy,
  readBooleanPayloadValue,
  readObjectArrayPayloadValue,
  readStringArrayPayloadValue,
  readStringPayloadValue,
  renderPill,
  renderSelectOptions,
  renderOverviewMetrics,
  renderStats
} from "./dashboard-formatters.js";
import {
  findLatestJobWithStatus,
  parseDriftResourceReference,
  renderActionForm,
  renderFocusLink,
  resolveResourceKeyTarget
} from "./dashboard-links.js";
import {
  findRelatedAuditEvents,
  findRelatedJobs,
  payloadContainsValue,
  renderActiveFiltersPanel,
  renderAuditPanel,
  renderJobFeedPanel,
  renderProfileFacts,
  renderRelatedPanel,
  renderSignOutIconSvg,
  renderUserIconSvg,
  renderWorkspaceFilterForm,
  renderCodeBlock
} from "./dashboard-panels.js";
import { renderDesiredStateSection as renderDesiredStateWorkspace } from "./desired-state-workspace.js";
import { renderMailSection } from "./mail-section.js";
import { renderActionFacts, renderDetailGrid, renderSignalStripHtml } from "./panel-renderers.js";
import { renderRustDeskSection } from "./rustdesk-section.js";
import type { OverviewMetricsSnapshot } from "./overview-metrics.js";
import {
  createComparisonDeltaItems,
  createComparisonRow,
  renderComparisonTable as renderComparisonTableHtml,
  summarizeComparisonRows
} from "./comparison-utils.js";
import { type WebLocale } from "./request.js";
import { copyByLocale, type WebCopy } from "./web-copy.js";

type RenderDashboardArgs = {
  currentPath: string;
  data: DashboardData;
  defaultImportPath: string;
  desiredStateTab: DesiredStateTabId;
  focus?: string;
  historyReplaceUrl?: string;
  locale: WebLocale;
  mailCredentialReveal?: MailboxCredentialReveal | null;
  notice?: PanelNotice;
  overviewMetrics: OverviewMetricsSnapshot;
  version: string;
  view: DashboardView;
};

function renderSignalStrip(
  entries: Array<{ label: string; value: string; tone?: "default" | "success" | "danger" | "muted" }>
): string {
  return renderSignalStripHtml(entries, renderPill);
}

function renderComparisonTable(
  copy: WebCopy,
  title: string,
  description: string,
  rows: Array<{
    field: string;
    desiredValue: string;
    appliedValue: string;
    state: "match" | "changed" | "unknown";
  }>
): string {
  return renderComparisonTableHtml(copy, title, description, rows, renderPill);
}

function renderFocusLinkWithPill(
  label: string,
  href: string,
  active: boolean,
  activeLabel: string
): string {
  return renderFocusLink(label, href, active, activeLabel, renderPill);
}

function renderDesiredStateSection(
  data: DashboardData,
  copy: WebCopy,
  locale: WebLocale,
  defaultTabId: DesiredStateTabId,
  defaultImportPath: string,
  focus?: string,
  options: {
    mode?: "full" | "single" | "workspace";
    workspaceTabId?: string;
    workspaceKind?: "apps" | "proxies";
    panelsOnly?: boolean;
  } = {}
): string {
  return renderDesiredStateWorkspace({
    data,
    copy,
    locale,
    defaultTabId,
    defaultImportPath,
    focus,
    options,
    formatDate,
    interpolateCopy,
    renderActionFacts,
    renderActionForm,
    renderAuditPanel: (nextCopy, nextLocale, events) =>
      renderAuditPanel(nextCopy, nextLocale, events, formatDate),
    renderComparisonTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderJobFeedPanel: (nextCopy, nextLocale, jobs, title) =>
      renderJobFeedPanel(nextCopy, nextLocale, jobs, formatDate, title),
    renderPill,
    renderRelatedPanel,
    renderSelectOptions,
    findRelatedJobs,
    findRelatedAuditEvents,
    findLatestJobWithStatus,
    createComparisonRow,
    createComparisonDeltaItems,
    summarizeComparisonRows,
    readStringPayloadValue,
    readBooleanPayloadValue,
    readStringArrayPayloadValue,
    readObjectArrayPayloadValue,
    formatDnsRecordPreview
  });
}

function renderSingleDesiredStateObjectView(
  data: DashboardData,
  copy: WebCopy,
  locale: WebLocale,
  defaultTabId: DesiredStateTabId,
  defaultImportPath: string,
  focus?: string,
  panelsOnly = false
): string {
  return renderDesiredStateSection(data, copy, locale, defaultTabId, defaultImportPath, focus, {
    mode: "single",
    panelsOnly
  });
}

function renderDesiredStateObjectWorkspaceView(
  data: DashboardData,
  copy: WebCopy,
  locale: WebLocale,
  defaultTabId: DesiredStateTabId,
  defaultImportPath: string,
  focus: string | undefined,
  workspaceTabId: string,
  workspaceKind?: "apps" | "proxies"
): string {
  return renderDesiredStateSection(data, copy, locale, defaultTabId, defaultImportPath, focus, {
    mode: "workspace",
    workspaceTabId,
    workspaceKind
  });
}

export function renderDashboardPage(args: RenderDashboardArgs): string {
  const {
    currentPath,
    data,
    defaultImportPath,
    desiredStateTab,
    focus,
    historyReplaceUrl,
    locale,
    mailCredentialReveal,
    notice,
    overviewMetrics,
    version,
    view
  } = args;

  const copy = copyByLocale[locale];
  const {
    resolvedDesiredStateTab,
    tenantWorkspaceTab,
    zoneWorkspaceTab,
    proxyWorkspaceTab,
    appWorkspaceTab,
    databaseWorkspaceTab,
    backupPolicyWorkspaceTab,
    jobStatusFilter,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    driftStatusFilter,
    driftKindFilter,
    driftNodeFilter,
    backupStatusFilter,
    backupNodeFilter,
    backupTenantFilter,
    backupPolicyFilter,
    packageNodeFilter,
    packageNameFilter,
    packageArchFilter,
    filteredJobHistory,
    filteredAuditEvents,
    filteredDrift,
    filteredBackupPolicies,
    filteredBackupRuns,
    filteredPackages,
    currentJobFilters,
    currentDriftFilters,
    currentBackupFilters,
    currentPackageFilters,
    selectedNodeHealth,
    selectedDrift,
    selectedJob,
    selectedBackupViewRun,
    selectedBackupPolicySummary,
    selectedPackage
  } = buildDashboardViewModel({
    data,
    currentPath,
    view,
    desiredStateTab,
    focus,
    payloadContainsValue
  });
  const currentAuditFilters = {
    auditType: auditTypeFilter,
    auditActor: auditActorFilter,
    auditEntity: auditEntityFilter
  };
  const selectedAuditEvent =
    view === "audit"
      ? filteredAuditEvents.find((event) => event.eventId === focus) ??
        filteredAuditEvents[0] ??
        data.auditEvents[0]
      : undefined;
  const now = Date.now();
  const staleThresholdMs = 15 * 60 * 1000;
  const staleNodeCount = data.nodeHealth.filter((node) => {
    const lastSeenAt = node.lastSeenAt ? Date.parse(node.lastSeenAt) : Number.NaN;
    return Number.isFinite(lastSeenAt) && now - lastSeenAt > staleThresholdMs;
  }).length;
  const pendingNodeCount = data.nodeHealth.filter((node) => node.pendingJobCount > 0).length;
  const failingNodeCount = data.nodeHealth.filter((node) => node.latestJobStatus === "failed").length;
  const healthyNodeCount = data.nodeHealth.filter((node) => {
    const lastSeenAt = node.lastSeenAt ? Date.parse(node.lastSeenAt) : Number.NaN;
    const stale = Number.isFinite(lastSeenAt) && now - lastSeenAt > staleThresholdMs;
    return !stale && node.pendingJobCount === 0 && node.latestJobStatus !== "failed";
  }).length;

  const tenantMemberships =
    data.currentUser.tenantMemberships.length > 0
      ? data.currentUser.tenantMemberships
          .map((membership) => `${membership.tenantSlug}:${membership.role}`)
          .join(", ")
      : copy.none;

  const latestReconciliationSummary = data.overview.latestReconciliation
    ? `<p class="muted">${escapeHtml(
        copy.reconciliationVersion.replace(
          "{version}",
          String(data.overview.latestReconciliation.desiredStateVersion)
        )
      )}</p>
       <p class="muted">${escapeHtml(interpolateCopy(copy.reconciliationSummary, {
         generated: data.overview.latestReconciliation.generatedJobCount,
         skipped: data.overview.latestReconciliation.skippedJobCount,
         missing: data.overview.latestReconciliation.missingCredentialCount
       }))}</p>`
    : `<p class="muted">${escapeHtml(copy.noReconciliationRun)}</p>`;

  const actionBar = `<div class="action-grid">
      <article class="action-card action-card-strong">
        <span class="action-eyebrow">Planner</span>
        <h3>${escapeHtml(copy.actionsRunReconciliation)}</h3>
        <p class="muted">${escapeHtml(copy.actionPlanDescription)}</p>
        <div class="action-card-context">
          <span class="action-card-context-title">${escapeHtml(copy.latestReconciliation)}</span>
          ${latestReconciliationSummary}
        </div>
        <form method="post" action="/actions/reconcile-run">
          <button
            type="submit"
            data-confirm="${escapeHtml(
              "Run a new reconciliation cycle? Missing work across DNS, proxy and databases may be queued."
            )}"
          >${escapeHtml(copy.actionsRunReconciliation)}</button>
        </form>
      </article>
    </div>`;

  const bootstrapInventoryPanel = `<details class="panel panel-muted detail-shell">
    <summary>${escapeHtml(copy.bootstrapInventoryTitle)}</summary>
    <p class="muted section-description">${escapeHtml(copy.bootstrapInventoryDescription)}</p>
    <p class="muted">${escapeHtml(copy.dailyOperationsSourceNote)}</p>
    ${renderActionFacts(
      [
        {
          label: copy.latestImport,
          value:
            data.inventory.latestImport
              ? escapeHtml(
                  `${formatDate(data.inventory.latestImport.importedAt, locale)} · ${data.inventory.latestImport.sourcePath}`
                )
              : escapeHtml(copy.never)
        },
        {
          label: copy.latestExport,
          value: data.inventory.latestExport
            ? escapeHtml(formatDate(data.inventory.latestExport.exportedAt, locale))
            : escapeHtml(copy.never)
        },
        {
          label: copy.records,
          value: escapeHtml(
            interpolateCopy(copy.latestImportCounts, {
              nodes: data.desiredState.summary.nodeCount,
              zones: data.desiredState.summary.zoneCount,
              apps: data.desiredState.summary.appCount,
              databases: data.desiredState.summary.databaseCount
            })
          )
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <div class="toolbar">
      <a class="button-link secondary" href="/inventory/export">${escapeHtml(
        copy.actionsDownloadYaml
      )}</a>
    </div>
  </details>`;

  const topbarUserPanelHtml = `<div class="profile-sheet">
    <div class="profile-sheet-head">
      <span class="profile-avatar">${getInitials(data.currentUser.displayName)}</span>
      <div class="profile-sheet-copy">
        <strong class="profile-name">${escapeHtml(data.currentUser.displayName)}</strong>
        <span class="profile-meta">${escapeHtml(data.currentUser.email)}</span>
      </div>
    </div>
    ${renderProfileFacts([
      {
        label: copy.globalRoles,
        value: escapeHtml(formatList(data.currentUser.globalRoles, copy.none))
      },
      {
        label: copy.tenantMemberships,
        value: escapeHtml(tenantMemberships)
      }
    ])}
    <div class="profile-sheet-footer">
      <form method="post" action="/auth/logout">
        <button
          class="danger profile-sheet-signout"
          type="submit"
          aria-label="${escapeHtml(copy.signOutLabel)}"
          title="${escapeHtml(copy.signOutLabel)}"
        >
          ${renderSignOutIconSvg()}
          <span>${escapeHtml(copy.signOutLabel)}</span>
        </button>
      </form>
    </div>
  </div>`;
  const { nodeHealthSection, nodesSection } = renderNodeHealthWorkspace({
    copy,
    data,
    locale,
    selectedNodeHealth,
    healthyNodeCount,
    staleNodeCount,
    pendingNodeCount,
    failingNodeCount,
    specPanelHtml: renderSingleDesiredStateObjectView(
      data,
      copy,
      locale,
      "desired-state-nodes",
      defaultImportPath,
      focus,
      true
    ),
    renderDataTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip,
    formatDate
  });
  const jobHistorySection = renderJobHistoryWorkspace({
    copy,
    data,
    locale,
    filteredJobHistory,
    filteredAuditEvents,
    selectedJob,
    currentJobFilters,
    jobStatusFilter,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    formatDate,
    findRelatedJobs,
    payloadContainsValue,
    resolveResourceKeyTarget,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderAuditPanel: (nextCopy, nextLocale, events) =>
      renderAuditPanel(nextCopy, nextLocale, events, formatDate),
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderJobFeedPanel: (nextCopy, nextLocale, jobs, title) =>
      renderJobFeedPanel(nextCopy, nextLocale, jobs, formatDate, title),
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  });
  const auditSection = renderAuditWorkspace({
    copy,
    data,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    formatDate,
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderSignalStrip,
    renderWorkspaceFilterForm
  });
  const resourceDriftSection = renderResourceDriftWorkspace({
    copy,
    data,
    locale,
    filteredDrift,
    selectedDrift,
    currentDriftFilters,
    driftStatusFilter,
    driftKindFilter,
    driftNodeFilter,
    findRelatedAuditEvents,
    findRelatedJobs,
    parseDriftResourceReference,
    renderActionFacts,
    renderActionForm,
    renderActiveFiltersPanel,
    renderAuditPanel: (nextCopy, nextLocale, events) =>
      renderAuditPanel(nextCopy, nextLocale, events, formatDate),
    renderDataTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderJobFeedPanel: (nextCopy, nextLocale, jobs, title) =>
      renderJobFeedPanel(nextCopy, nextLocale, jobs, formatDate, title),
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  });
  const backupsSection = renderBackupsWorkspace({
    copy,
    data,
    locale,
    filteredBackupPolicies,
    filteredBackupRuns,
    selectedBackupViewRun,
    selectedBackupPolicySummary,
    currentBackupFilters,
    backupStatusFilter,
    backupNodeFilter,
    backupTenantFilter,
    backupPolicyFilter,
    findRelatedAuditEvents,
    formatDate,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderAuditPanel: (nextCopy, nextLocale, events) =>
      renderAuditPanel(nextCopy, nextLocale, events, formatDate),
    renderDataTable,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  });
  const packagesSection = renderPackagesWorkspace({
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
    renderFocusLink: renderFocusLinkWithPill
  });
  const firewallSection = renderFirewallWorkspace({
    copy,
    data,
    locale,
    currentPath,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const fail2banSection = renderFail2BanWorkspace({
    copy,
    data,
    locale,
    currentPath,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const servicesSection = renderServicesWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const logsSection = renderLogsWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const certificatesSection = renderCertificatesWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const storageSection = renderStorageWorkspace({
    copy,
    data,
    focus,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const networkSection = renderNetworkWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const processesSection = renderProcessesWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const containersSection = renderContainersWorkspace({
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const rustdeskSection = renderRustDeskSection(data, copy, locale, focus, {
    formatDate,
    renderActionFacts,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSignalStrip
  });
  const mailSection = renderMailSection(data, copy, locale, focus, currentPath, mailCredentialReveal
    ? {
        historyReplaceUrl,
        reveal: mailCredentialReveal
      }
    : undefined, {
    formatDate,
    renderActionForm,
    renderDetailGrid,
    renderFocusLink: renderFocusLinkWithPill,
    renderPill,
    renderSelectOptions,
    renderSignalStrip
  });

  const desiredStateSection = renderDesiredStateSection(
    data,
    copy,
    locale,
    resolvedDesiredStateTab,
    defaultImportPath,
    focus
  );
  const tenantsSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-tenants",
    defaultImportPath,
    focus,
    tenantWorkspaceTab
  );

  const zonesSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-zones",
    defaultImportPath,
    focus,
    zoneWorkspaceTab
  );

  const proxiesSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-apps",
    defaultImportPath,
    focus,
    proxyWorkspaceTab,
    "proxies"
  );

  const appsSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-apps",
    defaultImportPath,
    focus,
    appWorkspaceTab,
    "apps"
  );

  const databasesSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-databases",
    defaultImportPath,
    focus,
    databaseWorkspaceTab
  );

  const backupPoliciesSection = renderDesiredStateObjectWorkspaceView(
    data,
    copy,
    locale,
    "desired-state-backups",
    defaultImportPath,
    focus,
    backupPolicyWorkspaceTab
  );

  return renderDashboardShell({
    copy,
    data,
    locale,
    currentPath,
    historyReplaceUrl,
    version,
    view,
    focus,
    resolvedDesiredStateTab,
    notice,
    filteredDrift,
    filteredBackupRuns,
    actionBar,
    bootstrapInventoryPanel,
    topbarUserPanelHtml,
    userToggleIconHtml: renderUserIconSvg(),
    overviewMetrics,
    renderSignalStrip,
    renderOverviewMetrics,
    renderStats,
    sections: {
      desiredStateSection,
      tenantsSection,
      nodesSection,
      zonesSection,
      proxiesSection,
      appsSection,
      databasesSection,
      mailSection,
      backupPoliciesSection,
      servicesSection,
      logsSection,
      certificatesSection,
      storageSection,
      networkSection,
      processesSection,
      containersSection,
      packagesSection,
      firewallSection,
      fail2banSection,
      auditSection,
      jobHistorySection,
      nodeHealthSection,
      resourceDriftSection,
      backupsSection,
      rustdeskSection
    }
  });
}
