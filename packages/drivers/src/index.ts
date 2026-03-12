import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import mysql from "mysql2/promise";
import { Pool } from "pg";

import {
  isDnsSyncPayload,
  isMariadbReconcilePayload,
  isPostgresReconcilePayload,
  isProxyRenderPayload,
  isSupportedJobKind,
  type DnsSyncPayload,
  type MariadbReconcilePayload,
  type PostgresReconcilePayload,
  type ProxyRenderPayload,
  type ShmJobEnvelope,
  type ShmJobKind,
  type ShmJobResult
} from "@simplehost/manager-contracts";
import {
  renderApacheVhost,
  renderDnsZoneFile
} from "@simplehost/manager-renderers";

const execFileAsync = promisify(execFile);

export interface DriverExecutionContext {
  nodeId: string;
  hostname: string;
  stateDir: string;
  services: {
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
  };
}

function createCompletedResult(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  status: ShmJobResult["status"],
  summary: string,
  details?: Record<string, unknown>
): ShmJobResult {
  return {
    jobId: job.id,
    kind: job.kind,
    nodeId: context.nodeId,
    status,
    summary,
    details,
    completedAt: new Date().toISOString()
  };
}

function createFailedResult(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  summary: string,
  details?: Record<string, unknown>
): ShmJobResult {
  return createCompletedResult(job, context, "failed", summary, details);
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe SQL identifier.`);
  }
}

function assertSafeDnsLabel(value: string, label: string): void {
  if (value === "@") {
    return;
  }

  if (!/^[A-Za-z0-9*]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(value)) {
    throw new Error(`${label} ${value} is not a safe DNS label.`);
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await readFile(targetPath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function runOptionalCommand(
  command: string,
  args: string[]
): Promise<
  | { ran: false }
  | {
      ran: true;
      stdout: string;
      stderr: string;
    }
> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8"
    });

    return {
      ran: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return { ran: false };
    }

    throw error;
  }
}

async function validateApacheConfiguration(): Promise<{
  command: string | null;
  skipped: boolean;
}> {
  for (const command of ["apachectl", "httpd"]) {
    const result = await runOptionalCommand(command, ["-t"]);

    if (!result.ran) {
      continue;
    }

    return {
      command,
      skipped: false
    };
  }

  return {
    command: null,
    skipped: true
  };
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, targetPath);
}

async function writeRenderedFile(
  directoryPath: string,
  fileName: string,
  content: string
): Promise<string> {
  const targetPath = path.join(directoryPath, fileName);
  await writeFileAtomic(targetPath, content);
  return targetPath;
}

function quotePostgresIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function quotePostgresLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function absoluteDnsName(zoneName: string, recordName: string): string {
  const normalizedZone = zoneName.replace(/\.$/, "");

  if (recordName === "@") {
    return `${normalizedZone}.`;
  }

  return `${recordName.replace(/\.$/, "")}.${normalizedZone}.`;
}

interface PowerDnsZoneSnapshot {
  id: string;
  rrsets?: Array<Record<string, unknown>>;
}

async function readPowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ exists: boolean; zone?: PowerDnsZoneSnapshot }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SHM_PDNS_API_URL and SHM_PDNS_API_KEY are required.");
  }

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const zoneEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones/${encodeURIComponent(zoneId)}`,
    apiUrl
  );
  const response = await fetch(zoneEndpoint, {
    headers: {
      "x-api-key": apiKey
    }
  });

  if (response.status === 404) {
    return {
      exists: false
    };
  }

  if (!response.ok) {
    throw new Error(
      `PowerDNS zone lookup failed (${response.status}): ${await response.text()}`
    );
  }

  return {
    exists: true,
    zone: (await response.json()) as PowerDnsZoneSnapshot
  };
}

