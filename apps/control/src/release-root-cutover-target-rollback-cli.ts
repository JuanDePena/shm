import {
  formatCombinedControlReleaseRootCutoverTargetHistory
} from "./release-root-cutover-target.js";
import {
  formatCombinedControlReleaseRootCutoverTargetRollbackManifest,
  rollbackCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target-rollback.js";

const [workspaceRoot, targetId, version] = process.argv.slice(2);

const rolledBack = await rollbackCombinedControlReleaseRootCutoverTarget({
  workspaceRoot,
  targetId,
  version
});

console.log(formatCombinedControlReleaseRootCutoverTargetRollbackManifest(rolledBack.rollbackManifest));
console.log("");
console.log(formatCombinedControlReleaseRootCutoverTargetHistory(rolledBack.history));
