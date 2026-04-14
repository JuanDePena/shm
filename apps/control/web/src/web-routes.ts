import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  type AppReconcileRequest,
  type AuthLoginRequest,
  type AuthLoginResponse,
  type CodeServerUpdateRequest,
  type DatabaseReconcileRequest,
  type InventoryImportSummary,
  type JobDispatchResponse,
  type PackageInstallRequest,
  type PackageInventoryRefreshRequest,
  type ProxyRenderPayload
} from "@simplehost/panel-contracts";
import { type PanelNotice } from "@simplehost/panel-ui";

import {
  getNoticeFromUrl,
  noticeLocation,
  noticeReturnTo,
  type PanelWebApi,
  WebApiError
} from "./api-client.js";
import { handleDesiredStateResourceRoute } from "./desired-state-resource-routes.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { handleMailRoute } from "./mail-routes.js";
import { buildProxyVhostPreview, renderProxyVhostPage } from "./proxy-vhost-preview.js";
import {
  clearSessionCookie,
  normalizeLocale,
  readFormBody,
  readLocale,
  readSessionToken,
  redirect,
  sanitizeReturnTo,
  serializeLocaleCookie,
  serializeSessionCookie,
  type WebLocale,
  writeHtml,
  writeJson
} from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import { renderRustDeskConnectPage } from "./rustdesk-connect.js";

export interface PanelWebRuntimeConfig {
  api: {
    host: string;
    port: number;
  };
  env: string;
  inventory: {
    importPath: string;
  };
  version: string;
  web: {
    host: string;
    port: number;
  };
}

export interface StartPanelWebServerArgs {
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  handleDashboard: (
    request: IncomingMessage,
    response: ServerResponse
  ) => Promise<void>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  startedAt: number;
}

