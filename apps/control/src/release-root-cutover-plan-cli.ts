import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover
} from "./release-root-cutover.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg] = process.argv;

const planned = await planCombinedControlReleaseRootCutover({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverPlan(planned.planManifest));
