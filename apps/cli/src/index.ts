#!/usr/bin/env node

import { isSupportedJobKind } from "@simplehost/manager-contracts";
import { createDemoJob, executeAllowlistedJob } from "@simplehost/manager-drivers";
import {
  createShmRuntimeConfig,
  ensureShmStateDirectories,
  getShmStatePaths
} from "@simplehost/manager-node-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/manager-renderers";

async function createSnapshotForCli() {
  const config = createShmRuntimeConfig();
  const statePaths = getShmStatePaths(config);

  await ensureShmStateDirectories(config);

  return {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready" as const,
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString()
  };
}

async function main(): Promise<void> {
  const config = createShmRuntimeConfig();
  const command = process.argv[2] ?? "help";

  if (command === "help") {
    console.log("Usage: shm <health|paths|run-job <kind>>");
    return;
  }

  if (command === "health") {
    const snapshot = await createSnapshotForCli();
    console.log(renderNodeSnapshot(snapshot));
    return;
  }

  if (command === "paths") {
    console.log(
      JSON.stringify(
        {
          configPath: config.configPath,
          statePaths: getShmStatePaths(config),
          logDir: config.logDir
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "run-job") {
    const kind = process.argv[3];

    if (!kind || !isSupportedJobKind(kind)) {
      console.error("Provide a supported job kind.");
      process.exitCode = 1;
      return;
    }

    const result = await executeAllowlistedJob(createDemoJob(config.nodeId, kind), {
      nodeId: config.nodeId,
      hostname: config.hostname
    });

    console.log(renderJobResult(result));
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
