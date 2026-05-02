import { type PanelNotice } from "@simplehost/ui";
import {
  ControlSessionRequiredError,
  isUnauthorizedError
} from "@simplehost/control-shared";

import {
  getNoticeFromUrl,
  type ControlWebApi
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
import type { OverviewMetricsCollector } from "./overview-metrics.js";

export function createDashboardHandler(args: {
  api: ControlWebApi;
  overviewMetrics: OverviewMetricsCollector;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  version: string;
}): WebRouteHandler {
  return async function handleDashboard({
    request,
    response,
    url,
    locale,
    resolveSession,
    loadAuthenticatedDashboard
  }): Promise<boolean> {
    const view = normalizeDashboardView(url.searchParams.get("view"));
    const rawTab = url.searchParams.get("tab") ?? undefined;
    const desiredStateTab = normalizeDesiredStateTab(rawTab);
    const focus = normalizeDashboardFocus(url.searchParams.get("focus"));
    const mailCredentialRevealId = url.searchParams.get("mailCredentialReveal");

    const session = await resolveSession();

    if (session.state === "anonymous") {
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
      const { dashboard } = await loadAuthenticatedDashboard({
        jobHistoryMode: view === "jobs" || view === "job-history" ? "full" : "compact"
      });
      const historyReplaceUrl = (() => {
        if (!mailCredentialRevealId) {
          return undefined;
        }

        const nextUrl = new URL(`${url.pathname}${url.search}`, "http://localhost");
        nextUrl.searchParams.delete("mailCredentialReveal");
        return sanitizeReturnTo(`${nextUrl.pathname}${nextUrl.search}`);
      })();
      const mailCredentialReveal =
        mailCredentialRevealId && session.token
          ? await args.api.consumeMailboxCredentialReveal(session.token, mailCredentialRevealId)
          : null;
      writeHtml(
        response,
        200,
        renderDashboardPage({
          currentPath: sanitizeReturnTo(`${url.pathname}${url.search}`),
          data: dashboard,
          desiredStateTab,
          focus,
          historyReplaceUrl,
          locale,
          mailCredentialReveal,
          notice: getNoticeFromUrl(url),
          overviewMetrics: args.overviewMetrics.getSnapshot(),
          version: args.version,
          view
        })
      );
      return true;
    } catch (error) {
      if (error instanceof ControlSessionRequiredError || isUnauthorizedError(error)) {
        redirectToLogin(response, "Session required");
        return true;
      }

      renderLoginError(response, locale, args.renderLoginPage, error);
      return true;
    }
  };
}
