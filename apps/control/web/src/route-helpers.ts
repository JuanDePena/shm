import { WebApiError } from "./api-client.js";
import type { WebRouteContext } from "./web-route-context.js";

export function requireSessionToken(
  context: Pick<WebRouteContext, "sessionToken">
): string {
  const token = context.sessionToken;

  if (!token) {
    throw new WebApiError(401, "Missing session.");
  }

  return token;
}
