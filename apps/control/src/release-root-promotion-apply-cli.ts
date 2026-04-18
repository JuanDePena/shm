import {
  applyCombinedControlReleaseRootPromotion,
  formatCombinedControlReleaseRootPromotionApply,
  formatCombinedControlReleaseRootPromotionPlan
} from "./release-root-promotion.js";

const applied = await applyCombinedControlReleaseRootPromotion();

console.log(formatCombinedControlReleaseRootPromotionPlan(applied.planManifest));
console.log("");
console.log(formatCombinedControlReleaseRootPromotionApply(applied.applyManifest));
