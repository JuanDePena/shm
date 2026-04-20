import { type DashboardData } from "./api-client.js";
import { type WebLocale } from "./request.js";
import {
  type DesiredStateActionFactsRenderer,
  type DesiredStateActionFormRenderer,
  type DesiredStateComparisonDeltaItemsRenderer,
  type DesiredStateComparisonRow,
  type DesiredStateComparisonTableRenderer,
  type DesiredStateDetailGridRenderer,
  type DesiredStatePillRenderer,
  type DesiredStateRelatedPanelItem,
  type DesiredStateRelatedPanelRenderer,
  type DesiredStateSelectOption,
  type DesiredStateSelectOptionsRenderer
} from "./desired-state-shared.js";

export type App = DashboardData["desiredState"]["spec"]["apps"][number];
export type Database = DashboardData["desiredState"]["spec"]["databases"][number];
export type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
export type BackupRun = DashboardData["backups"]["latestRuns"][number];
export type Job = DashboardData["jobHistory"][number];
export type AuditEvent = DashboardData["auditEvents"][number];
export type NodeHealth = DashboardData["nodeHealth"][number];
export type DriftEntry = DashboardData["drift"][number];

export interface DesiredStateAppProxyCopy {
  proxyWorkspaceDescription: string;
  propertiesStatusTitle: string;
  propertiesStatusDescription: string;
  resourceActionsTitle: string;
  resourceActionsDescription: string;
  proxyPropertiesTitle: string;
  proxyPropertiesDescription: string;
  proxyDatabaseTitle: string;
  proxyDatabaseDescription: string;
  proxyActionsTitle: string;
  proxyActionsDescription: string;
  selectedResourceTitle: string;
  selectedResourceDescription: string;
  appColSlug: string;
  appColTenant: string;
  zoneColZone: string;
  backendPortLabel: string;
  aliasesLabel: string;
  appColNodes: string;
  appRuntimeTitle: string;
  appColDomain: string;
  appColMode: string;
  modeHealthLabel: string;
  runtimeImageLabel: string;
  databaseColDatabase: string;
  databaseColEngine: string;
  databaseColUser: string;
  detailActionsTitle: string;
  dispatchRecommended: string;
  yesLabel: string;
  noLabel: string;
  none: string;
  latestSuccessLabel: string;
  latestFailureLabel: string;
  linkedResource: string;
  linkedOperationsTitle: string;
  backupsTitle: string;
  backupCoverageDescription: string;
  auditTrailTitle: string;
  actionDispatchProxyRender: string;
  openDriftView: string;
  openAuditHistory: string;
  openBackupsView: string;
  openNodeHealth: string;
  desiredAppliedTitle: string;
  desiredAppliedDescription: string;
  fieldDeltaTitle: string;
  fieldDeltaDescription: string;
  noFieldDeltas: string;
  plannedChangesTitle: string;
  plannedChangesDescription: string;
  relatedResourcesTitle: string;
  relatedResourcesDescription: string;
  desiredStateEditorsTitle: string;
  desiredStateEditorsDescription: string;
  zoneColPrimaryNode: string;
  actionFullReconcile: string;
  openJobHistory: string;
  viewApacheVhost: string;
  effectiveStateTitle: string;
  effectiveStateDescription: string;
  nodeHealthTitle: string;
  relatedDriftTitle: string;
  relatedJobsTitle: string;
  queuedWorkTitle: string;
  queuedWorkDescription: string;
  storageRootLabel: string;
  targetedNodesLabel: string;
  affectedResourcesLabel: string;
  dangerZoneTitle: string;
  previewTitle: string;
  noRelatedRecords: string;
}

export interface DesiredStateAppProxyRenderers {
  renderActionFacts: DesiredStateActionFactsRenderer;
  renderActionForm: DesiredStateActionFormRenderer;
  renderComparisonTable: DesiredStateComparisonTableRenderer<DesiredStateComparisonRow>;
  createComparisonDeltaItems: DesiredStateComparisonDeltaItemsRenderer<DesiredStateComparisonRow>;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderDetailGrid: DesiredStateDetailGridRenderer;
  renderPill: DesiredStatePillRenderer;
  renderRelatedPanel: DesiredStateRelatedPanelRenderer<DesiredStateRelatedPanelItem>;
  renderResourceActivityStack: (jobs: Job[], audits: AuditEvent[]) => string;
  renderSelectOptions: DesiredStateSelectOptionsRenderer;
}

export interface RenderAppProxyDesiredStatePanelsArgs {
  copy: DesiredStateAppProxyCopy;
  locale: WebLocale;
  selectedApp: App | undefined;
  selectedAppDatabases: Database[];
  selectedAppBackupPolicies: BackupPolicy[];
  selectedAppBackupRuns: BackupRun[];
  selectedAppJobs: Job[];
  selectedAppAuditEvents: AuditEvent[];
  selectedAppLatestSuccess: Job | undefined;
  selectedAppLatestFailure: Job | undefined;
  selectedAppProxyDrifts: DriftEntry[];
  selectedAppActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedAppPlanItems: DesiredStateRelatedPanelItem[];
  appComparisonRows: DesiredStateComparisonRow[];
  selectedAppPrimaryNodeHealth: NodeHealth | undefined;
  tenantOptions: DesiredStateSelectOption[];
  zoneOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  renderers: DesiredStateAppProxyRenderers;
}
