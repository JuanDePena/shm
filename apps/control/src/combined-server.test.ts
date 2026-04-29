import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlTestHarness,
  startCombinedControlTestRuntime
} from "./test-harness.js";

test("combined runtime serves authenticated flow over a real HTTP server", async () => {
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
    assert.match(dashboardHtml, /SimpleHost/);
    assert.match(
      dashboardHtml,
      /<meta http-equiv="refresh" content="60" \/>/,
      "overview should auto-refresh every 60 seconds"
    );

    const jobsResponse = await fetch(new URL("/?view=jobs", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(jobsResponse.status, 200);
    const jobsHtml = await jobsResponse.text();
    assert.doesNotMatch(
      jobsHtml,
      /<meta http-equiv="refresh"/,
      "non-overview workspaces should not auto-refresh"
    );
    assert.match(
      jobsHtml,
      /data-workspace-filter-form data-filter-view="job-history"/,
      "job filters should be marked for localStorage persistence"
    );
    assert.match(
      jobsHtml,
      /simplehost:workspace-filters:/,
      "dashboard shell should ship the workspace filter persistence script"
    );

    const servicesResponse = await fetch(new URL("/?view=services", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(servicesResponse.status, 200);
    assert.match(
      await servicesResponse.text(),
      /Service inventory|Inventario de servicios/,
      "services workspace should render systemd service inventory"
    );

    const logsResponse = await fetch(new URL("/?view=logs", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(logsResponse.status, 200);
    assert.match(
      await logsResponse.text(),
      /Recent logs|Logs recientes/,
      "logs workspace should render recent journal entries"
    );

    const certificatesResponse = await fetch(new URL("/?view=certificates", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(certificatesResponse.status, 200);
    assert.match(
      await certificatesResponse.text(),
      /TLS certificates|Certificados TLS/,
      "certificates workspace should render TLS inventory"
    );

    const storageResponse = await fetch(new URL("/?view=storage", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(storageResponse.status, 200);
    assert.match(
      await storageResponse.text(),
      /Storage inventory|Inventario de storage/,
      "storage workspace should render filesystem inventory"
    );

    const networkResponse = await fetch(new URL("/?view=network", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(networkResponse.status, 200);
    assert.match(
      await networkResponse.text(),
      /Network listeners|Listeners de red/,
      "network workspace should render listener inventory"
    );

    const processesResponse = await fetch(new URL("/?view=processes", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(processesResponse.status, 200);
    assert.match(
      await processesResponse.text(),
      /Processes|Procesos/,
      "processes workspace should render process inventory"
    );

    const containersResponse = await fetch(new URL("/?view=containers", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(containersResponse.status, 200);
    assert.match(
      await containersResponse.text(),
      /Containers/,
      "containers workspace should render container inventory"
    );

    const timersResponse = await fetch(new URL("/?view=timers", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(timersResponse.status, 200);
    assert.match(
      await timersResponse.text(),
      /Timers/,
      "timers workspace should render systemd timer inventory"
    );

    const packagesResponse = await fetch(new URL("/?view=packages", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(packagesResponse.status, 200);
    const packagesHtml = await packagesResponse.text();
    assert.match(
      packagesHtml,
      /data-workspace-filter-form data-filter-view="packages"/,
      "package filters should be marked for localStorage persistence"
    );
    assert.match(
      packagesHtml,
      /data-workspace-filter-clear data-filter-view="packages"/,
      "package clear-filter links should clear localStorage persistence"
    );

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
