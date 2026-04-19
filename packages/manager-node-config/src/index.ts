import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface ShmRuntimeConfig {
  nodeId: string;
  hostname: string;
  controlPlaneUrl: string;
  enrollmentToken: string | null;
  configPath: string;
  stateDir: string;
  logDir: string;
  heartbeatMs: number;
  version: string;
  services: {
    containers: {
      quadletDir: string;
      envDir: string;
      stagingDir: string;
    };
    httpd: {
      sitesDir: string;
      stagingDir: string;
    };
    pdns: {
      apiUrl: string | null;
      apiKey: string | null;
      serverId: string;
      stagingDir: string;
    };
    postgresql: {
      adminUrl: string | null;
    };
    mariadb: {
      adminUrl: string | null;
    };
    codeServer: {
      serviceName: string;
      configPath: string;
      settingsPath: string;
      stagingDir: string;
    };
    packages: {
      stagingDir: string;
    };
    rustdesk: {
      hbbsServiceName: string;
      hbbrServiceName: string;
      publicKeyPath: string;
    };
    mail: {
      stagingDir: string;
      statePath: string;
      configRoot: string;
      vmailRoot: string;
      dkimRoot: string;
      roundcubeRoot: string;
      postfixServiceName: string;
      dovecotServiceName: string;
      rspamdServiceName: string;
      redisServiceName: string;
    };
    apps: {
      rootDir: string;
      servicePrefix: string;
    };
  };
}

export interface ShmStatePaths {
  nodeIdentityFile: string;
  lastAppliedStateFile: string;
  jobSpoolDir: string;
  reportBufferDir: string;
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

export function createShmRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ShmRuntimeConfig {
  const hostname = readString(env.SHM_HOSTNAME, os.hostname());
  const stateDir = readString(env.SHM_STATE_DIR, "/var/lib/simplehost");
  const defaultVersion = readPackageVersion("0000.00.00");

  return {
    nodeId: readString(env.SHM_NODE_ID, hostname),
    hostname,
    controlPlaneUrl: readString(
      env.SHM_CONTROL_PLANE_URL,
      "http://127.0.0.1:3100"
    ),
    enrollmentToken: readOptionalString(env.SHM_ENROLLMENT_TOKEN),
    configPath: readString(env.SHM_CONFIG_PATH, "/etc/simplehost/agent.config.yaml"),
    stateDir,
    logDir: readString(env.SHM_LOG_DIR, "/var/log/simplehost"),
    heartbeatMs: readPositiveInt(env.SHM_HEARTBEAT_MS, 10000),
    version: readString(env.SHM_VERSION, defaultVersion),
    services: {
      containers: {
        quadletDir: readString(
          env.SHM_CONTAINERS_QUADLET_DIR,
          "/etc/containers/systemd"
        ),
        envDir: readString(
          env.SHM_CONTAINERS_ENV_DIR,
          "/etc/containers/systemd/env"
        ),
        stagingDir: readString(
          env.SHM_CONTAINERS_STAGING_DIR,
          path.join(stateDir, "staging", "containers")
        )
      },
      httpd: {
        sitesDir: readString(env.SHM_HTTPD_SITES_DIR, "/etc/httpd/conf.d"),
        stagingDir: readString(
          env.SHM_HTTPD_STAGING_DIR,
          path.join(stateDir, "staging", "httpd")
        )
      },
      pdns: {
        apiUrl: readOptionalString(env.SHM_PDNS_API_URL),
        apiKey: readOptionalString(env.SHM_PDNS_API_KEY),
        serverId: readString(env.SHM_PDNS_SERVER_ID, "localhost"),
        stagingDir: readString(
          env.SHM_PDNS_STAGING_DIR,
          path.join(stateDir, "staging", "pdns")
        )
      },
      postgresql: {
        adminUrl: readOptionalString(env.SHM_POSTGRES_ADMIN_URL)
      },
      mariadb: {
        adminUrl: readOptionalString(env.SHM_MARIADB_ADMIN_URL)
      },
      codeServer: {
        serviceName: readString(
          env.SHM_CODE_SERVER_SERVICE_NAME,
          "code-server@root.service"
        ),
        configPath: readString(
          env.SHM_CODE_SERVER_CONFIG_PATH,
          "/root/.config/code-server/config.yaml"
        ),
        settingsPath: readString(
          env.SHM_CODE_SERVER_SETTINGS_PATH,
          "/root/.local/share/code-server/User/settings.json"
        ),
        stagingDir: readString(
          env.SHM_CODE_SERVER_STAGING_DIR,
          path.join(stateDir, "staging", "code-server")
        )
      },
      packages: {
        stagingDir: readString(
          env.SHM_PACKAGES_STAGING_DIR,
          path.join(stateDir, "staging", "packages")
        )
      },
      rustdesk: {
        hbbsServiceName: readString(
          env.SHM_RUSTDESK_HBBS_SERVICE_NAME,
          "rustdesk-hbbs.service"
        ),
        hbbrServiceName: readString(
          env.SHM_RUSTDESK_HBBR_SERVICE_NAME,
          "rustdesk-hbbr.service"
        ),
        publicKeyPath: readString(
          env.SHM_RUSTDESK_PUBLIC_KEY_PATH,
          "/srv/containers/rustdesk/data/id_ed25519.pub"
        )
      },
      mail: {
        stagingDir: readString(
          env.SHM_MAIL_STAGING_DIR,
          path.join(stateDir, "staging", "mail")
        ),
        statePath: readString(
          env.SHM_MAIL_STATE_PATH,
          "/srv/mail/config/desired-state.json"
        ),
        configRoot: readString(
          env.SHM_MAIL_CONFIG_ROOT,
          "/srv/mail/config"
        ),
        vmailRoot: readString(
          env.SHM_MAIL_VMAIL_ROOT,
          "/srv/mail/vmail"
        ),
        dkimRoot: readString(
          env.SHM_MAIL_DKIM_ROOT,
          "/srv/mail/dkim"
        ),
        roundcubeRoot: readString(
          env.SHM_MAIL_ROUNDCUBE_ROOT,
          "/srv/www/roundcube"
        ),
        postfixServiceName: readString(
          env.SHM_MAIL_POSTFIX_SERVICE_NAME,
          "postfix.service"
        ),
        dovecotServiceName: readString(
          env.SHM_MAIL_DOVECOT_SERVICE_NAME,
          "dovecot.service"
        ),
        rspamdServiceName: readString(
          env.SHM_MAIL_RSPAMD_SERVICE_NAME,
          "rspamd.service"
        ),
        redisServiceName: readString(
          env.SHM_MAIL_REDIS_SERVICE_NAME,
          "redis.service"
        )
      },
      apps: {
        rootDir: readString(
          env.SHM_APPS_ROOT_DIR,
          "/srv/containers/apps"
        ),
        servicePrefix: readString(
          env.SHM_APPS_SERVICE_PREFIX,
          "app-"
        )
      }
    }
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

export async function listJsonFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directoryPath, entry.name))
      .sort();
  } catch {
    return [];
  }
}

export async function removeFileIfExists(targetPath: string): Promise<void> {
  await rm(targetPath, { force: true });
}
