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
  redirect,
  sanitizeReturnTo,
  type WebLocale,
  writeHtml
} from "./request.js";
import { redirectToLogin, renderLoginError } from "./web-auth-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";

export function createDashboardHandler(args: {
  api: PanelWebApi;
  defaultImportPath: string;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  version: string;
}): WebRouteHandler {
  return async function handleDashboard({
    request,
    response,
    url,
    locale,
    sessionToken
  }): Promise<boolean> {
    const view = normalizeDashboardView(url.searchParams.get("view"));
    const rawTab = url.searchParams.get("tab") ?? undefined;
    const desiredStateTab = normalizeDesiredStateTab(rawTab);
    const focus = normalizeDashboardFocus(url.searchParams.get("focus"));

    if (!sessionToken) {
      writeHtml(response, 200, args.renderLoginPage(locale, getNoticeFromUrl(url)));
      return true;
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
      return true;
    }

    try {
      const data = await args.api.loadDashboardData(sessionToken);
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
      return true;
    } catch (error) {
      if (error instanceof WebApiError && error.statusCode === 401) {
        redirectToLogin(response, "Session required");
        return true;
      }

      renderLoginError(response, locale, args.renderLoginPage, error);
      return true;
    }
  };
}
