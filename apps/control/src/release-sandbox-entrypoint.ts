import {
  isMainModule,
  registerGracefulShutdown
} from "@simplehost/control-shared";

import { formatCombinedControlStartupManifest } from "./startup-manifest.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import {
  createControlTestHarness,
  startCombinedControlTestRuntime
} from "./test-harness.js";

function readPort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) ? parsed : 3200;
}

export async function startReleaseSandboxEntrypoint() {
  const host = process.env.SHP_WEB_HOST ?? "127.0.0.1";
  const port = readPort(process.env.SHP_WEB_PORT);
  const packed = await packCombinedControlReleaseSandbox({
    host,
    port,
    clean: false
  });
  const harness = await createControlTestHarness({ webPort: port });
  const runtime = await startCombinedControlTestRuntime(harness, {
    host,
    port
  });

  console.log(formatCombinedControlStartupManifest(packed.startupManifest));
  console.log(`SHP Control release-sandbox listening on ${runtime.origin}`);

  return {
    runtime,
    close: runtime.close
  };
}

if (isMainModule(import.meta.url)) {
  startReleaseSandboxEntrypoint()
    .then((started) => {
      registerGracefulShutdown(started.close, {
        onBeforeExit: () => {
          if (started.runtime.server.listening) {
            started.runtime.server.unref();
          }
        },
        onShutdownError: (error) => {
          console.error(error);
        }
      });
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
