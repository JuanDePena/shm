import {
  formatCombinedControlReleaseRootCutoverGate,
  runCombinedControlReleaseRootCutoverGate
} from "./release-root-cutover-gate.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg, previousVersionArg] =
  process.argv;

const result = await runCombinedControlReleaseRootCutoverGate({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  previousVersion: previousVersionArg || undefined,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverGate(result.gate));
