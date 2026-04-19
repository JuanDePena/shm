import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import { runCombinedControlReleaseRootCutoverGate } from "./release-root-cutover-gate.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

function createActualReleaseRootFixture(targetId: string) {
  return join(
    resolveWorkspaceRoot(),
    ".tmp",
    "control-release-root-cutover-gate",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

test("release-root cutover gate consolidates ready, handoff, rehearsal, and parity for the actual cutover layer", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-gate";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const previousVersion = "0.1.8";
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  const result = await runCombinedControlReleaseRootCutoverGate({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    previousVersion,
    persist: true
  });

  assert.equal(result.gate.status, "PASS");
  assert.equal(result.ready.status, "PASS");
  assert.equal(result.handoff.status, "PASS");
  assert.equal(result.rehearsal.status, "PASS");
  assert.equal(result.parity.status, "PASS");
  assert.equal(result.gate.rehearsalPreviousVersion, previousVersion);
  assert.equal(
    result.gate.checks.find((check) => check.name === "previous-version-alignment")?.ok,
    true
  );

  const layout = createCombinedControlReleaseRootCutoverLayout({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot
  });
  const persisted = JSON.parse(
    await readFile(layout.gateManifestFile, "utf8")
  ) as { status: string; rehearsalPreviousVersion: string; parityStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.rehearsalPreviousVersion, previousVersion);
  assert.equal(persisted.parityStatus, "PASS");
});
