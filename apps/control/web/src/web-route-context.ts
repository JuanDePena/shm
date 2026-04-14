import type { IncomingMessage, ServerResponse } from "node:http";

import type { PanelNotice } from "@simplehost/panel-ui";

import type { PanelWebApi } from "./api-client.js";
import type { PanelWebRuntimeConfig } from "./web-routes.js";
import type { WebLocale } from "./request.js";

export interface WebRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  locale: WebLocale;
  sessionToken: string | null;
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  startedAt: number;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
}

export type WebRouteHandler = (context: WebRouteContext) => Promise<boolean>;
