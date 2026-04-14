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
import {
  createRequestHandler,
  createServerRequestListener,
  startPanelWebServer,
  type StartPanelWebServerArgs
} from "./web-routes.js";

export {
  createPanelWebApiFromRequest,
  createHttpPanelWebApi,
  type PanelWebApi,
  type PanelWebApiRequestOptions,
  type PanelWebApiRequest,
  WebApiError
} from "./api-client.js";

export interface PanelWebProcessContext {
  config: StartPanelWebServerArgs["config"];
  startedAt: number;
}

export interface PanelWebSurface extends StartPanelWebServerArgs {
  context: PanelWebProcessContext;
  requestHandler: ReturnType<typeof createRequestHandler>;
  requestListener: ReturnType<typeof createServerRequestListener>;
}

export function createPanelWebSurface(
  context: PanelWebProcessContext = createControlProcessContext(),
  api: PanelWebApi = createHttpPanelWebApi(context.config)
): PanelWebSurface {
  const serverArgs: StartPanelWebServerArgs = {
    api,
    config: context.config,
    handleDashboard: createDashboardHandler({
      api,
      defaultImportPath: context.config.inventory.importPath,
      renderLoginPage,
      version: context.config.version
    }),
    renderLoginPage,
    startedAt: context.startedAt
  };

  return {
    context,
    ...serverArgs,
    requestHandler: createRequestHandler(serverArgs),
    requestListener: createServerRequestListener(serverArgs)
  };
}

export function createPanelWebRequestListener(
  context: PanelWebProcessContext = createControlProcessContext(),
  api: PanelWebApi = createHttpPanelWebApi(context.config)
): ReturnType<typeof createServerRequestListener> {
  return createPanelWebSurface(context, api).requestListener;
}

export function createPanelWebRuntime(
  context: PanelWebProcessContext = createControlProcessContext(),
  api: PanelWebApi = createHttpPanelWebApi(context.config)
): {
  server: ReturnType<typeof startPanelWebServer>;
  close: () => Promise<void>;
} {
  const surface = createPanelWebSurface(context, api);
  const server = startPanelWebServer(surface);

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
