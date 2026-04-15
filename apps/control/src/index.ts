import { createServer } from "node:http";

import { createPanelApiRuntime } from "@simplehost/control-api";
import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "../shared/src/index.js";
import { createCombinedControlRuntimeContract } from "./runtime-contract.js";
import { createPanelWebRuntime } from "@simplehost/control-web";

export type ControlRuntimeMode = "combined" | "split";

export function resolveControlRuntimeMode(
  env: NodeJS.ProcessEnv = process.env
): ControlRuntimeMode {
  return env.SIMPLEHOST_CONTROL_RUNTIME_MODE === "split" ? "split" : "combined";
}

export async function createSplitControlRuntime(
  context: ControlProcessContext = createControlProcessContext()
) {
  const apiRuntime = await createPanelApiRuntime(context);
  const webRuntime = createPanelWebRuntime(context);

  return {
    context,
    apiRuntime,
    webRuntime,
    close: async () => {
      await Promise.all([
        apiRuntime.close(),
        webRuntime.close()
      ]);
    }
  };
}

export async function createCombinedControlRuntime(
  context: ControlProcessContext = createControlProcessContext()
) {
  const contract = await createCombinedControlRuntimeContract(context);
  const server = createServer(contract.requestHandler);

  server.listen(context.config.web.port, context.config.web.host, () => {
    console.log(`SHP Control listening on http://${context.config.web.host}:${context.config.web.port}`);
  });

  return {
    context,
    contract,
    server,
    close: async () => {
      await closeHttpServer(server);
      await contract.close();
    }
  };
}

export const createUnifiedControlRuntime = createCombinedControlRuntime;

export async function startMainControlRuntime(
  context: ControlProcessContext = createControlProcessContext(),
  mode: ControlRuntimeMode = resolveControlRuntimeMode()
) {
  return mode === "split"
    ? createSplitControlRuntime(context)
    : createCombinedControlRuntime(context);
}

if (isMainModule(import.meta.url)) {
  startMainControlRuntime()
    .then((runtime) => {
      registerGracefulShutdown(runtime.close, {
        onBeforeExit: () => {
          if ("server" in runtime && runtime.server.listening) {
            runtime.server.unref();
          }
          if ("apiRuntime" in runtime && runtime.apiRuntime.server.listening) {
            runtime.apiRuntime.server.unref();
          }
          if ("webRuntime" in runtime && runtime.webRuntime.server.listening) {
            runtime.webRuntime.server.unref();
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
