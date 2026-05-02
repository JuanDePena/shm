import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { createHttpControlWebApi, type ControlWebApi } from "./api-client.js";
import { renderLoginPage } from "./auth-pages.js";
import { createDashboardHandler } from "./dashboard-page-routes.js";
import {
  createOverviewMetricsCollector,
  type OverviewMetricsCollector
} from "./overview-metrics.js";
import {
  createRequestHandler,
  createServerRequestListener,
  startControlWebServer,
  type StartControlWebServerArgs
} from "./web-routes.js";

export {
  createControlWebApiFromRequest,
  createHttpControlWebApi,
  type ControlWebApi,
  type ControlWebApiRequestOptions,
  type ControlWebApiRequest,
  WebApiError
} from "./api-client.js";
export {
  runMailReleaseBaseline,
  type MailReleaseBaselineCheck,
  type MailReleaseBaselineResult
} from "./mail-release-baseline.js";

export interface ControlWebProcessContext {
  config: StartControlWebServerArgs["config"];
  startedAt: number;
}

export interface ControlWebSurface extends StartControlWebServerArgs {
  context: ControlWebProcessContext;
  overviewMetrics: OverviewMetricsCollector;
  requestHandler: ReturnType<typeof createRequestHandler>;
  requestListener: ReturnType<typeof createServerRequestListener>;
  close: () => Promise<void>;
}

export function createControlWebSurface(
  context: ControlWebProcessContext = createControlProcessContext(),
  api: ControlWebApi = createHttpControlWebApi(context.config)
): ControlWebSurface {
  const overviewMetrics = createOverviewMetricsCollector({
    config: context.config
  });
  const serverArgs: StartControlWebServerArgs = {
    api,
    config: context.config,
    handleDashboard: createDashboardHandler({
      api,
      overviewMetrics,
      renderLoginPage,
      version: context.config.version
    }),
    renderLoginPage,
    startedAt: context.startedAt
  };

  return {
    context,
    overviewMetrics,
    ...serverArgs,
    requestHandler: createRequestHandler(serverArgs),
    requestListener: createServerRequestListener(serverArgs),
    close: async () => {
      overviewMetrics.close();
    }
  };
}

export function createControlWebRequestListener(
  context: ControlWebProcessContext = createControlProcessContext(),
  api: ControlWebApi = createHttpControlWebApi(context.config)
): ReturnType<typeof createServerRequestListener> {
  return createControlWebSurface(context, api).requestListener;
}

export function createControlWebRuntime(
  context: ControlWebProcessContext = createControlProcessContext(),
  api: ControlWebApi = createHttpControlWebApi(context.config)
): {
  server: ReturnType<typeof startControlWebServer>;
  close: () => Promise<void>;
} {
  const surface = createControlWebSurface(context, api);
  const server = startControlWebServer(surface);

  return {
    server,
    close: async () => {
      await closeHttpServer(server);
      await surface.close();
    }
  };
}

export function startControlWeb(
  context: ControlProcessContext = createControlProcessContext(),
  api: ControlWebApi = createHttpControlWebApi(context.config)
): ReturnType<typeof startControlWebServer> {
  const runtime = createControlWebRuntime(context, api);
  return runtime.server;
}

if (isMainModule(import.meta.url)) {
  const runtime = createControlWebRuntime();

  registerGracefulShutdown(runtime.close);
}
