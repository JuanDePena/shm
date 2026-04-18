import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover,
  type CombinedControlReleaseRootCutoverPlanManifest,
  type CombinedControlReleaseRootCutoverStep
} from "./release-root-cutover.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout,
  type CombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";

export interface CombinedControlReleaseRootCutoverTargetApplyRecord {
  readonly kind: CombinedControlReleaseRootCutoverStep["kind"];
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverTargetApplyManifest {
  readonly kind: "combined-release-root-cutover-target-apply";
  readonly targetId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-cutover-target-apply";
  readonly targetReleaseRoot: string;
  readonly targetCurrentRoot: string;
  readonly targetReleaseVersionRoot: string;
  readonly rollbackCandidateRoot: string | null;
  readonly sourcePlanManifestFile: string;
  readonly records: readonly CombinedControlReleaseRootCutoverTargetApplyRecord[];
}

export interface CombinedControlReleaseRootCutoverTargetHistoryRecord {
  readonly action: "cutover" | "rollback";
  readonly version: string;
  readonly previousVersion: string | null;
  readonly occurredAt: string;
  readonly currentRoot: string;
  readonly rollbackCandidateRoot: string | null;
}

export interface CombinedControlReleaseRootCutoverTargetHistory {
  readonly kind: "combined-release-root-cutover-target-history";
  readonly targetId: string;
  readonly records: readonly CombinedControlReleaseRootCutoverTargetHistoryRecord[];
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function removePathIfExists(path: string) {
  if (!existsSync(path)) {
    return;
  }
  const stat = lstatSync(path);
  await rm(path, { recursive: stat.isDirectory(), force: true });
}

export async function readCombinedControlReleaseRootCutoverTargetApplyManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootCutoverTargetApplyManifest | null> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootCutoverTargetApplyManifest>(
      layout.cutoverApplyManifestFile
    );
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseRootCutoverTargetHistory(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootCutoverTargetHistory> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootCutoverTargetHistory>(
      layout.cutoverHistoryFile
    );
  } catch {
    return {
      kind: "combined-release-root-cutover-target-history",
      targetId: layout.targetId,
      records: []
    };
  }
}

export function formatCombinedControlReleaseRootCutoverTargetApplyManifest(
  manifest: CombinedControlReleaseRootCutoverTargetApplyManifest
): string {
  return [
    "Combined control release-root cutover target apply manifest",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target current root: ${manifest.targetCurrentRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    `Rollback candidate: ${manifest.rollbackCandidateRoot ?? "none"}`,
    "",
    "Applied records:",
    ...manifest.records.map((record, index) =>
      `${index + 1}. ${record.kind} ${record.target}${record.source ? ` <= ${record.source}` : ""} :: ${record.detail}`
    )
  ].join("\n");
}

export function formatCombinedControlReleaseRootCutoverTargetHistory(
  history: CombinedControlReleaseRootCutoverTargetHistory
): string {
  return [
    "Combined control release-root cutover target history",
    `Target: ${history.targetId}`,
    ...(
      history.records.length > 0
        ? history.records.map(
            (record, index) =>
              `${index + 1}. ${record.occurredAt} :: ${record.action} ${record.version} (previous: ${
                record.previousVersion ?? "none"
              }, rollback: ${record.rollbackCandidateRoot ?? "none"})`
          )
        : ["No cutover history recorded."]
    )
  ].join("\n");
}

export async function applyCombinedControlReleaseRootCutoverTarget(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  clean?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootCutoverTargetLayout;
  planManifest: CombinedControlReleaseRootCutoverPlanManifest;
  applyManifest: CombinedControlReleaseRootCutoverTargetApplyManifest;
}> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);

  if (args.clean !== false) {
    await rm(layout.targetRoot, { recursive: true, force: true });
  }

  const planned = await planCombinedControlReleaseRootCutover({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot: layout.releaseRoot,
    persist: false
  });

  const records: CombinedControlReleaseRootCutoverTargetApplyRecord[] = [];
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
        throw new Error(`Unsupported cutover step kind: ${(step as { kind: string }).kind}`);
    }

    records.push({
      kind: step.kind,
      source: step.source,
      target: step.target,
      detail: step.detail
    });
  }

  const applyManifest: CombinedControlReleaseRootCutoverTargetApplyManifest = {
    kind: "combined-release-root-cutover-target-apply",
    targetId: layout.targetId,
    version: layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-cutover-target-apply",
    targetReleaseRoot: layout.releaseRoot,
    targetCurrentRoot: layout.currentRoot,
    targetReleaseVersionRoot: layout.releaseVersionRoot,
    rollbackCandidateRoot: planned.planManifest.rollbackCandidateRoot,
    sourcePlanManifestFile: layout.cutoverPlanManifestFile,
    records
  };
  const history = await readCombinedControlReleaseRootCutoverTargetHistory({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });
  const nextHistory: CombinedControlReleaseRootCutoverTargetHistory = {
    kind: "combined-release-root-cutover-target-history",
    targetId: layout.targetId,
    records: [
      ...history.records,
      {
        action: "cutover",
        version: layout.version,
        previousVersion: planned.planManifest.actualCurrentVersion,
        occurredAt: applyManifest.generatedAt,
        currentRoot: layout.currentRoot,
        rollbackCandidateRoot: planned.planManifest.rollbackCandidateRoot
      }
    ]
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.cutoverPlanManifestFile,
    JSON.stringify(planned.planManifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverPlanSummaryFile,
    formatCombinedControlReleaseRootCutoverPlan(planned.planManifest).concat("\n")
  );
  await writeFile(
    layout.cutoverApplyManifestFile,
    JSON.stringify(applyManifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverApplySummaryFile,
    formatCombinedControlReleaseRootCutoverTargetApplyManifest(applyManifest).concat("\n")
  );
  await writeFile(
    layout.cutoverHistoryFile,
    JSON.stringify(nextHistory, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverHistorySummaryFile,
    formatCombinedControlReleaseRootCutoverTargetHistory(nextHistory).concat("\n")
  );

  return {
    layout,
    planManifest: planned.planManifest,
    applyManifest
  };
}
