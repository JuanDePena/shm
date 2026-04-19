import { type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { type DashboardView } from "./dashboard-routing.js";
import { type DashboardJobFilters } from "./dashboard-view-model.js";
import { type WebLocale } from "./request.js";
import { type WorkspaceFilterField } from "./web-types.js";

export type JobsCopy = {
  auditActorsDescription: string;
  auditActorsTitle: string;
  auditEntitiesDescription: string;
  auditEntitiesTitle: string;
  auditSignalsDescription: string;
  auditSignalsTitle: string;
  auditTrailTitle: string;
  dataFilterPlaceholder: string;
  effectiveStateDescription: string;
  effectiveStateTitle: string;
  failureFocusDescription: string;
  failureFocusTitle: string;
  filterActorLabel: string;
  filterEntityLabel: string;
  filterEventLabel: string;
  filterKindLabel: string;
  filterNodeLabel: string;
  filterResourceLabel: string;
  filterStatusLabel: string;
  jobColCreated: string;
  jobColJob: string;
  jobColKind: string;
  jobColNode: string;
  jobColReason: string;
  jobColStatus: string;
  jobColSummary: string;
  jobHistoryDescription: string;
  jobHistoryTitle: string;
  jobKindsDescription: string;
  jobKindsTitle: string;
  jobNodesDescription: string;
  jobNodesTitle: string;
  jobResourceHotspotsDescription: string;
  jobResourceHotspotsTitle: string;
  jobStatusesDescription: string;
  jobStatusesTitle: string;
  latestCompleted: string;
  linkedOperationsTitle: string;
  linkedResource: string;
  noJobs: string;
  noRelatedRecords: string;
  none: string;
  of: string;
  nodeColNode: string;
  openDesiredState: string;
  openDriftView: string;
  openNodeHealth: string;
  payloadTitle: string;
  recentAppliedJobs: string;
  recentFailedJobs: string;
  recentQueuedJobs: string;
  records: string;
  rowsPerPage: string;
  selectedStateLabel: string;
  showing: string;
};

export type JobDataTableRenderer = (args: {
  id: string;
  heading: string;
  description: string;
  headingBadgeClassName?: string;
  restoreSelectionHref?: boolean;
  columns: Array<{ label: string; className?: string }>;
  rows: DataTableRow[];
  emptyMessage: string;
  filterPlaceholder: string;
  rowsPerPageLabel: string;
  showingLabel: string;
  ofLabel: string;
  recordsLabel: string;
  defaultPageSize?: number;
}) => string;

export type JobHistoryWorkspaceArgs<Copy extends JobsCopy> = {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  filteredJobHistory: DashboardData["jobHistory"];
  filteredAuditEvents: DashboardData["auditEvents"];
  selectedJob: DashboardData["jobHistory"][number] | undefined;
  currentJobFilters: DashboardJobFilters;
  jobStatusFilter?: string;
  jobKindFilter?: string;
  jobNodeFilter?: string;
  jobResourceFilter?: string;
  auditTypeFilter?: string;
  auditActorFilter?: string;
  auditEntityFilter?: string;
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
  payloadContainsValue: (payload: unknown, needle: string) => boolean;
  resolveResourceKeyTarget: (
    resourceKey: string
  ) => {
    desiredStateHref?: string;
    driftHref?: string;
  };
  renderActionFacts: (
    rows: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderActiveFiltersPanel: (
    copy: Copy,
    items: Array<{ label: string; value: string }>,
    clearHref: string
  ) => string;
  renderAuditPanel: (
    copy: Copy,
    locale: WebLocale,
    events: DashboardData["auditEvents"]
  ) => string;
  renderCodeBlock: (value: unknown) => string;
  renderDataTable: JobDataTableRenderer;
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
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
  renderWorkspaceFilterForm: (
    copy: Copy,
    props: {
      view: DashboardView;
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
};
