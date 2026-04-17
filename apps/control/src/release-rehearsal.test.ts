import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCombinedControlReleaseRehearsal,
  runCombinedControlReleaseRehearsal
} from "./release-rehearsal.js";

test("release rehearsal keeps sandbox and shadow aligned for key metadata and routes", async () => {
  const sandboxId = `release-rehearsal-${process.pid}-${Date.now()}`;
  const result = await runCombinedControlReleaseRehearsal({
    sandboxId,
    version: "0.1.0-rehearsal",
    host: "127.0.0.1",
    port: 0
  });

  assert.equal(result.kind, "combined-control-release-rehearsal");
  assert.equal(result.status, "PASS");
  assert.equal(result.checks.every((check) => check.ok), true);
  assert.ok(result.checks.find((check) => check.name === "inventory-parity")?.ok);
  assert.ok(result.checks.find((check) => check.name === "promotion-parity")?.ok);
  assert.ok(result.checks.find((check) => check.name === "proxy-vhost-parity")?.ok);
  assert.match(formatCombinedControlReleaseRehearsal(result), /Status: PASS/);
});
