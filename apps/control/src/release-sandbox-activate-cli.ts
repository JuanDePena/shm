import {
  activateCombinedControlReleaseSandboxVersion,
  formatCombinedControlReleaseSandboxActivation
} from "./release-sandbox-activation.js";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node dist/release-sandbox-activate-cli.js <version> [sandboxId]");
  process.exitCode = 1;
} else {
  const sandboxId = process.argv[3];
  const activation = await activateCombinedControlReleaseSandboxVersion({
    version,
    sandboxId
  });
  console.log(formatCombinedControlReleaseSandboxActivation(activation));
}
