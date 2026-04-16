import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";

import {
  packCombinedControlReleaseSandbox,
  type PackCombinedControlReleaseSandboxResult
} from "./release-sandbox-pack.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseSandboxRuntime {
  readonly kind: "combined-release-sandbox";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
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

export async function startCombinedControlReleaseSandbox(args: {
  host?: string;
  port?: number;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxRuntime> {
  const host = args.host ?? "127.0.0.1";
  const port = await resolvePort(args.port);
  const packed = await packCombinedControlReleaseSandbox({
    ...args,
    host,
    port
  });
  const envFromFile = parseEnvFile(await readFile(packed.bundle.envFile, "utf8"));
  const manifest = JSON.parse(
    await readFile(packed.bundle.startupManifestFile, "utf8")
  ) as CombinedControlStartupManifest;
  const stdoutLog: string[] = [];
  const stderrLog: string[] = [];
  const child = spawn(process.execPath, [packed.bundle.entrypoint], {
    cwd: packed.layout.currentRoot,
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
    packed,
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
