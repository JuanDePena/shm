import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createControlApiHttpHandler,
  createControlApiSurface,
  type ControlApiSurface
} from "@simplehost/control-api";
import {
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";
import { createControlWebSurface, type ControlWebSurface } from "@simplehost/control-web";

import { createControlBootstrapSurface, type ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createInProcessControlWebApi } from "./in-process-web-api.js";
import { createCombinedControlRequestContext, type CombinedControlRequestContext } from "./request-context.js";
import { createCombinedControlRequestHandler } from "./request-handler.js";
import { createCombinedControlRouteSurface, type CombinedControlRouteSurface } from "./route-surface.js";

export interface ControlCombinedSurface {
  readonly context: ControlProcessContext;
  readonly apiSurface: ControlApiSurface;
  readonly bootstrapSurface: ControlBootstrapSurface;
  readonly routeSurface: CombinedControlRouteSurface;
  readonly webSurface: ControlWebSurface;
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
  const apiSurface = await createControlApiSurface(context);
  const apiRequestHandler = createControlApiHttpHandler(apiSurface.requestHandler);
  const api = createInProcessControlWebApi(apiRequestHandler, apiSurface.auth);
  const webSurface = createControlWebSurface(context, api);
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
    close: async () => {
      await Promise.all([
        apiSurface.close(),
        webSurface.close()
      ]);
    }
  };
}
