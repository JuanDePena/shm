import { escapeHtml, renderDataTable, type DataTableRow } from "@simplehost/ui";

import { type AuditEventSummary, type JobHistoryEntry } from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";
import {
  type DesiredStateTabId,
  buildDashboardViewUrl
} from "./dashboard-routing.js";
import {
  buildDesiredStateCreateTab,
  type DesiredStateCreateCopy
} from "./desired-state-create.js";
import { renderDesiredStateLayout } from "./desired-state-layout.js";
import { buildDesiredStateModel } from "./desired-state-model.js";
import { buildDesiredStateLayoutSections } from "./desired-state-sections.js";
import {
  renderAppProxyDesiredStatePanels,
  type DesiredStateAppProxyCopy
} from "./desired-state-app-proxy.js";
import {
  renderBackupPolicyDesiredStatePanels,
  type DesiredStateBackupPolicyCopy
} from "./desired-state-backup-policy.js";
import {
  renderDatabaseDesiredStatePanels,
  type DesiredStateDatabaseCopy
} from "./desired-state-database.js";
import {
  renderNodeDesiredStatePanels,
  renderTenantDesiredStatePanels,
  type DesiredStateTenantNodeCopy
} from "./desired-state-tenant-node.js";
import {
  renderZoneDesiredStatePanels,
  type DesiredStateZoneCopy
} from "./desired-state-zone.js";
import { type DesiredStateComparisonRow } from "./desired-state-shared.js";
import { type WebLocale } from "./request.js";
import { type SelectOption } from "./web-types.js";

type DesiredStateSectionOptions = {
  mode?: "full" | "single" | "workspace";
  workspaceTabId?: string;
  workspaceKind?: "apps" | "proxies";
  panelsOnly?: boolean;
};

export interface DesiredStateWorkspaceCopy
  extends DesiredStateCreateCopy,
    DesiredStateTenantNodeCopy,
    DesiredStateZoneCopy,
    DesiredStateAppProxyCopy,
    DesiredStateDatabaseCopy,
    DesiredStateBackupPolicyCopy {
  appColTenant: string;
  backupPolicies: string;
  backupPolicyColSlug: string;
  dataFilterPlaceholder: string;
  desiredStateInventoryDescription: string;
  desiredStateInventoryTitle: string;
  noApps: string;
  noBackupPolicies: string;
  noDatabases: string;
  noNodes: string;
  noTenants: string;
  noZones: string;
  nodeColHostname: string;
  nodeSpecColPublicIpv4: string;
  nodeSpecColWireguard: string;
  of: string;
  records: string;
  proxyWorkspaceDescription: string;
  rowsPerPage: string;
  selectedStateLabel: string;
  showing: string;
  tabActivity: string;
  tabCreate: string;
  tabNodes: string;
  tabSpec: string;
  tabSummary: string;
  tabTenants: string;
  tabZones: string;
}

