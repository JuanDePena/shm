import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import {
  applyCombinedControlReleaseRootCutoverTarget,
  formatCombinedControlReleaseRootCutoverTargetApplyManifest,
  formatCombinedControlReleaseRootCutoverTargetHistory,
  readCombinedControlReleaseRootCutoverTargetApplyManifest,
  readCombinedControlReleaseRootCutoverTargetHistory
} from "./release-root-cutover-target.js";
import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import { startExistingCombinedControlReleaseRootCutoverTarget } from "./release-root-cutover-target-runner.js";

export interface CombinedControlReleaseRootCutoverTargetReadyCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverTargetReadyResult {
  readonly kind: "combined-release-root-cutover-target-ready";
  readonly targetId: string;
  readonly version: string;
  readonly origin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverTargetReadyCheck[];
}

interface CombinedControlReleaseRootCutoverTargetPromotionManifestShape {
  readonly promotedVersion?: string;
}

interface CombinedControlReleaseRootCutoverTargetDeployManifestShape {
  readonly promotedVersion?: string;
}

interface CombinedControlReleaseRootCutoverTargetRollbackManifestShape {
  readonly rollbackVersion?: string | null;
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverTargetReadyCheck;
}

export function formatCombinedControlReleaseRootCutoverTargetReady(
  result: CombinedControlReleaseRootCutoverTargetReadyResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover target ready",
    `Target: ${result.targetId}`,
    `Version: ${result.version}`,
    `Origin: ${result.origin}`,
    `Status: ${result.status} (${passed}/${result.checks.length})`,
    "",
    ...result.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverTargetReady(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootCutoverTargetReadyResult> {
  let applyManifest = await readCombinedControlReleaseRootCutoverTargetApplyManifest(args);

  if (!applyManifest) {
    await applyCombinedControlReleaseRootStaging({
      workspaceRoot: args.workspaceRoot,
      version: args.version,
      clean: false
    });
    await applyCombinedControlReleaseRootPromotion({
      workspaceRoot: args.workspaceRoot,
      targetId: args.targetId,
      version: args.version,
      clean: false
    });
    const applied = await applyCombinedControlReleaseRootCutoverTarget({
      workspaceRoot: args.workspaceRoot,
      targetId: args.targetId,
      version: args.version,
      clean: false
    });
    applyManifest = applied.applyManifest;
  }

  if (!applyManifest) {
    throw new Error("Release-root cutover target apply state is incomplete");
  }

  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  const history = await readCombinedControlReleaseRootCutoverTargetHistory({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });
  const promotionManifest =
    safeReadJson<CombinedControlReleaseRootCutoverTargetPromotionManifestShape>(
      layout.promotionManifestFile
    );
  const deployManifest =
    safeReadJson<CombinedControlReleaseRootCutoverTargetDeployManifestShape>(
      layout.deployManifestFile
    );
  const rollbackManifest =
    safeReadJson<CombinedControlReleaseRootCutoverTargetRollbackManifestShape>(
      layout.rollbackManifestFile
    );
  const latestHistory = history.records.at(-1) ?? null;
  const currentExists = existsSync(layout.currentRoot);
  const currentIsSymlink = currentExists && lstatSync(layout.currentRoot).isSymbolicLink();
  const currentResolvedTarget =
    currentIsSymlink
      ? (() => {
          try {
            return realpathSync(layout.currentRoot);
          } catch {
            return null;
          }
        })()
      : null;
  const releaseVersionResolvedTarget =
    existsSync(layout.releaseVersionRoot)
      ? (() => {
          try {
            return realpathSync(layout.releaseVersionRoot);
          } catch {
            return null;
          }
        })()
      : null;
  const currentPointsAtVersion =
    currentResolvedTarget !== null &&
    releaseVersionResolvedTarget !== null &&
    currentResolvedTarget === releaseVersionResolvedTarget;
  const checks: CombinedControlReleaseRootCutoverTargetReadyCheck[] = [
    createCheck(
      "promotion-manifest",
      promotionManifest?.promotedVersion === layout.version,
      promotionManifest
        ? `promotion manifest targets ${promotionManifest.promotedVersion ?? "unknown"}`
        : "promotion manifest missing"
    ),
    createCheck(
      "deploy-manifest",
      deployManifest?.promotedVersion === layout.version,
      deployManifest
        ? `deploy manifest targets ${deployManifest.promotedVersion ?? "unknown"}`
        : "deploy manifest missing"
    ),
    createCheck(
      "rollback-manifest",
      rollbackManifest !== null,
      rollbackManifest
        ? `rollback manifest points to ${rollbackManifest.rollbackVersion ?? "no previous release"}`
        : "rollback manifest missing"
    ),
    createCheck(
      "apply-manifest",
      applyManifest.version === layout.version,
      `apply manifest targets ${applyManifest.version}`
    ),
    createCheck(
      "current-symlink",
      currentIsSymlink,
      currentExists
        ? currentIsSymlink
          ? `current symlink exists at ${layout.currentRoot}`
          : `current exists but is not a symlink at ${layout.currentRoot}`
        : "current symlink missing"
    ),
    createCheck(
      "current-target",
      currentPointsAtVersion,
      currentIsSymlink
        ? `current resolves to ${currentResolvedTarget ?? "unresolved"}`
        : "current target cannot be resolved"
    ),
    createCheck(
      "cutover-history-latest",
      latestHistory?.action === "cutover" && latestHistory.version === layout.version,
      latestHistory
        ? `latest history is ${latestHistory.action} ${latestHistory.version}`
        : "cutover history missing"
    )
  ];

  let origin = "unavailable";

  if (currentPointsAtVersion) {
    try {
      const runtime = await startExistingCombinedControlReleaseRootCutoverTarget({
        workspaceRoot: layout.workspaceRoot,
        targetId: layout.targetId,
        version: layout.version
      });
      origin = runtime.origin;

      try {
        const [health, login] = await Promise.all([
          fetch(new URL("/healthz", runtime.origin)),
          fetch(new URL("/auth/login", runtime.origin), {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded; charset=utf-8"
            },
            body: "email=admin%40example.com&password=good-pass",
            redirect: "manual"
          })
        ]);

        checks.push(
          createCheck(
            "runtime-healthz",
            health.status === 200,
            `healthz returned ${health.status}`
          )
        );
        checks.push(
          createCheck(
            "runtime-login",
            login.status === 303,
            `login returned ${login.status}`
          )
        );
      } finally {
        await runtime.close();
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "unknown runtime startup error";
      checks.push(createCheck("runtime-start", false, detail));
      checks.push(createCheck("runtime-healthz", false, "skipped because runtime failed to start"));
      checks.push(createCheck("runtime-login", false, "skipped because runtime failed to start"));
    }
  } else {
    checks.push(
      createCheck(
        "runtime-healthz",
        false,
        "skipped because current is not pointing at the target release version"
      )
    );
    checks.push(
      createCheck(
        "runtime-login",
        false,
        "skipped because current is not pointing at the target release version"
      )
    );
  }

  const ready: CombinedControlReleaseRootCutoverTargetReadyResult = {
    kind: "combined-release-root-cutover-target-ready",
    targetId: layout.targetId,
    version: layout.version,
    origin,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.cutoverReadyManifestFile,
    JSON.stringify(ready, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverReadySummaryFile,
    [
      formatCombinedControlReleaseRootCutoverTargetApplyManifest(applyManifest),
      "",
      formatCombinedControlReleaseRootCutoverTargetHistory(history),
      "",
      formatCombinedControlReleaseRootCutoverTargetReady(ready)
    ].join("\n").concat("\n")
  );

  return ready;
}
