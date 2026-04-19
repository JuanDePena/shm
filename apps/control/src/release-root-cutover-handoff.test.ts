import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, rm, symlink, readFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import { runCombinedControlReleaseRootCutoverHandoff } from "./release-root-cutover-handoff.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

function createActualReleaseRootFixture(targetId: string) {
  return join(
    resolveWorkspaceRoot(),
    ".tmp",
    "control-release-root-cutover-handoff",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

test("release-root cutover handoff consolidates actual cutover readiness with the emulated target handoff", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-handoff";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const previousVersion = "0.1.5";
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  const result = await runCombinedControlReleaseRootCutoverHandoff({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    persist: true
  });

  assert.equal(result.handoff.status, "PASS");
  assert.equal(result.ready.status, "PASS");
  assert.equal(result.targetHandoff.status, "PASS");
  assert.equal(
    result.handoff.checks.find((check) => check.name === "previous-version-alignment")?.ok,
    true
  );
  assert.equal(result.handoff.rehearsalPreviousVersion, previousVersion);

  const layout = createCombinedControlReleaseRootCutoverLayout({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot
  });
  const persisted = JSON.parse(
    await readFile(layout.handoffManifestFile, "utf8")
  ) as { status: string; rehearsalPreviousVersion: string; actualReadyStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.rehearsalPreviousVersion, previousVersion);
  assert.equal(persisted.actualReadyStatus, "PASS");
});
