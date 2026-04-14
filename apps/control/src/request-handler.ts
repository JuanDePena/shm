import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createPanelApiHttpHandler,
  createPanelApiSurface
} from "@simplehost/control-api";
import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";
import { createPanelWebSurface } from "@simplehost/control-web";

import { createInProcessPanelWebApi } from "./in-process-web-api.js";
import { createCombinedControlRequestHandler } from "./router.js";

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
  const webSurface = createPanelWebSurface(context, api);
  const webRequestHandler = webSurface.requestListener;

  return {
    apiRequestHandler,
    close: apiSurface.close,
    requestHandler: createCombinedControlRequestHandler({
      context,
      apiRequestHandler,
      webRequestHandler
    }),
    webRequestHandler
  };
}
