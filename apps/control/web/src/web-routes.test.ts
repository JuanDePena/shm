import assert from "node:assert/strict";
import test from "node:test";

import { invokeRequestHandler } from "@simplehost/control-shared";

import type { PanelWebApi } from "./api-client.js";
import { WebApiError } from "./api-client.js";
import { createPanelWebSurface } from "./index.js";
import { type PanelWebRuntimeConfig } from "./web-routes.js";

function createStubApi(
  overrides: Partial<PanelWebApi> = {}
): PanelWebApi {
  return {
    login: async () => {
      throw new Error("Unexpected login request in test");
    },
    logout: async () => {
      throw new Error("Unexpected logout request in test");
    },
    getCurrentUser: async () => {
      throw new Error("Unexpected current-user request in test");
    },
    resolveSession: async () => {
      return {
        state: "anonymous",
        token: null,
        currentUser: null
      };
    },
    loadAuthenticatedDashboard: async () => {
      throw new Error("Unexpected authenticated dashboard load in test");
    },
    loadDashboardBootstrap: async () => {
      throw new Error("Unexpected dashboard bootstrap load in test");
    },
    loadDashboardData: async () => {
      throw new Error("Unexpected dashboard load in test");
    },
    loadRustDeskPublicConnection: async () => {
      throw new Error("Unexpected RustDesk load in test");
    },
    exportInventory: async () => {
      throw new Error("Unexpected inventory export in test");
    },
    importInventory: async () => {
      throw new Error("Unexpected inventory import in test");
    },
    runReconciliation: async () => {
      throw new Error("Unexpected reconciliation run in test");
    },
    syncZone: async () => {
      throw new Error("Unexpected zone sync in test");
    },
    reconcileApp: async () => {
      throw new Error("Unexpected app reconcile in test");
    },
    renderAppProxy: async () => {
      throw new Error("Unexpected proxy render in test");
    },
    reconcileDatabase: async () => {
      throw new Error("Unexpected database reconcile in test");
    },
    updateCodeServer: async () => {
      throw new Error("Unexpected code-server update in test");
    },
    refreshPackageInventory: async () => {
      throw new Error("Unexpected package inventory refresh in test");
    },
    installPackages: async () => {
      throw new Error("Unexpected package install in test");
    },
    loadProxyPreview: async () => {
      throw new Error("Unexpected proxy preview in test");
    },
    upsertMailDomain: async () => {
      throw new Error("Unexpected mail domain upsert in test");
    },
    deleteMailDomain: async () => {
      throw new Error("Unexpected mail domain delete in test");
    },
    upsertMailbox: async () => {
      throw new Error("Unexpected mailbox upsert in test");
    },
    deleteMailbox: async () => {
      throw new Error("Unexpected mailbox delete in test");
    },
    upsertMailAlias: async () => {
      throw new Error("Unexpected mail alias upsert in test");
    },
    deleteMailAlias: async () => {
      throw new Error("Unexpected mail alias delete in test");
    },
    upsertMailboxQuota: async () => {
      throw new Error("Unexpected mailbox quota upsert in test");
    },
    deleteMailboxQuota: async () => {
      throw new Error("Unexpected mailbox quota delete in test");
    },
    loadDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state load in test");
    },
    applyDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state apply in test");
    },
    mutateDesiredState: async () => {
      throw new Error("Unexpected desired-state mutation in test");
    },
    ...overrides
  };
}

function createConfig(): PanelWebRuntimeConfig {
  return {
    api: { host: "127.0.0.1", port: 4100 },
    env: "test",
    inventory: { importPath: "/tmp/inventory.yaml" },
    version: "0.1.0-test",
    web: { host: "127.0.0.1", port: 3200 }
  };
}

test("web healthz reports web runtime metadata", async () => {
  const handler = createPanelWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now() - 12_000
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/healthz"
  });
  const payload = JSON.parse(response.bodyText) as {
    service: string;
    environment: string;
    upstreamApi: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.service, "web");
  assert.equal(payload.environment, "test");
  assert.equal(payload.upstreamApi, "127.0.0.1:4100");
});

test("locale preferences route redirects and sets locale cookie", async () => {
  const handler = createPanelWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/preferences/locale",
    body: "locale=en&returnTo=%2F%3Fview%3Dnodes",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/?view=nodes");
  assert.match(String(response.headers["set-cookie"]), /shp_lang=en/);
});

test("unknown routes still return a structured 404 payload", async () => {
  const handler = createPanelWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/no-such-route"
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.bodyText), {
    error: "Not Found",
    method: "GET",
    path: "/no-such-route"
  });
});

test("missing session on protected routes redirects to login", async () => {
  const handler = createPanelWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/resources/apps/delete",
    body: "slug=adudoc",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/login?notice=Session%20required&kind=error");
  assert.match(String(response.headers["set-cookie"]), /shp_session=;/);
});

test("login failures render the login page with the API error message", async () => {
  const handler = createPanelWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      login: async () => {
        throw new WebApiError(401, "Invalid credentials");
      }
    })
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/auth/login",
    body: "email=admin%40example.com&password=bad-pass",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.bodyText, /Invalid credentials/);
});
