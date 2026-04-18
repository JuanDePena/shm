import { existsSync, lstatSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover
} from "./release-root-cutover.js";
import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import { readCombinedControlReleaseRootPromotionApplyManifest } from "./release-root-promotion.js";
import { readCombinedControlReleaseRootPromotionDeployManifest } from "./release-root-promotion-deployment.js";
import { readCombinedControlReleaseRootPromotionManifest } from "./release-root-promotion-promotion.js";

export interface CombinedControlReleaseRootCutoverReadyCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverReadyResult {
  readonly kind: "combined-release-root-cutover-ready";
  readonly targetId: string;
  readonly version: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverReadyCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverReadyCheck;
}

export function formatCombinedControlReleaseRootCutoverReady(
  result: CombinedControlReleaseRootCutoverReadyResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover ready",
    `Target: ${result.targetId}`,
    `Version: ${result.version}`,
    `Status: ${result.status} (${passed}/${result.checks.length})`,
    "",
    ...result.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverReady(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: ReturnType<typeof createCombinedControlReleaseRootCutoverLayout>;
  ready: CombinedControlReleaseRootCutoverReadyResult;
}> {
  const { layout, planManifest } = await planCombinedControlReleaseRootCutover({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    actualReleaseRoot: args.actualReleaseRoot,
    persist: args.persist
  });
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

  const checks: CombinedControlReleaseRootCutoverReadyCheck[] = [
    createCheck(
      "source-promotion",
      sourcePromotion?.promotedVersion === layout.version,
      sourcePromotion
        ? `source promotion manifest targets ${sourcePromotion.promotedVersion}`
        : "source promotion manifest missing"
    ),
    createCheck(
      "source-deploy",
      sourceDeploy?.promotedVersion === layout.version,
      sourceDeploy
        ? `source deploy manifest targets ${sourceDeploy.promotedVersion}`
        : "source deploy manifest missing"
    ),
    createCheck(
      "source-apply",
      sourceApply?.version === layout.version,
      sourceApply
        ? `source apply manifest targets ${sourceApply.version}`
        : "source apply manifest missing"
    ),
    createCheck(
      "source-current-symlink",
      existsSync(layout.sourcePromotionCurrentRoot) &&
        lstatSync(layout.sourcePromotionCurrentRoot).isSymbolicLink(),
      existsSync(layout.sourcePromotionCurrentRoot)
        ? `source current exists at ${layout.sourcePromotionCurrentRoot}`
        : "source current symlink missing"
    ),
    createCheck(
      "actual-current-shape",
      !existsSync(layout.actualCurrentRoot) ||
        (lstatSync(layout.actualCurrentRoot).isSymbolicLink() &&
          (planManifest.actualCurrentTarget === null ||
            planManifest.actualCurrentTarget.startsWith(`${layout.actualReleasesRoot}/`))),
      existsSync(layout.actualCurrentRoot)
        ? `actual current target is ${planManifest.actualCurrentTarget ?? "unresolved"}`
        : "actual current root is absent"
    ),
    createCheck(
      "target-release-version-root",
      planManifest.targetReleaseVersionRoot === layout.actualTargetReleaseVersionRoot,
      `target release version root is ${planManifest.targetReleaseVersionRoot}`
    ),
    createCheck(
      "rollback-candidate",
      planManifest.rollbackCandidateRoot === null ||
        planManifest.rollbackCandidateRoot === planManifest.actualCurrentTarget,
      planManifest.rollbackCandidateRoot
        ? `rollback candidate is ${planManifest.rollbackCandidateRoot}`
        : "no rollback candidate recorded"
    ),
    createCheck(
      "planned-cutover-step",
      planManifest.steps.some(
        (step) =>
          step.kind === "write-symlink" &&
          step.target === layout.actualCurrentRoot &&
          step.source === layout.actualTargetReleaseVersionRoot
      ),
      `current will point to ${layout.actualTargetReleaseVersionRoot}`
    )
  ];

  const ready: CombinedControlReleaseRootCutoverReadyResult = {
    kind: "combined-release-root-cutover-ready",
    targetId: layout.targetId,
    version: layout.version,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist) {
    await mkdir(layout.sharedMetaDir, { recursive: true });
    await writeFile(
      layout.readyManifestFile,
      JSON.stringify(ready, null, 2).concat("\n")
    );
    await writeFile(
      layout.readySummaryFile,
      [
        formatCombinedControlReleaseRootCutoverPlan(planManifest),
        "",
        formatCombinedControlReleaseRootCutoverReady(ready)
      ].join("\n").concat("\n")
    );
  }

  return {
    layout,
    ready
  };
}
