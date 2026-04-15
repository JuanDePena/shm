import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AuthLoginResponse,
  AuthenticatedUserSummary
} from "@simplehost/panel-contracts";
import {
  createPanelApiHttpHandler,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
  createRuntimeHealthSnapshot,
  invokeRequestHandler,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelWebSurface } from "@simplehost/control-web";

import { createControlBootstrapSurface, type ControlBootstrapSurface } from "./bootstrap-surface.js";
import { createCombinedControlRequestHandler } from "./router.js";

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
    startedAt: Date.now() - 5_000
  };
}

function createStubApiSurface(
  requestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>
): Pick<PanelApiSurface, "auth" | "requestHandler"> {
  return {
    auth: {
      login: async () => createAuthLoginResponse(),
      logout: async () => {},
      getCurrentUser: async () => createAuthenticatedUserSummary()
    },
    requestHandler
  };
}

function createStubWebSurface(
  requestListener: (request: IncomingMessage, response: ServerResponse) => Promise<void>
): Pick<PanelWebSurface, "requestListener"> {
  return {
    requestListener
  };
}

function createSplitRequestHandler(args: {
  apiSurface: Pick<PanelApiSurface, "requestHandler">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const apiRequestHandler = createPanelApiHttpHandler(args.apiSurface.requestHandler);

  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      await apiRequestHandler(request, response);
      return;
    }

    await args.webSurface.requestListener(request, response);
  };
}

function createStubBootstrapSurface(args: {
  apiSurface: Pick<PanelApiSurface, "auth" | "requestHandler">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
  context?: ControlProcessContext;
}): ControlBootstrapSurface {
  const context = args.context ?? createTestContext();

  return createControlBootstrapSurface({
    context,
    apiSurface: args.apiSurface,
    webApi: {
      loadAuthenticatedDashboard: async (token: string | null) => {
        if (!token) {
          throw new Error("Session required");
        }

        return {
          session: {
            state: "authenticated",
            token,
            currentUser: createAuthenticatedUserSummary()
          },
          dashboard: {
            currentUser: createAuthenticatedUserSummary(),
            overview: {
              tenants: 0,
              nodes: 0,
              zones: 0,
              apps: 0,
              databases: 0,
              mailDomains: 0,
              backupPolicies: 0,
              backupRuns: 0,
              pendingJobs: 0,
              failedJobs: 0,
              driftedResources: 0
            },
            inventory: { tenants: [], nodes: [], zones: [], apps: [], databases: [], mailDomains: [], mailboxes: [], mailAliases: [], mailQuotas: [] },
            desiredState: { spec: { tenants: [], nodes: [], zones: [], apps: [], databases: [], mail: { domains: [], mailboxes: [], aliases: [], quotas: [] }, backupPolicies: [] } },
            drift: [],
            nodeHealth: [],
            jobHistory: [],
            auditEvents: [],
            backups: { policies: [], latestRuns: [] },
            rustdesk: { relay: null, server: null, listeners: [], nodes: [] },
            mail: { domains: [], mailboxes: [], aliases: [], quotas: [] },
            packages: { nodes: [], packages: [] }
          }
        } as unknown as ControlBootstrapSurface["dashboard"] extends {
          loadAuthenticated(token: string | null): Promise<infer T>;
        }
          ? T
          : never;
      },
      loadDashboardBootstrap: async () => ({
        currentUser: createAuthenticatedUserSummary(),
        overview: {
          tenants: 0,
          nodes: 0,
          zones: 0,
          apps: 0,
          databases: 0,
          mailDomains: 0,
          backupPolicies: 0,
          backupRuns: 0,
          pendingJobs: 0,
          failedJobs: 0,
          driftedResources: 0
        },
        inventory: { tenants: [], nodes: [], zones: [], apps: [], databases: [], mailDomains: [], mailboxes: [], mailAliases: [], mailQuotas: [] },
        desiredState: { spec: { tenants: [], nodes: [], zones: [], apps: [], databases: [], mail: { domains: [], mailboxes: [], aliases: [], quotas: [] }, backupPolicies: [] } },
        drift: [],
        nodeHealth: [],
        jobHistory: [],
        auditEvents: [],
        backups: { policies: [], latestRuns: [] },
        rustdesk: { relay: null, server: null, listeners: [], nodes: [] },
        mail: { domains: [], mailboxes: [], aliases: [], quotas: [] },
        packages: { nodes: [], packages: [] }
      }) as unknown as ControlBootstrapSurface["dashboard"] extends {
        loadBootstrap(token: string): Promise<infer T>;
      }
        ? T
        : never
    },
    webSurface: args.webSurface
  });
}

