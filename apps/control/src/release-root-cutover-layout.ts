import { join } from "node:path";

import {
  readWorkspaceVersion,
  resolveWorkspaceRoot
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseRootCutoverLayout {
  readonly workspaceRoot: string;
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly actualReleasesRoot: string;
  readonly actualSharedRoot: string;
  readonly actualSharedMetaDir: string;
  readonly actualSharedTmpDir: string;
  readonly actualSharedLogsDir: string;
  readonly actualSharedRunDir: string;
  readonly actualTargetReleaseVersionRoot: string;
  readonly sourcePromotionRoot: string;
  readonly sourcePromotionCurrentRoot: string;
  readonly sourcePromotionReleaseVersionRoot: string;
  readonly sourceEnvFile: string;
  readonly sourceStartupManifestFile: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly sourceHandoffManifestFile: string;
  readonly sourceReleaseEntrypoint: string;
  readonly targetRoot: string;
  readonly sharedMetaDir: string;
  readonly planManifestFile: string;
  readonly planSummaryFile: string;
  readonly readyManifestFile: string;
  readonly readySummaryFile: string;
  readonly handoffManifestFile: string;
  readonly handoffSummaryFile: string;
  readonly rehearsalManifestFile: string;
  readonly rehearsalSummaryFile: string;
  readonly parityManifestFile: string;
  readonly paritySummaryFile: string;
  readonly gateManifestFile: string;
  readonly gateSummaryFile: string;
}

export function createCombinedControlReleaseRootCutoverLayout(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
} = {}): CombinedControlReleaseRootCutoverLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const targetId = args.targetId ?? "default";
  const actualReleaseRoot = args.actualReleaseRoot ?? "/opt/simplehostman/release";
  const actualCurrentRoot = join(actualReleaseRoot, "current");
  const actualReleasesRoot = join(actualReleaseRoot, "releases");
  const actualSharedRoot = join(actualReleaseRoot, "shared");
  const actualSharedMetaDir = join(actualSharedRoot, "meta");
  const actualSharedTmpDir = join(actualSharedRoot, "tmp");
  const actualSharedLogsDir = join(actualSharedRoot, "logs");
  const actualSharedRunDir = join(actualSharedRoot, "run");
  const actualTargetReleaseVersionRoot = join(actualReleasesRoot, version);
  const sourcePromotionRoot = join(
    workspaceRoot,
    ".tmp",
    "control-release-root-promotion",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
  const sourcePromotionCurrentRoot = join(sourcePromotionRoot, "current");
  const sourcePromotionReleaseVersionRoot = join(sourcePromotionRoot, "releases", version);
  const targetRoot = join(workspaceRoot, ".tmp", "control-release-root-cutover", targetId);
  const sharedMetaDir = join(targetRoot, "meta");

  return {
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    actualCurrentRoot,
    actualReleasesRoot,
    actualSharedRoot,
    actualSharedMetaDir,
    actualSharedTmpDir,
    actualSharedLogsDir,
    actualSharedRunDir,
    actualTargetReleaseVersionRoot,
    sourcePromotionRoot,
    sourcePromotionCurrentRoot,
    sourcePromotionReleaseVersionRoot,
    sourceEnvFile: join(sourcePromotionReleaseVersionRoot, "env", "control.env"),
    sourceStartupManifestFile: join(
      sourcePromotionReleaseVersionRoot,
      "meta",
      "startup-manifest.json"
    ),
    sourcePromotionManifestFile: join(sourcePromotionRoot, "shared", "meta", "promotion.json"),
    sourceDeployManifestFile: join(sourcePromotionRoot, "shared", "meta", "deploy.json"),
    sourceRollbackManifestFile: join(sourcePromotionRoot, "shared", "meta", "rollback.json"),
    sourceHandoffManifestFile: join(sourcePromotionRoot, "shared", "meta", "handoff.json"),
    sourceReleaseEntrypoint: join(
      sourcePromotionCurrentRoot,
      "apps",
      "control",
      "dist",
      "release-sandbox-entrypoint.js"
    ),
    targetRoot,
    sharedMetaDir,
    planManifestFile: join(sharedMetaDir, "plan.json"),
    planSummaryFile: join(sharedMetaDir, "plan-summary.txt"),
    readyManifestFile: join(sharedMetaDir, "ready.json"),
    readySummaryFile: join(sharedMetaDir, "ready-summary.txt"),
    handoffManifestFile: join(sharedMetaDir, "handoff.json"),
    handoffSummaryFile: join(sharedMetaDir, "handoff-summary.txt"),
    rehearsalManifestFile: join(sharedMetaDir, "rehearsal.json"),
    rehearsalSummaryFile: join(sharedMetaDir, "rehearsal-summary.txt"),
    parityManifestFile: join(sharedMetaDir, "parity.json"),
    paritySummaryFile: join(sharedMetaDir, "parity-summary.txt"),
    gateManifestFile: join(sharedMetaDir, "gate.json"),
    gateSummaryFile: join(sharedMetaDir, "gate-summary.txt")
  };
}
