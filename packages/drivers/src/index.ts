import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  isDnsSyncPayload,
  isProxyRenderPayload,
  isSupportedJobKind,
  type ProxyRenderPayload,
  type DnsSyncPayload,
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

async function writeRenderedFile(
  context: DriverExecutionContext,
  subdirectory: string,
  fileName: string,
  content: string
): Promise<string> {
  const targetDirectory = path.join(context.stateDir, "rendered", subdirectory);
  const targetPath = path.join(targetDirectory, fileName);

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(targetPath, content, "utf8");

  return targetPath;
}

async function executeProxyRenderJob(
  job: ShmJobEnvelope,
  context: DriverExecutionContext,
  payload: ProxyRenderPayload
): Promise<ShmJobResult> {
  const targetPath = await writeRenderedFile(
    context,
    "httpd",
    `${payload.vhostName}.conf`,
    renderApacheVhost(payload)
  );

  return createCompletedResult(
    job,
    context,
    "applied",
    `Rendered Apache vhost ${payload.serverName}.`,
    {
      targetPath,
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
  const targetPath = await writeRenderedFile(
    context,
    "dns",
    zoneFileName,
    renderDnsZoneFile(payload)
  );

  return createCompletedResult(
    job,
    context,
    "applied",
    `Rendered DNS zone ${payload.zoneName}.`,
    {
      targetPath,
      recordCount: payload.records.length,
      serial: payload.serial
    }
  );
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
        tls: false
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
        serial: 2026031201,
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
