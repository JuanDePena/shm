import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";

import {
  createCombinedControlReleaseRootPromotionLayout,
  type CombinedControlReleaseRootPromotionLayout
} from "./release-root-promotion-layout.js";
import {
  readCombinedControlReleaseRootStagingApplyManifest,
  type CombinedControlReleaseRootStagingApplyManifest
} from "./release-root-staging.js";
import {
  createCombinedControlReleaseRootStagingLayout,
  type CombinedControlReleaseRootStagingLayout
} from "./release-root-staging-layout.js";

type PromotionStepKind = "ensure-dir" | "copy-tree" | "copy-file" | "write-symlink";

export interface CombinedControlReleaseRootPromotionPlannedStep {
  readonly kind: PromotionStepKind;
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootPromotionPlanManifest {
  readonly kind: "combined-release-root-promotion-plan";
  readonly targetId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-promotion-plan";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly sourceStagingRoot: string;
  readonly sourceStagingCurrentRoot: string;
  readonly sourceStagingReleaseVersionRoot: string;
  readonly sourceEnvFile: string;
  readonly sourceStartupManifestFile: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly sourceHandoffManifestFile: string;
  readonly targetReleaseRoot: string;
  readonly targetCurrentRoot: string;
  readonly targetReleaseVersionRoot: string;
  readonly steps: readonly CombinedControlReleaseRootPromotionPlannedStep[];
}

export interface CombinedControlReleaseRootPromotionApplyRecord {
  readonly kind: PromotionStepKind;
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootPromotionApplyManifest {
  readonly kind: "combined-release-root-promotion-apply";
  readonly targetId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-promotion-apply";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly sourceStagingRoot: string;
  readonly targetReleaseRoot: string;
  readonly targetCurrentRoot: string;
  readonly targetReleaseVersionRoot: string;
  readonly sourceApplyManifestFile: string;
  readonly records: readonly CombinedControlReleaseRootPromotionApplyRecord[];
}

export interface CombinedControlReleaseRootPromotionDiffCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootPromotionDiffManifest {
  readonly kind: "combined-release-root-promotion-diff";
  readonly targetId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-promotion-diff";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly sourceStagingRoot: string;
  readonly targetReleaseRoot: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootPromotionDiffCheck[];
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function createDiffCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootPromotionDiffCheck;
}

async function removePathIfExists(path: string) {
  if (!existsSync(path)) {
    return;
  }
  const stat = lstatSync(path);
  await rm(path, { recursive: stat.isDirectory(), force: true });
}

function compareFiles(target?: string, source?: string): boolean {
  if (!target || !source) {
    return false;
  }
  if (!existsSync(target) || !existsSync(source)) {
    return false;
  }
  return readFileSync(target, "utf8") === readFileSync(source, "utf8");
}

function readlinkSyncSafe(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return "unreadable";
  }
}

function realpathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

async function materializePromotionPlan(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  stagingLayout: CombinedControlReleaseRootStagingLayout;
  stagingApplyManifest: CombinedControlReleaseRootStagingApplyManifest;
  planManifest: CombinedControlReleaseRootPromotionPlanManifest;
}> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const stagingLayout = createCombinedControlReleaseRootStagingLayout({
    workspaceRoot: layout.workspaceRoot,
    version: layout.version
  });
  const stagingApplyManifest =
    (await readCombinedControlReleaseRootStagingApplyManifest({
      workspaceRoot: layout.workspaceRoot,
      version: layout.version
    })) ??
    (() => {
      throw new Error(
        `Release-root staging apply state missing for version ${layout.version}. Run apply:release-root-staging first.`
      );
    })();

