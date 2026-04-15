import {
  createControlSessionSurface,
  createRuntimeHealthSnapshot,
  type ControlAuthenticatedDashboardBootstrap,
  type ControlDashboardBootstrap,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelApiSurface } from "@simplehost/control-api";
import type { PanelWebApi, PanelWebSurface } from "@simplehost/control-web";

export interface ControlBootstrapSurface {
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  auth: Pick<PanelApiSurface["auth"], "login" | "logout" | "getCurrentUser">;
  session: ReturnType<typeof createControlSessionSurface>;
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
  const session = createControlSessionSurface(args.apiSurface.auth);

  return {
    apiSurface: args.apiSurface,
    auth: args.apiSurface.auth,
    session,
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
