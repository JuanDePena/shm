import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import type { ShmNodeSnapshot } from "@simplehost/manager-contracts";
import { createDemoJob, executeAllowlistedJob } from "@simplehost/manager-drivers";
import {
  createShmRuntimeConfig,
  ensureShmStateDirectories,
  getShmStatePaths,
  writeJsonFileAtomic
} from "@simplehost/manager-node-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/manager-renderers";

export async function createNodeSnapshot(): Promise<ShmNodeSnapshot> {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);

  await ensureShmStateDirectories(config);

  const snapshot: ShmNodeSnapshot = {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready",
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString()
  };

  await writeJsonFileAtomic(statePaths.nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt
  });

  await writeJsonFileAtomic(statePaths.lastAppliedStateFile, {
    schemaVersion: 1,
    desiredStateVersion: "bootstrap",
    lastHeartbeatAt: snapshot.generatedAt
  });

  return snapshot;
}

export async function startManagerAgent(): Promise<void> {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);
  const runOnce = process.env.SHM_RUN_ONCE === "true";

  do {
    const snapshot = await createNodeSnapshot();
    console.log(renderNodeSnapshot(snapshot));

    const demoJob = createDemoJob(config.nodeId);
    const result = await executeAllowlistedJob(demoJob, {
      nodeId: config.nodeId,
      hostname: config.hostname
    });

    await writeJsonFileAtomic(
      `${statePaths.reportBufferDir}/${demoJob.id}.json`,
      {
        schemaVersion: 1,
        result
      }
    );

    console.log(renderJobResult(result));

    if (runOnce) {
      break;
    }

    await sleep(config.heartbeatMs);
  } while (true);
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startManagerAgent().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