test("routes /v1/* requests to the API surface", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    surface: createStubBootstrapSurface({
      context: createTestContext(),
      apiSurface: createStubApiSurface(async (_request, response) => {
        apiCalls += 1;
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ source: "api" }));
      }),
      webSurface: createStubWebSurface(async (_request, response) => {
        webCalls += 1;
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("web");
      })
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/v1/meta"
  });

  assert.equal(apiCalls, 1);
  assert.equal(webCalls, 0);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.bodyText), { source: "api" });
});

test("routes non-/v1 requests to the web surface", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    surface: createStubBootstrapSurface({
      context: createTestContext(),
      apiSurface: createStubApiSurface(async (_request, response) => {
        apiCalls += 1;
        response.writeHead(200);
        response.end("api");
      }),
      webSurface: createStubWebSurface(async (_request, response) => {
        webCalls += 1;
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("web");
      })
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/?view=overview"
  });

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 1);
  assert.equal(response.statusCode, 200);
  assert.equal(response.bodyText, "web");
});

test("does not confuse /v11 with /v1", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    surface: createStubBootstrapSurface({
      context: createTestContext(),
      apiSurface: createStubApiSurface(async (_request, response) => {
        apiCalls += 1;
        response.writeHead(200);
        response.end("api");
      }),
      webSurface: createStubWebSurface(async (_request, response) => {
        webCalls += 1;
        response.writeHead(200);
        response.end("web");
      })
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/v11/meta"
  });

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 1);
  assert.equal(response.bodyText, "web");
});

test("serves control health directly without delegating", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const context = createTestContext();
  const handler = createCombinedControlRequestHandler({
    surface: createStubBootstrapSurface({
      context,
      apiSurface: createStubApiSurface(async (_request, response) => {
        apiCalls += 1;
        response.writeHead(200);
        response.end("api");
      }),
      webSurface: createStubWebSurface(async (_request, response) => {
        webCalls += 1;
        response.writeHead(200);
        response.end("web");
      })
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/healthz"
  });
  const payload = JSON.parse(response.bodyText) as {
    status: string;
    version: string;
    service: string;
    timestamp: string;
    uptimeSeconds: number;
    mode: string;
    environment: string;
  };

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 0);
  assert.equal(response.statusCode, 200);
  const expectedHealth = createRuntimeHealthSnapshot({
    config: context.config,
    service: "control",
    startedAt: context.startedAt,
    extra: {
      mode: "combined-candidate"
    }
  });

  assert.equal(payload.service, expectedHealth.service);
  assert.equal(payload.status, expectedHealth.status);
  assert.equal(payload.version, expectedHealth.version);
  assert.equal(payload.environment, expectedHealth.environment);
  assert.equal(payload.mode, expectedHealth.mode);
  assert.equal(payload.uptimeSeconds, expectedHealth.uptimeSeconds);
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("matches split responses for key control routes", async () => {
  const apiSurface = createStubApiSurface(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/v1/meta") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ service: "api", version: "0.1.0-test" }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/auth/me") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(createAuthenticatedUserSummary()));
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/resources/spec") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ spec: { apps: [] } }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
  });
  const webSurface = createStubWebSurface(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>dashboard</body></html>");
      return;
    }

    if (request.method === "GET" && url.pathname === "/login") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>login</body></html>");
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      response.writeHead(303, { location: "/" });
      response.end("");
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      response.writeHead(303, { location: "/login?notice=Signed%20out&kind=success" });
      response.end("");
      return;
    }

    if (request.method === "POST" && url.pathname === "/resources/apps/delete") {
      response.writeHead(303, { location: "/login?notice=Session%20required&kind=error" });
      response.end("");
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
  });

  const context = createTestContext();
  const combined = createCombinedControlRequestHandler({
    surface: createStubBootstrapSurface({
      context,
      apiSurface,
      webSurface
    })
  });
  const split = createSplitRequestHandler({
    apiSurface,
    webSurface
  });

  for (const request of [
    { method: "GET", url: "/" },
    { method: "GET", url: "/login" },
    { method: "GET", url: "/v1/meta" },
    { method: "GET", url: "/v1/auth/me" },
    { method: "GET", url: "/v1/resources/spec" },
    { method: "POST", url: "/auth/login" },
    { method: "POST", url: "/auth/logout" },
    { method: "POST", url: "/resources/apps/delete" }
  ] as const) {
    const [combinedResponse, splitResponse] = await Promise.all([
      invokeRequestHandler(combined, request),
      invokeRequestHandler(split, request)
    ]);

    assert.equal(combinedResponse.statusCode, splitResponse.statusCode);
    assert.equal(combinedResponse.bodyText, splitResponse.bodyText);
    assert.equal(
      combinedResponse.headers["content-type"],
      splitResponse.headers["content-type"]
    );
  }
});
