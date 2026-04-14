import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { type PanelNotice } from "@simplehost/panel-ui";

import { type PanelWebApi, WebApiError } from "./api-client.js";
import { handleDesiredStateResourceRoute } from "./desired-state-resource-routes.js";
import { handleMailRoute } from "./mail-routes.js";
import {
  clearSessionCookie,
  readSessionToken,
  readLocale,
  redirect,
  type WebLocale,
  writeHtml,
  writeJson
} from "./request.js";
import {
  type WebRouteContext,
  type WebRouteHandler
} from "./web-route-context.js";
import { handleActionWebRoutes } from "./web-action-routes.js";
import { handleCoreWebRoutes } from "./web-core-routes.js";
import { handleSessionWebRoutes } from "./web-session-routes.js";

export interface PanelWebRuntimeConfig {
  api: {
    host: string;
    port: number;
  };
  env: string;
  inventory: {
    importPath: string;
  };
  version: string;
  web: {
    host: string;
    port: number;
  };
}

export interface StartPanelWebServerArgs {
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  startedAt: number;
}

export function createRequestHandler(args: StartPanelWebServerArgs) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const context: WebRouteContext = {
      request,
      response,
      url,
      locale: readLocale(request),
      sessionToken: readSessionToken(request),
      api: args.api,
      config: args.config,
      startedAt: args.startedAt,
      handleDashboard: args.handleDashboard,
      renderLoginPage: args.renderLoginPage
    };

    for (const handler of [
      handleCoreWebRoutes,
      handleSessionWebRoutes,
      handleActionWebRoutes,
      handleDesiredStateResourceRoute,
      handleMailRoute
    ] satisfies WebRouteHandler[]) {
      if (await handler(context)) {
        return;
      }
    }

    writeJson(response, 404, {
      error: "Not Found",
      method: request.method ?? "GET",
      path: url.pathname
    });
  };
}

export function createServerRequestListener(
  args: StartPanelWebServerArgs
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const requestHandler = createRequestHandler(args);

  return async (request, response) => {
    try {
      await requestHandler(request, response);
    } catch (error: unknown) {
      const locale = readLocale(request);

      if (error instanceof WebApiError && error.statusCode === 401) {
        redirect(response, "/login?notice=Session%20required&kind=error", clearSessionCookie());
        return;
      }

      writeHtml(
        response,
        error instanceof WebApiError ? error.statusCode : 500,
        args.renderLoginPage(locale, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  };
}

export function startPanelWebServer(
  args: StartPanelWebServerArgs
): ReturnType<typeof createServer> {
  const server = createServer(createServerRequestListener(args));

  server.listen(args.config.web.port, args.config.web.host, () => {
    console.log(`SHP Web listening on http://${args.config.web.host}:${args.config.web.port}`);
  });

  return server;
}
