import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { registerGracefulShutdown } from "@simplehost/control-shared";

import {
  applyCombinedControlReleaseRootPromotion,
  readCombinedControlReleaseRootPromotionApplyManifest,
  type CombinedControlReleaseRootPromotionApplyManifest
} from "./release-root-promotion.js";
import {
  createCombinedControlReleaseRootPromotionLayout,
  type CombinedControlReleaseRootPromotionLayout
} from "./release-root-promotion-layout.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseRootPromotionRuntime {
  readonly kind: "combined-control-release-root-promotion";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly applyManifest: CombinedControlReleaseRootPromotionApplyManifest;
  readonly startupSummary: string;
  readonly applySummary: string;
  readonly layout: CombinedControlReleaseRootPromotionLayout;
  readonly child: ChildProcess;
  readonly stdoutLog: string[];
  readonly stderrLog: string[];
  close(): Promise<void>;
}

function parseEnvFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    entries[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }
  return entries;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function waitForHealthz(origin: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/healthz", origin));
      if (response.ok) {
        return;
      }
      lastError = new Error(`healthz returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${origin}/healthz`);
}

function validateReleaseRootPromotionArtifacts(args: {
  layout: CombinedControlReleaseRootPromotionLayout;
  manifest: CombinedControlStartupManifest;
  applyManifest: CombinedControlReleaseRootPromotionApplyManifest;
  env: Record<string, string>;
  startupSummary: string;
  applySummary: string;
}) {
  const { layout, manifest, applyManifest, env, startupSummary, applySummary } = args;

  if (!existsSync(layout.releaseEntrypoint)) {
    throw new Error(`Release-root promotion entrypoint missing: ${layout.releaseEntrypoint}`);
  }
  if (!existsSync(layout.envFile)) {
    throw new Error(`Release-root promotion env file missing: ${layout.envFile}`);
  }
  if (!existsSync(layout.startupManifestFile)) {
    throw new Error(
      `Release-root promotion startup manifest missing: ${layout.startupManifestFile}`
    );
  }
  if (!existsSync(layout.applyManifestFile)) {
    throw new Error(
      `Release-root promotion apply manifest missing: ${layout.applyManifestFile}`
    );
  }
  if (!existsSync(layout.releasesInventoryFile)) {
    throw new Error(
      `Release-root promotion inventory missing: ${layout.releasesInventoryFile}`
    );
  }
  if (!existsSync(layout.activationManifestFile)) {
    throw new Error(
      `Release-root promotion activation manifest missing: ${layout.activationManifestFile}`
    );
  }
  if (!existsSync(layout.promotionManifestFile)) {
    throw new Error(
      `Release-root promotion manifest missing: ${layout.promotionManifestFile}`
    );
  }
  if (!existsSync(layout.deployManifestFile)) {
    throw new Error(
      `Release-root promotion deploy manifest missing: ${layout.deployManifestFile}`
    );
  }
  if (!existsSync(layout.rollbackManifestFile)) {
    throw new Error(
      `Release-root promotion rollback manifest missing: ${layout.rollbackManifestFile}`
    );
  }
  if (!existsSync(layout.handoffManifestFile)) {
    throw new Error(
      `Release-root promotion handoff manifest missing: ${layout.handoffManifestFile}`
    );
  }
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(
      `Release-root promotion current root is not a symlink: ${layout.currentRoot}`
    );
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(layout.releaseVersionRoot)) {
    throw new Error(
      "Release-root promotion current root does not point at the versioned release"
    );
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN !== manifest.origin) {
    throw new Error(
      "Release-root promotion env origin does not match startup manifest origin"
    );
  }
  if (applyManifest.targetReleaseRoot !== layout.releaseRoot) {
    throw new Error(
      "Release-root promotion apply manifest does not point at the emulated live release root"
    );
  }
  if (!startupSummary.includes(manifest.origin)) {
    throw new Error(
      "Release-root promotion startup summary does not include runtime origin"
    );
  }
  if (!applySummary.includes(layout.releaseRoot)) {
    throw new Error(
      "Release-root promotion apply summary does not include the emulated live release root"
    );
  }
  if (
    existsSync(layout.actualCurrentRoot) &&
    realpathSync(layout.actualCurrentRoot).startsWith(layout.targetRoot)
  ) {
    throw new Error("Actual release current root unexpectedly points into the promotion target");
  }
}

async function startAppliedReleaseRootPromotion(args: {
  layout: CombinedControlReleaseRootPromotionLayout;
}): Promise<CombinedControlReleaseRootPromotionRuntime> {
  const envFromFile = parseEnvFile(await readFile(args.layout.envFile, "utf8"));
  const manifest = readJsonFile<CombinedControlStartupManifest>(args.layout.startupManifestFile);
  const applyManifest = readJsonFile<CombinedControlReleaseRootPromotionApplyManifest>(
    args.layout.applyManifestFile
  );
  const startupSummary = await readFile(args.layout.startupSummaryFile, "utf8");
  const applySummary = await readFile(args.layout.applySummaryFile, "utf8");

  validateReleaseRootPromotionArtifacts({
    layout: args.layout,
    manifest,
    applyManifest,
    env: envFromFile,
    startupSummary,
    applySummary
  });

  const stdoutLog: string[] = [];
  const stderrLog: string[] = [];
  const child = spawn(process.execPath, [args.layout.currentEntrypoint], {
    cwd: args.layout.currentRoot,
    env: {
      ...process.env,
      ...envFromFile
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => stdoutLog.push(chunk));
  child.stderr?.on("data", (chunk: string) => stderrLog.push(chunk));

  const runtime: CombinedControlReleaseRootPromotionRuntime = {
    kind: "combined-control-release-root-promotion",
    origin: manifest.origin,
    manifest,
    applyManifest,
    startupSummary,
    applySummary,
    layout: args.layout,
    child,
    stdoutLog,
    stderrLog,
    close: async () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
  };

  try {
    await waitForHealthz(runtime.origin);
    return runtime;
  } catch (error) {
    await runtime.close().catch(() => {});
    throw error;
  }
}

export async function startCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionRuntime> {
  const applied = await applyCombinedControlReleaseRootPromotion(args);
  return startAppliedReleaseRootPromotion({ layout: applied.layout });
}

export async function startExistingCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionRuntime> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const applyManifest =
    (await readCombinedControlReleaseRootPromotionApplyManifest(args)) ??
    (() => {
      throw new Error("Release-root promotion apply state is incomplete");
    })();
  void applyManifest;
  return startAppliedReleaseRootPromotion({ layout });
}

export function registerCombinedControlReleaseRootPromotionShutdown(
  runtime: CombinedControlReleaseRootPromotionRuntime
) {
  registerGracefulShutdown(runtime.close, {
    onShutdownError: (error) => {
      console.error(error);
    }
  });
}
