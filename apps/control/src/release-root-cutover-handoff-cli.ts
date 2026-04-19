import {
  formatCombinedControlReleaseRootCutoverHandoff,
  runCombinedControlReleaseRootCutoverHandoff
} from "./release-root-cutover-handoff.js";

const [workspaceRoot, targetId, version, actualReleaseRoot, previousVersion] =
  process.argv.slice(2);

const { handoff } = await runCombinedControlReleaseRootCutoverHandoff({
  workspaceRoot,
  targetId,
  version,
  actualReleaseRoot,
  previousVersion,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverHandoff(handoff));
