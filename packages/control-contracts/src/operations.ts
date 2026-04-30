import type { DispatchedJobStatus } from "./core.js";
import type {
  DispatchedJobEnvelope,
  DispatchedJobKind
} from "./jobs.js";

export interface AppReconcileRequest {
  includeContainer?: boolean;
  includeDns?: boolean;
  includeProxy?: boolean;
  includeStandbyProxy?: boolean;
}

export interface DatabaseReconcileRequest {
  password?: string;
}

export interface CodeServerUpdateRequest {
  rpmUrl: string;
  expectedSha256?: string;
  nodeIds?: string[];
}

export interface PackageInventoryRefreshRequest {
  nodeIds?: string[];
}

export interface PackageInstallRequest {
  nodeIds?: string[];
  packageNames?: string[];
  rpmUrl?: string;
  expectedSha256?: string;
  allowReinstall?: boolean;
}

export interface FirewallApplyRequest {
  nodeIds?: string[];
  installPackage?: boolean;
  enableService?: boolean;
  applyPublicZone?: boolean;
  applyWireGuardZone?: boolean;
  reload?: boolean;
}

export interface Fail2BanApplyRequest {
  nodeIds?: string[];
  installPackage?: boolean;
  applySshdJail?: boolean;
  enableService?: boolean;
  restartService?: boolean;
}

export interface InstalledPackageSummary {
  nodeId: string;
  hostname: string;
  packageName: string;
  epoch?: string;
  version: string;
  release: string;
  arch: string;
  nevra: string;
  source?: string;
  installedAt?: string;
  lastCollectedAt: string;
}

export interface PackageInventorySnapshot {
  generatedAt: string;
  nodeCount: number;
  packageCount: number;
  packages: InstalledPackageSummary[];
}

export type EnvironmentParameterSource = "runtime" | "ui";

export interface EnvironmentParameterSummary {
  key: string;
  value: string | null;
  displayValue: string;
  source: EnvironmentParameterSource;
  sensitive: boolean;
  createdFromUi: boolean;
  editable: boolean;
  deletable: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnvironmentParametersSnapshot {
  generatedAt: string;
  parameterCount: number;
  runtimeCount: number;
  uiManagedCount: number;
  parameters: EnvironmentParameterSummary[];
}

export interface EnvironmentParameterMutationRequest {
  key: string;
  value?: string;
  description?: string;
  sensitive?: boolean;
}

export const operationHistoryRetentionDaysParameterKey =
  "SIMPLEHOST_HISTORY_RETENTION_DAYS";
export const operationHistoryRetentionDefaultDays = 90;
export const operationHistoryRetentionMinimumDays = 1;
export const operationHistoryRetentionMaximumDays = 3650;

export type OperationHistoryRetentionSource = "ui" | "runtime" | "default";

export interface OperationHistoryRetentionSummary {
  parameterKey: string;
  retentionDays: number;
  cutoffAt: string;
  source: OperationHistoryRetentionSource;
}

export interface OperationHistoryPurgeSummary extends OperationHistoryRetentionSummary {
  generatedAt: string;
  deletedAuditEventCount: number;
  deletedJobCount: number;
  deletedJobResultCount: number;
  keptLatestResourceJobCount: number;
}

export interface ReconciliationRunSummary {
  runId: string;
  desiredStateVersion: string;
  startedAt: string;
  completedAt: string;
  generatedJobCount: number;
  skippedJobCount: number;
  missingCredentialCount: number;
  jobs: DispatchedJobEnvelope[];
}

export interface JobHistoryEntry {
  jobId: string;
  desiredStateVersion: string;
  kind: DispatchedJobKind;
  nodeId: string;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  status?: DispatchedJobStatus;
  summary?: string;
  dispatchReason?: string;
  resourceKey?: string;
  payload: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export interface AuditEventSummary {
  eventId: string;
  actorType: string;
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface OperationsOverview {
  generatedAt: string;
  nodeCount: number;
  pendingJobCount: number;
  failedJobCount: number;
  backupPolicyCount: number;
  driftedResourceCount: number;
  latestReconciliation?: ReconciliationRunSummary;
}

export interface ResourceDriftSummary {
  resourceKind: "dns" | "site" | "database" | "mail";
  resourceKey: string;
  nodeId: string;
  driftStatus: "in_sync" | "pending" | "failed" | "out_of_sync" | "missing_secret";
  desiredPayloadHash?: string;
  latestPayloadHash?: string;
  latestJobId?: string;
  latestJobStatus?: DispatchedJobStatus;
  latestSummary?: string;
  dispatchRecommended: boolean;
}
