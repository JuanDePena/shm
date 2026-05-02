import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { invokeRequestHandler } from "@simplehost/control-shared";

import type { ControlWebApi } from "./api-client.js";
import { WebApiError } from "./api-client.js";
import { createControlWebSurface } from "./index.js";
import { type ControlWebRuntimeConfig } from "./web-routes.js";

function createStubApi(
  overrides: Partial<ControlWebApi> = {}
): ControlWebApi {
  return {
    login: async () => {
      throw new Error("Unexpected login request in test");
    },
    logout: async () => {
      throw new Error("Unexpected logout request in test");
    },
    getCurrentUser: async () => {
      throw new Error("Unexpected current-user request in test");
    },
    resolveSession: async () => {
      return {
        state: "anonymous",
        token: null,
        currentUser: null
      };
    },
    loadAuthenticatedDashboard: async () => {
      throw new Error("Unexpected authenticated dashboard load in test");
    },
    loadDashboardBootstrap: async () => {
      throw new Error("Unexpected dashboard bootstrap load in test");
    },
    loadDashboardData: async () => {
      throw new Error("Unexpected dashboard load in test");
    },
    loadParameters: async () => {
      throw new Error("Unexpected parameters load in test");
    },
    upsertParameter: async () => {
      throw new Error("Unexpected parameter upsert in test");
    },
    deleteParameter: async () => {
      throw new Error("Unexpected parameter delete in test");
    },
    loadRustDeskPublicConnection: async () => {
      throw new Error("Unexpected RustDesk load in test");
    },
    exportInventory: async () => {
      throw new Error("Unexpected inventory export in test");
    },
    runReconciliation: async () => {
      throw new Error("Unexpected reconciliation run in test");
    },
    purgeOperationalHistory: async () => {
      throw new Error("Unexpected history purge in test");
    },
    syncZone: async () => {
      throw new Error("Unexpected zone sync in test");
    },
    reconcileApp: async () => {
      throw new Error("Unexpected app reconcile in test");
    },
    renderAppProxy: async () => {
      throw new Error("Unexpected proxy render in test");
    },
    reconcileDatabase: async () => {
      throw new Error("Unexpected database reconcile in test");
    },
    updateCodeServer: async () => {
      throw new Error("Unexpected code-server update in test");
    },
    refreshPackageInventory: async () => {
      throw new Error("Unexpected package inventory refresh in test");
    },
    installPackages: async () => {
      throw new Error("Unexpected package install in test");
    },
    applyFirewall: async () => {
      throw new Error("Unexpected firewall apply in test");
    },
    applyFail2Ban: async () => {
      throw new Error("Unexpected Fail2Ban apply in test");
    },
    loadProxyPreview: async () => {
      throw new Error("Unexpected proxy preview in test");
    },
    upsertMailDomain: async () => {
      throw new Error("Unexpected mail domain upsert in test");
    },
    deleteMailDomain: async () => {
      throw new Error("Unexpected mail domain delete in test");
    },
    upsertMailbox: async () => {
      throw new Error("Unexpected mailbox upsert in test");
    },
    resetMailboxCredential: async () => {
      throw new Error("Unexpected mailbox credential reset in test");
    },
    rotateMailboxCredential: async () => {
      throw new Error("Unexpected mailbox credential rotate in test");
    },
    getMailboxWebmailAutologin: async () => {
      throw new Error("Unexpected mailbox webmail autologin request in test");
    },
    consumeMailboxCredentialReveal: async () => {
      throw new Error("Unexpected mailbox credential reveal consume in test");
    },
    deleteMailbox: async () => {
      throw new Error("Unexpected mailbox delete in test");
    },
    upsertMailAlias: async () => {
      throw new Error("Unexpected mail alias upsert in test");
    },
    deleteMailAlias: async () => {
      throw new Error("Unexpected mail alias delete in test");
    },
    upsertMailboxQuota: async () => {
      throw new Error("Unexpected mailbox quota upsert in test");
    },
    upsertMailPolicy: async () => {
      throw new Error("Unexpected mail policy upsert in test");
    },
    deleteMailboxQuota: async () => {
      throw new Error("Unexpected mailbox quota delete in test");
    },
    loadDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state load in test");
    },
    applyDesiredStateSpec: async () => {
      throw new Error("Unexpected desired-state apply in test");
    },
    mutateDesiredState: async () => {
      throw new Error("Unexpected desired-state mutation in test");
    },
    ...overrides
  };
}

