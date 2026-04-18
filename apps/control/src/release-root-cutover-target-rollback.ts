import { lstatSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  createCombinedControlReleaseRootCutoverTargetLayout,
  type CombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  formatCombinedControlReleaseRootCutoverTargetHistory,
  readCombinedControlReleaseRootCutoverTargetApplyManifest,
  readCombinedControlReleaseRootCutoverTargetHistory,
  type CombinedControlReleaseRootCutoverTargetHistory
} from "./release-root-cutover-target.js";

export interface CombinedControlReleaseRootCutoverTargetRollbackManifest {
  readonly kind: "combined-release-root-cutover-target-rollback";
  readonly targetId: string;
  readonly version: string;
  readonly rollbackVersion: string;
  readonly currentVersion: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-cutover-target-rollback";
  readonly currentRoot: string;
  readonly rollbackTargetRoot: string;
  readonly reason: string;
}

export function formatCombinedControlReleaseRootCutoverTargetRollbackManifest(
  manifest: CombinedControlReleaseRootCutoverTargetRollbackManifest
): string {
  return [
    "Combined control release-root cutover target rollback manifest",
    `Target: ${manifest.targetId}`,
    `Current version: ${manifest.currentVersion}`,
    `Rollback version: ${manifest.rollbackVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Rollback target root: ${manifest.rollbackTargetRoot}`,
    `Reason: ${manifest.reason}`
  ].join("\n");
}

async function removePathIfExists(path: string) {
  try {
    const stat = lstatSync(path);
    await rm(path, { recursive: stat.isDirectory(), force: true });
  } catch {
    // absent
  }
}

export async function rollbackCombinedControlReleaseRootCutoverTarget(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseRootCutoverTargetLayout;
  rollbackManifest: CombinedControlReleaseRootCutoverTargetRollbackManifest;
  history: CombinedControlReleaseRootCutoverTargetHistory;
}> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  const applyManifest =
    (await readCombinedControlReleaseRootCutoverTargetApplyManifest(args)) ??
    (() => {
      throw new Error("Release-root cutover target apply state is incomplete");
    })();

  if (!applyManifest.rollbackCandidateRoot) {
    throw new Error(
      `Release-root cutover target ${layout.targetId} has no rollback candidate recorded`
    );
  }

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await removePathIfExists(layout.currentRoot);
  await symlink(applyManifest.rollbackCandidateRoot, layout.currentRoot);

  const rollbackManifest: CombinedControlReleaseRootCutoverTargetRollbackManifest = {
    kind: "combined-release-root-cutover-target-rollback",
    targetId: layout.targetId,
    version: layout.version,
    rollbackVersion: basename(applyManifest.rollbackCandidateRoot),
    currentVersion: applyManifest.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-cutover-target-rollback",
    currentRoot: layout.currentRoot,
    rollbackTargetRoot: applyManifest.rollbackCandidateRoot,
    reason: `rollback restored previous current symlink for ${layout.targetId}`
  };

  const history = await readCombinedControlReleaseRootCutoverTargetHistory(args);
  const nextHistory: CombinedControlReleaseRootCutoverTargetHistory = {
    kind: "combined-release-root-cutover-target-history",
    targetId: layout.targetId,
    records: [
      ...history.records,
      {
        action: "rollback",
        version: rollbackManifest.rollbackVersion,
        previousVersion: rollbackManifest.currentVersion,
        occurredAt: rollbackManifest.generatedAt,
        currentRoot: layout.currentRoot,
        rollbackCandidateRoot: applyManifest.rollbackCandidateRoot
      }
    ]
  };

  await writeFile(
    layout.cutoverRollbackManifestFile,
    JSON.stringify(rollbackManifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverRollbackSummaryFile,
    formatCombinedControlReleaseRootCutoverTargetRollbackManifest(rollbackManifest).concat("\n")
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
    rollbackManifest,
    history: nextHistory
  };
}
