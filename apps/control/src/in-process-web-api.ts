import type { IncomingMessage, ServerResponse } from "node:http";

import {
  invokeRequestHandler,
  type InvokedHttpResponse
} from "@simplehost/control-shared";
import {
  createPanelWebApiFromRequest,
  type PanelWebApi,
  type PanelWebApiRequestOptions,
  WebApiError
} from "@simplehost/control-web";

function parseWebApiError(response: InvokedHttpResponse): never {
  let message = response.bodyText || `Request failed with status ${response.statusCode}`;

  try {
    const parsed = JSON.parse(response.bodyText) as Record<string, unknown>;
    message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : message;
  } catch {
    // Keep plain-text fallback.
  }

  throw new WebApiError(response.statusCode, message);
}

export function createInProcessPanelWebApi(
  requestHandler: (
    request: IncomingMessage,
    response: ServerResponse
  ) => Promise<void> | void
): PanelWebApi {
  return createPanelWebApiFromRequest(async <T>(
    pathname: string,
    options: PanelWebApiRequestOptions = {}
  ): Promise<T> => {
    const response = await invokeRequestHandler(requestHandler, {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined
          ? { "content-type": "application/json; charset=utf-8" }
          : {})
      },
      method: options.method ?? "GET",
      url: pathname
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      parseWebApiError(response);
    }

    if ((options.responseType ?? "json") === "text") {
      return response.bodyText as T;
    }

    return (response.bodyText ? JSON.parse(response.bodyText) : null) as T;
  });
}