export function createRequestHandler(args: StartPanelWebServerArgs) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const locale = readLocale(request);

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(response, 200, {
        service: "web",
        status: "ok",
        version: args.config.version,
        environment: args.config.env,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round((Date.now() - args.startedAt) / 1000),
        upstreamApi: `${args.config.api.host}:${args.config.api.port}`
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/connect/rustdesk") {
      writeHtml(
        response,
        200,
        renderRustDeskConnectPage(locale, await args.api.loadRustDeskPublicConnection(), {
          hasSession: Boolean(readSessionToken(request)),
          notice: getNoticeFromUrl(url)
        })
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/proxy-vhost") {
      const token = await requireSessionToken(request);
      const slug = url.searchParams.get("slug")?.trim() ?? "";
      const payload = await args.api.request<ProxyRenderPayload>(
        `/v1/apps/${encodeURIComponent(slug)}/proxy-preview`,
        { token }
      );
      if (url.searchParams.get("format") === "json") {
        writeJson(response, 200, buildProxyVhostPreview(payload));
        return;
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
      return;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/login")) {
      await args.handleDashboard(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/preferences/locale") {
      const form = await readFormBody(request);
      redirect(
        response,
        sanitizeReturnTo(form.get("returnTo")),
        serializeLocaleCookie(normalizeLocale(form.get("locale")))
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      const form = await readFormBody(request);

      try {
        const login = await args.api.request<AuthLoginResponse>("/v1/auth/login", {
          method: "POST",
          body: {
            email: form.get("email")?.trim() ?? "",
            password: form.get("password")?.trim() ?? ""
          } satisfies AuthLoginRequest
        });

        redirect(
          response,
          "/",
          serializeSessionCookie(login.sessionToken, login.expiresAt)
        );
      } catch (error) {
        writeHtml(
          response,
          error instanceof WebApiError ? error.statusCode : 500,
          args.renderLoginPage(locale, {
            kind: "error",
            message: error instanceof Error ? error.message : String(error)
          })
        );
      }

      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      const token = readSessionToken(request);

      if (token) {
        try {
          await args.api.request("/v1/auth/logout", {
            method: "POST",
            token
          });
        } catch {
          // Ignore logout errors and clear the local cookie anyway.
        }
      }

      redirect(response, "/login?notice=Session%20closed&kind=info", clearSessionCookie());
      return;
    }

    if (request.method === "GET" && url.pathname === "/inventory/export") {
      const token = await requireSessionToken(request);
      const yaml = await args.api.request<string>("/v1/inventory/export", {
        token,
        responseType: "text"
      });
      response.writeHead(200, {
        "content-type": "text/yaml; charset=utf-8",
        "content-disposition": 'attachment; filename="simplehost-desired-state.yaml"'
      });
      response.end(yaml);
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/inventory-import") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const pathValue = form.get("path")?.trim() || args.config.inventory.importPath;
      const result = await args.api.request<InventoryImportSummary>("/v1/inventory/import", {
        method: "POST",
        token,
        body: {
          path: pathValue
        }
      });
      redirect(
        response,
        noticeLocation(
          `Imported inventory from ${result.sourcePath}. ${result.appCount} apps and ${result.databaseCount} databases refreshed.`,
          "success"
        )
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/reconcile-run") {
      const token = await requireSessionToken(request);
      const result = await args.api.request<{ generatedJobCount: number; skippedJobCount: number }>(
        "/v1/reconcile/run",
        {
          method: "POST",
          token
        }
      );
      redirect(
        response,
        noticeLocation(
          `Reconciliation generated ${result.generatedJobCount} job(s) and skipped ${result.skippedJobCount}.`,
          "success"
        )
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/zone-sync") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const zoneName = form.get("zoneName")?.trim() ?? "";
      const result = await args.api.request<JobDispatchResponse>(
        `/v1/zones/${encodeURIComponent(zoneName)}/sync`,
        {
          method: "POST",
          token
        }
      );
      redirect(
        response,
        noticeLocation(`Queued ${result.jobs.length} dns.sync job(s) for ${zoneName}.`, "success")
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/app-reconcile") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const slug = form.get("slug")?.trim() ?? "";
      const requestBody: AppReconcileRequest = {
        includeContainer: true,
        includeDns: true,
        includeProxy: true,
        includeStandbyProxy: true
      };
      const result = await args.api.request<JobDispatchResponse>(
        `/v1/apps/${encodeURIComponent(slug)}/reconcile`,
        {
          method: "POST",
          token,
          body: requestBody
        }
      );
      redirect(
        response,
        noticeLocation(`Queued ${result.jobs.length} job(s) for app ${slug}.`, "success")
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/app-render-proxy") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const slug = form.get("slug")?.trim() ?? "";
      const result = await args.api.request<JobDispatchResponse>(
        `/v1/apps/${encodeURIComponent(slug)}/render-proxy`,
        {
          method: "POST",
          token
        }
      );
      redirect(
        response,
        noticeLocation(`Queued ${result.jobs.length} proxy.render job(s) for ${slug}.`, "success")
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/database-reconcile") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const appSlug = form.get("appSlug")?.trim() ?? "";
      const password = form.get("desiredPassword")?.trim();
      const requestBody: DatabaseReconcileRequest = {};

      if (password) {
        requestBody.password = password;
      }

      const result = await args.api.request<JobDispatchResponse>(
        `/v1/databases/${encodeURIComponent(appSlug)}/reconcile`,
        {
          method: "POST",
          token,
          body: requestBody
        }
      );
      redirect(
        response,
        noticeLocation(
          `Queued ${result.jobs.length} database reconcile job(s) for ${appSlug}.`,
          "success"
        )
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/code-server-update") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const rpmUrl = form.get("rpmUrl")?.trim() ?? "";
      const expectedSha256 = form.get("expectedSha256")?.trim() || undefined;
      const targetScope = form.get("targetScope")?.trim() ?? "";
      const returnTo = form.get("returnTo") ?? "/";
      const requestBody: CodeServerUpdateRequest = {
        rpmUrl,
        expectedSha256
      };

      if (targetScope && targetScope !== "__all__") {
        requestBody.nodeIds = [targetScope];
      }

      const result = await args.api.request<JobDispatchResponse>("/v1/code-server/update", {
        method: "POST",
        token,
        body: requestBody
      });

      redirect(
        response,
        noticeReturnTo(
          returnTo,
          `Queued ${result.jobs.length} code-server update job(s).`,
          "success"
        )
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/package-inventory-refresh") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const returnTo = form.get("returnTo") ?? "/";
      const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
      const requestBody: PackageInventoryRefreshRequest = {
        nodeIds: nodeIds.length > 0 ? nodeIds : undefined
      };

      const result = await args.api.request<JobDispatchResponse>("/v1/packages/refresh", {
        method: "POST",
        token,
        body: requestBody
      });

      redirect(
        response,
        noticeReturnTo(
          returnTo,
          `Queued ${result.jobs.length} package inventory refresh job(s).`,
          "success"
        )
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions/package-install") {
      const token = await requireSessionToken(request);
      const form = await readFormBody(request);
      const returnTo = form.get("returnTo") ?? "/";
      const nodeIds = form.getAll("nodeIds").map((value) => value.trim()).filter(Boolean);
      const packageNames = (form.get("packageNames")?.trim() ?? "")
        .split(/[,\s]+/g)
        .map((value) => value.trim())
        .filter(Boolean);
      const rpmUrl = form.get("rpmUrl")?.trim() || undefined;
      const expectedSha256 = form.get("expectedSha256")?.trim() || undefined;
      const allowReinstall = (form.get("allowReinstall")?.trim() ?? "") === "on";
      const requestBody: PackageInstallRequest = {
        nodeIds: nodeIds.length > 0 ? nodeIds : undefined,
        packageNames: packageNames.length > 0 ? packageNames : undefined,
        rpmUrl,
        expectedSha256,
        allowReinstall
      };

      const result = await args.api.request<JobDispatchResponse>("/v1/packages/install", {
        method: "POST",
        token,
        body: requestBody
      });

      redirect(
        response,
        noticeReturnTo(
          returnTo,
          `Queued ${result.jobs.length} package install job(s).`,
          "success"
        )
      );
      return;
    }

    if (await handleDesiredStateResourceRoute(args.api, request, response, url)) {
      return;
    }

    if (await handleMailRoute(args.api, request, response, url)) {
      return;
    }

    writeJson(response, 404, {
      error: "Not Found",
      method: request.method ?? "GET",
      path: url.pathname
    });
  };
}

export function createServerRequestListener(
  args: StartPanelWebServerArgs
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const requestHandler = createRequestHandler(args);

  return async (request, response) => {
    try {
      await requestHandler(request, response);
    } catch (error: unknown) {
      const locale = readLocale(request);

      if (error instanceof WebApiError && error.statusCode === 401) {
        redirect(response, "/login?notice=Session%20required&kind=error", clearSessionCookie());
        return;
      }

      writeHtml(
        response,
        error instanceof WebApiError ? error.statusCode : 500,
        args.renderLoginPage(locale, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  };
}

export function startPanelWebServer(
  args: StartPanelWebServerArgs
): ReturnType<typeof createServer> {
  const server = createServer(createServerRequestListener(args));

  server.listen(args.config.web.port, args.config.web.host, () => {
    console.log(`SHP Web listening on http://${args.config.web.host}:${args.config.web.port}`);
  });

  return server;
}
