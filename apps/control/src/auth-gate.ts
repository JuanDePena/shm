import {
  type ControlAuthenticatedDashboardBootstrap,
  type ControlAuthenticatedSession,
  type ControlResolvedSession
} from "@simplehost/control-shared";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";

export interface CombinedControlAuthGate {
  sessionToken: string | null;
  resolveSession(): Promise<ControlResolvedSession>;
  requireSession(): Promise<ControlAuthenticatedSession>;
  loadAuthenticatedDashboard(): Promise<ControlAuthenticatedDashboardBootstrap>;
  isAuthenticated(): Promise<boolean>;
}

export function createCombinedControlAuthGate(args: {
  sessionToken: string | null;
  surface: Pick<ControlBootstrapSurface, "session" | "dashboard">;
}): CombinedControlAuthGate {
  let resolvedSessionPromise: Promise<ControlResolvedSession> | undefined;
  let requiredSessionPromise: Promise<ControlAuthenticatedSession> | undefined;
  let authenticatedDashboardPromise:
    | Promise<ControlAuthenticatedDashboardBootstrap>
    | undefined;

  const resolveSession = (): Promise<ControlResolvedSession> =>
    (resolvedSessionPromise ??= args.surface.session.resolve(args.sessionToken));

  const requireSession = async (): Promise<ControlAuthenticatedSession> => {
    if (!requiredSessionPromise) {
      requiredSessionPromise = args.surface.session.require(args.sessionToken);
      resolvedSessionPromise = requiredSessionPromise;
    }

    return requiredSessionPromise;
  };

  const loadAuthenticatedDashboard =
    async (): Promise<ControlAuthenticatedDashboardBootstrap> => {
      if (!authenticatedDashboardPromise) {
        authenticatedDashboardPromise = args.surface.dashboard
          .loadAuthenticated(args.sessionToken)
          .then((result) => {
            resolvedSessionPromise = Promise.resolve(result.session);
            requiredSessionPromise = Promise.resolve(result.session);
            return result;
          });
      }

      return authenticatedDashboardPromise;
    };

  return {
    sessionToken: args.sessionToken,
    resolveSession,
    requireSession,
    loadAuthenticatedDashboard,
    isAuthenticated: () => args.surface.session.isAuthenticated(args.sessionToken)
  };
}
