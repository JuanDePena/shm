import {
  escapeHtml,
  renderDataTable,
  type PanelNotice
} from "@simplehost/ui";
import {
  operationHistoryRetentionDaysParameterKey,
  operationHistoryRetentionDefaultDays,
  type MailboxCredentialReveal
} from "@simplehost/control-contracts";

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
import { renderParametersWorkspace } from "./dashboard-parameters.js";
import {
  renderFail2BanWorkspace,
  renderFirewallWorkspace
} from "./dashboard-security.js";
import { renderUpdatesWorkspace } from "./dashboard-updates.js";
import { renderRepositoriesWorkspace } from "./dashboard-repositories.js";
import { renderRebootsWorkspace } from "./dashboard-reboots.js";
import { renderConfigValidationWorkspace } from "./dashboard-config-validation.js";
import { renderTimeWorkspace } from "./dashboard-time.js";
import { renderResolverWorkspace } from "./dashboard-resolver.js";
import { renderAccountsWorkspace } from "./dashboard-accounts.js";
import { renderServicesWorkspace } from "./dashboard-services.js";
import { renderLogsWorkspace } from "./dashboard-logs.js";
import { renderCertificatesWorkspace } from "./dashboard-certificates.js";
import { renderStorageWorkspace } from "./dashboard-storage.js";
import { renderMountsWorkspace } from "./dashboard-mounts.js";
import { renderKernelWorkspace } from "./dashboard-kernel.js";
import { renderNetworkWorkspace } from "./dashboard-network.js";
import { renderProcessesWorkspace } from "./dashboard-processes.js";
import { renderContainersWorkspace } from "./dashboard-containers.js";
import { renderTimersWorkspace } from "./dashboard-timers.js";
import { renderSelinuxWorkspace } from "./dashboard-selinux.js";
import { renderSshWorkspace } from "./dashboard-ssh.js";
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
  defaultImportPath: string | null;
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
  defaultImportPath: string | null,
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
  defaultImportPath: string | null,
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
  defaultImportPath: string | null,
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
  const historyRetentionParameter = data.parameters.parameters.find(
    (parameter) => parameter.key === operationHistoryRetentionDaysParameterKey
  );
  const parsedHistoryRetentionDays = Number.parseInt(
    historyRetentionParameter?.value ?? historyRetentionParameter?.displayValue ?? "",
    10
  );
  const historyRetentionDays = Number.isInteger(parsedHistoryRetentionDays)
    ? parsedHistoryRetentionDays
    : operationHistoryRetentionDefaultDays;
  const historyRetentionCutoffAt = new Date(
    now - historyRetentionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const reconciliationPanel = `<div class="action-grid">
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
      <article class="action-card">
        <span class="action-eyebrow">Retention</span>
        <h3>${escapeHtml(copy.historyRetentionTitle)}</h3>
        <p class="muted">${escapeHtml(copy.historyRetentionDescription)}</p>
        <div class="action-card-context">
          <span class="action-card-context-title">${escapeHtml(copy.historyRetentionParameterLabel)}</span>
          ${renderActionFacts([
            {
              label: copy.historyRetentionParameterLabel,
              value: `<span class="mono">${escapeHtml(operationHistoryRetentionDaysParameterKey)}</span>`
            },
            {
              label: copy.historyRetentionDaysLabel,
              value: escapeHtml(String(historyRetentionDays))
            },
            {
              label: copy.historyRetentionCutoffLabel,
              value: escapeHtml(formatDate(historyRetentionCutoffAt, locale))
            }
          ])}
        </div>
        <form method="post" action="/actions/operations-history-purge">
          <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
          <button
            type="submit"
            data-confirm="${escapeHtml(
              "Purge old audit and job history rows using the configured retention?"
            )}"
          >${escapeHtml(copy.purgeHistoryAction)}</button>
        </form>
      </article>
    </div>`;

  const renderReconciliationSection = (): string => `<section id="section-reconciliation" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(copy.navReconciliation)}</h2>
        <p class="muted section-description">${escapeHtml(copy.reconciliationWorkspaceDescription)}</p>
      </div>
    </div>
    ${reconciliationPanel}
  </section>`;

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
  const renderNodeWorkspaceSections = () => renderNodeHealthWorkspace({
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
  const renderJobHistorySection = () => renderJobHistoryWorkspace({
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
  const bodySection = (() => {
    switch (view) {
      case "tenants":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-tenants",
          defaultImportPath,
          focus,
          tenantWorkspaceTab
        );
      case "nodes":
        return renderNodeWorkspaceSections().nodesSection;
      case "zones":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-zones",
          defaultImportPath,
          focus,
          zoneWorkspaceTab
        );
      case "proxies":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-apps",
          defaultImportPath,
          focus,
          proxyWorkspaceTab,
          "proxies"
        );
      case "apps":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-apps",
          defaultImportPath,
          focus,
          appWorkspaceTab,
          "apps"
        );
      case "databases":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-databases",
          defaultImportPath,
          focus,
          databaseWorkspaceTab
        );
      case "mail":
        return renderMailSection(
          data,
          copy,
          locale,
          focus,
          currentPath,
          mailCredentialReveal
            ? {
                historyReplaceUrl,
                reveal: mailCredentialReveal
              }
            : undefined,
          {
            formatDate,
            renderActionForm,
            renderDetailGrid,
            renderFocusLink: renderFocusLinkWithPill,
            renderPill,
            renderSelectOptions,
            renderSignalStrip
          }
        );
      case "backup-policies":
        return renderDesiredStateObjectWorkspaceView(
          data,
          copy,
          locale,
          "desired-state-backups",
          defaultImportPath,
          focus,
          backupPolicyWorkspaceTab
        );
      case "updates":
        return renderUpdatesWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "repositories":
        return renderRepositoriesWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "reboots":
        return renderRebootsWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "config":
        return renderConfigValidationWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "time":
        return renderTimeWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "resolver":
        return renderResolverWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "accounts":
        return renderAccountsWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "services":
        return renderServicesWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "logs":
        return renderLogsWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "certificates":
        return renderCertificatesWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "storage":
        return renderStorageWorkspace({
          copy,
          data,
          focus,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "mounts":
        return renderMountsWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "kernel":
        return renderKernelWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "network":
        return renderNetworkWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "processes":
        return renderProcessesWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "containers":
        return renderContainersWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "timers":
        return renderTimersWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderPill,
          renderSignalStrip
        });
      case "selinux":
        return renderSelinuxWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderPill,
          renderSignalStrip
        });
      case "ssh":
        return renderSshWorkspace({
          copy,
          data,
          locale,
          focus,
          formatDate,
          renderPill,
          renderSignalStrip
        });
      case "packages":
        return renderPackagesWorkspace({
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
      case "firewall":
        return renderFirewallWorkspace({
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
      case "fail2ban":
        return renderFail2BanWorkspace({
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
      case "parameters":
        return renderParametersWorkspace({
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
      case "reconciliation":
        return renderReconciliationSection();
      case "audit":
        return renderAuditWorkspace({
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
      case "jobs":
      case "job-history":
        return renderJobHistorySection();
      case "node-health":
        return renderNodeWorkspaceSections().nodeHealthSection;
      case "resource-drift":
        return renderResourceDriftWorkspace({
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
      case "backups":
        return renderBackupsWorkspace({
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
      case "rustdesk":
        return renderRustDeskSection(data, copy, locale, focus, {
          formatDate,
          renderActionFacts,
          renderDetailGrid,
          renderFocusLink: renderFocusLinkWithPill,
          renderPill,
          renderSignalStrip
        });
      case "desired-state":
        return renderDesiredStateSection(
          data,
          copy,
          locale,
          resolvedDesiredStateTab,
          defaultImportPath,
          focus
        );
      case "overview":
      default:
        return "";
    }
  })();

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
    bodySection,
    topbarUserPanelHtml,
    userToggleIconHtml: renderUserIconSvg(),
    overviewMetrics,
    renderSignalStrip,
    renderOverviewMetrics,
    renderStats
  });
}
