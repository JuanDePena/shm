import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  invokeRequestHandler,
  type ControlProcessContext
} from "@simplehost/control-shared";

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

test("routes /v1/* requests to the API handler", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      apiCalls += 1;
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ source: "api" }));
    },
    webRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      webCalls += 1;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("web");
    }
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

test("routes non-/v1 requests to the web handler", async () => {
  let apiCalls = 0;
  let webCalls = 0;

  const handler = createCombinedControlRequestHandler({
    context: createTestContext(),
    apiRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    },
    webRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      webCalls += 1;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("web");
    }
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
    apiRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    },
    webRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      webCalls += 1;
      response.writeHead(200);
      response.end("web");
    }
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
    apiRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      apiCalls += 1;
      response.writeHead(200);
      response.end("api");
    },
    webRequestHandler: async (_request: IncomingMessage, response: ServerResponse) => {
      webCalls += 1;
      response.writeHead(200);
      response.end("web");
    }
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
