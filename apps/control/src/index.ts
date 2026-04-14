import { createServer } from "node:http";

import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "../shared/src/index.js";
import { createPanelApiRuntime } from "../api/src/index.js";
import { createCombinedControlSurface } from "./request-handler.js";
import { createPanelWebRuntime } from "../web/src/index.js";

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
  const surface = await createCombinedControlSurface(context);
  const server = createServer(surface.requestHandler);

  server.listen(context.config.web.port, context.config.web.host, () => {
    console.log(`SHP Control listening on http://${context.config.web.host}:${context.config.web.port}`);
  });

  return {
    context,
    server,
    close: async () => {
      await closeHttpServer(server);
      await surface.close();
    }
  };
}

export const createUnifiedControlRuntime = createCombinedControlRuntime;

if (isMainModule(import.meta.url)) {
  createCombinedControlRuntime()
    .then((runtime) => {
      registerGracefulShutdown(runtime.close, {
        onBeforeExit: () => {
          if (runtime.server.listening) {
            runtime.server.unref();
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
