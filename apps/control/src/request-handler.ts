import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import type { CombinedControlRequestContext } from "./request-context.js";
import { createCombinedControlRequestContext } from "./request-context.js";
import type { CombinedControlRouteSurface } from "./route-surface.js";
import { createCombinedControlRouteSurface } from "./route-surface.js";

export interface CombinedControlRequestHandlingSurface {
  createRequestContext(args: {
    request: IncomingMessage;
    response: ServerResponse;
  }): CombinedControlRequestContext;
  routeSurface: CombinedControlRouteSurface;
}

export function createCombinedControlRequestHandler({
  surface
}: {
  surface: CombinedControlRequestHandlingSurface | ControlBootstrapSurface;
}): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  const resolvedSurface: CombinedControlRequestHandlingSurface =
    "createRequestContext" in surface
      ? surface
      : {
          createRequestContext: ({ request, response }) =>
            createCombinedControlRequestContext({
              request,
              response,
              surface
            }),
          routeSurface: createCombinedControlRouteSurface(surface)
        };

  return async (request, response) => {
    const context = resolvedSurface.createRequestContext({
      request,
      response
    });
    await resolvedSurface.routeSurface.handle(context);
  };
}