async function ensurePowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ created: boolean }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SHM_PDNS_API_URL and SHM_PDNS_API_KEY are required.");
  }

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const createEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones`,
    apiUrl
  );
  const zoneState = await readPowerDnsZone(payload, context);

  if (!zoneState.exists) {
    const createResponse = await fetch(createEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        name: zoneId,
        kind: "Native",
        nameservers: payload.nameservers.map((nameserver) => `${nameserver}.`)
      })
    });

    if (!createResponse.ok) {
      throw new Error(
        `PowerDNS zone creation failed (${createResponse.status}): ${await createResponse.text()}`
      );
    }

    return {
      created: true
    };
  }

  return {
    created: false
  };
}

async function upsertPowerDnsRecords(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<{ createdZone: boolean }> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SHM_PDNS_API_URL and SHM_PDNS_API_KEY are required.");
  }

  const zoneState = await ensurePowerDnsZone(payload, context);

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const zoneEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones/${encodeURIComponent(zoneId)}`,
    apiUrl
  );
  const recordGroups = new Map<
    string,
    {
      name: string;
      type: string;
      ttl: number;
      records: Array<{ content: string; disabled: boolean }>;
    }
  >();

  for (const record of payload.records) {
    const name = absoluteDnsName(payload.zoneName, record.name);
    const groupKey = `${name}:${record.type}:${record.ttl}`;
    const group = recordGroups.get(groupKey) ?? {
      name,
      type: record.type,
      ttl: record.ttl,
      records: []
    };

    group.records.push({
      content: record.value,
      disabled: false
    });
    recordGroups.set(groupKey, group);
  }

  recordGroups.set(`ns:${zoneId}`, {
    name: zoneId,
    type: "NS",
    ttl: 300,
    records: payload.nameservers.map((nameserver) => ({
      content: `${nameserver}.`,
      disabled: false
    }))
  });

  const patchResponse = await fetch(zoneEndpoint, {
    method: "PATCH",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      rrsets: [...recordGroups.values()].map((group) => ({
        name: group.name,
        type: group.type,
        ttl: group.ttl,
        changetype: "REPLACE",
        records: group.records
      }))
    })
  });

  if (!patchResponse.ok) {
    throw new Error(
      `PowerDNS zone update failed (${patchResponse.status}): ${await patchResponse.text()}`
    );
  }

  return {
    createdZone: zoneState.created
  };
}

function validateDnsPayload(payload: DnsSyncPayload): void {
  if (!/^[A-Za-z0-9.-]+$/.test(payload.zoneName.replace(/\.$/, ""))) {
    throw new Error(`Zone name ${payload.zoneName} is invalid.`);
  }

  if (payload.nameservers.length < 2) {
    throw new Error(`Zone ${payload.zoneName} must declare at least two nameservers.`);
  }

  for (const nameserver of payload.nameservers) {
    if (!/^[A-Za-z0-9.-]+$/.test(nameserver.replace(/\.$/, ""))) {
      throw new Error(`Nameserver ${nameserver} is invalid.`);
    }
  }

  for (const record of payload.records) {
    assertSafeDnsLabel(record.name, `Record name for ${payload.zoneName}`);

    if (record.ttl <= 0) {
      throw new Error(`Record TTL for ${payload.zoneName} must be positive.`);
    }
  }
}

