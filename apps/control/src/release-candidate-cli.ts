import {
  formatCombinedControlReleaseCandidateReport,
  runCombinedControlReleaseCandidate
} from "./release-candidate-runner.js";

const result = await runCombinedControlReleaseCandidate();

console.log(formatCombinedControlReleaseCandidateReport(result));

if (!result.ok) {
  process.exitCode = 1;
}
