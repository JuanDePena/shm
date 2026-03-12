import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

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

async function ensurePowerDnsZone(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<void> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SHM_PDNS_API_URL and SHM_PDNS_API_KEY are required.");
  }

  const zoneId = `${payload.zoneName.replace(/\.$/, "")}.`;
  const zoneEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones/${encodeURIComponent(zoneId)}`,
    apiUrl
  );
  const createEndpoint = new URL(
    `/api/v1/servers/${encodeURIComponent(serverId)}/zones`,
    apiUrl
  );
  const zoneResponse = await fetch(zoneEndpoint, {
    headers: {
      "x-api-key": apiKey
    }
  });

  if (zoneResponse.status === 404) {
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

    return;
  }

  if (!zoneResponse.ok) {
    throw new Error(
      `PowerDNS zone lookup failed (${zoneResponse.status}): ${await zoneResponse.text()}`
    );
  }
}

async function upsertPowerDnsRecords(
  payload: DnsSyncPayload,
  context: DriverExecutionContext
): Promise<void> {
  const { apiUrl, apiKey, serverId } = context.services.pdns;

  if (!apiUrl || !apiKey) {
    throw new Error("SHM_PDNS_API_URL and SHM_PDNS_API_KEY are required.");
  }

  await ensurePowerDnsZone(payload, context);

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
}

async function executeProxyRenderJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: ProxyRenderPayload
): Promise<ShmJobResult> {
  const fileName = `${payload.vhostName}.conf`;
  const rendered = renderApacheVhost(payload);
  const stagedPath = await writeRenderedFile(
    context.services.httpd.stagingDir,
    fileName,
    rendered
  );
  const deployedPath = await writeRenderedFile(
    context.services.httpd.sitesDir,
    fileName,
    rendered
  );

  return createCompletedResult(
    job,
    context,
    "applied",
    `Installed Apache vhost ${payload.serverName}.`,
    {
      stagedPath,
      deployedPath,
      serverName: payload.serverName,
      aliases: payload.serverAliases ?? []
    }
  );
}

async function executeDnsSyncJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: DnsSyncPayload
): Promise<ShmJobResult> {
  const zoneFileName = `${payload.zoneName.replace(/[^a-zA-Z0-9.-]/g, "_")}.zone`;
  const stagedPath = await writeRenderedFile(
    context.services.pdns.stagingDir,
    zoneFileName,
    renderDnsZoneFile(payload)
  );

  await upsertPowerDnsRecords(payload, context);

  return createCompletedResult(
    job,
    context,
    "applied",
    `Synchronized PowerDNS zone ${payload.zoneName}.`,
    {
      stagedPath,
      recordCount: payload.records.length,
      serial: payload.serial,
      nameservers: payload.nameservers
    }
  );
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

    return createCompletedResult(
      job,
      context,
      "applied",
      `Reconciled PostgreSQL database ${payload.databaseName}.`,
      {
        appSlug: payload.appSlug,
        databaseName: payload.databaseName,
        roleName: payload.roleName
      }
    );
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
    const databaseIdentifier = connection.escapeId(payload.databaseName);
    const userLiteral = connection.escape(payload.userName);
    const passwordLiteral = connection.escape(payload.password);

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

    return createCompletedResult(
      job,
      context,
      "applied",
      `Reconciled MariaDB database ${payload.databaseName}.`,
      {
        appSlug: payload.appSlug,
        databaseName: payload.databaseName,
        userName: payload.userName
      }
    );
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
