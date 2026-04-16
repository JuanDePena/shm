import assert from "node:assert/strict";
import { lstatSync, realpathSync } from "node:fs";
import test from "node:test";

import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

test("release-sandbox bundle reflects the combined candidate metadata faithfully", async () => {
  const runtime = await startCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 0,
    sandboxId: "bundle-parity"
  });

  try {
    assert.equal(runtime.bundle.kind, "combined-release-sandbox-bundle");
    assert.equal(runtime.bundle.version, runtime.packed.layout.version);
    assert.equal(runtime.activation.activeVersion, runtime.bundle.version);
    assert.equal(runtime.bundle.sandboxId, "bundle-parity");
    assert.equal(
      runtime.bundle.paths.releaseEntrypoint,
      runtime.packed.bundle.paths.releaseEntrypoint
    );
    assert.equal(runtime.bundle.paths.currentEntrypoint, runtime.activation.currentEntrypoint);
    assert.equal(runtime.bundle.paths.envFile, runtime.packed.bundle.paths.envFile);
    assert.equal(runtime.bundle.paths.releasesRoot, runtime.packed.layout.releasesRoot);
    assert.equal(
      runtime.bundle.paths.releaseVersionRoot,
      runtime.packed.layout.releaseVersionRoot
    );
    assert.equal(runtime.bundle.paths.currentRoot, runtime.packed.layout.currentRoot);
    assert.equal(runtime.bundle.paths.sharedRoot, runtime.packed.layout.sharedRoot);
    assert.equal(runtime.bundle.paths.sharedMetaDir, runtime.packed.layout.sharedMetaDir);
    assert.equal(runtime.bundle.paths.sharedTmpDir, runtime.packed.layout.sharedTmpDir);
    assert.equal(
      runtime.bundle.paths.activationManifestFile,
      runtime.packed.layout.activationManifestFile
    );
    assert.equal(
      runtime.bundle.paths.activationSummaryFile,
      runtime.packed.layout.activationSummaryFile
    );
    assert.equal(
      runtime.bundle.paths.releasesInventoryFile,
      runtime.packed.layout.releasesInventoryFile
    );
    assert.equal(
      runtime.bundle.paths.startupManifestFile,
      runtime.packed.bundle.paths.startupManifestFile
    );
    assert.equal(
      runtime.bundle.paths.startupSummaryFile,
      runtime.packed.bundle.paths.startupSummaryFile
    );
    assert.equal(runtime.bundle.startup.origin, runtime.origin);
    assert.equal(
      runtime.bundle.startup.listener,
      `${runtime.manifest.listener.host}:${runtime.manifest.listener.port}`
    );
    assert.ok(lstatSync(runtime.bundle.paths.currentRoot).isSymbolicLink());
    assert.equal(
      realpathSync(runtime.bundle.paths.currentRoot),
      realpathSync(runtime.bundle.paths.releaseVersionRoot)
    );
    assert.deepEqual(runtime.bundle.startup.surfaces, runtime.manifest.surfaces);
    assert.equal(
      runtime.env.SIMPLEHOST_CONTROL_SANDBOX_MODE,
      "release-sandbox"
    );
    assert.equal(runtime.env.SIMPLEHOST_CONTROL_RUNTIME_MODE, "combined");
    assert.equal(runtime.env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN, runtime.origin);
    assert.ok(runtime.bundle.checks.pack.length > 0);
    assert.ok(runtime.bundle.checks.runtime.length > 0);
    assert.ok(runtime.bundle.checks.parity.length > 0);
    assert.match(runtime.bundleSummary, new RegExp(runtime.bundle.version, "i"));
    assert.match(runtime.startupSummary, new RegExp(runtime.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(runtime.bundleSummary, /Combined control release-sandbox bundle/);
  } finally {
    await runtime.close();
  }
});
