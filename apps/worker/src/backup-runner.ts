import { access, chmod, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { constants, createWriteStream } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

import { createControlRuntimeConfig } from "@simplehost/control-config";
import type {
  BackupPolicySummary,
  BackupRunDetails,
  BackupRunRecordRequest,
  BackupRunSummary,
  DesiredStateExportResponse,
  NodeHealthSnapshot
} from "@simplehost/control-contracts";
import { createPostgresControlPlaneStore } from "@simplehost/control-database";

type DesiredStateSpec = DesiredStateExportResponse["spec"];
type DesiredNode = DesiredStateSpec["nodes"][number];
type DesiredMailDomain = DesiredStateSpec["mailDomains"][number];
type DesiredDatabase = DesiredStateSpec["databases"][number];
type DesiredApp = DesiredStateSpec["apps"][number];

const defaultEnvFilePaths = [
  "/etc/simplehost/worker.env",
  "/etc/simplehost/control.env",
  "/etc/simplehost/agent.env"
];

const defaultPgDumpBinary = "/usr/pgsql-18/bin/pg_dump";
const defaultPgDumpAllBinary = "/usr/pgsql-18/bin/pg_dumpall";
const defaultMariaDbContainerName = "mariadb-primary";

export interface BackupCliOptions {
  force?: boolean;
  policySlugs?: string[];
  now?: Date;
}

export interface BackupCycleOutcome {
  attemptedPolicies: string[];
  skippedPolicies: Array<{ policySlug: string; reason: string }>;
  localNodeId: string;
  runs: BackupRunSummary[];
}

interface BackupRuntimeEnv {
  SIMPLEHOST_NODE_ID?: string;
  SIMPLEHOST_HOSTNAME?: string;
  SIMPLEHOST_DATABASE_URL?: string;
  SIMPLEHOST_MARIADB_ADMIN_URL?: string;
  SIMPLEHOST_MAIL_ROUNDCUBE_DATABASE_DSN?: string;
  SIMPLEHOST_BACKUP_MARIADB_CONTAINER_NAME?: string;
  SIMPLEHOST_BACKUP_PG_DUMP_BIN?: string;
  SIMPLEHOST_BACKUP_PG_DUMPALL_BIN?: string;
  SIMPLEHOST_BACKUP_CONTROL_DATABASE?: string;
  SIMPLEHOST_BACKUP_CONTROL_PGPORT?: string;
}

interface BackupExecutionContext {
  desiredState: DesiredStateExportResponse;
  backupPolicies: BackupPolicySummary[];
  latestRuns: BackupRunSummary[];
  nodeHealth: NodeHealthSnapshot[];
  localNodeId: string;
  runtimeEnv: NodeJS.ProcessEnv & BackupRuntimeEnv;
}

interface PolicyExecutionResult {
  request: BackupRunRecordRequest;
  artifacts: string[];
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function loadEnvFile(path: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(path, "utf8");

    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .flatMap((line) => {
          const separatorIndex = line.indexOf("=");

          if (separatorIndex <= 0) {
            return [];
          }

          const key = line.slice(0, separatorIndex).trim();
          const value = stripQuotes(line.slice(separatorIndex + 1));
          return key.length > 0 ? [[key, value]] : [];
        })
    );
  } catch {
    return {};
  }
}

async function buildRuntimeEnv(
  baseEnv: NodeJS.ProcessEnv = process.env
): Promise<NodeJS.ProcessEnv & BackupRuntimeEnv> {
  const fileEnv = Object.assign(
    {},
    ...(await Promise.all(defaultEnvFilePaths.map((path) => loadEnvFile(path))))
  );

  return {
    ...fileEnv,
    ...baseEnv
  };
}

function normalizeHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function shortHostname(value: string | undefined): string | undefined {
  const normalized = normalizeHostname(value);
  return normalized ? normalized.split(".")[0] : undefined;
}

