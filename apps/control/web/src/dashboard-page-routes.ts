import { type IncomingMessage, type ServerResponse } from "node:http";

import { type PanelNotice } from "@simplehost/panel-ui";

import {
  getNoticeFromUrl,
  type PanelWebApi,
  WebApiError
} from "./api-client.js";
import {
  buildDashboardViewUrl,
  normalizeDashboardFocus,
  normalizeDashboardView,
  normalizeDesiredStateTab,
  resolveCanonicalDashboardTarget
} from "./dashboard-routing.js";
import { renderDashboardPage } from "./dashboard-page.js";
import {
  clearSessionCookie,
  readLocale,
  readSessionToken,
  redirect,
  sanitizeReturnTo,
  type WebLocale,
  writeHtml
} from "./request.js";

export function createDashboardHandler(args: {
  api: PanelWebApi;
  defaultImportPath: string;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  version: string;
}) {
  return async function handleDashboard(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const token = readSessionToken(request);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const locale = readLocale(request);
    const view = normalizeDashboardView(url.searchParams.get("view"));
    const rawTab = url.searchParams.get("tab") ?? undefined;
    const desiredStateTab = normalizeDesiredStateTab(rawTab);
    const focus = normalizeDashboardFocus(url.searchParams.get("focus"));

    if (!token) {
      writeHtml(response, 200, args.renderLoginPage(locale, getNoticeFromUrl(url)));
      return;
    }

    const canonicalTarget = resolveCanonicalDashboardTarget(view, rawTab);
    const extraFilters = Object.fromEntries(
      Array.from(url.searchParams.entries()).filter(
        ([key]) => key !== "view" && key !== "tab" && key !== "focus"
      )
    );
    const canonicalLocation = buildDashboardViewUrl(
      canonicalTarget.view,
      canonicalTarget.tab,
      focus,
      extraFilters
    );
    const currentLocation = sanitizeReturnTo(`${url.pathname}${url.search}`);

    if (canonicalLocation !== currentLocation) {
      redirect(response, canonicalLocation);
      return;
    }

    try {
      const data = await args.api.loadDashboardData(token);
      writeHtml(
        response,
        200,
        renderDashboardPage({
          currentPath: sanitizeReturnTo(`${url.pathname}${url.search}`),
          data,
          defaultImportPath: args.defaultImportPath,
          desiredStateTab,
          focus,
          locale,
          notice: getNoticeFromUrl(url),
          version: args.version,
          view
        })
      );
    } catch (error) {
      if (error instanceof WebApiError && error.statusCode === 401) {
        redirect(response, "/login", clearSessionCookie());
        return;
      }

      writeHtml(
        response,
        500,
        args.renderLoginPage(locale, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  };
}
