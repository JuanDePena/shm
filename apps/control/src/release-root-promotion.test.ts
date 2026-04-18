import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, realpathSync } from "node:fs";

import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { readCombinedControlReleaseRootStagingApplyManifest } from "./release-root-staging.js";
import {
  startCombinedControlReleaseRootStaging,
  startExistingCombinedControlReleaseRootStaging
} from "./release-root-staging-runner.js";
import { createCombinedControlReleaseRootStagingLayout } from "./release-root-staging-layout.js";
import { diffCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { startCombinedControlReleaseRootPromotion } from "./release-root-promotion-runner.js";

async function login(origin: string) {
  const response = await fetch(new URL("/auth/login", origin), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    },
    body: "email=admin%40example.com&password=good-pass",
    redirect: "manual"
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}

test("release-root promotion applies actual staging into an emulated live root and matches staging behavior", async () => {
  const version = "0.1.0";
  const targetId = "release-root-promotion";

  const existingStaging =
    await readCombinedControlReleaseRootStagingApplyManifest({
      version
    });

  if (!existingStaging) {
    await applyCombinedControlReleaseRootStaging({
      version,
      host: "127.0.0.1",
      port: 0,
      clean: true
    });
  }

  const staging = existingStaging
    ? await startExistingCombinedControlReleaseRootStaging({ version })
    : await startCombinedControlReleaseRootStaging({
        version,
        host: "127.0.0.1",
        port: 0
      });

  let stagingPackages: { status: number; body: string };
  let stagingProxy: { status: number; body: string };

  try {
    const stagingCookie = await login(staging.origin);
    [stagingPackages, stagingProxy] = await Promise.all([
      fetch(new URL("/?view=packages", staging.origin), {
        headers: { cookie: stagingCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", staging.origin), {
        headers: { cookie: stagingCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body })))
    ]);
  } finally {
    await staging.close();
  }

  const promotion = await startCombinedControlReleaseRootPromotion({
    targetId,
    version
  });

  try {
    const promotionCookie = await login(promotion.origin);
    const [promotionPackages, promotionProxy] = await Promise.all([
      fetch(new URL("/?view=packages", promotion.origin), {
        headers: { cookie: promotionCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", promotion.origin), {
        headers: { cookie: promotionCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body })))
    ]);

    const diffed = await diffCombinedControlReleaseRootPromotion({
      targetId,
      version,
      persist: true
    });
    const stagingLayout = createCombinedControlReleaseRootStagingLayout({ version });

    assert.equal(promotion.applyManifest.targetReleaseRoot, promotion.layout.releaseRoot);
    assert.equal(promotion.applyManifest.targetCurrentRoot, promotion.layout.currentRoot);
    assert.equal(
      promotion.applyManifest.targetReleaseVersionRoot,
      promotion.layout.releaseVersionRoot
    );
    assert.equal(promotionPackages.status, stagingPackages.status);
    assert.equal(promotionPackages.body, stagingPackages.body);
    assert.equal(promotionProxy.status, stagingProxy.status);
    assert.equal(promotionProxy.body, stagingProxy.body);
    assert.equal(diffed.diffManifest.status, "PASS");
    assert.ok(diffed.diffManifest.checks.every((check) => check.ok));
    assert.ok(existsSync(stagingLayout.currentRoot));
    if (existsSync(stagingLayout.actualCurrentRoot)) {
      assert.ok(
        !realpathSync(stagingLayout.actualCurrentRoot).startsWith(stagingLayout.stagingRoot)
      );
    }
  } finally {
    await promotion.close();
  }
});
