import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, rm, symlink } from "node:fs/promises";

import {
  planCombinedControlReleaseRootCutover
} from "./release-root-cutover.js";
import {
  runCombinedControlReleaseRootCutoverReady
} from "./release-root-cutover-ready.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

function createActualReleaseRootFixture(targetId: string) {
  return join(
    resolveWorkspaceRoot(),
    ".tmp",
    "control-release-root-cutover-fixture",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

test("release-root cutover plans cutover from promoted staging into the actual release root shape", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const previousVersion = "0.0.9";
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot,
    version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot,
    targetId,
    version,
    clean: true
  });

  const planned = await planCombinedControlReleaseRootCutover({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    persist: true
  });
  const ready = await runCombinedControlReleaseRootCutoverReady({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    persist: true
  });

  assert.equal(planned.planManifest.actualCurrentVersion, previousVersion);
  assert.equal(planned.planManifest.rollbackCandidateRoot, previousVersionRoot);
  assert.ok(
    planned.planManifest.steps.some(
      (step) =>
        step.kind === "write-symlink" &&
        step.target === actualCurrentRoot &&
        step.source === join(actualReleaseRoot, "releases", version)
    )
  );
  assert.equal(ready.ready.status, "PASS");
  assert.ok(ready.ready.checks.every((check) => check.ok));
});

test("release-root cutover flags unsafe actual current shapes", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-unsafe";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(actualCurrentRoot, { recursive: true });

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot,
    version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot,
    targetId,
    version,
    clean: true
  });

  const ready = await runCombinedControlReleaseRootCutoverReady({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    persist: true
  });

  assert.equal(ready.ready.status, "FAIL");
  const shapeCheck = ready.ready.checks.find((check) => check.name === "actual-current-shape");
  assert.ok(shapeCheck);
  assert.equal(shapeCheck.ok, false);
});
