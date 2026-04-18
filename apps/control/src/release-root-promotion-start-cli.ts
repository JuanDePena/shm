import {
  registerCombinedControlReleaseRootPromotionShutdown,
  startCombinedControlReleaseRootPromotion
} from "./release-root-promotion-runner.js";

const runtime = await startCombinedControlReleaseRootPromotion();

registerCombinedControlReleaseRootPromotionShutdown(runtime);

console.log(`Combined control release-root promotion started on ${runtime.origin}`);
console.log(`Apply summary: ${runtime.layout.applySummaryFile}`);
console.log(`Startup summary: ${runtime.layout.startupSummaryFile}`);
