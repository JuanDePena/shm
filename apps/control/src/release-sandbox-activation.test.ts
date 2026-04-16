import assert from "node:assert/strict";
import { lstatSync, realpathSync } from "node:fs";
import test from "node:test";

import {
  activateCombinedControlReleaseSandboxVersion,
  readCombinedControlReleaseSandboxInventory,
  resolveActiveCombinedControlReleaseSandbox
} from "./release-sandbox-activation.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import {
  startCombinedControlReleaseSandbox,
  startExistingCombinedControlReleaseSandbox
} from "./release-sandbox-runner.js";

test("release-sandbox can switch and roll back active versions within one sandbox", async () => {
  const sandboxId = "activation";
  const first = await startCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 0,
    sandboxId,
    version: "0.1.0-a"
  });

  try {
    assert.equal(first.activation.activeVersion, "0.1.0-a");
  } finally {
    await first.close();
  }

  const secondPack = await packCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 3219,
    sandboxId,
    version: "0.1.0-b",
    clean: false
  });
  const inventory = await readCombinedControlReleaseSandboxInventory({
    workspaceRoot: secondPack.layout.workspaceRoot,
    sandboxId
  });
  assert.deepEqual(
    inventory.releases.map((release) => release.version),
    ["0.1.0-a", "0.1.0-b"]
  );

  const activation = await activateCombinedControlReleaseSandboxVersion({
    workspaceRoot: secondPack.layout.workspaceRoot,
    sandboxId,
    version: "0.1.0-a"
  });
  assert.equal(activation.activeVersion, "0.1.0-a");
  assert.equal(activation.previousVersion, "0.1.0-b");

  const active = await resolveActiveCombinedControlReleaseSandbox({
    workspaceRoot: secondPack.layout.workspaceRoot,
    sandboxId
  });
  assert.equal(active.activation.activeVersion, "0.1.0-a");
  assert.ok(lstatSync(active.layout.currentRoot).isSymbolicLink());
  assert.equal(
    realpathSync(active.layout.currentRoot),
    realpathSync(active.layout.releaseVersionRoot)
  );

  const restarted = await startExistingCombinedControlReleaseSandbox({
    workspaceRoot: secondPack.layout.workspaceRoot,
    sandboxId
  });
  try {
    assert.equal(restarted.activation.activeVersion, "0.1.0-a");
    const health = await fetch(new URL("/healthz", restarted.origin));
    assert.equal(health.status, 200);
  } finally {
    await restarted.close();
  }
});
