import type { IncomingMessage, ServerResponse } from "node:http";

import type { PanelNotice } from "@simplehost/panel-ui";
import type {
  ControlAuthenticatedDashboardBootstrap,
  ControlResolvedSession
} from "@simplehost/control-shared";

import type { PanelWebApi } from "./api-client.js";
import { readLocale, readSessionToken } from "./request.js";
import type { PanelWebRuntimeConfig } from "./web-routes.js";
import type { WebLocale } from "./request.js";

export interface WebRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  locale: WebLocale;
  sessionToken: string | null;
  resolveSession: () => Promise<ControlResolvedSession>;
  loadAuthenticatedDashboard: () => Promise<ControlAuthenticatedDashboardBootstrap>;
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  startedAt: number;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
}

export type WebRouteHandler = (context: WebRouteContext) => Promise<boolean>;

export function createWebRouteContext(args: {
  request: IncomingMessage;
  response: ServerResponse;
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  startedAt: number;
  handleDashboard: WebRouteContext["handleDashboard"];
  renderLoginPage: WebRouteContext["renderLoginPage"];
}): WebRouteContext {
  const sessionToken = readSessionToken(args.request);

  return {
    request: args.request,
    response: args.response,
    url: new URL(args.request.url ?? "/", "http://127.0.0.1"),
    locale: readLocale(args.request),
    sessionToken,
    resolveSession: () => args.api.resolveSession(sessionToken),
    loadAuthenticatedDashboard: () => args.api.loadAuthenticatedDashboard(sessionToken),
    api: args.api,
    config: args.config,
    startedAt: args.startedAt,
    handleDashboard: args.handleDashboard,
    renderLoginPage: args.renderLoginPage
  };
}
