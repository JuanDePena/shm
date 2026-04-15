import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createCombinedControlRequestContext } from "./request-context.js";
import { createCombinedControlRouteSurface } from "./route-surface.js";

export function createCombinedControlRequestHandler({
  surface
}: {
  surface: ControlBootstrapSurface;
}): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  const routeSurface = createCombinedControlRouteSurface(surface);

  return async (request, response) => {
    const context = createCombinedControlRequestContext({
      request,
      response,
      surface
    });
    await routeSurface.handle(context);
  };
}
