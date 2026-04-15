import assert from "node:assert/strict";
import test from "node:test";

import { createCombinedControlReleaseCandidateSurface } from "./release-candidate-surface.js";
import {
  formatCombinedControlReleaseCandidateReport,
  runCombinedControlReleaseCandidate
} from "./release-candidate-runner.js";

test("combined release-candidate passes with a stable startup manifest", async () => {
  const result = await runCombinedControlReleaseCandidate(
    await createCombinedControlReleaseCandidateSurface()
  );

  assert.equal(result.ok, true);
  assert.equal(result.failed, 0);
  assert.equal(result.passed, result.checks.length);
  assert.equal(result.manifest.kind, "combined-release-candidate-manifest");
  assert.equal(result.manifest.releaseRoot, "/opt/simplehostman/release");
  assert.ok(result.manifest.surfaces.includes("release-candidate"));
  assert.match(
    formatCombinedControlReleaseCandidateReport(result),
    /Status: PASS/
  );
});

test("combined release-candidate reports desired-state mutation failures clearly", async () => {
  const result = await runCombinedControlReleaseCandidate(
    await createCombinedControlReleaseCandidateSurface({
      desiredStateApplyError: {
        statusCode: 500,
        message: "Desired state apply failed"
      }
    })
  );

  assert.equal(result.ok, false);
  const appDeleteCheck = result.checks.find((check) => check.name === "app-delete");
  assert.ok(appDeleteCheck);
  assert.equal(appDeleteCheck.ok, false);
  assert.match(appDeleteCheck.detail, /expected 303 but received 500/i);
});

test("combined release-candidate reports proxy preview failures clearly", async () => {
  const result = await runCombinedControlReleaseCandidate(
    await createCombinedControlReleaseCandidateSurface({
      proxyPreviewError: {
        statusCode: 502,
        message: "Proxy preview unavailable"
      }
    })
  );

  assert.equal(result.ok, false);
  const proxyCheck = result.checks.find((check) => check.name === "proxy-vhost-html");
  assert.ok(proxyCheck);
  assert.equal(proxyCheck.ok, false);
  assert.match(proxyCheck.detail, /expected 200 but received 502/i);
  assert.match(
    formatCombinedControlReleaseCandidateReport(result),
    /\[FAIL\] proxy-vhost-html:/
  );
});
