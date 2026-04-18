import {
  diffCombinedControlReleaseRootPromotion,
  formatCombinedControlReleaseRootPromotionDiff
} from "./release-root-promotion.js";

const diffed = await diffCombinedControlReleaseRootPromotion({ persist: true });

console.log(formatCombinedControlReleaseRootPromotionDiff(diffed.diffManifest));