export function resolveLocalNodeId(
  env: BackupRuntimeEnv,
  desiredNodes: DesiredNode[],
  nodeHealth: NodeHealthSnapshot[]
): string {
  if (env.SIMPLEHOST_NODE_ID?.trim()) {
    return env.SIMPLEHOST_NODE_ID.trim();
  }

  const hostnameCandidates = [
    normalizeHostname(env.SIMPLEHOST_HOSTNAME),
    normalizeHostname(os.hostname()),
    shortHostname(env.SIMPLEHOST_HOSTNAME),
    shortHostname(os.hostname())
  ].filter(Boolean) as string[];

  for (const candidate of hostnameCandidates) {
    const desiredMatch = desiredNodes.find((node) => {
      const fqdn = normalizeHostname(node.hostname);
      const short = shortHostname(node.hostname);
      return candidate === fqdn || candidate === short;
    });

    if (desiredMatch) {
      return desiredMatch.nodeId;
    }

    const healthMatch = nodeHealth.find((node) => {
      const fqdn = normalizeHostname(node.hostname);
      const short = shortHostname(node.hostname);
      return candidate === fqdn || candidate === short;
    });

    if (healthMatch) {
      return healthMatch.nodeId;
    }
  }

  throw new Error("Unable to resolve the local node id for the backup runner.");
}

function fieldIsWildcard(field: string): boolean {
  return field.trim() === "*";
}

function parseInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  return Number.parseInt(value, 10);
}

function normalizeCronValue(value: number, max: number): number {
  if (max === 7 && value === 7) {
    return 0;
  }

  return value;
}

function matchCronSegment(segment: string, value: number, min: number, max: number): boolean {
  const trimmed = segment.trim();

  if (trimmed === "*") {
    return true;
  }

  const [base, stepText] = trimmed.split("/", 2);
  const step = stepText ? parseInteger(stepText) : 1;

  if (!step || step <= 0) {
    return false;
  }

  const normalizedValue = normalizeCronValue(value, max);

  if (!base || base === "*") {
    return normalizedValue >= min && normalizedValue <= max && (normalizedValue - min) % step === 0;
  }

  if (base.includes("-")) {
    const [startText, endText] = base.split("-", 2);
    const start = parseInteger(startText ?? "");
    const end = parseInteger(endText ?? "");

    if (start === undefined || end === undefined) {
      return false;
    }

    const normalizedStart = normalizeCronValue(start, max);
    const normalizedEnd = normalizeCronValue(end, max);

    if (normalizedValue < normalizedStart || normalizedValue > normalizedEnd) {
      return false;
    }

    return (normalizedValue - normalizedStart) % step === 0;
  }

  const exact = parseInteger(base);

  if (exact === undefined) {
    return false;
  }

  return normalizeCronValue(exact, max) === normalizedValue;
}

