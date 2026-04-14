import {
  type AuthLoginRequest,
  type AuthLoginResponse
} from "@simplehost/panel-contracts";

import { WebApiError } from "./api-client.js";
import {
  clearSessionCookie,
  normalizeLocale,
  readFormBody,
  redirect,
  sanitizeReturnTo,
  serializeLocaleCookie,
  serializeSessionCookie,
  writeHtml
} from "./request.js";
import type { WebRouteHandler } from "./web-route-context.js";

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
      const login = await api.request<AuthLoginResponse>("/v1/auth/login", {
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
        renderLoginPage(locale, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    if (sessionToken) {
      try {
        await api.request("/v1/auth/logout", {
          method: "POST",
          token: sessionToken
        });
      } catch {
        // Ignore logout errors and clear the local cookie anyway.
      }
    }

    redirect(response, "/login?notice=Session%20closed&kind=info", clearSessionCookie());
    return true;
  }

  return false;
};