function createConfig(): ControlWebRuntimeConfig {
  return {
    api: { host: "127.0.0.1", port: 4100 },
    env: "test",
    version: "0.1.0-test",
    web: { host: "127.0.0.1", port: 3200 }
  };
}

test("web healthz reports web runtime metadata", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now() - 12_000
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/healthz"
  });
  const payload = JSON.parse(response.bodyText) as {
    service: string;
    environment: string;
    upstreamApi: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.service, "web");
  assert.equal(payload.environment, "test");
  assert.equal(payload.upstreamApi, "127.0.0.1:4100");
});

test("locale preferences route redirects and sets locale cookie", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/preferences/locale",
    body: "locale=en&returnTo=%2F%3Fview%3Dnodes",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/?view=nodes");
  assert.match(String(response.headers["set-cookie"]), /shp_lang=en/);
});

test("unknown routes still return a structured 404 payload", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "GET",
    url: "/no-such-route"
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.bodyText), {
    error: "Not Found",
    method: "GET",
    path: "/no-such-route"
  });
});

test("missing session on protected routes redirects to login", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi()
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/resources/apps/delete",
    body: "slug=adudoc",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/login?notice=Session%20required&kind=error");
  assert.match(String(response.headers["set-cookie"]), /shp_session=;/);
});

test("logout clears the local session and redirects to the local login for direct sessions", async () => {
  let logoutToken: string | null = null;
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      logout: async (token) => {
        logoutToken = token;
      }
    })
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/auth/logout",
    headers: {
      cookie: "shp_session=test-token"
    }
  });

  assert.equal(logoutToken, "test-token");
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/login?notice=Session%20closed&kind=info");
  assert.match(String(response.headers["set-cookie"]), /shp_session=;/);
});

test("logout clears the local session and starts Authentik outpost sign-out for SSO sessions", async () => {
  let logoutToken: string | null = null;
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      logout: async (token) => {
        logoutToken = token;
      }
    })
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/auth/logout",
    headers: {
      cookie: "shp_session=test-token",
      "x-authentik-email": "webmaster@pyrosa.com.do"
    }
  });

  const location = new URL(String(response.headers.location), "http://localhost");

  assert.equal(logoutToken, "test-token");
  assert.equal(response.statusCode, 303);
  assert.equal(location.pathname, "/outpost.goauthentik.io/sign_out");
  assert.equal(location.searchParams.get("rd"), "/login");
  assert.match(String(response.headers["set-cookie"]), /shp_session=;/);
});

test("parameter and history actions call the authenticated API and return to the dashboard", async () => {
  const savedRequests: Array<{ key: string; value?: string; sensitive?: boolean }> = [];
  const deletedKeys: string[] = [];
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      resolveSession: async () => ({
        state: "authenticated",
        token: "test-token",
        currentUser: {
          userId: "user-1",
          email: "ops@example.com",
          displayName: "Ops",
          status: "active",
          globalRoles: ["platform_admin"],
          tenantMemberships: []
        }
      }),
      upsertParameter: async (token, request) => {
        assert.equal(token, "test-token");
        savedRequests.push(request);
      },
      deleteParameter: async (token, key) => {
        assert.equal(token, "test-token");
        deletedKeys.push(key);
      },
      purgeOperationalHistory: async (token) => {
        assert.equal(token, "test-token");
        return {
          generatedAt: "2026-04-30T00:00:00.000Z",
          parameterKey: "SIMPLEHOST_HISTORY_RETENTION_DAYS",
          retentionDays: 90,
          cutoffAt: "2026-01-30T00:00:00.000Z",
          source: "ui",
          deletedAuditEventCount: 2,
          deletedReconciliationRunCount: 5,
          deletedJobCount: 3,
          deletedJobResultCount: 3,
          keptLatestResourceJobCount: 4
        };
      }
    })
  ).requestListener;

  const upsertResponse = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/actions/parameters/upsert",
    body: "key=SIMPLEHOST_TEST&value=enabled&description=flag&sensitive=on&returnTo=%2F%3Fview%3Dparameters",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      cookie: "shp_session=test-token"
    }
  });

  assert.equal(upsertResponse.statusCode, 303);
  assert.equal(savedRequests[0]?.key, "SIMPLEHOST_TEST");
  assert.equal(savedRequests[0]?.value, "enabled");
  assert.equal(savedRequests[0]?.sensitive, true);
  assert.match(String(upsertResponse.headers.location), /view=parameters/);

  const deleteResponse = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/actions/parameters/delete",
    body: "key=SIMPLEHOST_TEST&returnTo=%2F%3Fview%3Dparameters",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      cookie: "shp_session=test-token"
    }
  });

  assert.equal(deleteResponse.statusCode, 303);
  assert.deepEqual(deletedKeys, ["SIMPLEHOST_TEST"]);

  const purgeResponse = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/actions/operations-history-purge",
    body: "returnTo=%2F%3Fview%3Dreconciliation",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      cookie: "shp_session=test-token"
    }
  });

  assert.equal(purgeResponse.statusCode, 303);
  assert.match(String(purgeResponse.headers.location), /view=reconciliation/);
  assert.match(String(purgeResponse.headers.location), /Purged/);
});

