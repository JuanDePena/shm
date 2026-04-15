import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createPanelApiHttpHandler,
  type PanelApiSurface
} from "@simplehost/control-api";
import {
  invokeRequestHandler,
  type ControlProcessContext
} from "@simplehost/control-shared";
import type { PanelWebSurface } from "@simplehost/control-web";

import { createCombinedControlRequestHandler } from "./router.js";

function createTestContext(): ControlProcessContext {
  return {
    config: {
      env: "test",
      version: "0.1.0-test"
    } as ControlProcessContext["config"],
    startedAt: Date.now() - 5_000
  };
}

function createStubApiSurface(
  requestHandler: (request: IncomingMessage, response: ServerResponse) => Promise<void>
): Pick<PanelApiSurface, "requestHandler"> {
  return {
    requestHandler
  };
}

function createStubWebSurface(
  requestListener: (request: IncomingMessage, response: ServerResponse) => Promise<void>
): Pick<PanelWebSurface, "requestListener"> {
  return {
    requestListener
  };
}

function createSplitRequestHandler(args: {
  apiSurface: Pick<PanelApiSurface, "requestHandler">;
  webSurface: Pick<PanelWebSurface, "requestListener">;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const apiRequestHandler = createPanelApiHttpHandler(args.apiSurface.requestHandler);

  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      await apiRequestHandler(request, response);
      return;
    }

    await args.webSurface.requestListener(request, response);
  };
}

test("routes /v1/* requests to the API surface", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiSurface: createStubApiSurface(async (_request, response) => {
      apiCalls += 1;
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ source: "api" }));
    }),
    webSurface: createStubWebSurface(async (_request, response) => {
      webCalls += 1;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("web");
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/v1/meta"
  });

  assert.equal(apiCalls, 1);
  assert.equal(webCalls, 0);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.bodyText), { source: "api" });
});

test("routes non-/v1 requests to the web surface", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiSurface: createStubApiSurface(async (_request, response) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    }),
    webSurface: createStubWebSurface(async (_request, response) => {
      webCalls += 1;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("web");
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/?view=overview"
  });

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 1);
  assert.equal(response.statusCode, 200);
  assert.equal(response.bodyText, "web");
});

test("does not confuse /v11 with /v1", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiSurface: createStubApiSurface(async (_request, response) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    }),
    webSurface: createStubWebSurface(async (_request, response) => {
      webCalls += 1;
      response.writeHead(200);
      response.end("web");
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/v11/meta"
  });

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 1);
  assert.equal(response.bodyText, "web");
});

test("serves control health directly without delegating", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiSurface: createStubApiSurface(async (_request, response) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    }),
    webSurface: createStubWebSurface(async (_request, response) => {
      webCalls += 1;
      response.writeHead(200);
      response.end("web");
    })
  });

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/healthz"
  });
  const payload = JSON.parse(response.bodyText) as {
    service: string;
    mode: string;
    environment: string;
  };

  assert.equal(apiCalls, 0);
  assert.equal(webCalls, 0);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.service, "control");
  assert.equal(payload.mode, "combined-candidate");
  assert.equal(payload.environment, "test");
});

test("matches split responses for key control routes", async () => {
  const apiSurface = createStubApiSurface(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/v1/auth/me") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ email: "admin@example.com", name: "Admin" }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/resources/spec") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ spec: { apps: [] } }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
  });
  const webSurface = createStubWebSurface(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>dashboard</body></html>");
      return;
    }

    if (request.method === "GET" && url.pathname === "/login") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>login</body></html>");
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
  });

  const context = createTestContext();
  const combined = createCombinedControlRequestHandler({
    context,
    apiSurface,
    webSurface
  });
  const split = createSplitRequestHandler({
    apiSurface,
    webSurface
  });

  for (const request of [
    { method: "GET", url: "/" },
    { method: "GET", url: "/login" },
    { method: "GET", url: "/v1/auth/me" },
    { method: "GET", url: "/v1/resources/spec" }
  ] as const) {
    const [combinedResponse, splitResponse] = await Promise.all([
      invokeRequestHandler(combined, request),
      invokeRequestHandler(split, request)
    ]);

    assert.equal(combinedResponse.statusCode, splitResponse.statusCode);
    assert.equal(combinedResponse.bodyText, splitResponse.bodyText);
    assert.equal(
      combinedResponse.headers["content-type"],
      splitResponse.headers["content-type"]
    );
  }
});
