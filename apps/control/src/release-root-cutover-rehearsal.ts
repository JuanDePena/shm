import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import {
  formatCombinedControlReleaseRootCutoverHandoff,
  runCombinedControlReleaseRootCutoverHandoff,
  type CombinedControlReleaseRootCutoverHandoffManifest
} from "./release-root-cutover-handoff.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";

export interface CombinedControlReleaseRootCutoverRehearsalCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverRehearsalManifest {
  readonly kind: "combined-release-root-cutover-rehearsal";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly rehearsalPreviousVersion: string;
  readonly generatedAt: string;
  readonly actualReadyStatus: CombinedControlReleaseRootCutoverHandoffManifest["actualReadyStatus"];
  readonly actualHandoffStatus: CombinedControlReleaseRootCutoverHandoffManifest["status"];
  readonly targetHandoffStatus: CombinedControlReleaseRootCutoverHandoffManifest["targetHandoffStatus"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverRehearsalCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverRehearsalCheck;
}

export function formatCombinedControlReleaseRootCutoverRehearsal(
  manifest: CombinedControlReleaseRootCutoverRehearsalManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover rehearsal",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Rehearsal previous version: ${manifest.rehearsalPreviousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual ready status: ${manifest.actualReadyStatus}`,
    `Actual handoff status: ${manifest.actualHandoffStatus}`,
    `Target handoff status: ${manifest.targetHandoffStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverRehearsal(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  previousVersion?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: ReturnType<typeof createCombinedControlReleaseRootCutoverLayout>;
  handoff: CombinedControlReleaseRootCutoverHandoffManifest;
  rehearsal: CombinedControlReleaseRootCutoverRehearsalManifest;
}> {
  const handoffRun = await runCombinedControlReleaseRootCutoverHandoff({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    actualReleaseRoot: args.actualReleaseRoot,
    previousVersion: args.previousVersion,
    persist: true
  });
  const layout = handoffRun.layout;
  const targetLayout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });
  const handoff = handoffRun.handoff;
  const writeSymlinkStep = handoffRun.planManifest.steps.find(
    (step) =>
      step.kind === "write-symlink" &&
      step.target === layout.actualCurrentRoot &&
      step.source === layout.actualTargetReleaseVersionRoot
  );

  const checks: CombinedControlReleaseRootCutoverRehearsalCheck[] = [
    createCheck(
      "actual-ready",
      handoff.actualReadyStatus === "PASS",
      `actual ready status is ${handoff.actualReadyStatus}`
    ),
    createCheck(
      "actual-handoff",
      handoff.status === "PASS",
      `actual handoff status is ${handoff.status}`
    ),
    createCheck(
      "target-handoff",
      handoff.targetHandoffStatus === "PASS",
      `target handoff status is ${handoff.targetHandoffStatus}`
    ),
    createCheck(
      "actual-cutover-step",
      Boolean(writeSymlinkStep),
      writeSymlinkStep
        ? `actual current will point to ${writeSymlinkStep.source ?? "none"}`
        : `actual current write-symlink step missing for ${layout.actualCurrentRoot}`
    ),
    createCheck(
      "version-alignment",
      handoffRun.planManifest.version === layout.version &&
        handoff.version === layout.version,
      `all rehearsal artifacts target version ${layout.version}`
    ),
    createCheck(
      "previous-version-alignment",
      handoffRun.targetHandoff.previousVersion === handoff.rehearsalPreviousVersion,
      `actual rehearsal previous version is ${handoff.rehearsalPreviousVersion} and target handoff previous version is ${handoffRun.targetHandoff.previousVersion}`
    ),
    createCheck(
      "actual-release-root-contract",
      layout.actualReleaseRoot.endsWith("/opt/simplehostman/release"),
      `actual release root is ${layout.actualReleaseRoot}`
    ),
    createCheck(
      "summary-artifacts",
      [
        layout.planSummaryFile,
        layout.readySummaryFile,
        layout.handoffSummaryFile,
        targetLayout.cutoverHandoffSummaryFile
      ].every((filePath) => existsSync(filePath)),
      "plan, ready, actual handoff, and target handoff summaries exist"
    )
  ];

  const rehearsal: CombinedControlReleaseRootCutoverRehearsalManifest = {
    kind: "combined-release-root-cutover-rehearsal",
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot: layout.actualReleaseRoot,
    rehearsalPreviousVersion: handoff.rehearsalPreviousVersion,
    generatedAt: new Date().toISOString(),
    actualReadyStatus: handoff.actualReadyStatus,
    actualHandoffStatus: handoff.status,
    targetHandoffStatus: handoff.targetHandoffStatus,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist ?? true) {
    await mkdir(layout.sharedMetaDir, { recursive: true });
    await writeFile(
      layout.rehearsalManifestFile,
      JSON.stringify(rehearsal, null, 2).concat("\n")
    );
    await writeFile(
      layout.rehearsalSummaryFile,
      [
        formatCombinedControlReleaseRootCutoverHandoff(handoff),
        "",
        formatCombinedControlReleaseRootCutoverRehearsal(rehearsal)
      ].join("\n").concat("\n")
    );
  }

  return {
    layout,
    handoff,
    rehearsal
  };
}
