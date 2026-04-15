import type { IncomingMessage, ServerResponse } from "node:http";

import { createPanelApiHttpHandler, writeJson } from "@simplehost/control-api";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";

export function createCombinedControlRequestHandler({
  surface
}: {
  surface: Pick<ControlBootstrapSurface, "apiSurface" | "runtime" | "webSurface">;
}): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  const apiRequestHandler = createPanelApiHttpHandler(surface.apiSurface.requestHandler);
  const webRequestHandler = surface.webSurface.requestListener;

  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(response, 200, surface.runtime.getHealthSnapshot());
      return;
    }

    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      await apiRequestHandler(request, response);
      return;
    }

    await webRequestHandler(request, response);
  };
}
