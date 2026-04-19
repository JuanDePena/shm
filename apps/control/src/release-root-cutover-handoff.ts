import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  createCombinedControlReleaseRootCutoverLayout
} from "./release-root-cutover-layout.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover,
  type CombinedControlReleaseRootCutoverPlanManifest
} from "./release-root-cutover.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  runCombinedControlReleaseRootCutoverReady,
  type CombinedControlReleaseRootCutoverReadyResult
} from "./release-root-cutover-ready.js";
import {
  formatCombinedControlReleaseRootCutoverTargetHandoff,
  runCombinedControlReleaseRootCutoverTargetHandoff,
  type CombinedControlReleaseRootCutoverTargetHandoffManifest
} from "./release-root-cutover-target-handoff.js";

export interface CombinedControlReleaseRootCutoverHandoffCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverHandoffManifest {
  readonly kind: "combined-release-root-cutover-handoff";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly rehearsalPreviousVersion: string;
  readonly generatedAt: string;
  readonly actualReadyStatus: CombinedControlReleaseRootCutoverReadyResult["status"];
  readonly targetHandoffStatus: CombinedControlReleaseRootCutoverTargetHandoffManifest["status"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverHandoffCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverHandoffCheck;
}

export function formatCombinedControlReleaseRootCutoverHandoff(
  manifest: CombinedControlReleaseRootCutoverHandoffManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover handoff",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Rehearsal previous version: ${manifest.rehearsalPreviousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual ready status: ${manifest.actualReadyStatus}`,
    `Target handoff status: ${manifest.targetHandoffStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverHandoff(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  previousVersion?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: ReturnType<typeof createCombinedControlReleaseRootCutoverLayout>;
  planManifest: CombinedControlReleaseRootCutoverPlanManifest;
  ready: CombinedControlReleaseRootCutoverReadyResult;
  targetHandoff: CombinedControlReleaseRootCutoverTargetHandoffManifest;
  handoff: CombinedControlReleaseRootCutoverHandoffManifest;
}> {
  await applyCombinedControlReleaseRootStaging({
    workspaceRoot: args.workspaceRoot,
    version: args.version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    clean: false
  });

  const planned = await planCombinedControlReleaseRootCutover({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    actualReleaseRoot: args.actualReleaseRoot,
    persist: args.persist
  });
  const readyRun = await runCombinedControlReleaseRootCutoverReady({
    workspaceRoot: planned.layout.workspaceRoot,
    targetId: planned.layout.targetId,
    version: planned.layout.version,
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    persist: args.persist
  });
  const rehearsalPreviousVersion =
    planned.planManifest.actualCurrentVersion ?? args.previousVersion ?? "0.0.8";
  const targetHandoffRun = await runCombinedControlReleaseRootCutoverTargetHandoff({
    workspaceRoot: planned.layout.workspaceRoot,
    targetId: planned.layout.targetId,
    version: planned.layout.version,
    previousVersion: rehearsalPreviousVersion
  });

  const writeSymlinkStep = planned.planManifest.steps.find(
    (step) =>
      step.kind === "write-symlink" &&
      step.target === planned.layout.actualCurrentRoot &&
      step.source === planned.layout.actualTargetReleaseVersionRoot
  );
  const targetLayout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot: planned.layout.workspaceRoot,
    targetId: planned.layout.targetId,
    version: planned.layout.version
  });

  const checks: CombinedControlReleaseRootCutoverHandoffCheck[] = [
    createCheck(
      "actual-ready",
      readyRun.ready.status === "PASS",
      `actual cutover ready status is ${readyRun.ready.status}`
    ),
    createCheck(
      "target-handoff",
      targetHandoffRun.handoff.status === "PASS",
      `target handoff status is ${targetHandoffRun.handoff.status}`
    ),
    createCheck(
      "version-alignment",
      planned.planManifest.version === planned.layout.version &&
        targetHandoffRun.handoff.version === planned.layout.version,
      `all handoff artifacts target version ${planned.layout.version}`
    ),
    createCheck(
      "actual-target-release-version-root",
      planned.planManifest.targetReleaseVersionRoot === planned.layout.actualTargetReleaseVersionRoot,
      `actual target release version root is ${planned.planManifest.targetReleaseVersionRoot}`
    ),
    createCheck(
      "actual-cutover-step",
      Boolean(writeSymlinkStep),
      writeSymlinkStep
        ? `actual current will point to ${writeSymlinkStep.source ?? "none"}`
        : `actual current write-symlink step missing for ${planned.layout.actualCurrentRoot}`
    ),
    createCheck(
      "rollback-candidate-alignment",
      planned.planManifest.rollbackCandidateRoot === null
        ? true
        : basename(planned.planManifest.rollbackCandidateRoot) === rehearsalPreviousVersion,
      planned.planManifest.rollbackCandidateRoot
        ? `actual rollback candidate is ${planned.planManifest.rollbackCandidateRoot}`
        : `actual release root has no rollback candidate; rehearsal uses ${rehearsalPreviousVersion}`
    ),
    createCheck(
      "previous-version-alignment",
      targetHandoffRun.handoff.previousVersion === rehearsalPreviousVersion,
      `target handoff rehearsal previous version is ${targetHandoffRun.handoff.previousVersion}`
    ),
    createCheck(
      "summary-artifacts",
      existsSync(planned.layout.planSummaryFile) &&
        existsSync(planned.layout.readySummaryFile) &&
        existsSync(targetLayout.cutoverHandoffSummaryFile),
      "plan, ready, and target handoff summaries exist"
    )
  ];

  const handoff: CombinedControlReleaseRootCutoverHandoffManifest = {
    kind: "combined-release-root-cutover-handoff",
    targetId: planned.layout.targetId,
    version: planned.layout.version,
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    rehearsalPreviousVersion,
    generatedAt: new Date().toISOString(),
    actualReadyStatus: readyRun.ready.status,
    targetHandoffStatus: targetHandoffRun.handoff.status,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist) {
    await mkdir(planned.layout.sharedMetaDir, { recursive: true });
    await writeFile(
      planned.layout.handoffManifestFile,
      JSON.stringify(handoff, null, 2).concat("\n")
    );
    await writeFile(
      planned.layout.handoffSummaryFile,
      [
        formatCombinedControlReleaseRootCutoverPlan(planned.planManifest),
        "",
        formatCombinedControlReleaseRootCutoverReady(readyRun.ready),
        "",
        formatCombinedControlReleaseRootCutoverTargetHandoff(targetHandoffRun.handoff),
        "",
        formatCombinedControlReleaseRootCutoverHandoff(handoff)
      ].join("\n").concat("\n")
    );
  }

  return {
    layout: planned.layout,
    planManifest: planned.planManifest,
    ready: readyRun.ready,
    targetHandoff: targetHandoffRun.handoff,
    handoff
  };
}
