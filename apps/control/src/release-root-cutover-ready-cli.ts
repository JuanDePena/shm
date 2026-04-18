import {
  formatCombinedControlReleaseRootCutoverReady,
  runCombinedControlReleaseRootCutoverReady
} from "./release-root-cutover-ready.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg] = process.argv;

const result = await runCombinedControlReleaseRootCutoverReady({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverReady(result.ready));

if (result.ready.status !== "PASS") {
  process.exitCode = 1;
}