export function matchesCronExpression(schedule: string, date: Date): boolean {
  const fields = schedule.trim().split(/\s+/);

  if (fields.length !== 5) {
    return false;
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields;
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dayOfWeek = date.getUTCDay();

  const minuteMatches = minuteField
    .split(",")
    .some((segment) => matchCronSegment(segment, minute, 0, 59));
  const hourMatches = hourField
    .split(",")
    .some((segment) => matchCronSegment(segment, hour, 0, 23));
  const monthMatches = monthField
    .split(",")
    .some((segment) => matchCronSegment(segment, month, 1, 12));
  const dayOfMonthMatches = dayOfMonthField
    .split(",")
    .some((segment) => matchCronSegment(segment, dayOfMonth, 1, 31));
  const dayOfWeekMatches = dayOfWeekField
    .split(",")
    .some((segment) => matchCronSegment(segment, dayOfWeek, 0, 7));

  if (!minuteMatches || !hourMatches || !monthMatches) {
    return false;
  }

  if (fieldIsWildcard(dayOfMonthField) && fieldIsWildcard(dayOfWeekField)) {
    return true;
  }

  if (fieldIsWildcard(dayOfMonthField)) {
    return dayOfWeekMatches;
  }

  if (fieldIsWildcard(dayOfWeekField)) {
    return dayOfMonthMatches;
  }

  return dayOfMonthMatches || dayOfWeekMatches;
}

function minuteStamp(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export function shouldRunPolicyAtTime(args: {
  schedule: string;
  latestRun?: BackupRunSummary;
  now: Date;
  force?: boolean;
}): boolean {
  if (args.force) {
    return true;
  }

  if (!matchesCronExpression(args.schedule, args.now)) {
    return false;
  }

  return minuteStamp(new Date(args.latestRun?.startedAt ?? 0)) !== minuteStamp(args.now);
}

function normalizeSelectors(selectors: string[]): string[] {
  return selectors.map((selector) => selector.trim().toLowerCase()).filter(Boolean);
}

export function policyCoversMailDomain(
  policy: BackupPolicySummary,
  domain: DesiredMailDomain
): boolean {
  if (policy.tenantSlug !== domain.tenantSlug) {
    return false;
  }

  const selectors = normalizeSelectors(policy.resourceSelectors);

  if (selectors.length === 0) {
    return true;
  }

  return (
    selectors.includes(`tenant:${domain.tenantSlug}`) ||
    selectors.includes("mail-stack") ||
    selectors.includes(`mail-domain:${domain.domainName}`.toLowerCase())
  );
}

export function policyCoversDatabase(
  policy: BackupPolicySummary,
  database: DesiredDatabase,
  tenantSlug: string
): boolean {
  if (policy.tenantSlug !== tenantSlug) {
    return false;
  }

  const selectors = normalizeSelectors(policy.resourceSelectors);

  if (selectors.length === 0) {
    return true;
  }

  return (
    selectors.includes(`tenant:${tenantSlug}`) ||
    selectors.includes(`app:${database.appSlug}`.toLowerCase()) ||
    selectors.includes(`database:${database.appSlug}`.toLowerCase()) ||
    selectors.includes(`database:${database.databaseName}`.toLowerCase())
  );
}

export function policyCoversAppFiles(
  policy: BackupPolicySummary,
  app: DesiredApp
): boolean {
  if (policy.tenantSlug !== app.tenantSlug) {
    return false;
  }

  const selectors = normalizeSelectors(policy.resourceSelectors);

  if (selectors.length === 0) {
    return true;
  }

  return (
    selectors.includes("app-files") ||
    selectors.includes(`app-files:${app.slug}`.toLowerCase()) ||
    selectors.includes(`storage-root:${app.slug}`.toLowerCase())
  );
}

export function policyCoversPostgresqlControl(policy: BackupPolicySummary): boolean {
  const selectors = normalizeSelectors(policy.resourceSelectors);

  return (
    selectors.includes("postgresql-control") ||
    selectors.includes("postgresql-cluster:control") ||
    selectors.includes("control-db")
  );
}

async function pathExists(path: string | undefined): Promise<boolean> {
  if (!path) {
    return false;
  }

  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectExistingPaths(paths: Array<string | undefined>): Promise<string[]> {
  const uniquePaths = [...new Set(paths.filter(Boolean) as string[])];
  const checks = await Promise.all(uniquePaths.map(async (path) => ((await pathExists(path)) ? path : undefined)));
  return checks.filter(Boolean) as string[];
}

async function runCommand(args: {
  command: string;
  commandArgs: string[];
  stdoutPath?: string;
  stdinData?: string;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(args.command, args.commandArgs, {
      stdio: ["pipe", args.stdoutPath ? "pipe" : "inherit", "pipe"]
    });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const stdoutStream = child.stdout;

    if (args.stdoutPath && !stdoutStream) {
      reject(new Error(`Unable to capture stdout for ${args.command}.`));
      return;
    }

    const stdoutPipeline =
      args.stdoutPath && stdoutStream
        ? pipeline(stdoutStream, createWriteStream(args.stdoutPath))
        : Promise.resolve();

    if (args.stdinData && child.stdin) {
      child.stdin.write(args.stdinData);
    }

    child.stdin?.end();

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", async (code) => {
      try {
        await stdoutPipeline;
        if (args.stdoutPath) {
          await chmod(args.stdoutPath, 0o600);
        }
      } catch (error) {
        reject(error);
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim().length > 0
            ? stderr.trim()
            : `${args.command} exited with status ${code ?? "unknown"}.`
        )
      );
    });
  });
}

function buildRunStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function applyRetention(storageLocation: string, retentionDays: number): Promise<void> {
  if (retentionDays <= 0) {
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(storageLocation, { withFileTypes: true }).catch(() => []);

  await Promise.all(
    entries.map(async (entry) => {
      const targetPath = join(storageLocation, entry.name);
      const targetStat = await stat(targetPath).catch(() => undefined);

      if (!targetStat || targetStat.mtimeMs >= cutoff) {
        return;
      }

      await rm(targetPath, { recursive: true, force: true });
    })
  );
}

function findNodeRuntime(nodeHealth: NodeHealthSnapshot[], nodeId: string): NodeHealthSnapshot | undefined {
  return nodeHealth.find((node) => node.nodeId === nodeId);
}

async function createMailArchive(args: {
  policy: BackupPolicySummary;
  runDirectory: string;
  desiredState: DesiredStateSpec;
  nodeHealth: NodeHealthSnapshot[];
  runtimeEnv: BackupRuntimeEnv;
}): Promise<{ details: BackupRunDetails; artifacts: string[]; summary: string }> {
  const relevantDomains = args.desiredState.mailDomains.filter(
    (domain) =>
      (domain.primaryNodeId === args.policy.targetNodeId ||
        domain.standbyNodeId === args.policy.targetNodeId) &&
      policyCoversMailDomain(args.policy, domain)
  );

  if (relevantDomains.length === 0) {
    throw new Error(`Policy ${args.policy.policySlug} does not match any managed mail domain.`);
  }

  const runtime = findNodeRuntime(args.nodeHealth, args.policy.targetNodeId);
  const mailRuntime = runtime?.mail;

  if (!mailRuntime) {
    throw new Error(`Mail runtime is not currently reported on node ${args.policy.targetNodeId}.`);
  }

  const coveredMaildirPaths: string[] = [];
  const coveredDkimPaths: string[] = [];
  const coveredRuntimeConfigPaths: string[] = [];
  const coveredWebmailPaths: string[] = [];

  for (const domain of relevantDomains) {
    const managedDomain = mailRuntime.managedDomains.find(
      (entry) => entry.domainName === domain.domainName
    );

    coveredMaildirPaths.push(
      ...(await collectExistingPaths([managedDomain?.maildirRoot]))
    );
    coveredDkimPaths.push(
      ...(await collectExistingPaths(
        mailRuntime.dkimRoot
          ? [
              `${mailRuntime.dkimRoot}/${domain.domainName}/${domain.dkimSelector}.key`,
              `${mailRuntime.dkimRoot}/${domain.domainName}/${domain.dkimSelector}.dns.txt`
            ]
          : []
      ))
    );
    coveredWebmailPaths.push(
      ...(await collectExistingPaths([
        managedDomain?.webmailDocumentRoot
      ]))
    );
  }

  coveredRuntimeConfigPaths.push(
    ...(await collectExistingPaths([mailRuntime.configRoot, mailRuntime.policyRoot]))
  );
  coveredWebmailPaths.push(
    ...(await collectExistingPaths([
      mailRuntime.roundcubeConfigPath,
      mailRuntime.roundcubeDatabasePath,
      mailRuntime.roundcubeSharedRoot
    ]))
  );

  const archiveSourcePaths = [
    ...new Set([
      ...coveredMaildirPaths,
      ...coveredDkimPaths,
      ...coveredRuntimeConfigPaths,
      ...coveredWebmailPaths
    ])
  ];

  if (archiveSourcePaths.length === 0) {
    throw new Error(`Policy ${args.policy.policySlug} did not find any mail paths to archive.`);
  }

  const archivePath = join(args.runDirectory, "mail-runtime.tar.gz");
  await runCommand({
    command: "/usr/bin/tar",
    commandArgs: ["-czf", archivePath, "-P", ...archiveSourcePaths]
  });
  await chmod(archivePath, 0o600);

  const artifacts = [archivePath];
  const roundcubeDsn = args.runtimeEnv.SIMPLEHOST_MAIL_ROUNDCUBE_DATABASE_DSN?.trim();

  if (roundcubeDsn) {
    const dsnUrl = new URL(roundcubeDsn.replace(/^pgsql:/, "postgresql:"));
    const databaseName = dsnUrl.pathname.replace(/^\//, "");

    if (databaseName.length > 0) {
      const roundcubeDumpPath = join(args.runDirectory, `${databaseName}.dump`);
      const pgDumpBinary =
        args.runtimeEnv.SIMPLEHOST_BACKUP_PG_DUMP_BIN?.trim() || defaultPgDumpBinary;

      await runCommand({
        command: "/usr/sbin/runuser",
        commandArgs: [
          "-u",
          "postgres",
          "--",
          pgDumpBinary,
          "--format=custom",
          "--compress=6",
          "--dbname",
          databaseName
        ],
        stdoutPath: roundcubeDumpPath
      });

      artifacts.push(roundcubeDumpPath);
    }
  }

  return {
    details: {
      mail: {
        artifactPaths: {
          maildir: [...new Set(coveredMaildirPaths)],
          dkim: [...new Set(coveredDkimPaths)],
          runtimeConfig: [...new Set(coveredRuntimeConfigPaths)],
          webmailState: [...new Set(coveredWebmailPaths)]
        },
        restoreChecks: []
      }
    },
    artifacts,
    summary: `Backed up ${relevantDomains.length} mail domain(s) into ${args.policy.storageLocation}.`
  };
}

function buildAppTenantMap(apps: DesiredApp[]): Map<string, string> {
  return new Map(apps.map((app) => [app.slug, app.tenantSlug]));
}

async function createAppFileArchives(args: {
  policy: BackupPolicySummary;
  runDirectory: string;
  desiredState: DesiredStateSpec;
}): Promise<{
  details: NonNullable<BackupRunDetails["appFiles"]>;
  artifacts: string[];
  summary: string;
}> {
  const relevantApps = args.desiredState.apps.filter(
    (app) =>
      (app.primaryNodeId === args.policy.targetNodeId ||
        app.standbyNodeId === args.policy.targetNodeId) &&
      policyCoversAppFiles(args.policy, app)
  );

  if (relevantApps.length === 0) {
    throw new Error(`Policy ${args.policy.policySlug} does not match any managed app file root.`);
  }

  const artifacts: string[] = [];
  const details: NonNullable<BackupRunDetails["appFiles"]> = {
    artifacts: []
  };

  for (const app of relevantApps) {
    if (!(await pathExists(app.storageRoot))) {
      throw new Error(`App ${app.slug} storage root does not exist: ${app.storageRoot}.`);
    }

    const archivePath = join(args.runDirectory, `${app.slug}-files.tar.gz`);

    await runCommand({
      command: "/usr/bin/tar",
      commandArgs: [
        "--ignore-failed-read",
        "--warning=no-file-changed",
        "-czf",
        archivePath,
        "--exclude",
        `${app.storageRoot}/logs/*`,
        "--exclude",
        `${app.storageRoot}/app/storage/logs/*`,
        "-P",
        app.storageRoot
      ]
    });
    await chmod(archivePath, 0o600);

    artifacts.push(archivePath);
    details.artifacts.push({
      appSlug: app.slug,
      storageRoot: app.storageRoot,
      archivePath
    });
  }

  return {
    details,
    artifacts,
    summary: `Backed up ${relevantApps.length} app file root(s) into ${args.policy.storageLocation}.`
  };
}

async function createDatabaseBackups(args: {
  policy: BackupPolicySummary;
  runDirectory: string;
  desiredState: DesiredStateSpec;
  runtimeEnv: BackupRuntimeEnv;
}): Promise<{ artifacts: string[]; summary: string }> {
  const tenantByAppSlug = buildAppTenantMap(args.desiredState.apps);
  const relevantDatabases = args.desiredState.databases.filter(
    (database) =>
      database.primaryNodeId === args.policy.targetNodeId &&
      policyCoversDatabase(
        args.policy,
        database,
        tenantByAppSlug.get(database.appSlug) ?? args.policy.tenantSlug
      )
  );

  if (relevantDatabases.length === 0) {
    throw new Error(`Policy ${args.policy.policySlug} does not match any managed database.`);
  }

  const artifacts: string[] = [];

  for (const database of relevantDatabases) {
    if (database.engine === "postgresql") {
      const pgDumpBinary =
        args.runtimeEnv.SIMPLEHOST_BACKUP_PG_DUMP_BIN?.trim() || defaultPgDumpBinary;
      const outputPath = join(args.runDirectory, `${database.databaseName}.dump`);

      await runCommand({
        command: "/usr/sbin/runuser",
        commandArgs: [
          "-u",
          "postgres",
          "--",
          pgDumpBinary,
          "--format=custom",
          "--compress=6",
          "--dbname",
          database.databaseName
        ],
        stdoutPath: outputPath
      });

      artifacts.push(outputPath);
      continue;
    }

    const mariadbAdminUrl = args.runtimeEnv.SIMPLEHOST_MARIADB_ADMIN_URL?.trim();

    if (!mariadbAdminUrl) {
      throw new Error("SIMPLEHOST_MARIADB_ADMIN_URL is required for MariaDB backups.");
    }

    const mariadbUrl = new URL(mariadbAdminUrl);
    const outputPath = join(args.runDirectory, `${database.databaseName}.sql`);
    const containerName =
      args.runtimeEnv.SIMPLEHOST_BACKUP_MARIADB_CONTAINER_NAME?.trim() ??
      defaultMariaDbContainerName;

    await runCommand({
      command: "/usr/bin/podman",
      commandArgs: [
        "exec",
        containerName,
        "mariadb-dump",
        `--host=${mariadbUrl.hostname || "127.0.0.1"}`,
        `--port=${mariadbUrl.port || "3306"}`,
        `--user=${decodeURIComponent(mariadbUrl.username)}`,
        `--password=${decodeURIComponent(mariadbUrl.password)}`,
        "--single-transaction",
        "--routines",
        "--events",
        "--databases",
        database.databaseName
      ],
      stdoutPath: outputPath
    });

    artifacts.push(outputPath);
  }

  return {
    artifacts,
    summary: `Backed up ${relevantDatabases.length} database(s) into ${args.policy.storageLocation}.`
  };
}

function parseControlDatabaseUrl(rawUrl: string | undefined): URL | undefined {
  if (!rawUrl?.trim()) {
    return undefined;
  }

  try {
    return new URL(rawUrl.trim());
  } catch {
    return undefined;
  }
}

function resolveControlDatabaseName(runtimeEnv: BackupRuntimeEnv): string {
  const configuredName = runtimeEnv.SIMPLEHOST_BACKUP_CONTROL_DATABASE?.trim();

  if (configuredName) {
    return configuredName;
  }

  const databaseUrl = parseControlDatabaseUrl(runtimeEnv.SIMPLEHOST_DATABASE_URL);
  const databaseName = databaseUrl?.pathname.replace(/^\//, "").trim();

  return databaseName || "simplehost_control";
}

function resolveControlPostgresqlPort(runtimeEnv: BackupRuntimeEnv): number {
  const configuredPort =
    runtimeEnv.SIMPLEHOST_BACKUP_CONTROL_PGPORT?.trim() ||
    parseControlDatabaseUrl(runtimeEnv.SIMPLEHOST_DATABASE_URL)?.port ||
    "5433";
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PostgreSQL control backup port: ${configuredPort}.`);
  }

  return port;
}

async function createControlPostgresqlBackup(args: {
  policy: BackupPolicySummary;
  runDirectory: string;
  runtimeEnv: BackupRuntimeEnv;
}): Promise<{
  details: NonNullable<BackupRunDetails["postgresqlCluster"]>;
  artifacts: string[];
  summary: string;
}> {
  const pgDumpBinary =
    args.runtimeEnv.SIMPLEHOST_BACKUP_PG_DUMP_BIN?.trim() || defaultPgDumpBinary;
  const pgDumpAllBinary =
    args.runtimeEnv.SIMPLEHOST_BACKUP_PG_DUMPALL_BIN?.trim() || defaultPgDumpAllBinary;
  const port = resolveControlPostgresqlPort(args.runtimeEnv);
  const databaseName = resolveControlDatabaseName(args.runtimeEnv);
  const dumpPath = join(args.runDirectory, `${databaseName}.dump`);
  const globalsPath = join(args.runDirectory, "postgresql-control-globals.sql");

  await runCommand({
    command: "/usr/sbin/runuser",
    commandArgs: [
      "-u",
      "postgres",
      "--",
      pgDumpBinary,
      "--format=custom",
      "--compress=6",
      "--port",
      String(port),
      "--dbname",
      databaseName
    ],
    stdoutPath: dumpPath
  });

  await runCommand({
    command: "/usr/sbin/runuser",
    commandArgs: [
      "-u",
      "postgres",
      "--",
      pgDumpAllBinary,
      "--globals-only",
      "--port",
      String(port)
    ],
    stdoutPath: globalsPath
  });

  return {
    details: {
      cluster: "control",
      port,
      databaseName,
      dumpPath,
      globalsPath
    },
    artifacts: [dumpPath, globalsPath],
    summary: `Backed up PostgreSQL control database ${databaseName} on port ${port} into ${args.policy.storageLocation}.`
  };
}

async function executePolicy(
  context: BackupExecutionContext,
  policy: BackupPolicySummary,
  now: Date
): Promise<PolicyExecutionResult> {
  await mkdir(policy.storageLocation, { recursive: true });
  await chmod(policy.storageLocation, 0o700);
  await applyRetention(policy.storageLocation, policy.retentionDays);

  const runDirectory = join(policy.storageLocation, `${policy.policySlug}-${buildRunStamp(now)}`);
  await mkdir(runDirectory, { recursive: true });
  await chmod(runDirectory, 0o700);
  try {
    const selectors = normalizeSelectors(policy.resourceSelectors);
    const handlesMail =
      selectors.length === 0 ||
      selectors.some((selector) => selector === "mail-stack" || selector.startsWith("mail-domain:"));
    const handlesDatabases =
      selectors.length === 0 ||
      selectors.some((selector) => selector.startsWith("app:") || selector.startsWith("database:"));
    const handlesAppFiles =
      selectors.length === 0 ||
      selectors.some(
        (selector) =>
          selector === "app-files" ||
          selector.startsWith("app-files:") ||
          selector.startsWith("storage-root:")
      );
    const handlesPostgresqlControl = policyCoversPostgresqlControl(policy);

    let details: BackupRunDetails | undefined;
    const artifacts: string[] = [];
    const summaryParts: string[] = [];

    if (
      handlesMail &&
      context.desiredState.spec.mailDomains.some((domain) => policyCoversMailDomain(policy, domain))
    ) {
      const mailResult = await createMailArchive({
        policy,
        runDirectory,
        desiredState: context.desiredState.spec,
        nodeHealth: context.nodeHealth,
        runtimeEnv: context.runtimeEnv
      });

      details = mailResult.details;
      artifacts.push(...mailResult.artifacts);
      summaryParts.push(mailResult.summary);
    }

    if (
      handlesAppFiles &&
      context.desiredState.spec.apps.some(
        (app) =>
          (app.primaryNodeId === policy.targetNodeId ||
            app.standbyNodeId === policy.targetNodeId) &&
          policyCoversAppFiles(policy, app)
      )
    ) {
      const appFileResult = await createAppFileArchives({
        policy,
        runDirectory,
        desiredState: context.desiredState.spec
      });

      details = {
        ...(details ?? {}),
        appFiles: appFileResult.details
      };
      artifacts.push(...appFileResult.artifacts);
      summaryParts.push(appFileResult.summary);
    }

    if (
      handlesDatabases &&
      context.desiredState.spec.databases.some((database) =>
        policyCoversDatabase(
          policy,
          database,
          buildAppTenantMap(context.desiredState.spec.apps).get(database.appSlug) ?? policy.tenantSlug
        )
      )
    ) {
      const databaseResult = await createDatabaseBackups({
        policy,
        runDirectory,
        desiredState: context.desiredState.spec,
        runtimeEnv: context.runtimeEnv
      });

      artifacts.push(...databaseResult.artifacts);
      summaryParts.push(databaseResult.summary);
    }

    if (handlesPostgresqlControl) {
      const postgresqlResult = await createControlPostgresqlBackup({
        policy,
        runDirectory,
        runtimeEnv: context.runtimeEnv
      });

      details = {
        ...(details ?? {}),
        postgresqlCluster: postgresqlResult.details
      };
      artifacts.push(...postgresqlResult.artifacts);
      summaryParts.push(postgresqlResult.summary);
    }

    if (artifacts.length === 0) {
      throw new Error(`Policy ${policy.policySlug} did not produce any backup artifacts.`);
    }

    const manifestPath = join(runDirectory, "manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: now.toISOString(),
          policySlug: policy.policySlug,
          tenantSlug: policy.tenantSlug,
          targetNodeId: policy.targetNodeId,
          storageLocation: policy.storageLocation,
          resourceSelectors: policy.resourceSelectors,
          artifacts,
          details
        },
        null,
        2
      )
    );
    await chmod(manifestPath, 0o600);
    artifacts.push(manifestPath);

    return {
      request: {
        policySlug: policy.policySlug,
        nodeId: context.localNodeId,
        status: "succeeded",
        summary: summaryParts.join(" "),
        completedAt: new Date().toISOString(),
        details
      },
      artifacts
    };
  } catch (error) {
    await rm(runDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function buildExecutionContext(
  runtimeEnv: NodeJS.ProcessEnv & BackupRuntimeEnv
): Promise<{
  controlPlaneStore: Awaited<ReturnType<typeof createPostgresControlPlaneStore>>;
  sessionToken: string;
  context: BackupExecutionContext;
}> {
  const config = createControlRuntimeConfig(runtimeEnv);
  const bootstrapAdminEmail = config.auth.bootstrapAdminEmail;
  const bootstrapAdminPassword = config.auth.bootstrapAdminPassword;

  if (!bootstrapAdminEmail || !bootstrapAdminPassword) {
    throw new Error("Bootstrap admin credentials are required for the backup runner.");
  }

  const controlPlaneStore = await createPostgresControlPlaneStore(config.database.url, {
    pollIntervalMs: config.worker.pollIntervalMs,
    bootstrapEnrollmentToken: config.auth.bootstrapEnrollmentToken,
    sessionTtlSeconds: config.auth.sessionTtlSeconds,
    bootstrapAdminEmail: bootstrapAdminEmail,
    bootstrapAdminPassword,
    bootstrapAdminName: config.auth.bootstrapAdminName,
    jobPayloadSecret: config.jobs.payloadSecret
  });

  const session = await controlPlaneStore.loginUser({
    email: bootstrapAdminEmail,
    password: bootstrapAdminPassword
  });

  const backups = await controlPlaneStore.getBackupsOverview(session.sessionToken);
  const desiredState = await controlPlaneStore.exportDesiredState(session.sessionToken);
  const nodeHealth = await controlPlaneStore.getNodeHealth(session.sessionToken);

  const localNodeId = resolveLocalNodeId(runtimeEnv, desiredState.spec.nodes, nodeHealth);

  return {
    controlPlaneStore,
    sessionToken: session.sessionToken,
    context: {
      desiredState,
      backupPolicies: backups.policies,
      latestRuns: backups.latestRuns,
      nodeHealth,
      localNodeId,
      runtimeEnv
    }
  };
}

export async function runBackupCycle(options: BackupCliOptions = {}): Promise<BackupCycleOutcome> {
  const runtimeEnv = await buildRuntimeEnv();
  const now = options.now ?? new Date();
  const { controlPlaneStore, sessionToken, context } = await buildExecutionContext(runtimeEnv);

  try {
    const selectedPolicySlugs = new Set((options.policySlugs ?? []).map((slug) => slug.trim()).filter(Boolean));
    const policies = context.backupPolicies.filter((policy) => {
      if (policy.targetNodeId !== context.localNodeId) {
        return false;
      }

      return selectedPolicySlugs.size === 0 || selectedPolicySlugs.has(policy.policySlug);
    });

    if (selectedPolicySlugs.size > 0) {
      const discoveredSlugs = new Set(policies.map((policy) => policy.policySlug));
      const missingPolicies = [...selectedPolicySlugs].filter((slug) => !discoveredSlugs.has(slug));

      if (missingPolicies.length > 0) {
        throw new Error(`Unknown or non-local backup policy: ${missingPolicies.join(", ")}`);
      }
    }

    const skippedPolicies: BackupCycleOutcome["skippedPolicies"] = [];
    const runs: BackupRunSummary[] = [];
    const attemptedPolicies: string[] = [];

    for (const policy of policies) {
      const latestRun = context.latestRuns.find((run) => run.policySlug === policy.policySlug);

      if (
        !shouldRunPolicyAtTime({
          schedule: policy.schedule,
          latestRun,
          now,
          force: options.force
        })
      ) {
        skippedPolicies.push({
          policySlug: policy.policySlug,
          reason: options.force ? "Skipped unexpectedly." : "Schedule does not match the current minute."
        });
        continue;
      }

      attemptedPolicies.push(policy.policySlug);

      try {
        const result = await executePolicy(context, policy, now);
        const recordedRun = await controlPlaneStore.recordBackupRun(result.request, sessionToken);
        runs.push(recordedRun);
        console.log(
          `[backup] ${policy.policySlug}: succeeded (${result.artifacts.length} artifact(s))`
        );
      } catch (error) {
        const summary =
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Backup execution failed.";
        const failedRun = await controlPlaneStore.recordBackupRun(
          {
            policySlug: policy.policySlug,
            nodeId: context.localNodeId,
            status: "failed",
            summary,
            completedAt: new Date().toISOString()
          },
          sessionToken
        );
        runs.push(failedRun);
        console.error(`[backup] ${policy.policySlug}: failed (${summary})`);
      }
    }

    return {
      attemptedPolicies,
      skippedPolicies,
      localNodeId: context.localNodeId,
      runs
    };
  } finally {
    await controlPlaneStore.close();
  }
}

export function parseBackupCliArgs(args: string[]): BackupCliOptions {
  const policySlugs: string[] = [];
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--policy") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("--policy requires a value.");
      }

      policySlugs.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown backup-runner argument: ${arg}`);
  }

  return {
    force,
    policySlugs
  };
}
