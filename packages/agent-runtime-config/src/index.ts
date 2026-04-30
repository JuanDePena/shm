import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface AgentRuntimeConfig {
  nodeId: string;
  hostname: string;
  controlPlaneUrl: string;
  enrollmentToken: string | null;
  configPath: string;
  stateDir: string;
  logDir: string;
  heartbeatMs: number;
  runtimeSnapshotIntervalMs: number;
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
      policyRoot: string;
      vmailUser: string;
      vmailGroup: string;
      dkimRoot: string;
      roundcubeRoot: string;
      roundcubeSharedRoot: string;
      roundcubeUser: string;
      roundcubeGroup: string;
      roundcubeConfigPath: string;
      roundcubeDatabasePath: string;
      roundcubeDatabaseDsn: string | null;
      roundcubePackageRoot: string;
      roundcubeDefaultHttpdConfPath: string;
      firewallServiceName: string;
      firewallServicePath: string;
      postfixServiceName: string;
      dovecotServiceName: string;
      rspamdServiceName: string;
      redisServiceName: string;
      postfixPackageTargets: string[];
      dovecotPackageTargets: string[];
      rspamdPackageTargets: string[];
      redisPackageTargets: string[];
      roundcubePackageTargets: string[];
    };
    apps: {
      rootDir: string;
      servicePrefix: string;
    };
  };
}