export function renderDesiredStateSection<Copy extends DesiredStateWorkspaceCopy>(args: {
  data: DashboardData;
  copy: Copy;
  locale: WebLocale;
  defaultTabId: DesiredStateTabId;
  defaultImportPath: string;
  focus?: string;
  options?: DesiredStateSectionOptions;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  interpolateCopy: (
    template: string,
    variables: Record<string, string | number>
  ) => string;
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderActionForm: (
    action: string,
    hiddenFields: Record<string, string>,
    label: string,
    options?: { confirmMessage?: string }
  ) => string;
  renderAuditPanel: (
    copy: Copy,
    locale: WebLocale,
    events: DashboardData["auditEvents"]
  ) => string;
  renderComparisonTable: (
    copy: Copy,
    title: string,
    description: string,
    rows: DesiredStateComparisonRow[]
  ) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderJobFeedPanel: (
    copy: Copy,
    locale: WebLocale,
    jobs: DashboardData["jobHistory"],
    title?: string
  ) => string;
  renderPill: (
    value: string,
    tone?: "default" | "success" | "danger" | "muted"
  ) => string;
  renderRelatedPanel: (
    title: string,
    description: string | undefined,
    items: Array<{
      title: string;
      meta?: string;
      summary?: string;
      summaryHtml?: string;
      tone?: "default" | "danger" | "success";
    }>,
    emptyMessage: string
  ) => string;
  renderSelectOptions: (
    options: SelectOption[],
    selectedValue: string | undefined,
    optionsConfig?: {
      allowBlank?: boolean;
      blankLabel?: string;
    }
  ) => string;
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
  findLatestJobWithStatus: (
    jobs: DashboardData["jobHistory"],
    status: DashboardData["jobHistory"][number]["status"]
  ) => DashboardData["jobHistory"][number] | undefined;
  createComparisonRow: (
    label: string,
    desiredValue: string,
    appliedValue?: string | null
  ) => DesiredStateComparisonRow;
  createComparisonDeltaItems: (
    copy: Copy,
    rows: DesiredStateComparisonRow[],
    limit?: number
  ) => Array<{ title: string; meta?: string; summary?: string; tone?: "default" | "success" | "danger" }>;
  summarizeComparisonRows: (copy: Copy, rows: DesiredStateComparisonRow[]) => string;
  readStringPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => string | null;
  readBooleanPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => boolean | null;
  readStringArrayPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => string[];
  readObjectArrayPayloadValue: (
    payload: Record<string, unknown> | undefined,
    key: string
  ) => Array<Record<string, unknown>>;
  formatDnsRecordPreview: (
    record:
      | DashboardData["desiredState"]["spec"]["zones"][number]["records"][number]
      | Record<string, unknown>
      | undefined
  ) => string;
}): string {
  const {
    data,
    copy,
    locale,
    defaultTabId,
    defaultImportPath,
    focus,
    options = {},
    formatDate,
    interpolateCopy,
    renderActionFacts,
    renderActionForm,
    renderAuditPanel,
    renderComparisonTable,
    renderDetailGrid,
    renderFocusLink,
    renderJobFeedPanel,
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
  } = args;

  const renderEmptyDesiredStatePanel = (message: string): string =>
    `<article class="panel"><p class="empty">${escapeHtml(message)}</p></article>`;
  const renderDesiredStateTable = (
    id: string,
    columns: Array<{ label: string; className?: string }>,
    rows: DataTableRow[],
    emptyMessage: string
  ): string =>
    renderDataTable({
      id,
      heading: copy.desiredStateInventoryTitle,
      description: copy.desiredStateInventoryDescription,
      headingBadgeClassName: "section-badge-lime",
      restoreSelectionHref: true,
      columns,
      rows,
      emptyMessage,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    });

  const {
    tenantOptions,
    nodeOptions,
    zoneOptions,
    appOptions,
    selectedTenant,
    selectedNode,
    selectedZone,
    selectedApp,
    selectedDatabase,
    selectedBackupPolicy,
    selectedDatabaseApp,
    selectedAppZone,
    selectedTenantApps,
    selectedTenantZones,
    selectedTenantBackupPolicies,
    selectedTenantBackupRuns,
    selectedNodePrimaryApps,
    selectedNodePrimaryZones,
    selectedNodeBackupPolicies,
    selectedNodeBackupRuns,
    selectedZoneApps,
    selectedZoneBackupPolicies,
    selectedZoneBackupRuns,
    selectedAppDatabases,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedBackupRuns,
    selectedBackupTenantApps,
    selectedBackupTenantZones,
    selectedBackupTenantDatabases,
    selectedDatabaseBackupPolicies,
    selectedDatabaseBackupRuns,
    tenantCounts,
    nodeCounts,
    tenantTableRows,
    nodeTableRows,
    zoneTableRows,
    appTableRows,
    proxyTableRows,
    databaseTableRows,
    backupTableRows,
    selectedTenantJobs,
    selectedTenantAuditEvents,
    selectedNodeDesiredJobs,
    selectedNodeDesiredAuditEvents,
    selectedNodeDesiredDrift,
    selectedZoneJobs,
    selectedZoneAuditEvents,
    selectedAppJobs,
    selectedAppAuditEvents,
    selectedDatabaseJobs,
    selectedDatabaseAuditEvents,
    selectedBackupRun,
    selectedBackupAuditEvents,
    selectedTenantLatestFailure,
    selectedTenantLatestSuccess,
    selectedNodeLatestFailure,
    selectedNodeLatestSuccess,
    selectedZoneLatestFailure,
    selectedZoneLatestSuccess,
    selectedAppLatestFailure,
    selectedAppLatestSuccess,
    selectedDatabaseLatestFailure,
    selectedDatabaseLatestSuccess,
    selectedBackupLatestFailureRun,
    selectedBackupLatestSuccessRun,
    selectedNodeHealthSnapshot,
    selectedBackupTargetHealth,
    selectedZonePrimaryNodeHealth,
    selectedAppPrimaryNodeHealth,
    selectedDatabasePrimaryNodeHealth,
    selectedZoneDrift,
    selectedAppProxyDrifts,
    selectedDatabaseDrift,
    selectedZoneLatestAppliedDnsJob,
    selectedAppLatestAppliedProxyJob,
    selectedDatabaseLatestAppliedReconcileJob,
    selectedAppPlanItems,
    selectedDatabasePlanItems,
    selectedZonePlanItems,
    zoneComparisonRows,
    appComparisonRows,
    databaseComparisonRows,
    selectedTenantActionPreviewItems,
    selectedNodeActionPreviewItems,
    selectedZoneActionPreviewItems,
    selectedAppActionPreviewItems,
    selectedDatabaseActionPreviewItems,
    selectedBackupActionPreviewItems
  } = buildDesiredStateModel({
    data,
    copy,
    defaultTabId,
    focus,
    renderFocusLink,
    renderPill,
    findRelatedJobs,
    findRelatedAuditEvents,
    findLatestJobWithStatus,
    createComparisonRow,
    createComparisonDeltaItems: (_copy, rows, limit) =>
      createComparisonDeltaItems(copy, rows, limit),
    summarizeComparisonRows: (_copy, rows) => summarizeComparisonRows(copy, rows),
    readStringPayloadValue,
    readBooleanPayloadValue,
    readStringArrayPayloadValue,
    readObjectArrayPayloadValue,
    formatDnsRecordPreview
  });

  const renderResourceActivityStack = (
    jobs: JobHistoryEntry[],
    audits: AuditEventSummary[]
  ): string => `<div class="stack">
      ${renderJobFeedPanel(copy, locale, jobs)}
      ${renderAuditPanel(copy, locale, audits)}
    </div>`;

  const {
    detailPanel: tenantDetailPanel,
    editorPanel: tenantEditorPanel,
    workspacePanel: tenantWorkspacePanel
  } =
    renderTenantDesiredStatePanels({
      copy,
      locale,
      selectedTenant,
      selectedTenantApps,
      selectedTenantZones,
      selectedTenantBackupPolicies,
      selectedTenantBackupRuns,
      selectedTenantJobs,
      selectedTenantAuditEvents,
      selectedTenantLatestSuccess,
      selectedTenantLatestFailure,
      selectedTenantActionPreviewItems,
      tenantCounts,
      renderers: {
        formatDate,
        renderDetailGrid,
        renderPill,
        renderRelatedPanel,
        renderResourceActivityStack
      }
    });

  const {
    detailPanel: nodeDetailPanel,
    editorPanel: nodeEditorPanel
  } =
    renderNodeDesiredStatePanels({
      copy,
      locale,
      selectedNode,
      selectedNodePrimaryApps,
      selectedNodePrimaryZones,
      selectedNodeBackupPolicies,
      selectedNodeBackupRuns,
      selectedNodeDesiredJobs,
      selectedNodeDesiredAuditEvents,
      selectedNodeDesiredDrift,
      selectedNodeLatestSuccess,
      selectedNodeLatestFailure,
      selectedNodeActionPreviewItems,
      selectedNodeHealthSnapshot,
      nodeCounts,
      renderers: {
        formatDate,
        renderDetailGrid,
        renderPill,
        renderRelatedPanel,
        renderResourceActivityStack
      }
    });

  const { detailPanel: backupDetailPanel, editorPanel: backupEditorPanel } =
    renderBackupPolicyDesiredStatePanels({
      copy,
      locale,
      selectedBackupPolicy,
      selectedBackupRun,
      selectedBackupRuns,
      selectedBackupAuditEvents,
      selectedBackupLatestSuccessRun,
      selectedBackupLatestFailureRun,
      selectedBackupTargetHealth,
      selectedBackupActionPreviewItems,
      selectedBackupTenantApps,
      selectedBackupTenantZones,
      selectedBackupTenantDatabases,
      tenantOptions,
      nodeOptions,
      policyCoverageCount: data.backups.policies.length,
      renderers: {
        formatDate,
        renderActionFacts,
        renderAuditPanel: (events) => renderAuditPanel(copy, locale, events),
        renderDetailGrid,
        renderPill,
        renderRelatedPanel,
        renderSelectOptions
      }
    });

  const {
    detailPanel: zoneDetailPanel,
    editorPanel: zoneEditorPanel,
    workspacePanel: zoneWorkspacePanel
  } =
    renderZoneDesiredStatePanels({
      copy,
      locale,
      selectedZone,
      selectedZoneApps,
      selectedZoneBackupPolicies,
      selectedZoneBackupRuns,
      selectedZoneJobs,
      selectedZoneAuditEvents,
      selectedZonePrimaryNodeHealth,
      selectedZoneLatestSuccess,
      selectedZoneLatestFailure,
      selectedZoneDrift,
      selectedZoneActionPreviewItems,
      selectedZonePlanItems,
      zoneComparisonRows,
      tenantOptions,
      nodeOptions,
      renderers: {
        createComparisonDeltaItems: (rows, limit) =>
          createComparisonDeltaItems(copy, rows, limit),
        formatDate,
        renderActionFacts,
        renderActionForm,
        renderComparisonTable: (title, description, rows) =>
          renderComparisonTable(copy, title, description, rows),
        renderDetailGrid,
        renderPill,
        renderRelatedPanel,
        renderResourceActivityStack,
        renderSelectOptions
      }
    });

  const {
    proxyDetailPanel,
    proxyEditorPanel,
    proxyWorkspacePanel,
    appDetailPanel,
    appEditorPanel,
    appWorkspacePanel
  } = renderAppProxyDesiredStatePanels({
    copy,
    locale,
    selectedApp,
    selectedAppDatabases,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedAppJobs,
    selectedAppAuditEvents,
    selectedAppLatestSuccess,
    selectedAppLatestFailure,
    selectedAppProxyDrifts,
    selectedAppActionPreviewItems,
    selectedAppPlanItems,
    appComparisonRows,
    selectedAppPrimaryNodeHealth,
    tenantOptions,
    zoneOptions,
    nodeOptions,
    renderers: {
      createComparisonDeltaItems: (rows, limit) =>
        createComparisonDeltaItems(copy, rows, limit),
      formatDate,
      renderActionFacts,
      renderActionForm,
      renderComparisonTable: (title, description, rows) =>
        renderComparisonTable(copy, title, description, rows),
      renderDetailGrid,
      renderPill,
      renderRelatedPanel,
      renderResourceActivityStack,
      renderSelectOptions
    }
  });

  const {
    detailPanel: databaseDetailPanel,
    editorPanel: databaseEditorPanel,
    workspacePanel: databaseWorkspacePanel
  } =
    renderDatabaseDesiredStatePanels({
      copy,
      locale,
      selectedDatabase,
      selectedDatabaseApp,
      selectedDatabaseBackupPolicies,
      selectedDatabaseBackupRuns,
      selectedDatabaseJobs,
      selectedDatabaseAuditEvents,
      selectedDatabasePrimaryNodeHealth,
      selectedDatabaseLatestSuccess,
      selectedDatabaseLatestFailure,
      selectedDatabaseDrift,
      selectedDatabaseActionPreviewItems,
      selectedDatabasePlanItems,
      databaseComparisonRows,
      appOptions,
      nodeOptions,
      renderers: {
        createComparisonDeltaItems: (rows, limit) =>
          createComparisonDeltaItems(copy, rows, limit),
        formatDate,
        renderActionFacts,
        renderActionForm,
        renderComparisonTable: (title, description, rows) =>
          renderComparisonTable(copy, title, description, rows),
        renderDetailGrid,
        renderPill,
        renderRelatedPanel,
        renderResourceActivityStack,
        renderSelectOptions
      }
    });

  const { createTab, createFormPanels } = buildDesiredStateCreateTab({
    copy,
    data,
    locale,
    defaultTabId,
    defaultImportPath,
    tenantOptions,
    nodeOptions,
    zoneOptions,
    appOptions,
    formatDate,
    interpolateCopy,
    renderActionFacts,
    renderDetailGrid,
    renderSelectOptions
  });

  const tenantActivityHtml = selectedTenant
    ? renderResourceActivityStack(selectedTenantJobs, selectedTenantAuditEvents)
    : undefined;
  const zoneActivityHtml = selectedZone
    ? renderResourceActivityStack(selectedZoneJobs, selectedZoneAuditEvents)
    : undefined;
  const appActivityHtml = selectedApp
    ? renderResourceActivityStack(selectedAppJobs, selectedAppAuditEvents)
    : undefined;
  const databaseActivityHtml = selectedDatabase
    ? renderResourceActivityStack(selectedDatabaseJobs, selectedDatabaseAuditEvents)
    : undefined;
  const backupWorkspaceActivityHtml = selectedBackupPolicy
    ? `<div class="stack">
        ${renderRelatedPanel(
          copy.backupsTitle,
          copy.backupsDescription,
          selectedBackupRuns.slice(0, 8).map((run) => ({
            title: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, run.runId)
            )}">${escapeHtml(run.runId)}</a>`,
            meta: escapeHtml(
              [run.policySlug, run.nodeId, formatDate(run.startedAt, locale)].join(" · ")
            ),
            summary: escapeHtml(run.summary),
            tone:
              run.status === "failed"
                ? ("danger" as const)
                : run.status === "succeeded"
                  ? ("success" as const)
                  : ("default" as const)
          })),
          copy.noBackups
        )}
        ${renderAuditPanel(copy, locale, selectedBackupAuditEvents)}
      </div>`
    : undefined;

  const desiredStateSections = buildDesiredStateLayoutSections({
    copy,
    data,
    focus,
    options,
    createFormPanels,
    renderDesiredStateTable,
    renderEmptyDesiredStatePanel,
    tenantTableRows,
    nodeTableRows,
    zoneTableRows,
    appTableRows,
    proxyTableRows,
    databaseTableRows,
    backupTableRows,
    tenantDetailPanel,
    tenantEditorPanel,
    tenantActivityHtml,
    tenantWorkspacePanel,
    nodeDetailPanel,
    nodeEditorPanel,
    zoneDetailPanel,
    zoneEditorPanel,
    zoneActivityHtml,
    zoneWorkspacePanel,
    appDetailPanel,
    appEditorPanel,
    appActivityHtml,
    appWorkspacePanel,
    proxyDetailPanel,
    proxyEditorPanel,
    proxyWorkspacePanel,
    databaseDetailPanel,
    databaseEditorPanel,
    databaseActivityHtml,
    databaseWorkspacePanel,
    backupDetailPanel,
    backupEditorPanel,
    backupActivityHtml: backupWorkspaceActivityHtml
  });

  return renderDesiredStateLayout({
    mode: options.mode,
    defaultTabId,
    singlePanelsOnly: options.panelsOnly,
    createTab,
    sections: desiredStateSections
  });
}