async function executeProxyRenderJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: ProxyRenderPayload
): Promise<ShmJobResult> {
  try {
    const fileName = `${payload.vhostName}.conf`;
    const rendered = renderApacheVhost(payload);
    const stagedPath = await writeRenderedFile(
      context.services.httpd.stagingDir,
      fileName,
      rendered
    );
    const deployedPath = path.join(context.services.httpd.sitesDir, fileName);
    const backupPath = `${deployedPath}.bak`;
    const hadExistingFile = await pathExists(deployedPath);

    if (hadExistingFile) {
      await copyFile(deployedPath, backupPath);
    }

    try {
      await writeFileAtomic(deployedPath, rendered);
      const validation = await validateApacheConfiguration();

      if (hadExistingFile) {
        await rm(backupPath, { force: true });
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Installed Apache vhost ${payload.serverName}.`,
        {
          stagedPath,
          deployedPath,
          serverName: payload.serverName,
          aliases: payload.serverAliases ?? [],
          validation
        }
      );
    } catch (error) {
      if (hadExistingFile) {
        await rename(backupPath, deployedPath);
      } else {
        await rm(deployedPath, { force: true });
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          stagedPath,
          deployedPath,
          rolledBack: true
        }
      );
    }
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executeDnsSyncJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: DnsSyncPayload
): Promise<ShmJobResult> {
  try {
    validateDnsPayload(payload);
    const zoneFileName = `${payload.zoneName.replace(/[^a-zA-Z0-9.-]/g, "_")}.zone`;
    const stagedPath = await writeRenderedFile(
      context.services.pdns.stagingDir,
      zoneFileName,
      renderDnsZoneFile(payload)
    );
    const { createdZone } = await upsertPowerDnsRecords(payload, context);

    return createCompletedResult(
      job,
      context,
      "applied",
      `Synchronized PowerDNS zone ${payload.zoneName}.`,
      {
        stagedPath,
        recordCount: payload.records.length,
        serial: payload.serial,
        nameservers: payload.nameservers,
        validation: {
          recordCount: payload.records.length
        },
        rollback: {
          strategy: "pdns-api-atomic-patch",
          createdZone
        }
      }
    );
  } catch (error) {
    return createFailedResult(
      job,
      context,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executePostgresReconcileJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: PostgresReconcilePayload
): Promise<ShmJobResult> {
  if (!context.services.postgresql.adminUrl) {
    return createCompletedResult(
      job,
      context,
      "failed",
      "SHM_POSTGRES_ADMIN_URL is not configured."
    );
  }

  const pool = new Pool({
    connectionString: context.services.postgresql.adminUrl,
    application_name: "simplehost-manager-postgres-driver"
  });

  try {
    assertSafeIdentifier(payload.roleName, "PostgreSQL role");
    assertSafeIdentifier(payload.databaseName, "PostgreSQL database");

    let createdRole = false;
    let createdDatabase = false;

    try {
    const roleExists = await pool.query<{ exists: number }>(
      `SELECT 1 AS exists
       FROM pg_roles
       WHERE rolname = $1`,
      [payload.roleName]
    );

    if (roleExists.rows.length === 0) {
      await pool.query(
        `CREATE ROLE ${quotePostgresIdentifier(
          payload.roleName
        )} LOGIN PASSWORD ${quotePostgresLiteral(payload.password)}`
      );
      createdRole = true;
    } else {
      await pool.query(
        `ALTER ROLE ${quotePostgresIdentifier(
          payload.roleName
        )} LOGIN PASSWORD ${quotePostgresLiteral(payload.password)}`
      );
    }

    const databaseExists = await pool.query<{ exists: number }>(
      `SELECT 1 AS exists
       FROM pg_database
       WHERE datname = $1`,
      [payload.databaseName]
    );

    if (databaseExists.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${quotePostgresIdentifier(payload.databaseName)}`);
      createdDatabase = true;
    }

    await pool.query(
      `REVOKE ALL ON DATABASE ${quotePostgresIdentifier(
        payload.databaseName
      )} FROM PUBLIC`
    );
    await pool.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quotePostgresIdentifier(
        payload.databaseName
      )} TO ${quotePostgresIdentifier(payload.roleName)}`
    );

    const targetDatabaseUrl = new URL(context.services.postgresql.adminUrl);
    targetDatabaseUrl.pathname = `/${payload.databaseName}`;

    const targetDatabasePool = new Pool({
      connectionString: targetDatabaseUrl.toString(),
      application_name: "simplehost-manager-postgres-driver-schema"
    });

    try {
      await targetDatabasePool.query(
        `REVOKE ALL ON SCHEMA public FROM PUBLIC`
      );
      await targetDatabasePool.query(
        `GRANT USAGE, CREATE ON SCHEMA public TO ${quotePostgresIdentifier(
          payload.roleName
        )}`
      );
    } finally {
      await targetDatabasePool.end();
    }

      targetDatabaseUrl.username = payload.roleName;
      targetDatabaseUrl.password = payload.password;

      const validationPool = new Pool({
        connectionString: targetDatabaseUrl.toString(),
        application_name: "simplehost-manager-postgres-driver-validation"
      });

      try {
        await validationPool.query("SELECT current_database(), current_user");
      } finally {
        await validationPool.end();
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Reconciled PostgreSQL database ${payload.databaseName}.`,
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          roleName: payload.roleName,
          validation: {
            loginVerified: true
          }
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        createdRole,
        createdDatabase,
        rolledBack: false
      };

      try {
        if (createdDatabase) {
          await pool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1
               AND pid <> pg_backend_pid()`,
            [payload.databaseName]
          );
          await pool.query(`DROP DATABASE ${quotePostgresIdentifier(payload.databaseName)}`);
        }

        if (createdRole) {
          await pool.query(`DROP ROLE ${quotePostgresIdentifier(payload.roleName)}`);
        }

        rollback.rolledBack = true;
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          roleName: payload.roleName,
          rollback
        }
      );
    }
  } finally {
    await pool.end();
  }
}

async function executeMariadbReconcileJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: MariadbReconcilePayload
): Promise<ShmJobResult> {
  if (!context.services.mariadb.adminUrl) {
    return createCompletedResult(
      job,
      context,
      "failed",
      "SHM_MARIADB_ADMIN_URL is not configured."
    );
  }

  const connection = await mysql.createConnection(context.services.mariadb.adminUrl);

  try {
    assertSafeIdentifier(payload.userName, "MariaDB user");
    assertSafeIdentifier(payload.databaseName, "MariaDB database");

    const databaseIdentifier = connection.escapeId(payload.databaseName);
    const userLiteral = connection.escape(payload.userName);
    const passwordLiteral = connection.escape(payload.password);
    let createdDatabase = false;
    let createdUser = false;

    try {
      const [databaseRows] = (await connection.query(
        `SELECT 1 AS existing
         FROM INFORMATION_SCHEMA.SCHEMATA
         WHERE SCHEMA_NAME = ?`,
        [payload.databaseName]
      )) as unknown as [Array<{ existing: number }>, unknown];
      const [userRows] = (await connection.query(
        `SELECT 1 AS existing
         FROM mysql.user
         WHERE user = ?
           AND host = '%'`,
        [payload.userName]
      )) as unknown as [Array<{ existing: number }>, unknown];

      createdDatabase = databaseRows.length === 0;
      createdUser = userRows.length === 0;

      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${databaseIdentifier}
           CHARACTER SET utf8mb4
           COLLATE utf8mb4_unicode_ci`
      );
      await connection.query(
        `CREATE USER IF NOT EXISTS ${userLiteral}@'%'
           IDENTIFIED BY ${passwordLiteral}`
      );
      await connection.query(
        `ALTER USER ${userLiteral}@'%'
           IDENTIFIED BY ${passwordLiteral}`
      );
      await connection.query(
        `GRANT ALL PRIVILEGES ON ${databaseIdentifier}.* TO ${userLiteral}@'%'`
      );
      await connection.query("FLUSH PRIVILEGES");

      const validationUrl = new URL(context.services.mariadb.adminUrl);
      validationUrl.username = payload.userName;
      validationUrl.password = payload.password;
      validationUrl.pathname = `/${payload.databaseName}`;
      const validationConnection = await mysql.createConnection(validationUrl.toString());

      try {
        await validationConnection.query("SELECT current_user(), database()");
      } finally {
        await validationConnection.end();
      }

      return createCompletedResult(
        job,
        context,
        "applied",
        `Reconciled MariaDB database ${payload.databaseName}.`,
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          userName: payload.userName,
          validation: {
            loginVerified: true
          }
        }
      );
    } catch (error) {
      const rollback: Record<string, unknown> = {
        createdDatabase,
        createdUser,
        rolledBack: false
      };

      try {
        if (createdDatabase) {
          await connection.query(`DROP DATABASE IF EXISTS ${databaseIdentifier}`);
        }

        if (createdUser) {
          await connection.query(`DROP USER IF EXISTS ${userLiteral}@'%'`);
          await connection.query("FLUSH PRIVILEGES");
        }

        rollback.rolledBack = true;
      } catch (rollbackError) {
        rollback.rollbackError =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      }

      return createFailedResult(
        job,
        context,
        error instanceof Error ? error.message : String(error),
        {
          appSlug: payload.appSlug,
          databaseName: payload.databaseName,
          userName: payload.userName,
          rollback
        }
      );
    }
  } finally {
    await connection.end();
  }
}

