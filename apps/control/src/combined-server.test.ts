import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlTestHarness,
  startCombinedControlTestRuntime
} from "./test-harness.js";

test("combined candidate serves authenticated flow over a real HTTP server", async () => {
  const harness = await createControlTestHarness({ webPort: 0 });
  const runtime = await startCombinedControlTestRuntime(harness, {
    host: "127.0.0.1",
    port: 0
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
    assert.ok(setCookie, "login should set a session cookie");
    const cookie = setCookie.split(";", 1)[0];

    const dashboardResponse = await fetch(new URL("/?view=overview", runtime.origin), {
      headers: {
        cookie
      }
    });

    assert.equal(dashboardResponse.status, 200);
    const dashboardHtml = await dashboardResponse.text();
    assert.match(dashboardHtml, /SimpleHostPanel/);

    const vhostResponse = await fetch(
      new URL("/proxy-vhost?slug=adudoc&format=json", runtime.origin),
      {
        headers: {
          cookie
        }
      }
    );

    assert.equal(vhostResponse.status, 200);
    const vhostPayload = await vhostResponse.json() as {
      serverName: string;
      httpVhost: string;
      httpsVhost: string;
    };
    assert.equal(vhostPayload.serverName, "adudoc.com");
    assert.match(vhostPayload.httpVhost, /ServerName adudoc\.com/);
    assert.match(vhostPayload.httpsVhost, /ServerName adudoc\.com/);

    const packageResponse = await fetch(new URL("/actions/package-install", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        cookie
      },
      body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
      redirect: "manual"
    });

    assert.equal(packageResponse.status, 303);
    assert.equal(
      packageResponse.headers.get("location"),
      "/?view=packages&notice=Queued+1+package+install+job%28s%29.&kind=success"
    );

    const logoutResponse = await fetch(new URL("/auth/logout", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        cookie
      },
      body: "returnTo=%2Flogin",
      redirect: "manual"
    });

    assert.equal(logoutResponse.status, 303);
    assert.equal(
      logoutResponse.headers.get("location"),
      "/login?notice=Session%20closed&kind=info"
    );
  } finally {
    await runtime.close();
  }
});
