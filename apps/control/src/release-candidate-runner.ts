import {
  createCombinedControlReleaseCandidateSurface,
  type CombinedControlReleaseCandidateSurface,
  type CombinedControlReleaseCandidateRuntime
} from "./release-candidate-surface.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";
import { runMailReleaseBaseline } from "@simplehost/control-web";

export interface ControlReleaseCandidateCheckResult {
  readonly name: string;
  readonly description: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly statusCode?: number;
}

export interface ControlReleaseCandidateResult {
  readonly kind: "source-release-candidate";
  readonly mode: "combined";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly ok: boolean;
  readonly passed: number;
  readonly failed: number;
  readonly checks: readonly ControlReleaseCandidateCheckResult[];
}

interface ControlReleaseCandidateRequestContext {
  request(pathname: string, init?: RequestInit): Promise<Response>;
  getCookie(): Promise<string>;
}

async function ensureSessionCookie(
  runtime: CombinedControlReleaseCandidateRuntime
): Promise<string> {
  const loginResponse = await fetch(new URL("/auth/login", runtime.origin), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    },
    body: "email=admin%40example.com&password=good-pass",
    redirect: "manual"
  });

  if (loginResponse.status !== 303) {
    throw new Error(`Login expected 303 but received ${loginResponse.status}`);
  }

  const setCookie = loginResponse.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Login did not return a session cookie");
  }

  return setCookie.split(";", 1)[0];
}

