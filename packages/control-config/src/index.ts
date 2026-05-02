import { readFileSync } from "node:fs";

export interface ControlListenerConfig {
  host: string;
  port: number;
}

export interface ControlWorkerConfig {
  pollIntervalMs: number;
  reconciliationIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface ControlDatabaseRuntimeConfig {
  url: string;
}

export interface ControlAuthRuntimeConfig {
  bootstrapEnrollmentToken: string | null;
  bootstrapAdminEmail: string | null;
  bootstrapAdminPassword: string | null;
  bootstrapAdminName: string | null;
  sessionTtlSeconds: number;
}

export interface ControlJobRuntimeConfig {
  payloadSecret: string | null;
}

export interface ControlRustDeskRuntimeConfig {
  publicHostname: string | null;
  txtRecordFqdn: string | null;
  primaryNodeId: string | null;
  primaryDnsTarget: string | null;
  secondaryNodeId: string | null;
  secondaryDnsTarget: string | null;
}

export interface ControlRuntimeConfig {
  env: string;
  version: string;
  api: ControlListenerConfig;
  web: ControlListenerConfig;
  worker: ControlWorkerConfig;
  database: ControlDatabaseRuntimeConfig;
  auth: ControlAuthRuntimeConfig;
  jobs: ControlJobRuntimeConfig;
  rustdesk: ControlRustDeskRuntimeConfig;
}

function readPackageVersion(fallback: string): string {
  try {
    const payload = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: string };
    return typeof payload.version === "string" && payload.version.trim().length > 0
      ? payload.version.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

function readString(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readOptionalString(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function createControlRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ControlRuntimeConfig {
  const defaultVersion = readPackageVersion("0000.00.00");

  return {
    env: readString(env.NODE_ENV, "development"),
    version: readString(env.SIMPLEHOST_VERSION, defaultVersion),
    api: {
      host: readString(env.SIMPLEHOST_API_HOST, "127.0.0.1"),
      port: readPort(env.SIMPLEHOST_API_PORT, 3100)
    },
    web: {
      host: readString(env.SIMPLEHOST_WEB_HOST, "127.0.0.1"),
      port: readPort(env.SIMPLEHOST_WEB_PORT, 3200)
    },
    worker: {
      pollIntervalMs: readPositiveInt(env.SIMPLEHOST_WORKER_POLL_INTERVAL_MS, 5000),
      reconciliationIntervalMs: readPositiveInt(
        env.SIMPLEHOST_WORKER_RECONCILE_INTERVAL_MS,
        5 * 60 * 1000
      ),
      logLevel: readString(env.SIMPLEHOST_LOG_LEVEL, "info") as ControlWorkerConfig["logLevel"]
    },
    database: {
      url: readString(
        env.SIMPLEHOST_DATABASE_URL,
        "postgresql://simplehost_control:change-me@127.0.0.1:5433/simplehost_control"
      )
    },
    auth: {
      bootstrapEnrollmentToken: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ENROLLMENT_TOKEN),
      bootstrapAdminEmail: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_EMAIL),
      bootstrapAdminPassword: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_PASSWORD),
      bootstrapAdminName: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_NAME),
      sessionTtlSeconds: readPositiveInt(env.SIMPLEHOST_SESSION_TTL_SECONDS, 43200)
    },
    jobs: {
      payloadSecret:
        readOptionalString(env.SIMPLEHOST_JOB_SECRET_KEY) ??
        readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ENROLLMENT_TOKEN)
    },
    rustdesk: {
      publicHostname: readOptionalString(env.SIMPLEHOST_RUSTDESK_PUBLIC_HOSTNAME),
      txtRecordFqdn: readOptionalString(env.SIMPLEHOST_RUSTDESK_TXT_FQDN),
      primaryNodeId: readOptionalString(env.SIMPLEHOST_RUSTDESK_PRIMARY_NODE_ID),
      primaryDnsTarget: readOptionalString(env.SIMPLEHOST_RUSTDESK_PRIMARY_DNS_TARGET),
      secondaryNodeId: readOptionalString(env.SIMPLEHOST_RUSTDESK_SECONDARY_NODE_ID),
      secondaryDnsTarget: readOptionalString(env.SIMPLEHOST_RUSTDESK_SECONDARY_DNS_TARGET)
    }
  };
}
