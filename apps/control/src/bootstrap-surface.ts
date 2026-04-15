import {
  createRuntimeHealthSnapshot,
  requireControlSession,
  resolveControlSession,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlDashboardBootstrap,
  type ControlAuthenticatedSession,
  type ControlResolvedSession,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelApiSurface } from "@simplehost/control-api";
import type { PanelWebApi, PanelWebSurface } from "@simplehost/control-web";

export interface ControlBootstrapSurface {
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  auth: Pick<PanelApiSurface["auth"], "login" | "logout" | "getCurrentUser">;
  session: {
    resolve(token: string | null): Promise<ControlResolvedSession>;
    require(token: string | null): Promise<ControlAuthenticatedSession>;
  };
  dashboard: {
    loadBootstrap(token: string): Promise<ControlDashboardBootstrap>;
    loadAuthenticated(
      token: string | null
    ): Promise<ControlAuthenticatedDashboardBootstrap>;
  };
  runtime: {
    getHealthSnapshot(): ReturnType<typeof createRuntimeHealthSnapshot<{ mode: string }>>;
  };
  webSurface: Pick<PanelWebSurface, "requestListener">;
}

export function createControlBootstrapSurface(args: {
  context: ControlProcessContext;
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  webApi: Pick<PanelWebApi, "loadDashboardBootstrap" | "loadAuthenticatedDashboard">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
}): ControlBootstrapSurface {
  return {
    apiSurface: args.apiSurface,
    auth: args.apiSurface.auth,
    session: {
      resolve: (token) => resolveControlSession(token, args.apiSurface.auth),
      require: (token) => requireControlSession(token, args.apiSurface.auth)
    },
    dashboard: {
      loadBootstrap: (token) => args.webApi.loadDashboardBootstrap(token),
      loadAuthenticated: (token) =>
        args.webApi.loadAuthenticatedDashboard(token)
    },
    runtime: {
      getHealthSnapshot: () =>
        createRuntimeHealthSnapshot({
          config: args.context.config,
          service: "control",
          startedAt: args.context.startedAt,
          extra: {
            mode: "combined-candidate"
          }
        })
    },
    webSurface: args.webSurface
  };
}
