import {
  formatCombinedControlReleaseSandboxActivation,
  formatCombinedControlReleaseSandboxInventory,
  readCombinedControlReleaseSandboxInventory,
  resolveActiveCombinedControlReleaseSandbox
} from "./release-sandbox-activation.js";

const sandboxId = process.argv[2];
const inventory = await readCombinedControlReleaseSandboxInventory({ sandboxId });

console.log(formatCombinedControlReleaseSandboxInventory(inventory));
console.log("");

try {
  const active = await resolveActiveCombinedControlReleaseSandbox({ sandboxId });
  console.log(formatCombinedControlReleaseSandboxActivation(active.activation));
} catch {
  console.log("No active release-sandbox activation found.");
}
