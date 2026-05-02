import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { type PanelNotice } from "@simplehost/ui";
import { isUnauthorizedError } from "@simplehost/control-shared";

import { type ControlWebApi } from "./api-client.js";
import { handleDesiredStateResourceRoute } from "./desired-state-resource-routes.js";
import { handleMailRoute } from "./mail-routes.js";
import {
  type WebLocale,
  writeJson
} from "./request.js";
import {
  createWebRouteContext,
  type WebRouteContext,
  type WebRouteHandler
} from "./web-route-context.js";
import { redirectToLogin, renderLoginError } from "./web-auth-helpers.js";
import { handleActionWebRoutes } from "./web-action-routes.js";
import { handleCoreWebRoutes } from "./web-core-routes.js";
import { handleSessionWebRoutes } from "./web-session-routes.js";

export interface ControlWebRuntimeConfig {
  api: {
    host: string;
    port: number;
  };
  env: string;
  inventory: {
    importPath: string | null;
  };
  version: string;
  web: {
    host: string;
    port: number;
  };
}

export interface StartControlWebServerArgs {
  api: ControlWebApi;
  config: ControlWebRuntimeConfig;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  startedAt: number;
}

export function createRequestHandler(args: StartControlWebServerArgs) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const context = createWebRouteContext({
      request,
      response,
      api: args.api,
      config: args.config,
      startedAt: args.startedAt,
      handleDashboard: args.handleDashboard,
      renderLoginPage: args.renderLoginPage
    });

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
      path: context.url.pathname
    });
  };
}

export function createServerRequestListener(
  args: StartControlWebServerArgs
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const requestHandler = createRequestHandler(args);

  return async (request, response) => {
    try {
      await requestHandler(request, response);
    } catch (error: unknown) {
      const { locale } = createWebRouteContext({
        request,
        response,
        api: args.api,
        config: args.config,
        startedAt: args.startedAt,
        handleDashboard: args.handleDashboard,
        renderLoginPage: args.renderLoginPage
      });

      if (isUnauthorizedError(error)) {
        redirectToLogin(response);
        return;
      }

      renderLoginError(response, locale, args.renderLoginPage, error);
    }
  };
}

export function startControlWebServer(
  args: StartControlWebServerArgs
): ReturnType<typeof createServer> {
  const server = createServer(createServerRequestListener(args));

  server.listen(args.config.web.port, args.config.web.host, () => {
    console.log(`SimpleHost Control Web listening on http://${args.config.web.host}:${args.config.web.port}`);
  });

  return server;
}
