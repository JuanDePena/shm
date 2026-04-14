import type { ProxyRenderPayload } from "@simplehost/panel-contracts";
import { createRuntimeHealthSnapshot } from "@simplehost/control-shared";

import { getNoticeFromUrl } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { buildProxyVhostPreview, renderProxyVhostPage } from "./proxy-vhost-preview.js";
import { readSessionToken, writeHtml, writeJson } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import { renderRustDeskConnectPage } from "./rustdesk-connect.js";
import type { WebRouteHandler } from "./web-route-context.js";

export const handleCoreWebRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  locale,
  api,
  config,
  startedAt,
  handleDashboard
}) => {
  if (request.method === "GET" && url.pathname === "/healthz") {
    writeJson(
      response,
      200,
      createRuntimeHealthSnapshot({
        config,
        service: "web",
        startedAt,
        extra: {
          upstreamApi: `${config.api.host}:${config.api.port}`
        }
      })
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return true;
  }

  if (request.method === "GET" && url.pathname === "/connect/rustdesk") {
    writeHtml(
      response,
      200,
      renderRustDeskConnectPage(locale, await api.loadRustDeskPublicConnection(), {
        hasSession: Boolean(readSessionToken(request)),
        notice: getNoticeFromUrl(url)
      })
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/proxy-vhost") {
    const token = await requireSessionToken(request);
    const slug = url.searchParams.get("slug")?.trim() ?? "";
    const payload = await api.request<ProxyRenderPayload>(
      `/v1/apps/${encodeURIComponent(slug)}/proxy-preview`,
      { token }
    );

    if (url.searchParams.get("format") === "json") {
      writeJson(response, 200, buildProxyVhostPreview(payload));
      return true;
    }

    writeHtml(
      response,
      200,
      renderProxyVhostPage({
        backHref: buildDashboardViewUrl("proxies", undefined, slug),
        locale,
        payload
      })
    );
    return true;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/login")) {
    await handleDashboard(request, response);
    return true;
  }

  return false;
};
