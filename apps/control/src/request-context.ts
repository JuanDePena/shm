import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createRuntimeHealthSnapshot,
  readSessionTokenFromCookieHeader,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlAuthenticatedSession,
  type ControlResolvedSession
} from "@simplehost/control-shared";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createCombinedControlAuthGate } from "./auth-gate.js";

export interface CombinedControlRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  method: string;
  pathname: string;
  sessionToken: string | null;
  surface: ControlBootstrapSurface;
  getHealthSnapshot(): ReturnType<typeof createRuntimeHealthSnapshot<{ mode: string }>>;
  isAuthenticated(): Promise<boolean>;
  resolveSession(): Promise<ControlResolvedSession>;
  requireSession(): Promise<ControlAuthenticatedSession>;
  loadAuthenticatedDashboard(): Promise<ControlAuthenticatedDashboardBootstrap>;
}

export function createCombinedControlRequestContext(args: {
  request: IncomingMessage;
  response: ServerResponse;
  surface: ControlBootstrapSurface;
}): CombinedControlRequestContext {
  const sessionToken = readSessionTokenFromCookieHeader(args.request.headers.cookie);
  const method = args.request.method ?? "GET";
  const url = new URL(args.request.url ?? "/", "http://127.0.0.1");
  const authGate = createCombinedControlAuthGate({
    sessionToken,
    surface: args.surface
  });
  let healthSnapshot:
    | ReturnType<typeof createRuntimeHealthSnapshot<{ mode: string }>>
    | undefined;

  return {
    request: args.request,
    response: args.response,
    url,
    method,
    pathname: url.pathname,
    sessionToken,
    surface: args.surface,
    getHealthSnapshot: () =>
      (healthSnapshot ??= args.surface.runtime.getHealthSnapshot()),
    isAuthenticated: authGate.isAuthenticated,
    resolveSession: authGate.resolveSession,
    requireSession: authGate.requireSession,
    loadAuthenticatedDashboard: authGate.loadAuthenticatedDashboard
  };
}
