import { ControlSessionRequiredError } from "@simplehost/control-shared";

import type { WebRouteContext } from "./web-route-context.js";

export function requireSessionToken(
  context: Pick<WebRouteContext, "sessionToken">
): string {
  const token = context.sessionToken;

  if (!token) {
    throw new ControlSessionRequiredError("Missing session.");
  }

  return token;
}