  const steps: CombinedControlReleaseRootPromotionPlannedStep[] = [
    {
      kind: "ensure-dir",
      target: layout.releaseRoot,
      detail: "ensure the emulated live release root exists"
    },
    {
      kind: "ensure-dir",
      target: layout.releasesRoot,
      detail: "ensure the emulated live releases directory exists"
    },
    {
      kind: "ensure-dir",
      target: layout.sharedMetaDir,
      detail: "ensure shared/meta exists for promotion metadata"
    },
    {
      kind: "ensure-dir",
      target: layout.sharedTmpDir,
      detail: "ensure shared/tmp exists for writable temporary state"
    },
    {
      kind: "ensure-dir",
      target: layout.sharedLogsDir,
      detail: "ensure shared/logs exists for runtime logs"
    },
    {
      kind: "ensure-dir",
      target: layout.sharedRunDir,
      detail: "ensure shared/run exists for pid and socket state"
    },
    {
      kind: "copy-tree",
      target: layout.releaseVersionRoot,
      source: stagingLayout.releaseVersionRoot,
      detail: "materialize the staged version into the emulated live release root"
    },
    {
      kind: "copy-file",
      target: layout.promotionManifestFile,
      source: stagingLayout.promotionManifestFile,
      detail: "carry forward the staged promotion manifest"
    },
    {
      kind: "copy-file",
      target: layout.deployManifestFile,
      source: stagingLayout.deployManifestFile,
      detail: "carry forward the staged deploy manifest"
    },
    {
      kind: "copy-file",
      target: layout.rollbackManifestFile,
      source: stagingLayout.rollbackManifestFile,
      detail: "carry forward the staged rollback manifest"
    },
    {
      kind: "copy-file",
      target: layout.handoffManifestFile,
      source: stagingLayout.handoffManifestFile,
      detail: "carry forward the staged handoff manifest"
    },
    {
      kind: "write-symlink",
      target: layout.currentRoot,
      source: layout.releaseVersionRoot,
      detail: "point the emulated live current symlink at the promoted version"
    }
  ];

  const planManifest: CombinedControlReleaseRootPromotionPlanManifest = {
    kind: "combined-release-root-promotion-plan",
    targetId: layout.targetId,
    version: layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-promotion-plan",
    actualReleaseRoot: layout.actualReleaseRoot,
    actualCurrentRoot: layout.actualCurrentRoot,
    sourceStagingRoot: stagingLayout.stagingRoot,
    sourceStagingCurrentRoot: stagingLayout.currentRoot,
    sourceStagingReleaseVersionRoot: stagingLayout.releaseVersionRoot,
    sourceEnvFile: stagingLayout.envFile,
    sourceStartupManifestFile: stagingLayout.startupManifestFile,
    sourcePromotionManifestFile: stagingLayout.promotionManifestFile,
    sourceDeployManifestFile: stagingLayout.deployManifestFile,
    sourceRollbackManifestFile: stagingLayout.rollbackManifestFile,
    sourceHandoffManifestFile: stagingLayout.handoffManifestFile,
    targetReleaseRoot: layout.releaseRoot,
    targetCurrentRoot: layout.currentRoot,
    targetReleaseVersionRoot: layout.releaseVersionRoot,
    steps
  };

  return {
    layout,
    stagingLayout,
    stagingApplyManifest,
    planManifest
  };
}

export async function planCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}) {
  return materializePromotionPlan(args);
}

