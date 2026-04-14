import assert from "node:assert/strict";
import test from "node:test";

import { invokeRequestHandler } from "@simplehost/control-shared";

import type { PanelWebApi } from "./api-client.js";
import { createPanelWebSurface } from "./index.js";
import { type PanelWebRuntimeConfig } from "./web-routes.js";

function createStubApi(): PanelWebApi {
  return {
    request: async () => {
      throw new Error("Unexpected API request in test");
    },
    loadDashboardData: async () => {
      throw new Error("Unexpected dashboard load in test");
    },
    loadRustDeskPublicConnection: async () => {
      throw new Error("Unexpected RustDesk load in test");
    },
    loadDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state load in test");
    },
    applyDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state apply in test");
    },
    mutateDesiredState: async () => {
      throw new Error("Unexpected desired-state mutation in test");
    }
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
