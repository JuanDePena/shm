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
import { createCombinedControlRequestContext, type CombinedControlRequestContext } from "./request-context.js";
import { createCombinedControlRequestHandler } from "./request-handler.js";
import { createCombinedControlRouteSurface, type CombinedControlRouteSurface } from "./route-surface.js";

export interface ControlCombinedSurface {
  readonly context: ControlProcessContext;
  readonly apiSurface: PanelApiSurface;
  readonly bootstrapSurface: ControlBootstrapSurface;
  readonly routeSurface: CombinedControlRouteSurface;
  readonly webSurface: PanelWebSurface;
  createRequestContext(args: {
    request: IncomingMessage;
    response: ServerResponse;
  }): CombinedControlRequestContext;
  readonly requestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  close(): Promise<void>;
}

export async function createControlCombinedSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<ControlCombinedSurface> {
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
  const routeSurface = createCombinedControlRouteSurface(bootstrapSurface);
  const createRequestContext = (args: {
    request: IncomingMessage;
    response: ServerResponse;
  }): CombinedControlRequestContext =>
    createCombinedControlRequestContext({
      request: args.request,
      response: args.response,
      surface: bootstrapSurface
    });

  return {
    context,
    apiSurface,
    bootstrapSurface,
    routeSurface,
    webSurface,
    createRequestContext,
    requestHandler: createCombinedControlRequestHandler({
      surface: {
        createRequestContext,
        routeSurface
      }
    }),
    close: apiSurface.close
  };
}
