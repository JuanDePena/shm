import type { ServerResponse } from "node:http";

import type { PanelNotice } from "@simplehost/panel-ui";
import { isUnauthorizedError } from "@simplehost/control-shared";

import { WebApiError } from "./api-client.js";
import {
  clearSessionCookie,
  redirect,
  type WebLocale,
  writeHtml
} from "./request.js";

export function buildLoginLocation(
  message: string,
  kind: PanelNotice["kind"] = "error"
): string {
  const notice = encodeURIComponent(message);
  return `/login?notice=${notice}&kind=${encodeURIComponent(kind)}`;
}

export function redirectToLogin(
  response: ServerResponse,
  message = "Session required",
  kind: PanelNotice["kind"] = "error"
): void {
  redirect(response, buildLoginLocation(message, kind), clearSessionCookie());
}

export function renderLoginError(
  response: ServerResponse,
  locale: WebLocale,
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string,
  error: unknown
): void {
  const statusCode =
    isUnauthorizedError(error) || error instanceof WebApiError
      ? error.statusCode
      : 500;

  writeHtml(
    response,
    statusCode,
    renderLoginPage(locale, {
      kind: "error",
      message: error instanceof Error ? error.message : String(error)
    })
  );
}
