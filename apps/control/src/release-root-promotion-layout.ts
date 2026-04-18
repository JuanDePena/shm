import { join } from "node:path";

import {
  readWorkspaceVersion,
  resolveWorkspaceRoot
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseRootPromotionLayout {
  readonly workspaceRoot: string;
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly actualStagingRoot: string;
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
  readonly planManifestFile: string;
  readonly planSummaryFile: string;
  readonly diffManifestFile: string;
  readonly diffSummaryFile: string;
  readonly applyManifestFile: string;
  readonly applySummaryFile: string;
  readonly releasesInventoryFile: string;
  readonly activationManifestFile: string;
  readonly activationSummaryFile: string;
  readonly promotionManifestFile: string;
  readonly promotionSummaryFile: string;
  readonly promotionHistoryFile: string;
  readonly deployManifestFile: string;
  readonly deploySummaryFile: string;
  readonly rollbackManifestFile: string;
  readonly rollbackSummaryFile: string;
  readonly handoffManifestFile: string;
}

export function createCombinedControlReleaseRootPromotionLayout(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): CombinedControlReleaseRootPromotionLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const targetId = args.targetId ?? "default";
  const targetRoot = join(workspaceRoot, ".tmp", "control-release-root-promotion", targetId);
  const hostRoot = join(targetRoot, "opt", "simplehostman");
  const releaseRoot = join(hostRoot, "release");
  const releasesRoot = join(releaseRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(releaseRoot, "current");
  const sharedRoot = join(releaseRoot, "shared");
  const sharedMetaDir = join(sharedRoot, "meta");

  return {
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot: "/opt/simplehostman/release",
    actualCurrentRoot: "/opt/simplehostman/release/current",
    actualStagingRoot: "/opt/simplehostman/release/.staging/control",
    targetRoot,
    hostRoot,
    releaseRoot,
    releasesRoot,
    releaseVersionRoot,
    currentRoot,
    sharedRoot,
    sharedMetaDir,
    sharedTmpDir: join(sharedRoot, "tmp"),
    sharedLogsDir: join(sharedRoot, "logs"),
    sharedRunDir: join(sharedRoot, "run"),
    logsDir: join(sharedRoot, "logs", "control"),
    runDir: join(sharedRoot, "run", "control"),
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
    planManifestFile: join(sharedMetaDir, "plan.json"),
    planSummaryFile: join(sharedMetaDir, "plan-summary.txt"),
    diffManifestFile: join(sharedMetaDir, "diff.json"),
    diffSummaryFile: join(sharedMetaDir, "diff-summary.txt"),
    applyManifestFile: join(sharedMetaDir, "apply.json"),
    applySummaryFile: join(sharedMetaDir, "apply-summary.txt"),
    releasesInventoryFile: join(sharedMetaDir, "releases.json"),
    activationManifestFile: join(sharedMetaDir, "activation.json"),
    activationSummaryFile: join(sharedMetaDir, "activation-summary.txt"),
    promotionManifestFile: join(sharedMetaDir, "promotion.json"),
    promotionSummaryFile: join(sharedMetaDir, "promotion-summary.txt"),
    promotionHistoryFile: join(sharedMetaDir, "promotion-history.json"),
    deployManifestFile: join(sharedMetaDir, "deploy.json"),
    deploySummaryFile: join(sharedMetaDir, "deploy-summary.txt"),
    rollbackManifestFile: join(sharedMetaDir, "rollback.json"),
    rollbackSummaryFile: join(sharedMetaDir, "rollback-summary.txt"),
    handoffManifestFile: join(sharedMetaDir, "handoff.json")
  };
}
