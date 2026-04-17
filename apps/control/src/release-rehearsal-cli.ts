import {
  formatCombinedControlReleaseRehearsal,
  runCombinedControlReleaseRehearsal
} from "./release-rehearsal.js";

const sandboxId = process.argv[2];
const version = process.argv[3];

const result = await runCombinedControlReleaseRehearsal({
  sandboxId,
  version
});

console.log(formatCombinedControlReleaseRehearsal(result));

if (result.status !== "PASS") {
  process.exitCode = 1;
}
