import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createPanelApiHttpHandler,
  writeJson,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
  createRuntimeHealthSnapshot,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelWebSurface } from "@simplehost/control-web";

export interface CombinedControlRouterArgs {
  context: ControlProcessContext;
  apiSurface: Pick<PanelApiSurface, "requestHandler">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
}

export function createCombinedControlRequestHandler({
  context,
  apiSurface,
  webSurface
}: CombinedControlRouterArgs): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  const apiRequestHandler = createPanelApiHttpHandler(apiSurface.requestHandler);
  const webRequestHandler = webSurface.requestListener;

  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(
        response,
        200,
        createRuntimeHealthSnapshot({
          config: context.config,
          service: "control",
          startedAt: context.startedAt,
          extra: {
            mode: "combined-candidate"
          }
        })
      );
      return;
    }

    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      await apiRequestHandler(request, response);
      return;
    }

    await webRequestHandler(request, response);
  };
}