export async function executeAllowlistedJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext
): Promise<ShmJobResult> {
  if (!isSupportedJobKind(job.kind)) {
    return createCompletedResult(
      job,
      context,
      "failed",
      `Unsupported job kind: ${job.kind}`
    );
  }

  if (job.kind === "proxy.render") {
    if (!isProxyRenderPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "proxy.render payload is invalid."
      );
    }

    return executeProxyRenderJob(job, context, job.payload);
  }

  if (job.kind === "dns.sync") {
    if (!isDnsSyncPayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "dns.sync payload is invalid."
      );
    }

    return executeDnsSyncJob(job, context, job.payload);
  }

  if (job.kind === "postgres.reconcile") {
    if (!isPostgresReconcilePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "postgres.reconcile payload is invalid."
      );
    }

    return executePostgresReconcileJob(job, context, job.payload);
  }

  if (job.kind === "mariadb.reconcile") {
    if (!isMariadbReconcilePayload(job.payload)) {
      return createCompletedResult(
        job,
        context,
        "failed",
        "mariadb.reconcile payload is invalid."
      );
    }

    return executeMariadbReconcileJob(job, context, job.payload);
  }

  return createCompletedResult(
    job,
    context,
    "skipped",
    `No real driver is implemented yet for ${job.kind}.`,
    {
      payloadKeys: Object.keys(job.payload)
    }
  );
}

