import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";

import {
  resolveActiveCombinedControlReleaseSandbox,
  type CombinedControlReleaseSandboxActivationManifest
} from "./release-sandbox-activation.js";
import type { CombinedControlReleaseSandboxPromotionManifest } from "./release-sandbox-promotion.js";
import {
  packCombinedControlReleaseSandbox,
  type PackCombinedControlReleaseSandboxResult
} from "./release-sandbox-pack.js";
import type { CombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseSandboxRuntime {
  readonly kind: "combined-release-sandbox";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly bundle: CombinedControlReleaseSandboxBundle;
  readonly activation: CombinedControlReleaseSandboxActivationManifest;
  readonly promotion: CombinedControlReleaseSandboxPromotionManifest | null;
  readonly env: Readonly<Record<string, string>>;
  readonly startupSummary: string;
  readonly bundleSummary: string;
  readonly packed: PackCombinedControlReleaseSandboxResult;
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

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    entries[key] = value;
  }

  return entries;
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
    } catch (error: unknown) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${origin}/healthz`);
}

async function resolvePort(port: number | undefined): Promise<number> {
  if (typeof port === "number" && port > 0) {
    return port;
  }

  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve an ephemeral port for release-sandbox"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function validateSandboxArtifacts(args: {
  packed: PackCombinedControlReleaseSandboxResult;
  manifest: CombinedControlStartupManifest;
  bundle: CombinedControlReleaseSandboxBundle;
  activation: CombinedControlReleaseSandboxActivationManifest;
  promotion: CombinedControlReleaseSandboxPromotionManifest | null;
  env: Record<string, string>;
  startupSummary: string;
  bundleSummary: string;
}) {
  const {
    packed,
    manifest,
    bundle,
    activation,
    promotion,
    env,
    startupSummary,
    bundleSummary
  } = args;

  if (!existsSync(bundle.paths.releaseEntrypoint)) {
    throw new Error(`Sandbox release entrypoint missing: ${bundle.paths.releaseEntrypoint}`);
  }
  if (!existsSync(bundle.paths.envFile)) {
    throw new Error(`Sandbox env file missing: ${bundle.paths.envFile}`);
  }
  if (!existsSync(bundle.paths.startupManifestFile)) {
    throw new Error(`Sandbox startup manifest missing: ${bundle.paths.startupManifestFile}`);
  }
  if (!existsSync(bundle.paths.bundleManifestFile)) {
    throw new Error(`Sandbox bundle manifest missing: ${bundle.paths.bundleManifestFile}`);
  }
  if (!existsSync(bundle.paths.bundleSummaryFile)) {
    throw new Error(`Sandbox bundle summary missing: ${bundle.paths.bundleSummaryFile}`);
  }
  if (!existsSync(bundle.paths.releasesInventoryFile)) {
    throw new Error(`Sandbox releases inventory missing: ${bundle.paths.releasesInventoryFile}`);
  }
  if (!existsSync(bundle.paths.activationManifestFile)) {
    throw new Error(`Sandbox activation manifest missing: ${bundle.paths.activationManifestFile}`);
  }
  if (!existsSync(bundle.paths.activationSummaryFile)) {
    throw new Error(`Sandbox activation summary missing: ${bundle.paths.activationSummaryFile}`);
  }
  if (promotion && !existsSync(bundle.paths.promotionManifestFile)) {
    throw new Error(`Sandbox promotion manifest missing: ${bundle.paths.promotionManifestFile}`);
  }
  if (promotion && !existsSync(bundle.paths.promotionSummaryFile)) {
    throw new Error(`Sandbox promotion summary missing: ${bundle.paths.promotionSummaryFile}`);
  }
  if (promotion && !existsSync(bundle.paths.promotionHistoryFile)) {
    throw new Error(`Sandbox promotion history missing: ${bundle.paths.promotionHistoryFile}`);
  }
  if (!lstatSync(bundle.paths.currentRoot).isSymbolicLink()) {
    throw new Error(`Sandbox current root is not a symlink: ${bundle.paths.currentRoot}`);
  }
  if (realpathSync(bundle.paths.currentRoot) !== realpathSync(bundle.paths.releaseVersionRoot)) {
    throw new Error("Sandbox current root does not point at the versioned release directory");
  }
  if (activation.activeVersion !== bundle.version) {
    throw new Error("Sandbox activation manifest does not match the active bundle version");
  }
  if (activation.currentEntrypoint !== bundle.paths.currentEntrypoint) {
    throw new Error("Sandbox activation entrypoint does not match the current entrypoint");
  }
  if (promotion && promotion.activeVersion !== activation.activeVersion) {
    throw new Error("Sandbox promotion manifest does not match the active version");
  }
  if (bundle.startup.origin !== manifest.origin) {
    throw new Error(
      `Sandbox bundle origin mismatch: ${bundle.startup.origin} !== ${manifest.origin}`
    );
  }
  if (bundle.paths.releaseEntrypoint !== packed.bundle.paths.releaseEntrypoint) {
    throw new Error("Sandbox release entrypoint does not match packed bundle entrypoint");
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_MODE !== "release-sandbox") {
    throw new Error("Sandbox env did not resolve SIMPLEHOST_CONTROL_SANDBOX_MODE=release-sandbox");
  }
  if (env.SIMPLEHOST_CONTROL_RUNTIME_MODE !== "combined") {
    throw new Error("Sandbox env did not resolve SIMPLEHOST_CONTROL_RUNTIME_MODE=combined");
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN !== manifest.origin) {
    throw new Error("Sandbox env origin does not match startup manifest origin");
  }
  if (!startupSummary.includes(manifest.origin)) {
    throw new Error("Sandbox startup summary does not include runtime origin");
  }
  if (!bundleSummary.includes(bundle.paths.releaseEntrypoint)) {
    throw new Error("Sandbox bundle summary does not include the packed release entrypoint");
  }
}

async function startPackedCombinedControlReleaseSandbox(args: {
  packed: PackCombinedControlReleaseSandboxResult;
}): Promise<CombinedControlReleaseSandboxRuntime> {
  const { layout } = args.packed;
  const active = await resolveActiveCombinedControlReleaseSandbox({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const envFromFile = parseEnvFile(await readFile(active.bundle.paths.envFile, "utf8"));
  const manifest = JSON.parse(
    await readFile(active.bundle.paths.startupManifestFile, "utf8")
  ) as CombinedControlStartupManifest;
  const promotion = existsSync(active.layout.promotionManifestFile)
    ? (JSON.parse(
        await readFile(active.layout.promotionManifestFile, "utf8")
      ) as CombinedControlReleaseSandboxPromotionManifest)
    : null;
  const startupSummary = await readFile(active.layout.startupSummaryFile, "utf8");
  const bundleSummary = await readFile(active.layout.bundleSummaryFile, "utf8");
  validateSandboxArtifacts({
    packed: args.packed,
    manifest,
    bundle: active.bundle,
    activation: active.activation,
    promotion,
    env: envFromFile,
    startupSummary,
    bundleSummary
  });
  const stdoutLog: string[] = [];
  const stderrLog: string[] = [];
  const child = spawn(process.execPath, [active.activation.currentEntrypoint], {
    cwd: active.layout.currentRoot,
    env: {
      ...process.env,
      ...envFromFile
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdoutLog.push(chunk);
  });
  child.stderr?.on("data", (chunk: string) => {
    stderrLog.push(chunk);
  });

  const runtime = {
    kind: "combined-release-sandbox" as const,
    origin: manifest.origin,
    manifest,
    bundle: active.bundle,
    activation: active.activation,
    promotion,
    env: envFromFile,
    startupSummary,
    bundleSummary,
    packed: args.packed,
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

      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
      });
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

export async function startExistingCombinedControlReleaseSandbox(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseSandboxRuntime> {
  const active = await resolveActiveCombinedControlReleaseSandbox(args);
  const originMatch = active.bundle.startup.origin.match(/:(\d+)$/);
  const port =
    typeof args.port === "number"
      ? args.port
      : originMatch
        ? Number(originMatch[1])
        : 0;
  const packed = await packCombinedControlReleaseSandbox({
    workspaceRoot: active.layout.workspaceRoot,
    sandboxId: active.layout.sandboxId,
    version: active.activation.activeVersion,
    host: args.host,
    port,
    clean: false
  });

  return startPackedCombinedControlReleaseSandbox({ packed });
}

export async function startCombinedControlReleaseSandbox(args: {
  host?: string;
  port?: number;
  sandboxId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseSandboxRuntime> {
  const host = args.host ?? "127.0.0.1";
  const port = await resolvePort(args.port);
  const packed = await packCombinedControlReleaseSandbox({
    ...args,
    host,
    port
  });

  return startPackedCombinedControlReleaseSandbox({ packed });
}
