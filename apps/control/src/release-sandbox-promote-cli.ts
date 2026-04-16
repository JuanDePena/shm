import {
  formatCombinedControlReleaseSandboxPromotion,
  formatCombinedControlReleaseSandboxPromotionHistory,
  promoteCombinedControlReleaseSandboxVersion
} from "./release-sandbox-promotion.js";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node dist/release-sandbox-promote-cli.js <version> [sandboxId]");
  process.exitCode = 1;
} else {
  const sandboxId = process.argv[3];
  const result = await promoteCombinedControlReleaseSandboxVersion({
    version,
    sandboxId
  });
  console.log(formatCombinedControlReleaseSandboxPromotion(result.promotion));
  console.log("");
  console.log(formatCombinedControlReleaseSandboxPromotionHistory(result.history));
}
