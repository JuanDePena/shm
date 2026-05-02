import { type Dirent } from "node:fs";
import { readdir, readFile, stat, statfs } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

import { type ControlWebRuntimeConfig } from "./web-routes.js";

export const OVERVIEW_METRICS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const DEFAULT_SOURCE_ROOT = "/opt/simplehostman/src";
const EXCLUDED_SOURCE_DIRECTORIES = new Set([
  ".git",
  ".tmp",
  "dist",
  "docs",
  "node_modules"
]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".env",
  ".example",
  ".html",
  ".ini",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".service",
  ".sh",
  ".sql",
  ".timer",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);

export interface OverviewSourceCodeMetrics {
  lineCount: number;
  sizeBytes: number;
  fileCount: number;
  directoryCount: number;
}

export interface OverviewSystemMetrics {
  hostname: string;
  cpuCores: number;
  cpuLoadPercent: number;
  memoryTotalBytes: number;
  memoryFreeBytes: number;
  storageTotalBytes: number;
  storageAvailableBytes: number;
  controlService: string;
  version: string;
  currentIpv4: string | null;
}

export interface OverviewMetricsSnapshot {
  generatedAt: string;
  sourceCode: OverviewSourceCodeMetrics;
  system: OverviewSystemMetrics;
  error?: string;
}

export interface OverviewMetricsCollector {
  getSnapshot(): OverviewMetricsSnapshot;
  refresh(): Promise<void>;
  close(): void;
}

export function createOverviewMetricsCollector(args: {
  config: ControlWebRuntimeConfig;
  intervalMs?: number;
  sourceRoot?: string;
}): OverviewMetricsCollector {
  const intervalMs = args.intervalMs ?? OVERVIEW_METRICS_REFRESH_INTERVAL_MS;
  let snapshot = createInitialSnapshot(args.config);
  let refreshPromise: Promise<void> | undefined;

  async function refresh(): Promise<void> {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = collectOverviewMetrics(args.config, args.sourceRoot)
      .then((nextSnapshot) => {
        snapshot = nextSnapshot;
      })
      .catch((error: unknown) => {
        snapshot = {
          ...snapshot,
          generatedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        };
      })
      .finally(() => {
        refreshPromise = undefined;
      });

    return refreshPromise;
  }

  const timer = setInterval(() => {
    void refresh();
  }, intervalMs);
  timer.unref();

  void refresh();

  return {
    getSnapshot: () => snapshot,
    refresh,
    close: () => {
      clearInterval(timer);
    }
  };
}

async function collectOverviewMetrics(
  config: ControlWebRuntimeConfig,
  sourceRootOverride: string | undefined
): Promise<OverviewMetricsSnapshot> {
  const sourceRoot = await resolveSourceRoot(sourceRootOverride);
  const [sourceCodeResult, storageResult] = await Promise.allSettled([
    collectSourceCodeMetrics(sourceRoot),
    collectStorageMetrics(sourceRoot)
  ]);
  const errors = [
    sourceCodeResult.status === "rejected" ? formatError(sourceCodeResult.reason) : null,
    storageResult.status === "rejected" ? formatError(storageResult.reason) : null
  ].filter((message): message is string => Boolean(message));

  return {
    generatedAt: new Date().toISOString(),
    sourceCode:
      sourceCodeResult.status === "fulfilled"
        ? sourceCodeResult.value
        : createEmptySourceCodeMetrics(),
    system: {
      ...collectSystemMetrics(config),
      ...(storageResult.status === "fulfilled"
        ? storageResult.value
        : {
            storageTotalBytes: 0,
            storageAvailableBytes: 0
          })
    },
    ...(errors.length > 0 ? { error: errors.join("; ") } : {})
  };
}

function createInitialSnapshot(config: ControlWebRuntimeConfig): OverviewMetricsSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    sourceCode: {
      ...createEmptySourceCodeMetrics()
    },
    system: {
      ...collectSystemMetrics(config),
      storageTotalBytes: 0,
      storageAvailableBytes: 0
    }
  };
}

function createEmptySourceCodeMetrics(): OverviewSourceCodeMetrics {
  return {
    lineCount: 0,
    sizeBytes: 0,
    fileCount: 0,
    directoryCount: 0
  };
}

async function resolveSourceRoot(sourceRootOverride: string | undefined): Promise<string> {
  const candidates = [
    sourceRootOverride,
    process.env.SIMPLEHOST_SOURCE_ROOT,
    DEFAULT_SOURCE_ROOT,
    process.cwd()
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    try {
      const candidateStat = await stat(candidate);

      if (candidateStat.isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return process.cwd();
}

async function collectSourceCodeMetrics(sourceRoot: string): Promise<OverviewSourceCodeMetrics> {
  const totals: OverviewSourceCodeMetrics = {
    lineCount: 0,
    sizeBytes: 0,
    fileCount: 0,
    directoryCount: 0
  };

  async function visitDirectory(directory: string): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await readdir(directory, {
        withFileTypes: true
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_SOURCE_DIRECTORIES.has(entry.name)) {
          continue;
        }

        totals.directoryCount += 1;
        await visitDirectory(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      let fileStat: Awaited<ReturnType<typeof stat>>;

      try {
        fileStat = await stat(entryPath);
      } catch {
        continue;
      }

      totals.fileCount += 1;
      totals.sizeBytes += fileStat.size;

      if (isTextFile(entry.name)) {
        try {
          totals.lineCount += countLines(await readFile(entryPath, "utf8"));
        } catch {
          continue;
        }
      }
    }
  }

  await visitDirectory(sourceRoot);
  return totals;
}

async function collectStorageMetrics(sourceRoot: string): Promise<{
  storageTotalBytes: number;
  storageAvailableBytes: number;
}> {
  const filesystemStats = await statfs(sourceRoot);

  return {
    storageTotalBytes: filesystemStats.blocks * filesystemStats.bsize,
    storageAvailableBytes: filesystemStats.bavail * filesystemStats.bsize
  };
}

function collectSystemMetrics(config: ControlWebRuntimeConfig): Omit<
  OverviewSystemMetrics,
  "storageTotalBytes" | "storageAvailableBytes"
> {
  const cpuCores = Math.max(os.cpus().length, 1);
  const loadAverage = os.loadavg()[0] ?? 0;

  return {
    hostname: os.hostname(),
    cpuCores,
    cpuLoadPercent: Math.max(0, (loadAverage / cpuCores) * 100),
    memoryTotalBytes: os.totalmem(),
    memoryFreeBytes: os.freemem(),
    controlService: `${config.web.host}:${config.web.port}`,
    version: config.version,
    currentIpv4: getCurrentIpv4()
  };
}

function getCurrentIpv4(): string | null {
  const candidates = Object.values(os.networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  return candidates.find((address) => !isPrivateIpv4(address)) ?? candidates[0] ?? null;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isTextFile(fileName: string): boolean {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) {
    return false;
  }

  return TEXT_EXTENSIONS.has(fileName.slice(dotIndex).toLowerCase());
}

function countLines(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  const newlineCount = value.match(/\n/g)?.length ?? 0;
  return value.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
