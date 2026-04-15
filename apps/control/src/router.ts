import type { IncomingMessage, ServerResponse } from "node:http";

import { createPanelApiHttpHandler, writeJson } from "@simplehost/control-api";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createCombinedControlRequestContext } from "./request-context.js";

export function createCombinedControlRequestHandler({
  surface
}: {
  surface: ControlBootstrapSurface;
}): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  const apiRequestHandler = createPanelApiHttpHandler(surface.apiSurface.requestHandler);
  const webRequestHandler = surface.webSurface.requestListener;

  return async (request, response) => {
    const context = createCombinedControlRequestContext({
      request,
      response,
      surface
    });

    if (request.method === "GET" && context.url.pathname === "/healthz") {
      writeJson(response, 200, context.surface.runtime.getHealthSnapshot());
      return;
    }

    if (context.url.pathname === "/v1" || context.url.pathname.startsWith("/v1/")) {
      await apiRequestHandler(request, response);
      return;
    }

    await webRequestHandler(request, response);
  };
}
