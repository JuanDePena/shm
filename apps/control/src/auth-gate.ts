import {
  type ControlAuthenticatedDashboardBootstrap,
  type ControlAuthenticatedSession,
  type ControlResolvedSession
} from "@simplehost/control-shared";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";

export interface CombinedControlAuthGate {
  sessionToken: string | null;
  cache: CombinedControlAuthGateCache;
  resolveSession(): Promise<ControlResolvedSession>;
  requireSession(): Promise<ControlAuthenticatedSession>;
  loadAuthenticatedDashboard(): Promise<ControlAuthenticatedDashboardBootstrap>;
  isAuthenticated(): Promise<boolean>;
}

export interface CombinedControlAuthGateCache {
  resolvedSessionPromise?: Promise<ControlResolvedSession>;
  requiredSessionPromise?: Promise<ControlAuthenticatedSession>;
  authenticatedDashboardPromise?: Promise<ControlAuthenticatedDashboardBootstrap>;
  isAuthenticatedPromise?: Promise<boolean>;
}

export function createCombinedControlAuthGate(args: {
  sessionToken: string | null;
  surface: Pick<ControlBootstrapSurface, "session" | "dashboard">;
  cache?: CombinedControlAuthGateCache;
}): CombinedControlAuthGate {
  const cache: CombinedControlAuthGateCache = args.cache ?? {};

  const resolveSession = (): Promise<ControlResolvedSession> =>
    (cache.resolvedSessionPromise ??= args.surface.session.resolve(args.sessionToken));

  const requireSession = async (): Promise<ControlAuthenticatedSession> => {
    if (!cache.requiredSessionPromise) {
      cache.requiredSessionPromise = args.surface.session.require(args.sessionToken);
      cache.resolvedSessionPromise = cache.requiredSessionPromise;
    }

    return cache.requiredSessionPromise;
  };

  const loadAuthenticatedDashboard =
    async (): Promise<ControlAuthenticatedDashboardBootstrap> => {
      if (!cache.authenticatedDashboardPromise) {
        cache.authenticatedDashboardPromise = args.surface.dashboard
          .loadAuthenticated(args.sessionToken)
          .then((result) => {
            cache.resolvedSessionPromise = Promise.resolve(result.session);
            cache.requiredSessionPromise = Promise.resolve(result.session);
            cache.isAuthenticatedPromise = Promise.resolve(true);
            return result;
          });
      }

      return cache.authenticatedDashboardPromise;
    };

  return {
    sessionToken: args.sessionToken,
    cache,
    resolveSession,
    requireSession,
    loadAuthenticatedDashboard,
    isAuthenticated: async () =>
      (cache.isAuthenticatedPromise ??= resolveSession().then(
        (session) => session.state === "authenticated"
      ))
  };
}