export interface AgentStatePaths {
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

function readList(value: string | undefined, fallback: string[]): string[] {
  if (!value || value.trim().length === 0) {
    return [...fallback];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

export function createAgentRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): AgentRuntimeConfig {
  const hostname = readString(env.SIMPLEHOST_HOSTNAME, os.hostname());
  const stateDir = readString(env.SIMPLEHOST_STATE_DIR, "/var/lib/simplehost");
  const defaultVersion = readPackageVersion("0000.00.00");

  return {
    nodeId: readString(env.SIMPLEHOST_NODE_ID, hostname),
    hostname,
    controlPlaneUrl: readString(
      env.SIMPLEHOST_CONTROL_PLANE_URL,
      "http://127.0.0.1:3200"
    ),
    enrollmentToken: readOptionalString(env.SIMPLEHOST_ENROLLMENT_TOKEN),
    configPath: readString(env.SIMPLEHOST_CONFIG_PATH, "/etc/simplehost/agent.config.yaml"),
    stateDir,
    logDir: readString(env.SIMPLEHOST_LOG_DIR, "/var/log/simplehost"),
    heartbeatMs: readPositiveInt(env.SIMPLEHOST_HEARTBEAT_MS, 10000),
    runtimeSnapshotIntervalMs: readPositiveInt(
      env.SIMPLEHOST_AGENT_RUNTIME_SNAPSHOT_INTERVAL_MS ??
        env.SIMPLEHOST_RUNTIME_SNAPSHOT_INTERVAL_MS,
      60000
    ),
    version: readString(env.SIMPLEHOST_VERSION, defaultVersion),
    services: {
      containers: {
        quadletDir: readString(
          env.SIMPLEHOST_CONTAINERS_QUADLET_DIR,
          "/etc/containers/systemd"
        ),
        envDir: readString(
          env.SIMPLEHOST_CONTAINERS_ENV_DIR,
          "/etc/containers/systemd/env"
        ),
        stagingDir: readString(
          env.SIMPLEHOST_CONTAINERS_STAGING_DIR,
          path.join(stateDir, "staging", "containers")
        )
      },
      httpd: {
        sitesDir: readString(env.SIMPLEHOST_HTTPD_SITES_DIR, "/etc/httpd/conf.d"),
        stagingDir: readString(
          env.SIMPLEHOST_HTTPD_STAGING_DIR,
          path.join(stateDir, "staging", "httpd")
        )
      },
      pdns: {
        apiUrl: readOptionalString(env.SIMPLEHOST_PDNS_API_URL),
        apiKey: readOptionalString(env.SIMPLEHOST_PDNS_API_KEY),
        serverId: readString(env.SIMPLEHOST_PDNS_SERVER_ID, "localhost"),
        stagingDir: readString(
          env.SIMPLEHOST_PDNS_STAGING_DIR,
          path.join(stateDir, "staging", "pdns")
        )
      },
      postgresql: {
        adminUrl: readOptionalString(env.SIMPLEHOST_POSTGRES_ADMIN_URL)
      },
      mariadb: {
        adminUrl: readOptionalString(env.SIMPLEHOST_MARIADB_ADMIN_URL)
      },
      codeServer: {
        serviceName: readString(
          env.SIMPLEHOST_CODE_SERVER_SERVICE_NAME,
          "code-server@root.service"
        ),
        configPath: readString(
          env.SIMPLEHOST_CODE_SERVER_CONFIG_PATH,
          "/root/.config/code-server/config.yaml"
        ),
        settingsPath: readString(
          env.SIMPLEHOST_CODE_SERVER_SETTINGS_PATH,
          "/root/.local/share/code-server/User/settings.json"
        ),
        stagingDir: readString(
          env.SIMPLEHOST_CODE_SERVER_STAGING_DIR,
          path.join(stateDir, "staging", "code-server")
        )
      },
      packages: {
        stagingDir: readString(
          env.SIMPLEHOST_PACKAGES_STAGING_DIR,
          path.join(stateDir, "staging", "packages")
        )
      },
      rustdesk: {
        hbbsServiceName: readString(
          env.SIMPLEHOST_RUSTDESK_HBBS_SERVICE_NAME,
          "rustdesk-hbbs.service"
        ),
        hbbrServiceName: readString(
          env.SIMPLEHOST_RUSTDESK_HBBR_SERVICE_NAME,
          "rustdesk-hbbr.service"
        ),
        publicKeyPath: readString(
          env.SIMPLEHOST_RUSTDESK_PUBLIC_KEY_PATH,
          "/srv/containers/rustdesk/data/id_ed25519.pub"
        )
      },
      mail: {
        stagingDir: readString(
          env.SIMPLEHOST_MAIL_STAGING_DIR,
          path.join(stateDir, "staging", "mail")
        ),
        statePath: readString(
          env.SIMPLEHOST_MAIL_STATE_PATH,
          "/srv/mail/config/desired-state.json"
        ),
        configRoot: readString(
          env.SIMPLEHOST_MAIL_CONFIG_ROOT,
          "/srv/mail/config"
        ),
        vmailRoot: readString(
          env.SIMPLEHOST_MAIL_VMAIL_ROOT,
          "/srv/mail/vmail"
        ),
        policyRoot: readString(
          env.SIMPLEHOST_MAIL_POLICY_ROOT,
          "/srv/www/mail-policies"
        ),
        vmailUser: readString(env.SIMPLEHOST_MAIL_VMAIL_USER, "vmail"),
        vmailGroup: readString(env.SIMPLEHOST_MAIL_VMAIL_GROUP, "vmail"),
        dkimRoot: readString(
          env.SIMPLEHOST_MAIL_DKIM_ROOT,
          "/srv/mail/dkim"
        ),
        roundcubeRoot: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_ROOT,
          "/srv/www/roundcube"
        ),
        roundcubeSharedRoot: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_SHARED_ROOT,
          "/srv/www/roundcube/_shared"
        ),
        roundcubeUser: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_USER,
          "apache"
        ),
        roundcubeGroup: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_GROUP,
          "apache"
        ),
        roundcubeConfigPath: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_CONFIG_PATH,
          "/etc/roundcubemail/config.inc.php"
        ),
        roundcubeDatabasePath: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_DATABASE_PATH,
          "/srv/www/roundcube/_shared/roundcube.sqlite"
        ),
        roundcubeDatabaseDsn: readOptionalString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_DATABASE_DSN
        ),
        roundcubePackageRoot: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_PACKAGE_ROOT,
          "/usr/share/roundcubemail"
        ),
        roundcubeDefaultHttpdConfPath: readString(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_DEFAULT_HTTPD_CONF_PATH,
          "/etc/httpd/conf.d/roundcubemail.conf"
        ),
        firewallServiceName: readString(
          env.SIMPLEHOST_MAIL_FIREWALL_SERVICE_NAME,
          "simplehost-mail"
        ),
        firewallServicePath: readString(
          env.SIMPLEHOST_MAIL_FIREWALL_SERVICE_PATH,
          "/etc/firewalld/services/simplehost-mail.xml"
        ),
        postfixServiceName: readString(
          env.SIMPLEHOST_MAIL_POSTFIX_SERVICE_NAME,
          "postfix.service"
        ),
        dovecotServiceName: readString(
          env.SIMPLEHOST_MAIL_DOVECOT_SERVICE_NAME,
          "dovecot.service"
        ),
        rspamdServiceName: readString(
          env.SIMPLEHOST_MAIL_RSPAMD_SERVICE_NAME,
          "rspamd.service"
        ),
        redisServiceName: readString(
          env.SIMPLEHOST_MAIL_REDIS_SERVICE_NAME,
          "valkey.service"
        ),
        postfixPackageTargets: readList(
          env.SIMPLEHOST_MAIL_POSTFIX_PACKAGE_TARGETS,
          ["postfix"]
        ),
        dovecotPackageTargets: readList(
          env.SIMPLEHOST_MAIL_DOVECOT_PACKAGE_TARGETS,
          ["dovecot"]
        ),
        rspamdPackageTargets: readList(
          env.SIMPLEHOST_MAIL_RSPAMD_PACKAGE_TARGETS,
          ["rspamd"]
        ),
        redisPackageTargets: readList(
          env.SIMPLEHOST_MAIL_REDIS_PACKAGE_TARGETS,
          ["valkey"]
        ),
        roundcubePackageTargets: readList(
          env.SIMPLEHOST_MAIL_ROUNDCUBE_PACKAGE_TARGETS,
          ["roundcubemail", "sqlite"]
        )
      },
      apps: {
        rootDir: readString(
          env.SIMPLEHOST_APPS_ROOT_DIR,
          "/srv/containers/apps"
        ),
        servicePrefix: readString(
          env.SIMPLEHOST_APPS_SERVICE_PREFIX,
          "app-"
        )
      }
    }
  };
}

export function getAgentStatePaths(config: AgentRuntimeConfig): AgentStatePaths {
  return {
    nodeIdentityFile: path.join(config.stateDir, "node-identity.json"),
    lastAppliedStateFile: path.join(config.stateDir, "last-applied-state.json"),
    jobSpoolDir: path.join(config.stateDir, "job-spool"),
    reportBufferDir: path.join(config.stateDir, "report-buffer")
  };
}

export async function ensureAgentStateDirectories(config: AgentRuntimeConfig): Promise<void> {
  const paths = getAgentStatePaths(config);

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
