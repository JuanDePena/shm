import { registerGracefulShutdown } from "@simplehost/control-shared";

import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

const runtime = await startCombinedControlReleaseSandbox();

console.log(`Combined control release-sandbox started on ${runtime.origin}`);
console.log(`Current release root: ${runtime.bundle.paths.currentRoot}`);
console.log(`Active version: ${runtime.activation.activeVersion}`);
console.log(runtime.startupSummary.trim());
console.log("");
console.log(runtime.bundleSummary.trim());

registerGracefulShutdown(runtime.close, {
  onShutdownError: (error) => {
    console.error(error);
  }
});
