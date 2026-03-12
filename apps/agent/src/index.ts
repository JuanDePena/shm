import { realpathSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  claimJobs,
  registerNode,
  reportJob
} from "@simplehost/manager-control-plane-client";
import {
  supportedJobKinds,
  type ShmBufferedReport,
  type ShmJobEnvelope,
  type ShmJobReportRequest,
  type ShmNodeRegistrationRequest,
  type ShmNodeSnapshot,
  type ShmSpoolEntry
} from "@simplehost/manager-contracts";
import { executeAllowlistedJob } from "@simplehost/manager-drivers";
import {
  createShmRuntimeConfig,
  ensureShmStateDirectories,
  getShmStatePaths,
  listJsonFiles,
  readJsonFile,
  removeFileIfExists,
  writeJsonFileAtomic
} from "@simplehost/manager-node-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/manager-renderers";

async function writeLastAppliedState(
  desiredStateVersion: string,
  lastCompletedJobId?: string
): Promise<void> {
  const config = createShmRuntimeConfig();
  const timestamp = new Date().toISOString();

  await writeJsonFileAtomic(getShmStatePaths(config).lastAppliedStateFile, {
    schemaVersion: 1,
    desiredStateVersion,
    lastCompletedJobId,
    lastHeartbeatAt: timestamp
  });
}

async function readStoredNodeToken(): Promise<string | undefined> {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);

  return existingIdentity?.nodeToken;
}

export async function createNodeSnapshot(): Promise<ShmNodeSnapshot> {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);

  await ensureShmStateDirectories(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeId: string;
    hostname: string;
    controlPlaneUrl: string;
    configPath: string;
    generatedAt: string;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);

  const snapshot: ShmNodeSnapshot = {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready",
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString(),
    nodeToken: existingIdentity?.nodeToken
  };

  await writeJsonFileAtomic(statePaths.nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken: existingIdentity?.nodeToken
  });

  await writeLastAppliedState("bootstrap");

  return snapshot;
}

function createRegistrationRequest(
  snapshot: ShmNodeSnapshot
): ShmNodeRegistrationRequest {
  const config = createShmRuntimeConfig();

  return {
    nodeId: snapshot.nodeId,
    hostname: snapshot.hostname,
    version: config.version,
    supportedJobKinds: [...supportedJobKinds],
    generatedAt: snapshot.generatedAt
  };
}

async function deliverBufferedReport(
  reportFile: string,
  reportPayload: ShmBufferedReport,
  nodeToken: string
): Promise<boolean> {
  const config = createShmRuntimeConfig();
  const request: ShmJobReportRequest = {
    nodeId: config.nodeId,
    result: reportPayload.result
  };

  try {
    await reportJob(config.controlPlaneUrl, request, nodeToken);
    await removeFileIfExists(reportFile);
    return true;
  } catch (error) {
    await writeJsonFileAtomic(reportFile, {
      ...reportPayload,
      deliveryAttempts: reportPayload.deliveryAttempts + 1,
      lastDeliveryError: error instanceof Error ? error.message : String(error)
    } satisfies ShmBufferedReport);
    return false;
  }
}

async function flushBufferedReports(): Promise<number> {
  const config = createShmRuntimeConfig();
  const reportFiles = await listJsonFiles(getShmStatePaths(config).reportBufferDir);
  let delivered = 0;
  const nodeToken = await readStoredNodeToken();

  if (!nodeToken) {
    return delivered;
  }

  for (const reportFile of reportFiles) {
    const payload = await readJsonFile<ShmBufferedReport>(reportFile);

    if (!payload) {
      await removeFileIfExists(reportFile);
      continue;
    }

    if (await deliverBufferedReport(reportFile, payload, nodeToken)) {
      delivered += 1;
    }
  }

  return delivered;
}

async function executeClaimedJob(job: ShmJobEnvelope): Promise<void> {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);
  const claimedAt = new Date().toISOString();
  const spoolPath = `${statePaths.jobSpoolDir}/${job.id}.json`;
  const reportPath = `${statePaths.reportBufferDir}/${job.id}.json`;
  const nodeToken = await readStoredNodeToken();

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "claimed",
    claimedAt
  } satisfies ShmSpoolEntry);

  const result = await (async () => {
    try {
      return await executeAllowlistedJob(job, {
        nodeId: config.nodeId,
        hostname: config.hostname,
        stateDir: config.stateDir,
        services: config.services
      });
    } catch (error) {
      return {
        jobId: job.id,
        kind: job.kind,
        nodeId: config.nodeId,
        status: "failed" as const,
        summary: error instanceof Error ? error.message : String(error),
        details: {
          thrown: true
        },
        completedAt: new Date().toISOString()
      };
    }
  })();
  const bufferedAt = new Date().toISOString();

  await writeJsonFileAtomic(reportPath, {
    schemaVersion: 1,
    result,
    bufferedAt,
    deliveryAttempts: 0
  } satisfies ShmBufferedReport);

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "executed",
    claimedAt,
    executedAt: bufferedAt,
    resultStatus: result.status
  } satisfies ShmSpoolEntry);

  await writeLastAppliedState(job.desiredStateVersion, job.id);
  console.log(renderJobResult(result));

  if (
    nodeToken &&
    (await deliverBufferedReport(
      reportPath,
      {
        schemaVersion: 1,
        result,
        bufferedAt,
        deliveryAttempts: 0
      },
      nodeToken
    ))
  ) {
    await removeFileIfExists(spoolPath);
  }
}

export async function runManagerAgentCycle(): Promise<void> {
  const config = createShmRuntimeConfig();
  const snapshot = await createNodeSnapshot();
  const registrationToken = snapshot.nodeToken ?? config.enrollmentToken;

  if (!registrationToken) {
    throw new Error(
      "SHM_ENROLLMENT_TOKEN is required until SHP issues a node bearer token."
    );
  }

  const registration = await registerNode(
    config.controlPlaneUrl,
    createRegistrationRequest(snapshot),
    registrationToken
  );
  const nodeToken = registration.nodeToken ?? snapshot.nodeToken;

  if (!nodeToken) {
    throw new Error(`SHP did not issue a node token for ${config.nodeId}.`);
  }

  await writeJsonFileAtomic(getShmStatePaths(config).nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken
  });

  console.log(renderNodeSnapshot(snapshot));
  console.log(
    `Registered with ${config.controlPlaneUrl} at ${registration.acceptedAt}. Poll every ${registration.pollIntervalMs}ms.`
  );

  const flushedReports = await flushBufferedReports();

  if (flushedReports > 0) {
    console.log(`Delivered ${flushedReports} buffered report(s).`);
  }

  const claimed = await claimJobs(config.controlPlaneUrl, {
    nodeId: config.nodeId,
    hostname: config.hostname,
    version: config.version,
    maxJobs: 4
  }, nodeToken);

  if (claimed.jobs.length === 0) {
    console.log("No jobs available.");
    return;
  }

  for (const job of claimed.jobs) {
    await executeClaimedJob(job);
  }
}

export async function startManagerAgent(): Promise<void> {
  const config = createShmRuntimeConfig();
  const runOnce = process.env.SHM_RUN_ONCE === "true";

  do {
    try {
      await runManagerAgentCycle();
    } catch (error: unknown) {
      console.error(error);
    }

    if (runOnce) {
      break;
    }

    await sleep(config.heartbeatMs);
  } while (true);
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isMainModule()) {
  startManagerAgent().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
