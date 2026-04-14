import { isMainModule, registerGracefulShutdown, createControlProcessContext } from "../shared/src/index.js";
import { createPanelApiRuntime } from "../api/src/index.js";
import { createPanelWebRuntime } from "../web/src/index.js";

export async function createUnifiedControlRuntime() {
  const context = createControlProcessContext();
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

if (isMainModule(import.meta.url)) {
  createUnifiedControlRuntime()
    .then((runtime) => {
      registerGracefulShutdown(runtime.close, {
        onBeforeExit: () => {
          if (runtime.apiRuntime.server.listening) {
            runtime.apiRuntime.server.unref();
          }
          if (runtime.webRuntime.server.listening) {
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
