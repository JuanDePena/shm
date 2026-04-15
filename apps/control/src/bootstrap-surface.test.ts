import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthLoginResponse,
  AuthenticatedUserSummary
} from "@simplehost/panel-contracts";
import {
  createRuntimeHealthSnapshot,
  type ControlDashboardBootstrap,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelApiSurface } from "@simplehost/control-api";
import type { PanelWebSurface } from "@simplehost/control-web";

import { createControlBootstrapSurface } from "./bootstrap-surface.js";

function createAuthenticatedUserSummary(): AuthenticatedUserSummary {
  return {
    userId: "user-1",
    email: "admin@example.com",
    displayName: "Admin",
    status: "active",
    globalRoles: ["platform_admin"],
    tenantMemberships: []
  };
}

function createAuthLoginResponse(): AuthLoginResponse {
  return {
    sessionToken: "test-session",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: createAuthenticatedUserSummary()
  };
}

function createTestContext(): ControlProcessContext {
  return {
    config: {
      env: "test",
      version: "0.1.0-test"
    } as ControlProcessContext["config"],
    startedAt: Date.now() - 3_000
  };
}

test("control bootstrap surface delegates auth and dashboard bootstrap", async () => {
  const context = createTestContext();
  let currentUserCalls = 0;
  let dashboardCalls = 0;

  const expectedBootstrap = {
    currentUser: createAuthenticatedUserSummary()
  } as unknown as ControlDashboardBootstrap;

  const apiSurface = {
    auth: {
      login: async () => createAuthLoginResponse(),
      logout: async () => {},
      getCurrentUser: async () => {
        currentUserCalls += 1;
        return expectedBootstrap.currentUser;
      }
    },
    requestHandler: async () => {}
  } satisfies Pick<PanelApiSurface, "auth" | "requestHandler">;

  const webSurface = {
    requestListener: async () => {}
  } satisfies Pick<PanelWebSurface, "requestListener">;

  const surface = createControlBootstrapSurface({
    context,
    apiSurface,
    webApi: {
      loadDashboardBootstrap: async () => {
        dashboardCalls += 1;
        return expectedBootstrap;
      }
    },
    webSurface
  });

  const currentUser = await surface.auth.getCurrentUser("test-session");
  const bootstrap = await surface.dashboard.loadBootstrap("test-session");

  assert.equal(currentUserCalls, 1);
  assert.equal(dashboardCalls, 1);
  assert.deepEqual(currentUser, expectedBootstrap.currentUser);
  assert.equal(bootstrap, expectedBootstrap);
  const healthSnapshot = surface.runtime.getHealthSnapshot();
  const expectedHealth = createRuntimeHealthSnapshot({
    config: context.config,
    service: "control",
    startedAt: context.startedAt,
    extra: {
      mode: "combined-candidate"
    }
  });

  assert.equal(healthSnapshot.service, expectedHealth.service);
  assert.equal(healthSnapshot.status, expectedHealth.status);
  assert.equal(healthSnapshot.version, expectedHealth.version);
  assert.equal(healthSnapshot.environment, expectedHealth.environment);
  assert.equal(healthSnapshot.mode, expectedHealth.mode);
  assert.equal(healthSnapshot.uptimeSeconds, expectedHealth.uptimeSeconds);
  assert.match(healthSnapshot.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