test("mail validation failures redirect back to the dashboard with an operator-facing notice", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      resolveSession: async () => ({
        state: "authenticated",
        token: "test-token",
        currentUser: {
          userId: "user-1",
          email: "ops@example.com",
          displayName: "Ops",
          status: "active",
          globalRoles: ["platform_admin"],
          tenantMemberships: []
        }
      })
    })
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/resources/mail/domains/upsert",
    body: "domainName=example.com&tenantSlug=acme&zoneName=example.com&primaryNodeId=mail-a&mailHost=mx.external.test&dkimSelector=mail&returnTo=%2F%3Fview%3Dmail",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      cookie: "shp_session=test-token"
    }
  });

  assert.equal(response.statusCode, 303);
  const location = new URL(String(response.headers.location), "http://localhost");

  assert.equal(location.pathname, "/");
  assert.equal(location.searchParams.get("view"), "mail");
  assert.equal(
    location.searchParams.get("notice"),
    "Couldn't save mail domain. Mail host must stay under example.com."
  );
  assert.equal(location.searchParams.get("kind"), "error");
});

test("login failures render the login page with the API error message", async () => {
  const handler = createControlWebSurface(
    {
      config: createConfig(),
      startedAt: Date.now()
    },
    createStubApi({
      login: async () => {
        throw new WebApiError(401, "Invalid credentials");
      }
    })
  ).requestListener;

  const response = await invokeRequestHandler(handler, {
    method: "POST",
    url: "/auth/login",
    body: "email=admin%40example.com&password=bad-pass",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.bodyText, /Invalid credentials/);
});

test("mailbox webmail route issues a launcher redirect for the selected mailbox", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "simplehost-webmail-secret-"));
  const secretPath = path.join(tempDir, "roundcube.des.key");
  writeFileSync(secretPath, "test-roundcube-secret\n", "utf8");
  process.env.SIMPLEHOST_MAIL_WEBMAIL_AUTOLOGIN_SECRET_PATH = secretPath;

  try {
    const handler = createControlWebSurface(
      {
        config: createConfig(),
        startedAt: Date.now()
      },
      createStubApi({
        resolveSession: async () => ({
          state: "authenticated",
          token: "test-token",
          currentUser: {
            userId: "user-1",
            email: "ops@example.com",
            displayName: "Ops",
            status: "active",
            globalRoles: ["platform_admin"],
            tenantMemberships: []
          }
        }),
        getMailboxWebmailAutologin: async (token, mailboxAddress) => {
          assert.equal(token, "test-token");
          assert.equal(mailboxAddress, "webmaster@adudoc.com");

          return {
            mailboxAddress,
            webmailHostname: "webmail.adudoc.com",
            credential: "AdudocWeb26!"
          };
        }
      })
    ).requestListener;

    const response = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/resources/mail/mailboxes/open-webmail?mailboxAddress=webmaster%40adudoc.com&returnTo=%2F%3Fview%3Dmail",
      headers: {
        cookie: "shp_session=test-token"
      }
    });

    assert.equal(response.statusCode, 303);
    assert.match(
      String(response.headers.location),
      /^http:\/\/webmail\.adudoc\.com\/simplehost-autologin\.php\?token=/
    );
  } finally {
    delete process.env.SIMPLEHOST_MAIL_WEBMAIL_AUTOLOGIN_SECRET_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
