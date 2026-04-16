import {
  formatCombinedControlReleaseSandboxActivation,
  formatCombinedControlReleaseSandboxInventory,
  readCombinedControlReleaseSandboxInventory,
  resolveActiveCombinedControlReleaseSandbox
} from "./release-sandbox-activation.js";
import {
  formatCombinedControlReleaseSandboxPromotion,
  formatCombinedControlReleaseSandboxPromotionHistory,
  readCombinedControlReleaseSandboxPromotionManifest,
  readCombinedControlReleaseSandboxPromotionHistory
} from "./release-sandbox-promotion.js";

const sandboxId = process.argv[2];
const inventory = await readCombinedControlReleaseSandboxInventory({ sandboxId });
const promotionHistory = await readCombinedControlReleaseSandboxPromotionHistory({
  sandboxId
});
const promotion = await readCombinedControlReleaseSandboxPromotionManifest({
  sandboxId
});

console.log(formatCombinedControlReleaseSandboxInventory(inventory));
console.log("");

try {
  const active = await resolveActiveCombinedControlReleaseSandbox({ sandboxId });
  console.log(formatCombinedControlReleaseSandboxActivation(active.activation));
  if (promotion) {
    console.log("");
    console.log(formatCombinedControlReleaseSandboxPromotion(promotion));
  }
} catch {
  console.log("No active release-sandbox activation found.");
}

console.log("");
console.log(formatCombinedControlReleaseSandboxPromotionHistory(promotionHistory));
