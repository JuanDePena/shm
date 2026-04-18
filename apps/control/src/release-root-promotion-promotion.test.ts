import assert from "node:assert/strict";
import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";

import { syncCombinedControlReleaseRootPromotionInventory } from "./release-root-promotion-activation.js";
import {
  promoteCombinedControlReleaseRootPromotionVersion,
  readCombinedControlReleaseRootPromotionManifest
} from "./release-root-promotion-promotion.js";
import { createCombinedControlReleaseRootPromotionLayout } from "./release-root-promotion-layout.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";

test("release-root promotion tracks promoted versions and rollback history", async () => {
  const targetId = "release-root-promotion-history";
  const versionA = "0.1.0";
  const versionB = "0.1.0-live-b";

  await applyCombinedControlReleaseRootStaging({
    sandboxId: `${targetId}-staging`,
    version: versionA,
    host: "127.0.0.1",
    port: 0,
    clean: true
  });
  const first = await applyCombinedControlReleaseRootPromotion({
    targetId,
    version: versionA,
    clean: true
  });
  assert.equal(first.applyManifest.version, versionA);

  const layoutA = createCombinedControlReleaseRootPromotionLayout({
    targetId,
    version: versionA
  });
  const versionBLayout = createCombinedControlReleaseRootPromotionLayout({
    targetId,
    version: versionB
  });
  await mkdir(dirname(versionBLayout.releaseVersionRoot), { recursive: true });
  await cp(layoutA.releaseVersionRoot, versionBLayout.releaseVersionRoot, { recursive: true });
  await syncCombinedControlReleaseRootPromotionInventory({ targetId });

  const promotedB = await promoteCombinedControlReleaseRootPromotionVersion({
    targetId,
    version: versionB
  });
  assert.equal(promotedB.promotion.promotedVersion, versionB);
  assert.equal(promotedB.promotion.previousPromotedVersion, versionA);
  assert.equal(promotedB.history.records.length, 2);

  const rollback = await promoteCombinedControlReleaseRootPromotionVersion({
    targetId,
    version: versionA
  });
  assert.equal(rollback.promotion.promotedVersion, versionA);
  assert.equal(rollback.promotion.previousPromotedVersion, versionB);
  assert.equal(rollback.history.records.length, 3);
  assert.deepEqual(
    rollback.history.records.map((record) => record.promotedVersion),
    [versionA, versionB, versionA]
  );

  const currentPromotion = await readCombinedControlReleaseRootPromotionManifest({
    targetId
  });
  assert.ok(currentPromotion);
  assert.equal(currentPromotion?.promotedVersion, versionA);
  assert.equal(currentPromotion?.previousPromotedVersion, versionB);
});
