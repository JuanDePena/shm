import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AuthLoginResponse,
  AuthenticatedUserSummary
} from "@simplehost/panel-contracts";
import {
  createPanelApiHttpHandler,
  writeJson,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
  invokeRequestHandler,
  type ControlDashboardBootstrap,
  type ControlProcessContext
} from "@simplehost/control-shared";
import {
  createPanelWebSurface,
  type PanelWebApi,
  type PanelWebProcessContext,
  type PanelWebSurface
} from "@simplehost/control-web";

import { createControlBootstrapSurface } from "./bootstrap-surface.js";
import { createInProcessPanelWebApi } from "./in-process-web-api.js";
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

function createDashboardBootstrap(
  currentUser: AuthenticatedUserSummary
): ControlDashboardBootstrap {
  return {
    currentUser,
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
    inventory: {
      tenants: [],
      nodes: [],
      zones: [],
      apps: [],
      databases: [],
      mailDomains: [],
      mailboxes: [],
      mailAliases: [],
      mailQuotas: []
    },
    desiredState: {
      spec: {
        tenants: [],
        nodes: [],
        zones: [],
        apps: [],
        databases: [],
        mail: {
          domains: [],
          mailboxes: [],
          aliases: [],
          quotas: []
        },
        backupPolicies: []
      }
    },
    drift: [],
    nodeHealth: [],
    jobHistory: [],
    auditEvents: [],
    backups: {
      policies: [],
      latestRuns: []
    },
    rustdesk: {
      relay: null,
      server: null,
      listeners: [],
      nodes: []
    },
    mail: {
      domains: [],
      mailboxes: [],
      aliases: [],
      quotas: []
    },
    packages: {
      nodes: [],
      packages: []
    }
  } as unknown as ControlDashboardBootstrap;
}

function createTestContext(): ControlProcessContext & PanelWebProcessContext {
  return {
    config: {
      api: { host: "127.0.0.1", port: 4100 },
      env: "test",
      inventory: { importPath: "/tmp/inventory.yaml" },
      version: "0.1.0-test",
      web: { host: "127.0.0.1", port: 3200 }
    } as ControlProcessContext["config"] & PanelWebProcessContext["config"],
    startedAt: Date.now() - 10_000
  };
}

function readBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== "string") {
    return null;
  }

  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function createStubApiSurface(args: {
  currentUser: AuthenticatedUserSummary;
  dashboard: ControlDashboardBootstrap;
  loginResponse: AuthLoginResponse;
}): Pick<PanelApiSurface, "auth" | "requestHandler"> {
  const isAuthorized = (request: IncomingMessage) =>
    readBearerToken(request.headers.authorization) === args.loginResponse.sessionToken;

  const auth = {
    login: async () => args.loginResponse,
    logout: async () => {},
    getCurrentUser: async (token: string | null) => {
      if (token !== args.loginResponse.sessionToken) {
        const error = new Error("Unauthorized") as Error & { statusCode: number };
        error.statusCode = 401;
        throw error;
      }

      return args.currentUser;
    }
  } satisfies PanelApiSurface["auth"];

  const requestHandler = async (
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/v1/meta") {
      writeJson(response, 200, {
        service: "api",
        version: "0.1.0-test"
      });
      return;
    }

    if (url.pathname === "/v1/auth/login" && request.method === "POST") {
      writeJson(response, 200, args.loginResponse);
      return;
    }

    if (url.pathname === "/v1/auth/logout" && request.method === "POST") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (!isAuthorized(request)) {
      writeJson(response, 401, {
        error: "Unauthorized",
        message: "Unauthorized"
      });
      return;
    }

    switch (url.pathname) {
      case "/v1/auth/me":
        writeJson(response, 200, args.currentUser);
        return;
      case "/v1/operations/overview":
        writeJson(response, 200, args.dashboard.overview);
        return;
      case "/v1/inventory/summary":
        writeJson(response, 200, args.dashboard.inventory);
        return;
      case "/v1/resources/spec":
        writeJson(response, 200, args.dashboard.desiredState);
        return;
      case "/v1/resources/drift":
        writeJson(response, 200, args.dashboard.drift);
        return;
      case "/v1/nodes/health":
        writeJson(response, 200, args.dashboard.nodeHealth);
        return;
      case "/v1/jobs/history":
        writeJson(response, 200, args.dashboard.jobHistory);
        return;
      case "/v1/audit/events":
        writeJson(response, 200, args.dashboard.auditEvents);
        return;
      case "/v1/backups/summary":
        writeJson(response, 200, args.dashboard.backups);
        return;
      case "/v1/platform/rustdesk":
        writeJson(response, 200, args.dashboard.rustdesk);
        return;
      case "/v1/mail/overview":
        writeJson(response, 200, args.dashboard.mail);
        return;
      case "/v1/packages/summary":
        writeJson(response, 200, args.dashboard.packages);
        return;
      default:
        writeJson(response, 404, {
          error: "Not Found",
          path: url.pathname
        });
    }
  };

  return {
    auth,
    requestHandler
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

function createSmokeHarness() {
  const context = createTestContext();
  const currentUser = createAuthenticatedUserSummary();
  const loginResponse = createAuthLoginResponse();
  const dashboard = createDashboardBootstrap(currentUser);
  const apiSurface = createStubApiSurface({
    currentUser,
    dashboard,
    loginResponse
  });
  const apiHttpHandler = createPanelApiHttpHandler(apiSurface.requestHandler);
  const webApi: PanelWebApi = createInProcessPanelWebApi(apiHttpHandler, apiSurface.auth);
  const webSurface = createPanelWebSurface(context, webApi);
  const bootstrapSurface = createControlBootstrapSurface({
    context,
    apiSurface,
    webApi,
    webSurface
  });

  return {
    split: createSplitRequestHandler({
      apiSurface,
      webSurface
    }),
    combined: createCombinedControlRequestHandler({
      surface: bootstrapSurface
    })
  };
}

function pickComparableHeaders(headers: Record<string, string | string[] | undefined>) {
  return {
    "content-type": headers["content-type"],
    location: headers.location,
    "set-cookie": headers["set-cookie"]
  };
}

test("combined candidate matches split behavior with real web/api surfaces", async () => {
  const harness = createSmokeHarness();
  const requests = [
    {
      method: "GET",
      url: "/login"
    },
    {
      method: "GET",
      url: "/?view=overview"
    },
    {
      method: "GET",
      url: "/?view=overview",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "POST",
      url: "/auth/login",
      body: "email=admin%40example.com&password=good-pass",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "POST",
      url: "/resources/apps/delete",
      body: "slug=adudoc",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: "Bearer test-session"
      }
    },
    {
      method: "GET",
      url: "/v1/resources/spec",
      headers: {
        authorization: "Bearer test-session"
      }
    }
  ] as const;

  for (const request of requests) {
    const [splitResponse, combinedResponse] = await Promise.all([
      invokeRequestHandler(harness.split, request),
      invokeRequestHandler(harness.combined, request)
    ]);

    assert.equal(
      combinedResponse.statusCode,
      splitResponse.statusCode,
      `status mismatch for ${request.method} ${request.url}`
    );
    assert.deepEqual(
      pickComparableHeaders(combinedResponse.headers),
      pickComparableHeaders(splitResponse.headers),
      `header mismatch for ${request.method} ${request.url}`
    );
    assert.equal(
      combinedResponse.bodyText,
      splitResponse.bodyText,
      `body mismatch for ${request.method} ${request.url}`
    );
  }
});
