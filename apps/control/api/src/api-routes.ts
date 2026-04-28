import type { IncomingMessage, ServerResponse } from "node:http";

import { type ControlRuntimeConfig } from "@simplehost/control-config";
import { createRuntimeHealthSnapshot } from "@simplehost/control-shared";
import { createControlApiMetadata } from "@simplehost/control-contracts";
import {
  createControlDatabaseHealthSummary,
  type ControlPlaneStore
} from "@simplehost/control-database";

import { handleAuthRoutes } from "./api-auth-routes.js";
import { readBearerToken, writeJson } from "./api-http.js";
import { handleMailRoutes } from "./api-mail-routes.js";
import { handleNodeAgentRoutes } from "./api-node-agent-routes.js";
import { handleOperationsRoutes } from "./api-operations-routes.js";
import { type ApiRouteContext } from "./api-route-context.js";
import { handleResourceRoutes } from "./api-resource-routes.js";

const rootEndpoints = [
  "GET /healthz",
  "GET /v1/meta",
  "POST /v1/auth/login",
  "GET /v1/auth/me",
  "POST /v1/auth/logout",
  "GET /v1/users",
  "POST /v1/users",
  "GET /v1/inventory/summary",
  "POST /v1/inventory/import",
  "GET /v1/inventory/export",
  "GET /v1/resources/spec",
  "PUT /v1/resources/spec",
  "GET /v1/resources/drift",
  "POST /v1/reconcile/run",
  "GET /v1/operations/overview",
  "GET /v1/nodes/health",
  "GET /v1/platform/rustdesk",
  "GET /v1/mail/overview",
  "POST /v1/mail/domains",
  "DELETE /v1/mail/domains/:domain",
  "POST /v1/mail/mailboxes",
  "DELETE /v1/mail/mailboxes/:address",
  "POST /v1/mail/aliases",
  "DELETE /v1/mail/aliases/:address",
  "POST /v1/mail/quotas",
  "DELETE /v1/mail/quotas/:mailboxAddress",
  "GET /v1/public/rustdesk",
  "GET /v1/jobs/history",
  "GET /v1/audit/events",
  "GET /v1/backups/summary",
  "GET /v1/packages/summary",
  "POST /v1/backups/runs",
  "POST /v1/packages/refresh",
  "POST /v1/packages/install",
  "POST /v1/firewall/apply",
  "POST /v1/fail2ban/apply",
  "GET /v1/control-plane/state",
  "POST /v1/code-server/update",
  "POST /v1/zones/:zone/sync",
  "GET /v1/apps/:slug/proxy-preview",
  "POST /v1/apps/:slug/render-proxy",
  "POST /v1/apps/:slug/reconcile",
  "POST /v1/databases/:slug/reconcile",
  "POST /v1/nodes/register",
  "POST /v1/jobs/claim",
  "POST /v1/jobs/report"
];

interface CreateApiRequestHandlerOptions {
  config: ControlRuntimeConfig;
  startedAt: number;
  controlPlaneStore: ControlPlaneStore;
}

export function createApiRequestHandler({
  config,
  startedAt,
  controlPlaneStore
}: CreateApiRequestHandlerOptions): (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void> {
  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const context: ApiRouteContext = {
      request,
      response,
      url,
      bearerToken: readBearerToken(request),
      controlPlaneStore,
      config,
      startedAt
    };

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(
        response,
        200,
        createRuntimeHealthSnapshot({
          config,
          service: "api",
          startedAt
        })
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/meta") {
      const stateSnapshot = await controlPlaneStore.getStateSnapshot();

      writeJson(response, 200, {
        metadata: createControlApiMetadata("api", config.version),
        database: createControlDatabaseHealthSummary(config.database.url),
        controlPlane: {
          registeredNodes: stateSnapshot.nodes.length
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/control-plane/state") {
      await controlPlaneStore.getCurrentUser(context.bearerToken);
      writeJson(response, 200, await controlPlaneStore.getStateSnapshot());
      return;
    }

    for (const handler of [
      handleAuthRoutes,
      handleResourceRoutes,
      handleMailRoutes,
      handleOperationsRoutes,
      handleNodeAgentRoutes
    ]) {
      if (await handler(context)) {
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/") {
      writeJson(response, 200, {
        message: "SimpleHost API bootstrap is running.",
        endpoints: rootEndpoints
      });
      return;
    }

    writeJson(response, 404, {
      error: "Not Found",
      method: request.method ?? "GET",
      path: url.pathname
    });
  };
}
