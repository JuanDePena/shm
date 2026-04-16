import assert from "node:assert/strict";
import test from "node:test";

import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";

test("release-sandbox candidate serves key HTTP routes over a packed sandbox layout", async () => {
  const runtime = await startCombinedControlReleaseSandbox({
    host: "127.0.0.1",
    port: 0,
    sandboxId: "smoke"
  });

  try {
    const healthResponse = await fetch(new URL("/healthz", runtime.origin));
    assert.equal(healthResponse.status, 200);

    const loginResponse = await fetch(new URL("/auth/login", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual"
    });
    assert.equal(loginResponse.status, 303);
    const setCookie = loginResponse.headers.get("set-cookie");
    assert.ok(setCookie);
    const cookie = setCookie.split(";", 1)[0];

    const overviewResponse = await fetch(new URL("/?view=overview", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(overviewResponse.status, 200);

    const authMeResponse = await fetch(new URL("/v1/auth/me", runtime.origin), {
      headers: {
        authorization: "Bearer test-session"
      }
    });
    assert.equal(authMeResponse.status, 200);

    const packagesResponse = await fetch(new URL("/?view=packages", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(packagesResponse.status, 200);

    const proxyHtmlResponse = await fetch(new URL("/proxy-vhost?slug=adudoc", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(proxyHtmlResponse.status, 200);

    const packageInstallResponse = await fetch(
      new URL("/actions/package-install", runtime.origin),
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
        redirect: "manual"
      }
    );
    assert.equal(packageInstallResponse.status, 303);
  } finally {
    await runtime.close();
  }
});
