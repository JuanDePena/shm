import type { EnvironmentParameterMutationRequest } from "@simplehost/control-contracts";

import {
  matchRoute,
  readJsonBody,
  writeJson
} from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

export const handleParameterRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "GET" && url.pathname === "/v1/parameters") {
    writeJson(
      response,
      200,
      await controlPlaneStore.listEnvironmentParameters(bearerToken)
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/parameters") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertEnvironmentParameter(
        await readJsonBody<EnvironmentParameterMutationRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const parameterMatch = matchRoute(url.pathname, /^\/v1\/parameters\/([^/]+)$/);

  if (request.method === "PUT" && parameterMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertEnvironmentParameter(
        {
          ...(await readJsonBody<Omit<EnvironmentParameterMutationRequest, "key">>(request)),
          key: decodeURIComponent(parameterMatch[1] ?? "")
        },
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "DELETE" && parameterMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteEnvironmentParameter(
        decodeURIComponent(parameterMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
