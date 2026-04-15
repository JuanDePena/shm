import assert from "node:assert/strict";
import test from "node:test";

import { createCombinedControlPreflightSurface } from "./preflight-surface.js";
import {
  formatCombinedControlPreflightReport,
  runCombinedControlPreflight
} from "./preflight-runner.js";

test("combined preflight passes against the default source-level candidate harness", async () => {
  const result = await runCombinedControlPreflight(
    await createCombinedControlPreflightSurface()
  );

  assert.equal(result.ok, true);
  assert.equal(result.failed, 0);
  assert.equal(result.passed, result.checks.length);
  assert.match(formatCombinedControlPreflightReport(result), /Status: PASS/);
});

test("combined preflight reports login failures clearly", async () => {
  const result = await runCombinedControlPreflight(
    await createCombinedControlPreflightSurface({
      loginError: {
        statusCode: 401,
        message: "Invalid credentials"
      }
    })
  );

  assert.equal(result.ok, false);
  const loginCheck = result.checks.find((check) => check.name === "login");
  assert.ok(loginCheck);
  assert.equal(loginCheck.ok, false);
  assert.match(loginCheck.detail, /expected 303 but received 401/i);
  assert.match(formatCombinedControlPreflightReport(result), /\[FAIL\] login:/);
});

test("combined preflight reports dashboard bootstrap failures clearly", async () => {
  const result = await runCombinedControlPreflight(
    await createCombinedControlPreflightSurface({
      overviewError: {
        statusCode: 500,
        message: "Dashboard bootstrap failed"
      }
    })
  );

  assert.equal(result.ok, false);
  const overviewCheck = result.checks.find(
    (check) => check.name === "authenticated-overview"
  );
  assert.ok(overviewCheck);
  assert.equal(overviewCheck.ok, false);
  assert.match(overviewCheck.detail, /expected 200 but received 500/i);
});
