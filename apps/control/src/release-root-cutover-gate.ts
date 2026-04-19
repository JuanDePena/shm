import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import {
  formatCombinedControlReleaseRootCutoverHandoff,
  runCombinedControlReleaseRootCutoverHandoff,
  type CombinedControlReleaseRootCutoverHandoffManifest
} from "./release-root-cutover-handoff.js";
import {
  formatCombinedControlReleaseRootCutoverParity,
  runCombinedControlReleaseRootCutoverParity,
  type CombinedControlReleaseRootCutoverParityManifest
} from "./release-root-cutover-parity.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  type CombinedControlReleaseRootCutoverReadyResult
} from "./release-root-cutover-ready.js";
import {
  formatCombinedControlReleaseRootCutoverRehearsal,
  runCombinedControlReleaseRootCutoverRehearsal,
  type CombinedControlReleaseRootCutoverRehearsalManifest
} from "./release-root-cutover-rehearsal.js";

export interface CombinedControlReleaseRootCutoverGateCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverGateManifest {
  readonly kind: "combined-release-root-cutover-gate";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly rehearsalPreviousVersion: string;
  readonly generatedAt: string;
  readonly readyStatus: CombinedControlReleaseRootCutoverReadyResult["status"];
  readonly handoffStatus: CombinedControlReleaseRootCutoverHandoffManifest["status"];
  readonly rehearsalStatus: CombinedControlReleaseRootCutoverRehearsalManifest["status"];
  readonly parityStatus: CombinedControlReleaseRootCutoverParityManifest["status"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverGateCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverGateCheck;
}

export function formatCombinedControlReleaseRootCutoverGate(
  manifest: CombinedControlReleaseRootCutoverGateManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover gate",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Rehearsal previous version: ${manifest.rehearsalPreviousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Ready status: ${manifest.readyStatus}`,
    `Handoff status: ${manifest.handoffStatus}`,
    `Rehearsal status: ${manifest.rehearsalStatus}`,
    `Parity status: ${manifest.parityStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverGate(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  previousVersion?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: ReturnType<typeof createCombinedControlReleaseRootCutoverLayout>;
  ready: CombinedControlReleaseRootCutoverReadyResult;
  handoff: CombinedControlReleaseRootCutoverHandoffManifest;
  rehearsal: CombinedControlReleaseRootCutoverRehearsalManifest;
  parity: CombinedControlReleaseRootCutoverParityManifest;
  gate: CombinedControlReleaseRootCutoverGateManifest;
}> {
  const handoffRun = await runCombinedControlReleaseRootCutoverHandoff({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    actualReleaseRoot: args.actualReleaseRoot,
    previousVersion: args.previousVersion,
    persist: true
  });
  const ready = handoffRun.ready;
  const rehearsalRun = await runCombinedControlReleaseRootCutoverRehearsal({
    workspaceRoot: handoffRun.layout.workspaceRoot,
    targetId: handoffRun.layout.targetId,
    version: handoffRun.layout.version,
    actualReleaseRoot: handoffRun.layout.actualReleaseRoot,
    previousVersion: handoffRun.handoff.rehearsalPreviousVersion,
    persist: true
  });
  const parityRun = await runCombinedControlReleaseRootCutoverParity({
    workspaceRoot: handoffRun.layout.workspaceRoot,
    targetId: handoffRun.layout.targetId,
    version: handoffRun.layout.version,
    actualReleaseRoot: handoffRun.layout.actualReleaseRoot,
    previousVersion: handoffRun.handoff.rehearsalPreviousVersion,
    persist: true
  });

  const layout = handoffRun.layout;
  const checks: CombinedControlReleaseRootCutoverGateCheck[] = [
    createCheck("ready", ready.status === "PASS", `ready status is ${ready.status}`),
    createCheck(
      "handoff",
      handoffRun.handoff.status === "PASS",
      `handoff status is ${handoffRun.handoff.status}`
    ),
    createCheck(
      "rehearsal",
      rehearsalRun.rehearsal.status === "PASS",
      `rehearsal status is ${rehearsalRun.rehearsal.status}`
    ),
    createCheck(
      "parity",
      parityRun.parity.status === "PASS",
      `parity status is ${parityRun.parity.status}`
    ),
    createCheck(
      "version-alignment",
      ready.version === layout.version &&
        handoffRun.handoff.version === layout.version &&
        rehearsalRun.rehearsal.version === layout.version &&
        parityRun.parity.version === layout.version,
      `all gate artifacts target version ${layout.version}`
    ),
    createCheck(
      "previous-version-alignment",
      handoffRun.handoff.rehearsalPreviousVersion ===
        rehearsalRun.rehearsal.rehearsalPreviousVersion &&
        rehearsalRun.rehearsal.rehearsalPreviousVersion ===
          parityRun.parity.rehearsalPreviousVersion,
      `actual previous version is ${handoffRun.handoff.rehearsalPreviousVersion}, rehearsal previous version is ${rehearsalRun.rehearsal.rehearsalPreviousVersion}, and parity previous version is ${parityRun.parity.rehearsalPreviousVersion}`
    ),
    createCheck(
      "actual-release-root-contract",
      layout.actualReleaseRoot.endsWith("/opt/simplehostman/release"),
      `actual release root is ${layout.actualReleaseRoot}`
    ),
    createCheck(
      "summary-artifacts",
      [
        layout.readySummaryFile,
        layout.handoffSummaryFile,
        layout.rehearsalSummaryFile,
        layout.paritySummaryFile
      ].every((filePath) => existsSync(filePath)),
      "ready, handoff, rehearsal, and parity summaries exist"
    )
  ];

  const gate: CombinedControlReleaseRootCutoverGateManifest = {
    kind: "combined-release-root-cutover-gate",
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot: layout.actualReleaseRoot,
    rehearsalPreviousVersion: handoffRun.handoff.rehearsalPreviousVersion,
    generatedAt: new Date().toISOString(),
    readyStatus: ready.status,
    handoffStatus: handoffRun.handoff.status,
    rehearsalStatus: rehearsalRun.rehearsal.status,
    parityStatus: parityRun.parity.status,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist ?? true) {
    await mkdir(layout.sharedMetaDir, { recursive: true });
    await writeFile(
      layout.gateManifestFile,
      JSON.stringify(gate, null, 2).concat("\n")
    );
    await writeFile(
      layout.gateSummaryFile,
      [
        formatCombinedControlReleaseRootCutoverReady(ready),
        "",
        formatCombinedControlReleaseRootCutoverHandoff(handoffRun.handoff),
        "",
        formatCombinedControlReleaseRootCutoverRehearsal(rehearsalRun.rehearsal),
        "",
        formatCombinedControlReleaseRootCutoverParity(parityRun.parity),
        "",
        formatCombinedControlReleaseRootCutoverGate(gate)
      ].join("\n").concat("\n")
    );
  }

  return {
    layout,
    ready,
    handoff: handoffRun.handoff,
    rehearsal: rehearsalRun.rehearsal,
    parity: parityRun.parity,
    gate
  };
}