export function formatCombinedControlReleaseRootPromotionPlan(
  manifest: CombinedControlReleaseRootPromotionPlanManifest
): string {
  return [
    "Combined control release-root promotion plan",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Source staging root: ${manifest.sourceStagingRoot}`,
    `Source staging current root: ${manifest.sourceStagingCurrentRoot}`,
    `Source staging release version root: ${manifest.sourceStagingReleaseVersionRoot}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target current root: ${manifest.targetCurrentRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    "",
    "Planned steps:",
    ...manifest.steps.map((step, index) =>
      `${index + 1}. ${step.kind} ${step.target}${step.source ? ` <= ${step.source}` : ""} :: ${step.detail}`
    )
  ].join("\n");
}

export async function applyCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  clean?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  stagingLayout: CombinedControlReleaseRootStagingLayout;
  stagingApplyManifest: CombinedControlReleaseRootStagingApplyManifest;
  planManifest: CombinedControlReleaseRootPromotionPlanManifest;
  applyManifest: CombinedControlReleaseRootPromotionApplyManifest;
}> {
  const planned = await materializePromotionPlan(args);

  if (args.clean !== false) {
    await rm(planned.layout.targetRoot, { recursive: true, force: true });
  }

  const records: CombinedControlReleaseRootPromotionApplyRecord[] = [];
  for (const step of planned.planManifest.steps) {
    switch (step.kind) {
      case "ensure-dir":
        await mkdir(step.target, { recursive: true });
        break;
      case "copy-tree":
        if (!step.source) {
          throw new Error(`copy-tree step missing source for ${step.target}`);
        }
        await removePathIfExists(step.target);
        await mkdir(dirname(step.target), { recursive: true });
        await cp(step.source, step.target, { recursive: true });
        break;
      case "copy-file":
        if (!step.source) {
          throw new Error(`copy-file step missing source for ${step.target}`);
        }
        await mkdir(dirname(step.target), { recursive: true });
        await cp(step.source, step.target);
        break;
      case "write-symlink":
        if (!step.source) {
          throw new Error(`write-symlink step missing source for ${step.target}`);
        }
        await removePathIfExists(step.target);
        await symlink(step.source, step.target);
        break;
      default:
        throw new Error(`Unsupported promotion step kind: ${(step as { kind: string }).kind}`);
    }

    records.push({
      kind: step.kind,
      source: step.source,
      target: step.target,
      detail: step.detail
    });
  }

  const applyManifest: CombinedControlReleaseRootPromotionApplyManifest = {
    kind: "combined-release-root-promotion-apply",
    targetId: planned.layout.targetId,
    version: planned.layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-promotion-apply",
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    actualCurrentRoot: planned.layout.actualCurrentRoot,
    sourceStagingRoot: planned.stagingLayout.stagingRoot,
    targetReleaseRoot: planned.layout.releaseRoot,
    targetCurrentRoot: planned.layout.currentRoot,
    targetReleaseVersionRoot: planned.layout.releaseVersionRoot,
    sourceApplyManifestFile: planned.stagingLayout.applyManifestFile,
    records
  };

  await mkdir(planned.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    planned.layout.planManifestFile,
    JSON.stringify(planned.planManifest, null, 2).concat("\n")
  );
  await writeFile(
    planned.layout.planSummaryFile,
    formatCombinedControlReleaseRootPromotionPlan(planned.planManifest).concat("\n")
  );
  await writeFile(
    planned.layout.applyManifestFile,
    JSON.stringify(applyManifest, null, 2).concat("\n")
  );
  await writeFile(
    planned.layout.applySummaryFile,
    formatCombinedControlReleaseRootPromotionApply(applyManifest).concat("\n")
  );

  return {
    layout: planned.layout,
    stagingLayout: planned.stagingLayout,
    stagingApplyManifest: planned.stagingApplyManifest,
    planManifest: planned.planManifest,
    applyManifest
  };
}

export function formatCombinedControlReleaseRootPromotionApply(
  manifest: CombinedControlReleaseRootPromotionApplyManifest
): string {
  return [
    "Combined control release-root promotion apply manifest",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Source staging root: ${manifest.sourceStagingRoot}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target current root: ${manifest.targetCurrentRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    "",
    "Applied records:",
    ...manifest.records.map((record, index) =>
      `${index + 1}. ${record.kind} ${record.target}${record.source ? ` <= ${record.source}` : ""} :: ${record.detail}`
    )
  ].join("\n");
}

export async function readCombinedControlReleaseRootPromotionPlanManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionPlanManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootPromotionPlanManifest>(layout.planManifestFile);
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseRootPromotionApplyManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionApplyManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootPromotionApplyManifest>(layout.applyManifestFile);
  } catch {
    return null;
  }
}

