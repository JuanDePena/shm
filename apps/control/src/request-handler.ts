import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import { writeJson } from "../api/src/api-http.js";
import {
  createPanelApiHttpHandler,
  createPanelApiSurface
} from "../api/src/index.js";
import { createInProcessPanelWebApi } from "./in-process-web-api.js";
import { createPanelWebRequestListener } from "../web/src/index.js";

export interface CombinedControlSurface {
  apiRequestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  close: () => Promise<void>;
  requestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  webRequestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
}

export async function createCombinedControlSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlSurface> {
  const apiSurface = await createPanelApiSurface(context);
  const apiRequestHandler = createPanelApiHttpHandler(apiSurface.requestHandler);
  const api = createInProcessPanelWebApi(apiRequestHandler);
  const webRequestHandler = createPanelWebRequestListener(context, api);

  return {
    apiRequestHandler,
    close: apiSurface.close,
    requestHandler: async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/healthz") {
        writeJson(response, 200, {
          service: "control",
          status: "ok",
          version: context.config.version,
          environment: context.config.env,
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.round((Date.now() - context.startedAt) / 1000),
          mode: "combined-candidate"
        });
        return;
      }

      if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
        await apiRequestHandler(request, response);
        return;
      }

      await webRequestHandler(request, response);
    },
    webRequestHandler
  };
}
