import assert from "node:assert/strict";
import test from "node:test";

import { createControlRuntimeParityHarness } from "./runtime-parity-harness.js";

function pickComparableHeaders(headers: Record<string, string>) {
  return {
    "content-type": headers["content-type"],
    location: headers.location,
    "set-cookie": headers["set-cookie"]
  };
}

test("split and combined candidates match over real HTTP servers for protected routes", async () => {
  const runtime = await createControlRuntimeParityHarness();
  const requests = [
    {
      method: "GET",
      url: "/?view=overview",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "GET",
      url: "/?view=overview",
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
      url: "/?view=packages",
      headers: {
        cookie: "shp_session=bad-session"
      },
      redirect: "manual" as const
    },
    {
      method: "POST",
      url: "/auth/login",
      body: "email=admin%40example.com&password=good-pass",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      redirect: "manual" as const
    },
    {
      method: "POST",
      url: "/actions/package-install",
      body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      redirect: "manual" as const
    },
    {
      method: "POST",
      url: "/resources/apps/delete",
      body: "slug=adudoc",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      redirect: "manual" as const
    },
    {
      method: "POST",
      url: "/resources/mail/domains/upsert",
      body: "domainName=adudoc.com&returnTo=%2F%3Fview%3Dmail",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      redirect: "manual" as const
    },
    {
      method: "GET",
      url: "/proxy-vhost?slug=adudoc",
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
    },
    {
      method: "POST",
      url: "/auth/logout",
      body: "returnTo=%2Flogin",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      redirect: "manual" as const
    }
  ] as const;

  try {
    for (const request of requests) {
      const pair = await runtime.requestBoth(request.url, request);

      assert.equal(
        pair.combined.status,
        pair.split.status,
        `status mismatch for ${request.method} ${request.url}`
      );
      assert.deepEqual(
        pickComparableHeaders(pair.combined.headers),
        pickComparableHeaders(pair.split.headers),
        `header mismatch for ${request.method} ${request.url}`
      );
      assert.equal(
        pair.combined.bodyText,
        pair.split.bodyText,
        `body mismatch for ${request.method} ${request.url}`
      );
    }
  } finally {
    await runtime.close();
  }
});
