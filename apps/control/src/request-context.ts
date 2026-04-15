import type { IncomingMessage, ServerResponse } from "node:http";

import {
  readSessionTokenFromCookieHeader,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlResolvedSession
} from "@simplehost/control-shared";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";

export interface CombinedControlRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  sessionToken: string | null;
  surface: ControlBootstrapSurface;
  resolveSession(): Promise<ControlResolvedSession>;
  loadAuthenticatedDashboard(): Promise<ControlAuthenticatedDashboardBootstrap>;
}

export function createCombinedControlRequestContext(args: {
  request: IncomingMessage;
  response: ServerResponse;
  surface: ControlBootstrapSurface;
}): CombinedControlRequestContext {
  const sessionToken = readSessionTokenFromCookieHeader(args.request.headers.cookie);

  return {
    request: args.request,
    response: args.response,
    url: new URL(args.request.url ?? "/", "http://127.0.0.1"),
    sessionToken,
    surface: args.surface,
    resolveSession: () => args.surface.session.resolve(sessionToken),
    loadAuthenticatedDashboard: () => args.surface.dashboard.loadAuthenticated(sessionToken)
  };
}
