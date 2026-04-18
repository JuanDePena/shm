import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  createCombinedControlReleaseRootCutoverLayout,
  type CombinedControlReleaseRootCutoverLayout
} from "./release-root-cutover-layout.js";
import { readCombinedControlReleaseRootPromotionApplyManifest } from "./release-root-promotion.js";
import { readCombinedControlReleaseRootPromotionDeployManifest } from "./release-root-promotion-deployment.js";
import { readCombinedControlReleaseRootPromotionManifest } from "./release-root-promotion-promotion.js";

export interface CombinedControlReleaseRootCutoverStep {
  readonly kind:
    | "ensure-dir"
    | "copy-tree"
    | "copy-file"
    | "write-symlink";
  readonly target: string;
  readonly source?: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverPlanManifest {
  readonly kind: "combined-release-root-cutover-plan";
  readonly targetId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-cutover-plan";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly actualCurrentTarget: string | null;
  readonly actualCurrentVersion: string | null;
  readonly sourcePromotionRoot: string;
  readonly sourcePromotionCurrentRoot: string;
  readonly sourcePromotionReleaseVersionRoot: string;
  readonly sourceEnvFile: string;
  readonly sourceStartupManifestFile: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly sourceHandoffManifestFile: string;
  readonly targetReleaseVersionRoot: string;
  readonly targetSharedMetaDir: string;
  readonly rollbackCandidateRoot: string | null;
  readonly steps: readonly CombinedControlReleaseRootCutoverStep[];
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readSymlinkTarget(path: string): string | null {
  try {
    return readlinkSync(path);
  } catch {
    return null;
  }
}

function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function resolveActualCurrentVersion(layout: CombinedControlReleaseRootCutoverLayout) {
  if (!existsSync(layout.actualCurrentRoot)) {
    return {
      target: null,
      version: null
    };
  }

  if (!lstatSync(layout.actualCurrentRoot).isSymbolicLink()) {
    return {
      target: null,
      version: null
    };
  }

  const resolved = realpathOrNull(layout.actualCurrentRoot);
  if (!resolved) {
    return {
      target: null,
      version: null
    };
  }

  const version =
    resolved.startsWith(`${layout.actualReleasesRoot}/`) ? basename(resolved) : null;

  return {
    target: resolved,
    version
  };
}

export async function planCombinedControlReleaseRootCutover(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootCutoverLayout;
  planManifest: CombinedControlReleaseRootCutoverPlanManifest;
}> {
  const layout = createCombinedControlReleaseRootCutoverLayout(args);
  const sourcePromotion =
    await readCombinedControlReleaseRootPromotionManifest({
      workspaceRoot: layout.workspaceRoot,
      targetId: layout.targetId
    });
  const sourceDeploy =
    await readCombinedControlReleaseRootPromotionDeployManifest({
      workspaceRoot: layout.workspaceRoot,
      targetId: layout.targetId
    });
  const sourceApply =
    await readCombinedControlReleaseRootPromotionApplyManifest({
      workspaceRoot: layout.workspaceRoot,
      targetId: layout.targetId
    });

  if (!sourcePromotion || !sourceDeploy || !sourceApply) {
    throw new Error(
      `Release-root promotion state missing for target ${layout.targetId}. Run apply:release-root-promotion first.`
    );
  }

  const actualCurrent = resolveActualCurrentVersion(layout);
  const steps: CombinedControlReleaseRootCutoverStep[] = [
    {
      kind: "ensure-dir",
      target: layout.actualReleaseRoot,
      detail: "ensure the canonical release root exists before cutover"
    },
    {
      kind: "ensure-dir",
      target: layout.actualReleasesRoot,
      detail: "ensure the versioned releases directory exists before cutover"
    },
    {
      kind: "ensure-dir",
      target: layout.actualSharedMetaDir,
      detail: "ensure shared/meta exists for live release metadata"
    },
    {
      kind: "ensure-dir",
      target: layout.actualSharedTmpDir,
      detail: "ensure shared/tmp exists for writable temporary state"
    },
    {
      kind: "ensure-dir",
      target: layout.actualSharedLogsDir,
      detail: "ensure shared/logs exists for runtime logs"
    },
    {
      kind: "ensure-dir",
      target: layout.actualSharedRunDir,
      detail: "ensure shared/run exists for pid and socket state"
    },
    {
      kind: "copy-tree",
      target: layout.actualTargetReleaseVersionRoot,
      source: layout.sourcePromotionReleaseVersionRoot,
      detail: "materialize the promoted release version into the live release root"
    },
    {
      kind: "copy-file",
      target: `${layout.actualSharedMetaDir}/promotion.json`,
      source: layout.sourcePromotionManifestFile,
      detail: "carry the promoted release metadata into the live release root"
    },
    {
      kind: "copy-file",
      target: `${layout.actualSharedMetaDir}/deploy.json`,
      source: layout.sourceDeployManifestFile,
      detail: "carry the deploy manifest into the live release root"
    },
    {
      kind: "copy-file",
      target: `${layout.actualSharedMetaDir}/rollback.json`,
      source: layout.sourceRollbackManifestFile,
      detail: "carry the rollback manifest into the live release root"
    },
    {
      kind: "copy-file",
      target: `${layout.actualSharedMetaDir}/handoff.json`,
      source: layout.sourceHandoffManifestFile,
      detail: "persist the latest handoff manifest alongside the live release metadata"
    },
    {
      kind: "write-symlink",
      target: layout.actualCurrentRoot,
      source: layout.actualTargetReleaseVersionRoot,
      detail: "point current at the promoted live release version"
    }
  ];

  const planManifest: CombinedControlReleaseRootCutoverPlanManifest = {
    kind: "combined-release-root-cutover-plan",
    targetId: layout.targetId,
    version: layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-cutover-plan",
    actualReleaseRoot: layout.actualReleaseRoot,
    actualCurrentRoot: layout.actualCurrentRoot,
    actualCurrentTarget: actualCurrent.target,
    actualCurrentVersion: actualCurrent.version,
    sourcePromotionRoot: layout.sourcePromotionRoot,
    sourcePromotionCurrentRoot: layout.sourcePromotionCurrentRoot,
    sourcePromotionReleaseVersionRoot: layout.sourcePromotionReleaseVersionRoot,
    sourceEnvFile: layout.sourceEnvFile,
    sourceStartupManifestFile: layout.sourceStartupManifestFile,
    sourcePromotionManifestFile: layout.sourcePromotionManifestFile,
    sourceDeployManifestFile: layout.sourceDeployManifestFile,
    sourceRollbackManifestFile: layout.sourceRollbackManifestFile,
    sourceHandoffManifestFile: layout.sourceHandoffManifestFile,
    targetReleaseVersionRoot: layout.actualTargetReleaseVersionRoot,
    targetSharedMetaDir: layout.actualSharedMetaDir,
    rollbackCandidateRoot: actualCurrent.target,
    steps
  };

  if (args.persist) {
    await mkdir(layout.sharedMetaDir, { recursive: true });
    await writeFile(
      layout.planManifestFile,
      JSON.stringify(planManifest, null, 2).concat("\n")
    );
    await writeFile(
      layout.planSummaryFile,
      formatCombinedControlReleaseRootCutoverPlan(planManifest).concat("\n")
    );
  }

  return {
    layout,
    planManifest
  };
}

export function formatCombinedControlReleaseRootCutoverPlan(
  manifest: CombinedControlReleaseRootCutoverPlanManifest
): string {
  return [
    "Combined control release-root cutover plan",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Actual current target: ${manifest.actualCurrentTarget ?? "none"}`,
    `Actual current version: ${manifest.actualCurrentVersion ?? "none"}`,
    `Source promotion root: ${manifest.sourcePromotionRoot}`,
    `Source promotion current root: ${manifest.sourcePromotionCurrentRoot}`,
    `Source promotion release version root: ${manifest.sourcePromotionReleaseVersionRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    `Rollback candidate root: ${manifest.rollbackCandidateRoot ?? "none"}`,
    "",
    "Planned steps:",
    ...manifest.steps.map((step, index) =>
      `${index + 1}. ${step.kind} ${step.target}${step.source ? ` <= ${step.source}` : ""} :: ${step.detail}`
    )
  ].join("\n");
}
