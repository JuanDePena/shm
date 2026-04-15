import { createPanelApiHttpHandler, writeJson } from "@simplehost/control-api";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import type { CombinedControlRequestContext } from "./request-context.js";

export interface CombinedControlRouteSurface {
  handle(context: CombinedControlRequestContext): Promise<void>;
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
    context.request.method === "GET" && context.url.pathname === "/healthz";
  const isApiRequest = (context: CombinedControlRequestContext) =>
    context.url.pathname === "/v1" || context.url.pathname.startsWith("/v1/");
  const isWebRequest = (context: CombinedControlRequestContext) =>
    !isHealthRequest(context) && !isApiRequest(context);

  return {
    async handle(context) {
      if (isHealthRequest(context)) {
        writeJson(context.response, 200, context.surface.runtime.getHealthSnapshot());
        return;
      }

      if (isApiRequest(context)) {
        await apiRequestHandler(context.request, context.response);
        return;
      }

      await webRequestHandler(context.request, context.response);
    },
    isApiRequest,
    isHealthRequest,
    isWebRequest
  };
}