async function runCheck(
  name: string,
  description: string,
  callback: () => Promise<{ detail: string; statusCode?: number }>
): Promise<ControlReleaseCandidateCheckResult> {
  try {
    const result = await callback();

    return {
      name,
      description,
      ok: true,
      detail: result.detail,
      statusCode: result.statusCode
    };
  } catch (error: unknown) {
    return {
      name,
      description,
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function expectStatus(response: Response, status: number, label: string) {
  if (response.status !== status) {
    throw new Error(`${label} expected ${status} but received ${response.status}`);
  }
}

export async function runCombinedControlReleaseCandidate(
  surface?: CombinedControlReleaseCandidateSurface
): Promise<ControlReleaseCandidateResult> {
  const resolvedSurface =
    surface ?? (await createCombinedControlReleaseCandidateSurface());
  const runtime = await resolvedSurface.start({
    host: "127.0.0.1",
    port: 0
  });
  let cookie: string | undefined;

  const requestContext: ControlReleaseCandidateRequestContext = {
    request(pathname, init) {
      return fetch(new URL(pathname, runtime.origin), init);
    },
    async getCookie() {
      cookie ??= await ensureSessionCookie(runtime);
      return cookie;
    }
  };

  try {
    const checks: ControlReleaseCandidateCheckResult[] = [];

    checks.push(
      await runCheck(
        "startup-manifest",
        resolvedSurface.checks[0]!.description,
        async () => {
          if (runtime.manifest.origin !== runtime.origin) {
            throw new Error(
              `Startup manifest origin mismatch: ${runtime.manifest.origin}`
            );
          }

          if (!runtime.manifest.surfaces.includes("release-candidate")) {
            throw new Error("Startup manifest is missing the release-candidate surface");
          }

          if (runtime.manifest.listener.port <= 0) {
            throw new Error("Startup manifest listener port must be a positive integer");
          }

          return {
            detail: `Startup manifest resolved ${runtime.manifest.listener.host}:${runtime.manifest.listener.port} for ${runtime.manifest.environment}.`
          };
        }
      )
    );

    checks.push(
      await runCheck("healthz", resolvedSurface.checks[1]!.description, async () => {
        const response = await requestContext.request("/healthz");
        expectStatus(response, 200, "healthz");
        return {
          detail: "Health endpoint returned 200.",
          statusCode: response.status
        };
      })
    );

    checks.push(
      await runCheck("login", resolvedSurface.checks[2]!.description, async () => {
        const sessionCookie = await requestContext.getCookie();
        return {
          detail: `Login redirected and produced cookie ${sessionCookie.split("=")[0]}.`,
          statusCode: 303
        };
      })
    );

    checks.push(
      await runCheck(
        "authenticated-overview",
        resolvedSurface.checks[3]!.description,
        async () => {
          const response = await requestContext.request("/?view=overview", {
            headers: {
              cookie: await requestContext.getCookie()
            }
          });
          expectStatus(response, 200, "authenticated overview");
          const html = await response.text();

          if (!html.includes("SimpleHost")) {
            throw new Error(
              "Authenticated overview did not render the dashboard shell"
            );
          }

          return {
            detail: "Overview rendered successfully for an authenticated session.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck(
        "packages-view",
        resolvedSurface.checks[4]!.description,
        async () => {
          const response = await requestContext.request("/?view=packages", {
            headers: {
              cookie: await requestContext.getCookie()
            }
          });
          expectStatus(response, 200, "packages view");
          return {
            detail: "Packages workspace rendered successfully.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck(
        "package-install",
        resolvedSurface.checks[5]!.description,
        async () => {
          const response = await requestContext.request("/actions/package-install", {
            method: "POST",
            headers: {
              cookie: await requestContext.getCookie(),
              "content-type": "application/x-www-form-urlencoded; charset=utf-8"
            },
            body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
            redirect: "manual"
          });
          expectStatus(response, 303, "package install");
          const location = response.headers.get("location") ?? "";

          if (!location.startsWith("/?view=packages&notice=Queued+1+package+install+job")) {
            throw new Error(`Unexpected package-install redirect: ${location}`);
          }

          return {
            detail: "Package install action redirected with a success notice.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck("app-delete", resolvedSurface.checks[6]!.description, async () => {
        const response = await requestContext.request("/resources/apps/delete", {
          method: "POST",
          headers: {
            cookie: await requestContext.getCookie(),
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
          },
          body: "slug=adudoc",
          redirect: "manual"
        });
        expectStatus(response, 303, "app delete");
        return {
          detail: "App delete mutation redirected through the desired-state flow.",
          statusCode: response.status
        };
      })
    );

    checks.push(
      await runCheck(
        "mail-domain-upsert",
        resolvedSurface.checks[7]!.description,
        async () => {
          const response = await requestContext.request("/resources/mail/domains/upsert", {
            method: "POST",
            headers: {
              cookie: await requestContext.getCookie(),
              "content-type": "application/x-www-form-urlencoded; charset=utf-8"
            },
            body: [
              "domainName=adudoc.com",
              "tenantSlug=adudoc",
              "zoneName=adudoc.com",
              "primaryNodeId=primary",
              "standbyNodeId=secondary",
              "mailHost=mail.adudoc.com",
              "dkimSelector=mail",
              "returnTo=%2F%3Fview%3Dmail"
            ].join("&"),
            redirect: "manual"
          });
          expectStatus(response, 303, "mail domain upsert");
          return {
            detail: "Mail domain upsert redirected through the mail workflow.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck(
        "proxy-vhost-html",
        resolvedSurface.checks[8]!.description,
        async () => {
          const response = await requestContext.request("/proxy-vhost?slug=adudoc", {
            headers: {
              cookie: await requestContext.getCookie()
            }
          });
          expectStatus(response, 200, "proxy vhost html");
          const html = await response.text();

          if (!html.includes("Apache vhost")) {
            throw new Error("Proxy vhost HTML did not render the expected heading");
          }

          return {
            detail: "Proxy preview HTML rendered through the combined web surface.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck(
        "proxy-vhost-json",
        resolvedSurface.checks[9]!.description,
        async () => {
          const response = await requestContext.request(
            "/proxy-vhost?slug=adudoc&format=json",
            {
              headers: {
                cookie: await requestContext.getCookie()
              }
            }
          );
          expectStatus(response, 200, "proxy preview json");
          const payload = (await response.json()) as { serverName?: string };

          if (payload.serverName !== "adudoc.com") {
            throw new Error(
              `Unexpected proxy preview payload: ${JSON.stringify(payload)}`
            );
          }

          return {
            detail: "Proxy preview JSON returned the expected app payload.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck("logout", resolvedSurface.checks[10]!.description, async () => {
        const response = await requestContext.request("/auth/logout", {
          method: "POST",
          headers: {
            cookie: await requestContext.getCookie(),
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
          },
          body: "returnTo=%2Flogin",
          redirect: "manual"
        });
        expectStatus(response, 303, "logout");
        const location = response.headers.get("location");

        if (location !== "/login?notice=Session%20closed&kind=info") {
          throw new Error(`Unexpected logout redirect: ${location ?? "<missing>"}`);
        }

        return {
          detail: "Logout redirected to the login route with the session-closed notice.",
          statusCode: response.status
        };
      })
    );

    checks.push(
      await runCheck(
        "invalid-session-redirect",
        resolvedSurface.checks[11]!.description,
        async () => {
          const response = await requestContext.request("/?view=packages", {
            headers: {
              cookie: "shp_session=bad-session"
            },
            redirect: "manual"
          });
          expectStatus(response, 303, "invalid session redirect");
          const location = response.headers.get("location");

          if (location !== "/login?notice=Session%20required&kind=error") {
            throw new Error(
              `Unexpected invalid-session redirect: ${location ?? "<missing>"}`
            );
          }

          return {
            detail: "Invalid session redirected to login with an error notice.",
            statusCode: response.status
          };
        }
      )
    );

    checks.push(
      await runCheck("mail-view", resolvedSurface.checks[12]!.description, async () => {
        const response = await requestContext.request("/?view=mail", {
          headers: {
            cookie: await requestContext.getCookie()
          }
        });
        expectStatus(response, 200, "mail view");
        return {
          detail: "Mail workspace rendered successfully.",
          statusCode: response.status
        };
      })
    );

    checks.push(
      await runCheck("mail-baseline", resolvedSurface.checks[13]!.description, async () => {
        const baseline = runMailReleaseBaseline();

        if (!baseline.ok) {
          throw new Error(baseline.detail);
        }

        return {
          detail: baseline.detail
        };
      })
    );

    const failed = checks.filter((check) => !check.ok).length;

    return {
      kind: resolvedSurface.kind,
      mode: runtime.mode,
      origin: runtime.origin,
      manifest: runtime.manifest,
      ok: failed === 0,
      passed: checks.length - failed,
      failed,
      checks
    };
  } finally {
    await runtime.close();
  }
}

export function formatCombinedControlReleaseCandidateReport(
  result: ControlReleaseCandidateResult
): string {
  const lines = [
    "Combined control release-candidate",
    `Origin: ${result.origin}`,
    `Mode: ${result.mode}`,
    `Kind: ${result.kind}`,
    `Manifest: ${result.manifest.listener.host}:${result.manifest.listener.port} · ${result.manifest.environment} · ${result.manifest.version}`,
    `Surfaces: ${result.manifest.surfaces.join(", ")}`,
    `Status: ${result.ok ? "PASS" : "FAIL"} (${result.passed}/${result.checks.length})`,
    ""
  ];

  for (const check of result.checks) {
    lines.push(`${check.ok ? "[PASS]" : "[FAIL]"} ${check.name}: ${check.detail}`);
  }

  return lines.join("\n");
}
