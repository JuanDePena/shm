import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createCombinedControlRequestContext } from "./request-context.js";
import { createControlTestHarness } from "./test-harness.js";

test("combined request context caches session, dashboard bootstrap and health per request", async () => {
  const harness = await createControlTestHarness();
  const context = createCombinedControlRequestContext({
    request: {
      method: "GET",
      url: "/?view=overview",
      headers: {
        cookie: "shp_session=test-session"
      }
    } as IncomingMessage,
    response: {} as ServerResponse,
    surface: harness.bootstrapSurface
  });

  const [resolvedA, resolvedB] = await Promise.all([
    context.resolveSession(),
    context.resolveSession()
  ]);
  const [isAuthenticatedA, isAuthenticatedB] = await Promise.all([
    context.isAuthenticated(),
    context.isAuthenticated()
  ]);
  const [dashboardA, dashboardB] = await Promise.all([
    context.loadAuthenticatedDashboard(),
    context.loadAuthenticatedDashboard()
  ]);
  const [healthA, healthB] = [context.getHealthSnapshot(), context.getHealthSnapshot()];
  const requiredSession = await context.requireSession();

  assert.equal(context.method, "GET");
  assert.equal(context.pathname, "/");
  assert.equal(context.sessionToken, "test-session");
  assert.ok(context.cache.auth.resolvedSessionPromise);
  assert.ok(context.cache.auth.requiredSessionPromise);
  assert.ok(context.cache.auth.authenticatedDashboardPromise);
  assert.ok(context.cache.auth.isAuthenticatedPromise);
  assert.equal(resolvedA, resolvedB);
  assert.equal(isAuthenticatedA, true);
  assert.equal(isAuthenticatedA, isAuthenticatedB);
  assert.equal(dashboardA, dashboardB);
  assert.equal(healthA, healthB);
  assert.equal(context.cache.healthSnapshot, healthA);
  assert.equal(requiredSession.token, "test-session");
  assert.equal(dashboardA.session.token, "test-session");
});
