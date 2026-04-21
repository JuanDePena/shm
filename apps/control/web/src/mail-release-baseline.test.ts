import assert from "node:assert/strict";
import test from "node:test";

import { runMailReleaseBaseline } from "./mail-release-baseline.js";

test("runMailReleaseBaseline passes for the repeatable mail release fixture", () => {
  const result = runMailReleaseBaseline();

  assert.equal(result.ok, true);
  assert.equal(
    result.checks.every((check) => check.ok),
    true
  );
  assert.match(result.detail, /Mail baseline passed/i);
});
