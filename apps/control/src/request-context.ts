import type { IncomingMessage, ServerResponse } from "node:http";

import {
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
  sessionToken: string | null;
  surface: ControlBootstrapSurface;
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
  const authGate = createCombinedControlAuthGate({
    sessionToken,
    surface: args.surface
  });

  return {
    request: args.request,
    response: args.response,
    url: new URL(args.request.url ?? "/", "http://127.0.0.1"),
    sessionToken,
    surface: args.surface,
    isAuthenticated: authGate.isAuthenticated,
    resolveSession: authGate.resolveSession,
    requireSession: authGate.requireSession,
    loadAuthenticatedDashboard: authGate.loadAuthenticatedDashboard
  };
}
