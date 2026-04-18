import {
  formatCombinedControlReleaseRootCutoverTargetReady,
  runCombinedControlReleaseRootCutoverTargetReady
} from "./release-root-cutover-target-ready.js";

const [workspaceRoot, targetId, version] = process.argv.slice(2);

const ready = await runCombinedControlReleaseRootCutoverTargetReady({
  workspaceRoot,
  targetId,
  version
});

console.log(formatCombinedControlReleaseRootCutoverTargetReady(ready));
