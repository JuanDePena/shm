import {
  createRuntimeHealthSnapshot,
  type ControlDashboardBootstrap,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelApiSurface } from "@simplehost/control-api";
import type { PanelWebApi, PanelWebSurface } from "@simplehost/control-web";

export interface ControlBootstrapSurface {
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  auth: Pick<PanelApiSurface["auth"], "login" | "logout" | "getCurrentUser">;
  dashboard: {
    loadBootstrap(token: string): Promise<ControlDashboardBootstrap>;
  };
  runtime: {
    getHealthSnapshot(): ReturnType<typeof createRuntimeHealthSnapshot<{ mode: string }>>;
  };
  webSurface: Pick<PanelWebSurface, "requestListener">;
}

export function createControlBootstrapSurface(args: {
  context: ControlProcessContext;
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  webApi: Pick<PanelWebApi, "loadDashboardBootstrap">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
}): ControlBootstrapSurface {
  return {
    apiSurface: args.apiSurface,
    auth: args.apiSurface.auth,
    dashboard: {
      loadBootstrap: (token) => args.webApi.loadDashboardBootstrap(token)
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
