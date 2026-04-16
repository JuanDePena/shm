import assert from "node:assert/strict";
import test from "node:test";

import {
  readCombinedControlReleaseSandboxPromotionManifest,
  promoteCombinedControlReleaseSandboxVersion
} from "./release-sandbox-promotion.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

test("release-sandbox promotion tracks promoted versions and rollback history", async () => {
  const sandboxId = "promotion";
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

  await packCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 3221,
    sandboxId,
    version: "0.1.0-b",
    clean: false
  });

  const promoted = await promoteCombinedControlReleaseSandboxVersion({
    sandboxId,
    version: "0.1.0-b"
  });
  assert.equal(promoted.promotion.promotedVersion, "0.1.0-b");
  assert.equal(promoted.promotion.previousPromotedVersion, null);
  assert.deepEqual(promoted.promotion.availableVersions, ["0.1.0-a", "0.1.0-b"]);
  assert.equal(promoted.history.records.length, 1);

  const rollback = await promoteCombinedControlReleaseSandboxVersion({
    sandboxId,
    version: "0.1.0-a"
  });
  assert.equal(rollback.promotion.promotedVersion, "0.1.0-a");
  assert.equal(rollback.promotion.previousPromotedVersion, "0.1.0-b");
  assert.equal(rollback.history.records.length, 2);
  assert.deepEqual(
    rollback.history.records.map((record) => record.promotedVersion),
    ["0.1.0-b", "0.1.0-a"]
  );

  const currentPromotion = await readCombinedControlReleaseSandboxPromotionManifest({
    sandboxId
  });
  assert.ok(currentPromotion);
  assert.equal(currentPromotion?.promotedVersion, "0.1.0-a");
  assert.equal(currentPromotion?.previousPromotedVersion, "0.1.0-b");
});
