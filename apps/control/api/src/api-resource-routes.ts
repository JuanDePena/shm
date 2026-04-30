import type {
  AppReconcileRequest,
  DatabaseReconcileRequest,
  DesiredStateApplyRequest,
  InventoryImportRequest
} from "@simplehost/control-contracts";

import {
  matchRoute,
  readJsonBody,
  writeJson,
  writeText
} from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

export const handleResourceRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "GET" && url.pathname === "/v1/inventory/summary") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getInventorySnapshot(bearerToken)
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/inventory/import") {
    writeJson(
      response,
      200,
      await controlPlaneStore.importInventory(
        await readJsonBody<InventoryImportRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/inventory/export") {
    const exported = await controlPlaneStore.exportDesiredState(bearerToken);
    writeText(response, 200, exported.yaml, "text/yaml; charset=utf-8");
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/resources/spec") {
    writeJson(
      response,
      200,
      await controlPlaneStore.exportDesiredState(bearerToken)
    );
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/resources/spec") {
    writeJson(
      response,
      200,
      await controlPlaneStore.applyDesiredState(
        await readJsonBody<DesiredStateApplyRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/reconcile/run") {
    writeJson(
      response,
      200,
      await controlPlaneStore.runReconciliationCycle(bearerToken)
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/operations/overview") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getOperationsOverview(bearerToken)
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/operations/history/purge") {
    writeJson(
      response,
      200,
      await controlPlaneStore.purgeOperationalHistory(bearerToken)
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/resources/drift") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getResourceDrift(bearerToken)
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/nodes/health") {
    writeJson(response, 200, await controlPlaneStore.getNodeHealth(bearerToken));
    return true;
  }

  const zoneSyncMatch = matchRoute(url.pathname, /^\/v1\/zones\/([^/]+)\/sync$/);

  if (request.method === "POST" && zoneSyncMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchZoneSync(
        decodeURIComponent(zoneSyncMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  const renderProxyMatch = matchRoute(url.pathname, /^\/v1\/apps\/([^/]+)\/render-proxy$/);

  const proxyPreviewMatch = matchRoute(url.pathname, /^\/v1\/apps\/([^/]+)\/proxy-preview$/);

  if (request.method === "GET" && proxyPreviewMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.getAppProxyPayload(
        decodeURIComponent(proxyPreviewMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && renderProxyMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchAppReconcile(
        decodeURIComponent(renderProxyMatch[1] ?? ""),
        {
          includeContainer: false,
          includeDns: false,
          includeProxy: true
        },
        bearerToken
      )
    );
    return true;
  }

  const appReconcileMatch = matchRoute(url.pathname, /^\/v1\/apps\/([^/]+)\/reconcile$/);

  if (request.method === "POST" && appReconcileMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchAppReconcile(
        decodeURIComponent(appReconcileMatch[1] ?? ""),
        await readJsonBody<AppReconcileRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const databaseReconcileMatch = matchRoute(
    url.pathname,
    /^\/v1\/databases\/([^/]+)\/reconcile$/
  );

  if (request.method === "POST" && databaseReconcileMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.dispatchDatabaseReconcile(
        decodeURIComponent(databaseReconcileMatch[1] ?? ""),
        await readJsonBody<DatabaseReconcileRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
