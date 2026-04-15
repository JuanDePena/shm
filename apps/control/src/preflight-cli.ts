import {
  formatCombinedControlPreflightReport,
  runCombinedControlPreflight
} from "./preflight-runner.js";

const result = await runCombinedControlPreflight();

console.log(formatCombinedControlPreflightReport(result));

if (!result.ok) {
  process.exitCode = 1;
}
