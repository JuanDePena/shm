import assert from "node:assert/strict";

import {
  readCombinedControlReleaseSandboxDeployManifest,
  readCombinedControlReleaseSandboxRollbackManifest
} from "./release-sandbox-deployment.js";
import { startExistingCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";
import {
  readCombinedControlReleaseShadowDeployManifest,
  readCombinedControlReleaseShadowRollbackManifest
} from "./release-shadow-deployment.js";
import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

export interface CombinedControlReleaseRehearsalCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRehearsalResult {
  readonly kind: "combined-control-release-rehearsal";
  readonly sandboxId: string;
  readonly version: string;
  readonly sandboxOrigin: string;
  readonly shadowOrigin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRehearsalCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRehearsalCheck;
}

async function readComparableResponse(response: Response) {
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    location: response.headers.get("location") ?? "",
    body: await response.text()
  };
}

async function createSession(origin: string) {
  const loginResponse = await fetch(new URL("/auth/login", origin), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    },
    body: "email=admin%40example.com&password=good-pass",
    redirect: "manual"
  });

  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, `login should set a session cookie for ${origin}`);
  return { response: loginResponse, cookie };
}

export function formatCombinedControlReleaseRehearsal(
  result: CombinedControlReleaseRehearsalResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release rehearsal",
    `Sandbox: ${result.sandboxId}`,
    `Version: ${result.version}`,
    `Sandbox origin: ${result.sandboxOrigin}`,
    `Shadow origin: ${result.shadowOrigin}`,
    `Status: ${result.status} (${passed}/${result.checks.length})`,
    "",
    ...result.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRehearsal(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseRehearsalResult> {
  const shadow = await startCombinedControlReleaseShadow(args);
  const sandbox = await startExistingCombinedControlReleaseSandbox({
    workspaceRoot: shadow.packed.layout.workspaceRoot,
    sandboxId: shadow.packed.layout.sandboxId
  });

  try {
    const [sandboxDeployManifest, sandboxRollbackManifest, shadowDeployManifest, shadowRollbackManifest] =
      await Promise.all([
        readCombinedControlReleaseSandboxDeployManifest({
          workspaceRoot: shadow.packed.layout.workspaceRoot,
          sandboxId: shadow.packed.layout.sandboxId
        }),
        readCombinedControlReleaseSandboxRollbackManifest({
          workspaceRoot: shadow.packed.layout.workspaceRoot,
          sandboxId: shadow.packed.layout.sandboxId
        }),
        readCombinedControlReleaseShadowDeployManifest({
          workspaceRoot: shadow.packed.layout.workspaceRoot,
          sandboxId: shadow.packed.layout.sandboxId
        }),
        readCombinedControlReleaseShadowRollbackManifest({
          workspaceRoot: shadow.packed.layout.workspaceRoot,
          sandboxId: shadow.packed.layout.sandboxId
        })
      ]);

    const [sandboxSession, shadowSession] = await Promise.all([
      createSession(sandbox.origin),
      createSession(shadow.origin)
    ]);

    const [sandboxPackages, shadowPackages, sandboxProxy, shadowProxy, sandboxPackageInstall, shadowPackageInstall] =
      await Promise.all([
        fetch(new URL("/?view=packages", sandbox.origin), {
          headers: { cookie: sandboxSession.cookie }
        }).then(readComparableResponse),
        fetch(new URL("/?view=packages", shadow.origin), {
          headers: { cookie: shadowSession.cookie }
        }).then(readComparableResponse),
        fetch(new URL("/proxy-vhost?slug=adudoc&format=json", sandbox.origin), {
          headers: { cookie: sandboxSession.cookie }
        }).then(readComparableResponse),
        fetch(new URL("/proxy-vhost?slug=adudoc&format=json", shadow.origin), {
          headers: { cookie: shadowSession.cookie }
        }).then(readComparableResponse),
        fetch(new URL("/actions/package-install", sandbox.origin), {
          method: "POST",
          headers: {
            cookie: sandboxSession.cookie,
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
          },
          body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
          redirect: "manual"
        }).then(readComparableResponse),
        fetch(new URL("/actions/package-install", shadow.origin), {
          method: "POST",
          headers: {
            cookie: shadowSession.cookie,
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
          },
          body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
          redirect: "manual"
        }).then(readComparableResponse)
      ]);

    const sandboxVersions = sandbox.activation.availableVersions;
    const shadowVersions = shadow.packed.activation.availableVersions;
    const checks: CombinedControlReleaseRehearsalCheck[] = [
      createCheck(
        "inventory-parity",
        JSON.stringify(sandboxVersions) === JSON.stringify(shadowVersions),
        `sandbox=${sandboxVersions.join(", ") || "none"} | shadow=${shadowVersions.join(", ") || "none"}`
      ),
      createCheck(
        "active-version-parity",
        sandbox.activation.activeVersion === shadow.packed.activation.activeVersion,
        `sandbox=${sandbox.activation.activeVersion} | shadow=${shadow.packed.activation.activeVersion}`
      ),
      createCheck(
        "source-commitish-parity",
        sandbox.bundle.sourceCommitish === shadow.shadowManifest.sourceCommitish,
        `sandbox=${sandbox.bundle.sourceCommitish} | shadow=${shadow.shadowManifest.sourceCommitish}`
      ),
      createCheck(
        "source-manifest-linkage",
        shadow.shadowManifest.sourcePromotionManifestFile === sandbox.packed.layout.promotionManifestFile &&
          shadow.shadowManifest.sourceDeployManifestFile === sandbox.packed.layout.deployManifestFile &&
          shadow.shadowManifest.sourceRollbackManifestFile === sandbox.packed.layout.rollbackManifestFile,
        "shadow source manifest pointers match the active sandbox manifests"
      ),
      createCheck(
        "surface-parity",
        JSON.stringify(sandbox.bundle.startup.surfaces) === JSON.stringify(shadow.shadowManifest.surfaces),
        `sandbox=${sandbox.bundle.startup.surfaces.join(", ")} | shadow=${shadow.shadowManifest.surfaces.join(", ")}`
      ),
      createCheck(
        "promotion-parity",
        sandbox.promotion?.promotedVersion === shadow.packed.promotion.promotedVersion,
        `sandbox=${sandbox.promotion?.promotedVersion ?? "none"} | shadow=${shadow.packed.promotion.promotedVersion}`
      ),
      createCheck(
        "deploy-parity",
        sandboxDeployManifest?.promotedVersion === shadowDeployManifest?.promotedVersion,
        `sandbox=${sandboxDeployManifest?.promotedVersion ?? "none"} | shadow=${shadowDeployManifest?.promotedVersion ?? "none"}`
      ),
      createCheck(
        "rollback-parity",
        sandboxRollbackManifest?.currentVersion === shadowRollbackManifest?.currentVersion &&
          (
            (sandboxRollbackManifest?.rollbackVersion ?? null) ===
              (shadowRollbackManifest?.rollbackVersion ?? null) ||
            (shadowRollbackManifest?.rollbackVersion ?? null) === null
          ),
        `sandbox=${sandboxRollbackManifest?.rollbackVersion ?? "none"} | shadow=${shadowRollbackManifest?.rollbackVersion ?? "none"}`
      ),
      createCheck(
        "packages-view-parity",
        sandboxPackages.status === shadowPackages.status &&
          sandboxPackages.contentType === shadowPackages.contentType &&
          sandboxPackages.body === shadowPackages.body,
        `status=${sandboxPackages.status}/${shadowPackages.status}`
      ),
      createCheck(
        "proxy-vhost-parity",
        sandboxProxy.status === shadowProxy.status &&
          sandboxProxy.contentType === shadowProxy.contentType &&
          sandboxProxy.body === shadowProxy.body,
        `status=${sandboxProxy.status}/${shadowProxy.status}`
      ),
      createCheck(
        "package-install-parity",
        sandboxPackageInstall.status === shadowPackageInstall.status &&
          sandboxPackageInstall.location === shadowPackageInstall.location,
        `status=${sandboxPackageInstall.status}/${shadowPackageInstall.status}, location=${shadowPackageInstall.location}`
      )
    ];

    return {
      kind: "combined-control-release-rehearsal",
      sandboxId: shadow.packed.layout.sandboxId,
      version: shadow.packed.layout.version,
      sandboxOrigin: sandbox.origin,
      shadowOrigin: shadow.origin,
      status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
      checks
    };
  } finally {
    await Promise.all([sandbox.close(), shadow.close()]);
  }
}
