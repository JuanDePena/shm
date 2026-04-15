import assert from "node:assert/strict";
import test from "node:test";

import type {
  ControlAuthenticatedDashboardBootstrap,
  ControlResolvedSession
} from "@simplehost/control-shared";

import { createCombinedControlAuthGate } from "./auth-gate.js";

test("combined auth gate caches session and dashboard bootstrap lookups", async () => {
  let resolveCalls = 0;
  let requireCalls = 0;
  let dashboardCalls = 0;

  const authenticatedSession = {
    state: "authenticated",
    token: "test-session",
    currentUser: {
      userId: "user-1",
      email: "admin@example.com",
      displayName: "Admin",
      status: "active",
      globalRoles: ["platform_admin"],
      tenantMemberships: []
    }
  } as const satisfies Extract<ControlResolvedSession, { state: "authenticated" }>;

  const authenticatedDashboard = {
    session: authenticatedSession,
    dashboard: {
      currentUser: authenticatedSession.currentUser
    }
  } as unknown as ControlAuthenticatedDashboardBootstrap;

  const gate = createCombinedControlAuthGate({
    sessionToken: authenticatedSession.token,
    surface: {
      session: {
        resolve: async () => {
          resolveCalls += 1;
          return authenticatedSession;
        },
        require: async () => {
          requireCalls += 1;
          return authenticatedSession;
        }
      },
      dashboard: {
        loadBootstrap: async () => authenticatedDashboard.dashboard,
        loadAuthenticated: async () => {
          dashboardCalls += 1;
          return authenticatedDashboard;
        }
      }
    }
  });

  const firstResolution = await gate.resolveSession();
  const secondResolution = await gate.resolveSession();
  const firstDashboard = await gate.loadAuthenticatedDashboard();
  const secondDashboard = await gate.loadAuthenticatedDashboard();
  const requiredSession = await gate.requireSession();
  const isAuthenticated = await gate.isAuthenticated();

  assert.equal(resolveCalls, 1);
  assert.equal(requireCalls, 0);
  assert.equal(dashboardCalls, 1);
  assert.equal(firstResolution, secondResolution);
  assert.equal(firstDashboard, secondDashboard);
  assert.equal(requiredSession, authenticatedSession);
  assert.equal(isAuthenticated, true);
});
