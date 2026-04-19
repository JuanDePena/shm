import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import { runCombinedControlReleaseRootCutoverRehearsal } from "./release-root-cutover-rehearsal.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

function createActualReleaseRootFixture(targetId: string) {
  return join(
    resolveWorkspaceRoot(),
    ".tmp",
    "control-release-root-cutover-rehearsal",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

test("release-root cutover rehearsal consolidates the actual handoff into a full rehearsal artifact", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-rehearsal";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const previousVersion = "0.1.6";
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  const result = await runCombinedControlReleaseRootCutoverRehearsal({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    previousVersion,
    persist: true
  });

  assert.equal(result.rehearsal.status, "PASS");
  assert.equal(result.handoff.status, "PASS");
  assert.equal(result.handoff.actualReadyStatus, "PASS");
  assert.equal(result.handoff.targetHandoffStatus, "PASS");
  assert.equal(result.rehearsal.rehearsalPreviousVersion, previousVersion);
  assert.equal(
    result.rehearsal.checks.find((check) => check.name === "summary-artifacts")?.ok,
    true
  );

  const layout = createCombinedControlReleaseRootCutoverLayout({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot
  });
  const persisted = JSON.parse(
    await readFile(layout.rehearsalManifestFile, "utf8")
  ) as { status: string; rehearsalPreviousVersion: string; actualHandoffStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.rehearsalPreviousVersion, previousVersion);
  assert.equal(persisted.actualHandoffStatus, "PASS");
});
