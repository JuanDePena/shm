import {
  formatCombinedControlReleaseRootCutoverRehearsal,
  runCombinedControlReleaseRootCutoverRehearsal
} from "./release-root-cutover-rehearsal.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg, previousVersionArg] =
  process.argv;

const result = await runCombinedControlReleaseRootCutoverRehearsal({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  previousVersion: previousVersionArg || undefined,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverRehearsal(result.rehearsal));
