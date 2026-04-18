import assert from "node:assert/strict";
import test from "node:test";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { mkdir, rm, symlink } from "node:fs/promises";

import {
  applyCombinedControlReleaseRootCutoverTarget,
  readCombinedControlReleaseRootCutoverTargetHistory
} from "./release-root-cutover-target.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  rollbackCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target-rollback.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

test("release-root cutover target rollback restores the previous current symlink and records history", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-rollback-flow";
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });
  const previousVersion = "0.0.7";
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

  const rolledBack = await rollbackCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version
  });
  const history = await readCombinedControlReleaseRootCutoverTargetHistory({
    workspaceRoot,
    targetId,
    version
  });

  assert.equal(rolledBack.rollbackManifest.rollbackVersion, previousVersion);
  assert.equal(realpathSync(layout.currentRoot), realpathSync(previousVersionRoot));
  assert.equal(history.records.at(-2)?.action, "cutover");
  assert.equal(history.records.at(-1)?.action, "rollback");
});

test("release-root cutover target rollback fails when no rollback candidate is recorded", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-no-rollback";

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

  await assert.rejects(
    () =>
      rollbackCombinedControlReleaseRootCutoverTarget({
        workspaceRoot,
        targetId,
        version
      }),
    /no rollback candidate recorded/
  );
});
