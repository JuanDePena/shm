import { readFileSync } from "node:fs";

import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover
} from "./release-root-cutover.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  runCombinedControlReleaseRootCutoverReady
} from "./release-root-cutover-ready.js";
import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg] = process.argv;

const layout = createCombinedControlReleaseRootCutoverLayout({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined
});
const planned = await planCombinedControlReleaseRootCutover({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  persist: true
});
const ready = await runCombinedControlReleaseRootCutoverReady({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  persist: true
});

console.log("Combined control release-root cutover inspect");
console.log(`Target root: ${layout.targetRoot}`);
console.log(`Actual release root: ${layout.actualReleaseRoot}`);
console.log(`Source promotion root: ${layout.sourcePromotionRoot}`);
console.log("");
console.log(formatCombinedControlReleaseRootCutoverPlan(planned.planManifest));
console.log("");
console.log(formatCombinedControlReleaseRootCutoverReady(ready.ready));
console.log("");

try {
  console.log(readFileSync(layout.planSummaryFile, "utf8").trim());
  console.log("");
} catch {
  console.log(`Plan summary unavailable: ${layout.planSummaryFile}`);
  console.log("");
}

try {
  console.log(readFileSync(layout.readySummaryFile, "utf8").trim());
} catch {
  console.log(`Ready summary unavailable: ${layout.readySummaryFile}`);
}
