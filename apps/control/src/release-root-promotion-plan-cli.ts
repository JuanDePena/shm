import {
  formatCombinedControlReleaseRootPromotionPlan,
  planCombinedControlReleaseRootPromotion
} from "./release-root-promotion.js";

const planned = await planCombinedControlReleaseRootPromotion();

console.log(formatCombinedControlReleaseRootPromotionPlan(planned.planManifest));
