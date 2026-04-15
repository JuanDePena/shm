import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createPanelApiHttpHandler,
  createPanelApiSurface,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";
import { createPanelWebSurface, type PanelWebSurface } from "@simplehost/control-web";

import { createControlBootstrapSurface, type ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createInProcessPanelWebApi } from "./in-process-web-api.js";
import { createCombinedControlRequestHandler } from "./router.js";

export interface CombinedControlSurface {
  apiSurface: PanelApiSurface;
  bootstrapSurface: ControlBootstrapSurface;
  close: () => Promise<void>;
  requestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  webSurface: PanelWebSurface;
}

export async function createCombinedControlSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<CombinedControlSurface> {
  const apiSurface = await createPanelApiSurface(context);
  const apiRequestHandler = createPanelApiHttpHandler(apiSurface.requestHandler);
  const api = createInProcessPanelWebApi(apiRequestHandler, apiSurface.auth);
  const webSurface = createPanelWebSurface(context, api);
  const bootstrapSurface = createControlBootstrapSurface({
    context,
    apiSurface,
    webApi: api,
    webSurface
  });

  return {
    apiSurface,
    bootstrapSurface,
    close: apiSurface.close,
    requestHandler: createCombinedControlRequestHandler({
      surface: bootstrapSurface
    }),
    webSurface
  };
}
