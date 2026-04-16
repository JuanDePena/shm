import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlRuntimeParityHarness,
  type RuntimeParityResponse
} from "./runtime-parity-harness.js";
import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

function pickComparableHeaders(headers: Record<string, string>) {
  return {
    "content-type": headers["content-type"],
    location: headers.location,
    "set-cookie": headers["set-cookie"]
  };
}

async function readResponse(response: Response): Promise<RuntimeParityResponse> {
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    bodyText: await response.text()
  };
}

function normalizeHealthBody(bodyText: string): string {
  const parsed = JSON.parse(bodyText) as Record<string, unknown>;
  delete parsed.timestamp;
  delete parsed.uptimeSeconds;
  return JSON.stringify(parsed, null, 2);
}

test("release-sandbox candidate matches the direct combined candidate for representative routes", async () => {
  const parity = await createControlRuntimeParityHarness();
  const sandbox = await startCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 0,
    sandboxId: "parity"
  });
  const requests = [
    {
      method: "GET",
      url: "/healthz"
    },
    {
      method: "POST",
      url: "/auth/login",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual" as const
    },
    {
      method: "GET",
      url: "/?view=packages",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "GET",
      url: "/proxy-vhost?slug=adudoc&format=json",
      headers: {
        cookie: "shp_session=test-session"
      }
    }
  ] as const;

  try {
    for (const request of requests) {
      const [combined, sandboxResponse] = await Promise.all([
        parity.requestCombined(request.url, request),
        fetch(new URL(request.url, sandbox.origin), request).then(readResponse)
      ]);

      assert.equal(
        sandboxResponse.status,
        combined.status,
        `status mismatch for ${request.method} ${request.url}`
      );
      assert.deepEqual(
        pickComparableHeaders(sandboxResponse.headers),
        pickComparableHeaders(combined.headers),
        `header mismatch for ${request.method} ${request.url}`
      );
      assert.equal(
        request.url === "/healthz"
          ? normalizeHealthBody(sandboxResponse.bodyText)
          : sandboxResponse.bodyText,
        request.url === "/healthz"
          ? normalizeHealthBody(combined.bodyText)
          : combined.bodyText,
        `body mismatch for ${request.method} ${request.url}`
      );
    }
  } finally {
    await Promise.all([parity.close(), sandbox.close()]);
  }
});
