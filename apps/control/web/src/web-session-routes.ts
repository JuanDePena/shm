import {
  type AuthLoginRequest
} from "@simplehost/control-contracts";

import {
  clearSessionCookie,
  normalizeLocale,
  readFormBody,
  redirect,
  sanitizeReturnTo,
  serializeLocaleCookie,
  serializeSessionCookie
} from "./request.js";
import { renderLoginError } from "./web-auth-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim() ?? null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isAuthentikSsoRequest(headers: Record<string, string | string[] | undefined>): boolean {
  return Boolean(
    readHeader(headers, "x-authentik-email") ??
      readHeader(headers, "x-authentik-username") ??
      readHeader(headers, "x-authentik-meta-provider") ??
      readHeader(headers, "x-authentik-meta-outpost")
  );
}

function buildAuthentikOutpostSignOutLocation(): string {
  return `/outpost.goauthentik.io/sign_out?rd=${encodeURIComponent("/login")}`;
}

export const handleSessionWebRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  locale,
  api,
  renderLoginPage,
  sessionToken
}) => {
  if (request.method === "POST" && url.pathname === "/preferences/locale") {
    const form = await readFormBody(request);
    redirect(
      response,
      sanitizeReturnTo(form.get("returnTo")),
      serializeLocaleCookie(normalizeLocale(form.get("locale")))
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/auth/login") {
    const form = await readFormBody(request);

    try {
      const login = await api.login({
          email: form.get("email")?.trim() ?? "",
          password: form.get("password")?.trim() ?? ""
        } satisfies AuthLoginRequest);

      redirect(
        response,
        "/",
        serializeSessionCookie(login.sessionToken, login.expiresAt)
      );
    } catch (error) {
      renderLoginError(response, locale, renderLoginPage, error);
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    if (sessionToken) {
      try {
        await api.logout(sessionToken);
      } catch {
        // Ignore logout errors and clear the local cookie anyway.
      }
    }

    redirect(
      response,
      isAuthentikSsoRequest(request.headers)
        ? buildAuthentikOutpostSignOutLocation()
        : "/login?notice=Session%20closed&kind=info",
      clearSessionCookie()
    );
    return true;
  }

  return false;
};
