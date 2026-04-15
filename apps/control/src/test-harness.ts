import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AuthLoginResponse,
  AuthenticatedUserSummary,
  JobDispatchResponse,
  ProxyRenderPayload
} from "@simplehost/panel-contracts";
import {
  createPanelApiHttpHandler,
  writeJson,
  type PanelApiSurface
} from "@simplehost/control-api";
import type {
  ControlDashboardBootstrap,
  ControlProcessContext
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
import { startCombinedControlServer, startControlCandidateServer } from "./server.js";
import type { ControlCandidateRuntimeSurface } from "./runtime-surface.js";

export interface StubApiErrorConfig {
  statusCode?: number;
  message: string;
}

export interface ControlTestHarnessOptions {
  webPort?: number;
  loginError?: StubApiErrorConfig;
  currentUserError?: StubApiErrorConfig;
  overviewError?: StubApiErrorConfig;
  packageInstallError?: StubApiErrorConfig;
  proxyPreviewError?: StubApiErrorConfig;
}

function createStubApiError(config: StubApiErrorConfig): Error & { statusCode: number } {
  const error = new Error(config.message) as Error & { statusCode: number };
  error.statusCode = config.statusCode ?? 500;
  return error;
}

function createJob(id: string): JobDispatchResponse["jobs"][number] {
  return {
    id,
    desiredStateVersion: "test-v1",
    kind: "package.install",
    nodeId: "primary",
    createdAt: new Date().toISOString(),
    payload: {
      packageNames: ["htop"]
    }
  };
}

export function createAuthenticatedUserSummary(): AuthenticatedUserSummary {
  return {
    userId: "user-1",
    email: "admin@example.com",
    displayName: "Admin",
    status: "active",
    globalRoles: ["platform_admin"],
    tenantMemberships: []
  };
}

export function createAuthLoginResponse(): AuthLoginResponse {
  return {
    sessionToken: "test-session",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: createAuthenticatedUserSummary()
  };
}

export function createDashboardBootstrap(
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

export function createTestContext(args: {
  webPort?: number;
} = {}): ControlProcessContext & PanelWebProcessContext {
  return {
    config: {
      api: { host: "127.0.0.1", port: 4100 },
      env: "test",
      inventory: { importPath: "/tmp/inventory.yaml" },
      version: "0.1.0-test",
      web: { host: "127.0.0.1", port: args.webPort ?? 3200 }
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

export function createStubApiSurface(args: {
  currentUser: AuthenticatedUserSummary;
  dashboard: ControlDashboardBootstrap;
  loginResponse: AuthLoginResponse;
  loginError?: StubApiErrorConfig;
  currentUserError?: StubApiErrorConfig;
  overviewError?: StubApiErrorConfig;
  packageInstallError?: StubApiErrorConfig;
  proxyPreviewError?: StubApiErrorConfig;
}): Pick<PanelApiSurface, "auth" | "requestHandler"> {
  const isAuthorized = (request: IncomingMessage) =>
    readBearerToken(request.headers.authorization) === args.loginResponse.sessionToken;

  const auth = {
    login: async () => {
      if (args.loginError) {
        throw createStubApiError(args.loginError);
      }

      return args.loginResponse;
    },
    logout: async () => {},
    getCurrentUser: async (token: string | null) => {
      if (args.currentUserError && token === args.loginResponse.sessionToken) {
        throw createStubApiError(args.currentUserError);
      }

      if (token !== args.loginResponse.sessionToken) {
        throw createStubApiError({
          statusCode: 401,
          message: "Unauthorized"
        });
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

    if (url.pathname === "/v1/resources/spec" && request.method === "PUT") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname === "/v1/mail/domains" && request.method === "POST") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname.startsWith("/v1/mail/domains/") && request.method === "DELETE") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname === "/v1/packages/refresh" && request.method === "POST") {
      writeJson(response, 200, { jobs: [createJob("pkg-refresh-1")] });
      return;
    }

    if (url.pathname === "/v1/packages/install" && request.method === "POST") {
      if (args.packageInstallError) {
        writeJson(response, args.packageInstallError.statusCode ?? 500, {
          error: args.packageInstallError.message,
          message: args.packageInstallError.message
        });
        return;
      }

      writeJson(response, 200, { jobs: [createJob("pkg-install-1")] });
      return;
    }

    if (url.pathname === "/v1/reconcile/run" && request.method === "POST") {
      writeJson(response, 200, {
        generatedJobCount: 1,
        skippedJobCount: 0
      });
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
        if (args.overviewError) {
          writeJson(response, args.overviewError.statusCode ?? 500, {
            error: args.overviewError.message,
            message: args.overviewError.message
          });
          return;
        }

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
        if (args.proxyPreviewError) {
          writeJson(response, args.proxyPreviewError.statusCode ?? 500, {
            error: args.proxyPreviewError.message,
            message: args.proxyPreviewError.message
          });
          return;
        }

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
    requestHandler
  };
}

export function createSplitRequestHandler(args: {
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

export async function createControlTestHarness(args: ControlTestHarnessOptions = {}) {
  const context = createTestContext({
    webPort: args.webPort
  });
  const currentUser = createAuthenticatedUserSummary();
  const loginResponse = createAuthLoginResponse();
  const dashboard = createDashboardBootstrap(currentUser);
  const apiSurface = createStubApiSurface({
    currentUser,
    dashboard,
    loginResponse,
    loginError: args.loginError,
    currentUserError: args.currentUserError,
    overviewError: args.overviewError,
    packageInstallError: args.packageInstallError,
    proxyPreviewError: args.proxyPreviewError
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
  const routeSurface = createCombinedControlRouteSurface(bootstrapSurface);
  const createRequestContext = (requestArgs: {
    request: IncomingMessage;
    response: ServerResponse;
  }) =>
    createCombinedControlRequestContext({
      request: requestArgs.request,
      response: requestArgs.response,
      surface: bootstrapSurface
    });
  const combinedSurface: ControlCombinedSurface = {
    context,
    apiSurface: apiSurface as PanelApiSurface,
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
    close: async () => {
      // Stub surfaces do not own external resources.
    }
  };
  const splitSurface: ControlCandidateRuntimeSurface<"split-candidate"> = {
    mode: "split-candidate",
    context,
    requestHandler: createSplitRequestHandler({
      apiSurface,
      webSurface
    }),
    close: async () => {
      // Stub surfaces do not own external resources.
    }
  };

  return {
    context,
    currentUser,
    loginResponse,
    dashboard,
    apiSurface,
    webApi,
    webSurface,
    bootstrapSurface,
    splitSurface,
    combinedSurface,
    split: splitSurface.requestHandler,
    combined: combinedSurface.requestHandler
  };
}

export async function startSplitControlTestRuntime(
  harness: Awaited<ReturnType<typeof createControlTestHarness>>,
  args: {
    host?: string;
    port?: number;
  } = {}
) {
  return startControlCandidateServer({
    context: harness.context,
    surface: harness.splitSurface,
    host: args.host,
    port: args.port
  });
}

export async function startCombinedControlTestRuntime(
  harness: Awaited<ReturnType<typeof createControlTestHarness>>,
  args: {
    host?: string;
    port?: number;
  } = {}
) {
  return startCombinedControlServer({
    context: harness.combinedSurface.context,
    surface: harness.combinedSurface,
    host: args.host,
    port: args.port
  });
}