export async function diffCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  planManifest: CombinedControlReleaseRootPromotionPlanManifest;
  diffManifest: CombinedControlReleaseRootPromotionDiffManifest;
}> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const existingPlan = await readCombinedControlReleaseRootPromotionPlanManifest(args);
  const planned = existingPlan
    ? {
        layout,
        planManifest: existingPlan
      }
    : await materializePromotionPlan(args);

  const checks: CombinedControlReleaseRootPromotionDiffCheck[] = [
    createDiffCheck(
      "target-root",
      existsSync(planned.layout.releaseRoot),
      existsSync(planned.layout.releaseRoot)
        ? `target root exists at ${planned.layout.releaseRoot}`
        : `target root missing at ${planned.layout.releaseRoot}`
    ),
    createDiffCheck(
      "release-version-root",
      existsSync(planned.layout.releaseVersionRoot),
      existsSync(planned.layout.releaseVersionRoot)
        ? `target version root exists at ${planned.layout.releaseVersionRoot}`
        : `target version root missing at ${planned.layout.releaseVersionRoot}`
    ),
    createDiffCheck(
      "release-entrypoint",
      existsSync(planned.layout.releaseEntrypoint),
      existsSync(planned.layout.releaseEntrypoint)
        ? `entrypoint exists at ${planned.layout.releaseEntrypoint}`
        : `entrypoint missing at ${planned.layout.releaseEntrypoint}`
    ),
    createDiffCheck(
      "target-current-symlink",
      existsSync(planned.layout.currentRoot) &&
        existsSync(planned.layout.releaseVersionRoot) &&
        lstatSync(planned.layout.currentRoot).isSymbolicLink() &&
        realpathSync(planned.layout.currentRoot) === realpathSync(planned.layout.releaseVersionRoot),
      existsSync(planned.layout.currentRoot)
        ? `current -> ${readlinkSyncSafe(planned.layout.currentRoot)}`
        : "target current symlink missing"
    ),
    createDiffCheck(
      "actual-current-untouched",
      !existsSync(planned.layout.actualCurrentRoot) ||
        !realpathOrSelf(planned.layout.actualCurrentRoot).startsWith(planned.layout.targetRoot),
      existsSync(planned.layout.actualCurrentRoot)
        ? `actual current remains outside promotion target: ${realpathOrSelf(planned.layout.actualCurrentRoot)}`
        : "actual current root is absent"
    ),
    createDiffCheck(
      "env-parity",
      compareFiles(planned.layout.envFile, planned.planManifest.sourceEnvFile),
      `target=${planned.layout.envFile} source=${planned.planManifest.sourceEnvFile}`
    ),
    createDiffCheck(
      "startup-manifest-parity",
      compareFiles(
        planned.layout.startupManifestFile,
        planned.planManifest.sourceStartupManifestFile
      ),
      `target=${planned.layout.startupManifestFile} source=${planned.planManifest.sourceStartupManifestFile}`
    ),
    createDiffCheck(
      "promotion-manifest-parity",
      compareFiles(
        planned.layout.promotionManifestFile,
        planned.planManifest.sourcePromotionManifestFile
      ),
      `target=${planned.layout.promotionManifestFile} source=${planned.planManifest.sourcePromotionManifestFile}`
    ),
    createDiffCheck(
      "deploy-manifest-parity",
      compareFiles(
        planned.layout.deployManifestFile,
        planned.planManifest.sourceDeployManifestFile
      ),
      `target=${planned.layout.deployManifestFile} source=${planned.planManifest.sourceDeployManifestFile}`
    ),
    createDiffCheck(
      "rollback-manifest-parity",
      compareFiles(
        planned.layout.rollbackManifestFile,
        planned.planManifest.sourceRollbackManifestFile
      ),
      `target=${planned.layout.rollbackManifestFile} source=${planned.planManifest.sourceRollbackManifestFile}`
    ),
    createDiffCheck(
      "handoff-manifest-parity",
      compareFiles(
        planned.layout.handoffManifestFile,
        planned.planManifest.sourceHandoffManifestFile
      ),
      `target=${planned.layout.handoffManifestFile} source=${planned.planManifest.sourceHandoffManifestFile}`
    )
  ];

  const diffManifest: CombinedControlReleaseRootPromotionDiffManifest = {
    kind: "combined-release-root-promotion-diff",
    targetId: planned.layout.targetId,
    version: planned.layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-promotion-diff",
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    actualCurrentRoot: planned.layout.actualCurrentRoot,
    sourceStagingRoot: planned.planManifest.sourceStagingRoot,
    targetReleaseRoot: planned.layout.releaseRoot,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist) {
    await mkdir(planned.layout.sharedMetaDir, { recursive: true });
    await writeFile(
      planned.layout.diffManifestFile,
      JSON.stringify(diffManifest, null, 2).concat("\n")
    );
    await writeFile(
      planned.layout.diffSummaryFile,
      formatCombinedControlReleaseRootPromotionDiff(diffManifest).concat("\n")
    );
  }

  return {
    layout: planned.layout,
    planManifest: planned.planManifest,
    diffManifest
  };
}

export function formatCombinedControlReleaseRootPromotionDiff(
  manifest: CombinedControlReleaseRootPromotionDiffManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root promotion diff",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Source staging root: ${manifest.sourceStagingRoot}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function readCombinedControlReleaseRootPromotionDiffManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionDiffManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootPromotionDiffManifest>(layout.diffManifestFile);
  } catch {
    return null;
  }
}
