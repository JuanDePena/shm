import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, rm, symlink } from "node:fs/promises";

import {
  applyCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  rollbackCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target-rollback.js";
import {
  runCombinedControlReleaseRootCutoverTargetReady
} from "./release-root-cutover-target-ready.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

test("release-root cutover target ready passes for an applied target release root", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-ready";

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
  await applyCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version,
    clean: true
  });

  const ready = await runCombinedControlReleaseRootCutoverTargetReady({
    workspaceRoot,
    targetId,
    version
  });

  assert.equal(ready.status, "PASS");
  assert.equal(ready.checks.find((check) => check.name === "runtime-healthz")?.ok, true);
  assert.equal(ready.checks.find((check) => check.name === "runtime-login")?.ok, true);
  assert.equal(ready.checks.find((check) => check.name === "cutover-history-latest")?.ok, true);
});

test("release-root cutover target ready fails after rollback rewires current away from the target version", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-ready-after-rollback";
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });
  const previousVersion = "0.0.6";
  const previousVersionRoot = join(layout.releasesRoot, previousVersion);

  await rm(layout.targetRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, layout.currentRoot);

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
  await applyCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version,
    clean: false
  });
  await rollbackCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version
  });

  const ready = await runCombinedControlReleaseRootCutoverTargetReady({
    workspaceRoot,
    targetId,
    version
  });

  assert.equal(ready.status, "FAIL");
  assert.equal(ready.checks.find((check) => check.name === "current-target")?.ok, false);
  assert.equal(ready.checks.find((check) => check.name === "cutover-history-latest")?.ok, false);
  assert.equal(ready.checks.find((check) => check.name === "runtime-healthz")?.ok, false);
});
