import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface ShmRuntimeConfig {
  nodeId: string;
  hostname: string;
  controlPlaneUrl: string;
  configPath: string;
  stateDir: string;
  logDir: string;
  heartbeatMs: number;
  version: string;
}

export interface ShmStatePaths {
  nodeIdentityFile: string;
  lastAppliedStateFile: string;
  jobSpoolDir: string;
  reportBufferDir: string;
}

function readString(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function createShmRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ShmRuntimeConfig {
  const hostname = readString(env.SHM_HOSTNAME, os.hostname());

  return {
    nodeId: readString(env.SHM_NODE_ID, hostname),
    hostname,
    controlPlaneUrl: readString(
      env.SHM_CONTROL_PLANE_URL,
      "https://shp.internal.example"
    ),
    configPath: readString(env.SHM_CONFIG_PATH, "/etc/shm/config.yaml"),
    stateDir: readString(env.SHM_STATE_DIR, "/var/lib/shm"),
    logDir: readString(env.SHM_LOG_DIR, "/var/log/shm"),
    heartbeatMs: readPositiveInt(env.SHM_HEARTBEAT_MS, 10000),
    version: readString(env.SHM_VERSION, "0.1.0")
  };
}

export function getShmStatePaths(config: ShmRuntimeConfig): ShmStatePaths {
  return {
    nodeIdentityFile: path.join(config.stateDir, "node-identity.json"),
    lastAppliedStateFile: path.join(config.stateDir, "last-applied-state.json"),
    jobSpoolDir: path.join(config.stateDir, "job-spool"),
    reportBufferDir: path.join(config.stateDir, "report-buffer")
  };
}

export async function ensureShmStateDirectories(config: ShmRuntimeConfig): Promise<void> {
  const paths = getShmStatePaths(config);

  await mkdir(config.stateDir, { recursive: true });
  await mkdir(config.logDir, { recursive: true });
  await mkdir(paths.jobSpoolDir, { recursive: true });
  await mkdir(paths.reportBufferDir, { recursive: true });
}

export async function writeJsonFileAtomic(
  targetPath: string,
  payload: unknown
): Promise<void> {
  const temporaryPath = `${targetPath}.tmp`;

  await writeFile(temporaryPath, JSON.stringify(payload, null, 2));
  await rename(temporaryPath, targetPath);
}

export async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  try {
    const content = await readFile(targetPath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