export function createDemoJob(
  nodeId: string,
  kind: ShmJobKind = "proxy.render"
): ShmJobEnvelope {
  const createdAt = new Date().toISOString();

  if (kind === "proxy.render") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        vhostName: `${nodeId}-bootstrap`,
        serverName: `${nodeId}.bootstrap.simplehost.test`,
        serverAliases: [`www.${nodeId}.bootstrap.simplehost.test`],
        documentRoot: `/srv/www/${nodeId}/current/public`,
        tls: true
      } satisfies ProxyRenderPayload
    };
  }

  if (kind === "dns.sync") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        zoneName: `${nodeId}.bootstrap.simplehost.test`,
        serial: Math.floor(Date.now() / 1000),
        nameservers: [
          `ns1.${nodeId}.bootstrap.simplehost.test`,
          `ns2.${nodeId}.bootstrap.simplehost.test`
        ],
        records: [
          {
            name: "@",
            type: "A",
            value: "127.0.0.1",
            ttl: 300
          }
        ]
      } satisfies DnsSyncPayload
    };
  }

  if (kind === "postgres.reconcile") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        appSlug: `${nodeId}-bootstrap`,
        databaseName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        roleName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        password: "change-me"
      } satisfies PostgresReconcilePayload
    };
  }

  if (kind === "mariadb.reconcile") {
    return {
      id: `job-${Date.now()}`,
      desiredStateVersion: `rev-${Date.now()}`,
      kind,
      nodeId,
      createdAt,
      payload: {
        appSlug: `${nodeId}-bootstrap`,
        databaseName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        userName: `app_${nodeId.replace(/[^a-z0-9]/gi, "_")}`,
        password: "change-me"
      } satisfies MariadbReconcilePayload
    };
  }

  return {
    id: `job-${Date.now()}`,
    desiredStateVersion: `rev-${Date.now()}`,
    kind,
    nodeId,
    createdAt,
    payload: {
      requestedBy: "bootstrap",
      dryRun: true
    }
  };
}
