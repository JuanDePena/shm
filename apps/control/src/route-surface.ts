import { createPanelApiHttpHandler, writeJson } from "@simplehost/control-api";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import type { CombinedControlRequestContext } from "./request-context.js";

export interface CombinedControlRouteSurface {
  handle(context: CombinedControlRequestContext): Promise<void>;
  match(context: CombinedControlRequestContext): "api" | "health" | "web";
  isApiRequest(context: CombinedControlRequestContext): boolean;
  isHealthRequest(context: CombinedControlRequestContext): boolean;
  isWebRequest(context: CombinedControlRequestContext): boolean;
}

export function createCombinedControlRouteSurface(
  surface: ControlBootstrapSurface
): CombinedControlRouteSurface {
  const apiRequestHandler = createPanelApiHttpHandler(surface.apiSurface.requestHandler);
  const webRequestHandler = surface.webSurface.requestListener;

  const isHealthRequest = (context: CombinedControlRequestContext) =>
    context.method === "GET" && context.pathname === "/healthz";
  const isApiRequest = (context: CombinedControlRequestContext) =>
    context.pathname === "/v1" || context.pathname.startsWith("/v1/");
  const isWebRequest = (context: CombinedControlRequestContext) =>
    !isHealthRequest(context) && !isApiRequest(context);
  const match = (context: CombinedControlRequestContext): "api" | "health" | "web" => {
    if (isHealthRequest(context)) {
      return "health";
    }

    if (isApiRequest(context)) {
      return "api";
    }

    return "web";
  };

  return {
    async handle(context) {
      switch (match(context)) {
        case "health":
          writeJson(context.response, 200, context.getHealthSnapshot());
          return;
        case "api":
          await apiRequestHandler(context.request, context.response);
          return;
        default:
          await webRequestHandler(context.request, context.response);
      }
    },
    match,
    isApiRequest,
    isHealthRequest,
    isWebRequest
  };
}
