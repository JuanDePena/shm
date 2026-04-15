import { ControlSessionRequiredError } from "@simplehost/control-shared";

import type { WebRouteContext } from "./web-route-context.js";

export async function requireSessionToken(
  context: Pick<WebRouteContext, "requireSession">
): Promise<string> {
  const session = await context.requireSession();
  return session.token;
}

export async function requireAuthenticatedSession(
  context: Pick<WebRouteContext, "requireSession">
) {
  try {
    return await context.requireSession();
  } catch (error) {
    if (error instanceof ControlSessionRequiredError) {
      throw error;
    }

    throw error;
  }
}
