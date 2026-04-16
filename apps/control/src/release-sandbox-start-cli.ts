import { registerGracefulShutdown } from "@simplehost/control-shared";

import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

const runtime = await startCombinedControlReleaseSandbox();

console.log(`Combined control release-sandbox started on ${runtime.origin}`);

registerGracefulShutdown(runtime.close, {
  onShutdownError: (error) => {
    console.error(error);
  }
});
