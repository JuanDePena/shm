import {
  formatCombinedControlReleaseRootPromotionHistory,
  formatCombinedControlReleaseRootPromotionManifest,
  promoteCombinedControlReleaseRootPromotionVersion
} from "./release-root-promotion-promotion.js";

const [, , versionArg, targetIdArg] = process.argv;

if (!versionArg) {
  throw new Error("Usage: node dist/release-root-promotion-promote-cli.js <version> [targetId]");
}

const promoted = await promoteCombinedControlReleaseRootPromotionVersion({
  version: versionArg,
  targetId: targetIdArg
});

console.log(formatCombinedControlReleaseRootPromotionManifest(promoted.promotion));
console.log("");
console.log(formatCombinedControlReleaseRootPromotionHistory(promoted.history));
