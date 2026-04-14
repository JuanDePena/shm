import type { IncomingMessage, ServerResponse } from "node:http";

import { writeJson } from "@simplehost/control-api";
import {
  createRuntimeHealthSnapshot,
  type ControlProcessContext
} from "@simplehost/control-shared";

export interface CombinedControlRouterArgs {
  context: ControlProcessContext;
  apiRequestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  webRequestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
}

export function createCombinedControlRequestHandler({
  context,
  apiRequestHandler,
  webRequestHandler
}: CombinedControlRouterArgs): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
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
