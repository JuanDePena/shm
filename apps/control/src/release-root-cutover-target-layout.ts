import { join } from "node:path";

import { readWorkspaceVersion, resolveWorkspaceRoot } from "./release-sandbox-layout.js";

export interface CombinedControlReleaseRootCutoverTargetLayout {
  readonly workspaceRoot: string;
  readonly targetId: string;
  readonly version: string;
  readonly targetRoot: string;
  readonly hostRoot: string;
  readonly releaseRoot: string;
  readonly releasesRoot: string;
  readonly releaseVersionRoot: string;
  readonly currentRoot: string;
  readonly sharedRoot: string;
  readonly sharedMetaDir: string;
  readonly sharedTmpDir: string;
  readonly sharedLogsDir: string;
  readonly sharedRunDir: string;
  readonly logsDir: string;
  readonly runDir: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly releaseEntrypoint: string;
  readonly currentEntrypoint: string;
  readonly promotionManifestFile: string;
  readonly deployManifestFile: string;
  readonly rollbackManifestFile: string;
  readonly handoffManifestFile: string;
  readonly cutoverPlanManifestFile: string;
  readonly cutoverPlanSummaryFile: string;
  readonly cutoverApplyManifestFile: string;
  readonly cutoverApplySummaryFile: string;
  readonly cutoverHistoryFile: string;
  readonly cutoverHistorySummaryFile: string;
  readonly cutoverRollbackManifestFile: string;
  readonly cutoverRollbackSummaryFile: string;
}

export function createCombinedControlReleaseRootCutoverTargetLayout(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): CombinedControlReleaseRootCutoverTargetLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const targetId = args.targetId ?? "default";
  const targetRoot = join(workspaceRoot, ".tmp", "control-release-root-cutover-target", targetId);
  const hostRoot = join(targetRoot, "opt", "simplehostman");
  const releaseRoot = join(hostRoot, "release");
  const releasesRoot = join(releaseRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(releaseRoot, "current");
  const sharedRoot = join(releaseRoot, "shared");
  const sharedMetaDir = join(sharedRoot, "meta");
  const sharedTmpDir = join(sharedRoot, "tmp");
  const sharedLogsDir = join(sharedRoot, "logs");
  const sharedRunDir = join(sharedRoot, "run");

  return {
    workspaceRoot,
    targetId,
    version,
    targetRoot,
    hostRoot,
    releaseRoot,
    releasesRoot,
    releaseVersionRoot,
    currentRoot,
    sharedRoot,
    sharedMetaDir,
    sharedTmpDir,
    sharedLogsDir,
    sharedRunDir,
    logsDir: join(sharedLogsDir, "control"),
    runDir: join(sharedRunDir, "control"),
    envFile: join(releaseVersionRoot, "env", "control.env"),
    startupManifestFile: join(releaseVersionRoot, "meta", "startup-manifest.json"),
    startupSummaryFile: join(releaseVersionRoot, "meta", "startup-summary.txt"),
    releaseEntrypoint: join(
      releaseVersionRoot,
      "apps",
      "control",
      "dist",
      "release-sandbox-entrypoint.js"
    ),
    currentEntrypoint: join(
      currentRoot,
      "apps",
      "control",
      "dist",
      "release-sandbox-entrypoint.js"
    ),
    promotionManifestFile: join(sharedMetaDir, "promotion.json"),
    deployManifestFile: join(sharedMetaDir, "deploy.json"),
    rollbackManifestFile: join(sharedMetaDir, "rollback.json"),
    handoffManifestFile: join(sharedMetaDir, "handoff.json"),
    cutoverPlanManifestFile: join(sharedMetaDir, "cutover-plan.json"),
    cutoverPlanSummaryFile: join(sharedMetaDir, "cutover-plan-summary.txt"),
    cutoverApplyManifestFile: join(sharedMetaDir, "cutover-apply.json"),
    cutoverApplySummaryFile: join(sharedMetaDir, "cutover-apply-summary.txt"),
    cutoverHistoryFile: join(sharedMetaDir, "cutover-history.json"),
    cutoverHistorySummaryFile: join(sharedMetaDir, "cutover-history-summary.txt"),
    cutoverRollbackManifestFile: join(sharedMetaDir, "cutover-rollback.json"),
    cutoverRollbackSummaryFile: join(sharedMetaDir, "cutover-rollback-summary.txt")
  };
}
