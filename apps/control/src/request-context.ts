import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createRuntimeHealthSnapshot,
  readSessionTokenFromCookieHeader,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlAuthenticatedSession,
  type ControlResolvedSession
} from "@simplehost/control-shared";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import {
  createCombinedControlAuthGate,
  type CombinedControlAuthGateCache
} from "./auth-gate.js";

export interface CombinedControlRequestCache {
  auth: CombinedControlAuthGateCache;
  healthSnapshot?: ReturnType<typeof createRuntimeHealthSnapshot<{ mode: string }>>;
}

export interface CombinedControlRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  method: string;
  pathname: string;
  sessionToken: string | null;
  surface: ControlBootstrapSurface;
  cache: CombinedControlRequestCache;
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
  const cache: CombinedControlRequestCache = {
    auth: {}
  };
  const authGate = createCombinedControlAuthGate({
    sessionToken,
    surface: args.surface,
    cache: cache.auth
  });

  return {
    request: args.request,
    response: args.response,
    url,
    method,
    pathname: url.pathname,
    sessionToken,
    surface: args.surface,
    cache,
    getHealthSnapshot: () =>
      (cache.healthSnapshot ??= args.surface.runtime.getHealthSnapshot()),
    isAuthenticated: authGate.isAuthenticated,
    resolveSession: authGate.resolveSession,
    requireSession: authGate.requireSession,
    loadAuthenticatedDashboard: authGate.loadAuthenticatedDashboard
  };
}
