import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { renderLoginPage } from "./auth-pages.js";
import { createDashboardHandler } from "./dashboard-page-routes.js";
import { startPanelWebServer } from "./web-routes.js";

export function createPanelWebRuntime(
  context: ControlProcessContext = createControlProcessContext()
): {
  server: ReturnType<typeof startPanelWebServer>;
  close: () => Promise<void>;
} {
  const handleDashboard = createDashboardHandler({
    defaultImportPath: context.config.inventory.importPath,
    renderLoginPage,
    version: context.config.version
  });
  const server = startPanelWebServer({
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
  context: ControlProcessContext = createControlProcessContext()
): ReturnType<typeof startPanelWebServer> {
  const runtime = createPanelWebRuntime(context);
  return runtime.server;
}

if (isMainModule(import.meta.url)) {
  const runtime = createPanelWebRuntime();

  registerGracefulShutdown(runtime.close);
}
