import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AuthLoginResponse,
  AuthenticatedUserSummary,
  ProxyRenderPayload
} from "@simplehost/panel-contracts";
import {
  createPanelApiHttpHandler,
  writeJson,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
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
import type { ControlCombinedSurface } from "./combined-surface.js";
import { createInProcessPanelWebApi } from "./in-process-web-api.js";
import { createCombinedControlRequestContext } from "./request-context.js";
import { createCombinedControlRequestHandler } from "./request-handler.js";
import { createCombinedControlRouteSurface } from "./route-surface.js";
import { startCombinedControlServer } from "./server.js";

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
      web: { host: "127.0.0.1", port: 0 }
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
}): PanelApiSurface {
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
      case "/v1/apps/adudoc/proxy-preview":
        writeJson(response, 200, {
          serverName: "adudoc.com",
          serverAliases: ["www.adudoc.com"],
          proxyPassUrl: "http://127.0.0.1:10301/",
          vhostName: "adudoc"
        } satisfies ProxyRenderPayload);
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
    controlPlaneStore: {
      close: async () => {}
    } as PanelApiSurface["controlPlaneStore"],
    requestHandler,
    close: async () => {}
  };
}

async function createStubCombinedSurface(): Promise<ControlCombinedSurface> {
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
  const webSurface: PanelWebSurface = createPanelWebSurface(context, webApi);
  const bootstrapSurface = createControlBootstrapSurface({
    context,
    apiSurface,
    webApi,
    webSurface
  });
  const routeSurface = createCombinedControlRouteSurface(bootstrapSurface);
  const createRequestContext = (args: {
    request: IncomingMessage;
    response: ServerResponse;
  }) =>
    createCombinedControlRequestContext({
      request: args.request,
      response: args.response,
      surface: bootstrapSurface
    });

  return {
    context,
    apiSurface,
    bootstrapSurface,
    routeSurface,
    webSurface,
    createRequestContext,
    requestHandler: createCombinedControlRequestHandler({
      surface: {
        createRequestContext,
        routeSurface
      }
    }),
    close: apiSurface.close
  };
}

test("combined candidate serves authenticated flow over a real HTTP server", async () => {
  const surface = await createStubCombinedSurface();
  const runtime = await startCombinedControlServer({
    context: surface.context,
    surface,
    host: "127.0.0.1",
    port: 0
  });

  try {
    const healthResponse = await fetch(new URL("/healthz", runtime.origin));
    assert.equal(healthResponse.status, 200);

    const loginResponse = await fetch(new URL("/auth/login", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual"
    });

    assert.equal(loginResponse.status, 303);
    const setCookie = loginResponse.headers.get("set-cookie");
    assert.ok(setCookie, "login should set a session cookie");
    const cookie = setCookie.split(";", 1)[0];

    const dashboardResponse = await fetch(new URL("/?view=overview", runtime.origin), {
      headers: {
        cookie
      }
    });

    assert.equal(dashboardResponse.status, 200);
    const dashboardHtml = await dashboardResponse.text();
    assert.match(dashboardHtml, /SimpleHostPanel/);

    const vhostResponse = await fetch(
      new URL("/proxy-vhost?slug=adudoc&format=json", runtime.origin),
      {
        headers: {
          cookie
        }
      }
    );

    assert.equal(vhostResponse.status, 200);
    const vhostPayload = await vhostResponse.json() as {
      serverName: string;
      httpVhost: string;
      httpsVhost: string;
    };
    assert.equal(vhostPayload.serverName, "adudoc.com");
    assert.match(vhostPayload.httpVhost, /ServerName adudoc\.com/);
    assert.match(vhostPayload.httpsVhost, /ServerName adudoc\.com/);

    const logoutResponse = await fetch(new URL("/auth/logout", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        cookie
      },
      body: "returnTo=%2Flogin",
      redirect: "manual"
    });

    assert.equal(logoutResponse.status, 303);
    assert.equal(
      logoutResponse.headers.get("location"),
      "/login?notice=Session%20closed&kind=info"
    );
  } finally {
    await runtime.close();
  }
});
