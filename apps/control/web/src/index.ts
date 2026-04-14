import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { createHttpPanelWebApi, type PanelWebApi } from "./api-client.js";
import { renderLoginPage } from "./auth-pages.js";
import { createDashboardHandler } from "./dashboard-page-routes.js";
import { startPanelWebServer } from "./web-routes.js";

export function createPanelWebRuntime(
  context: ControlProcessContext = createControlProcessContext(),
  api: PanelWebApi = createHttpPanelWebApi(context.config)
): {
  server: ReturnType<typeof startPanelWebServer>;
  close: () => Promise<void>;
} {
  const handleDashboard = createDashboardHandler({
    api,
    defaultImportPath: context.config.inventory.importPath,
    renderLoginPage,
    version: context.config.version
  });
  const server = startPanelWebServer({
    api,
    config: context.config,
    handleDashboard,
    renderLoginPage,
    startedAt: context.startedAt
  });

  return {
    server,
    close: async () => {
      await closeHttpServer(server);
    }
  };
}

export function startPanelWeb(
  context: ControlProcessContext = createControlProcessContext(),
  api: PanelWebApi = createHttpPanelWebApi(context.config)
): ReturnType<typeof startPanelWebServer> {
  const runtime = createPanelWebRuntime(context, api);
  return runtime.server;
}

if (isMainModule(import.meta.url)) {
  const runtime = createPanelWebRuntime();

  registerGracefulShutdown(runtime.close);
}
