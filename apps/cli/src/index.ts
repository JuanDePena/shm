#!/usr/bin/env node

import {
  claimJobs,
  registerNode
} from "@simplehost/manager-control-plane-client";
import { isSupportedJobKind, supportedJobKinds } from "@simplehost/manager-contracts";
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

function createRegistrationPayload(snapshot: Awaited<ReturnType<typeof createSnapshotForCli>>) {
  const config = createShmRuntimeConfig();

  return {
    nodeId: snapshot.nodeId,
    hostname: snapshot.hostname,
    version: config.version,
    supportedJobKinds: [...supportedJobKinds],
    generatedAt: snapshot.generatedAt
  };
}

async function main(): Promise<void> {
  const config = createShmRuntimeConfig();
  const command = process.argv[2] ?? "help";

  if (command === "help") {
    console.log("Usage: shm <health|paths|register|claim|run-job <kind>>");
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

  if (command === "register") {
    const snapshot = await createSnapshotForCli();
    const registration = await registerNode(
      config.controlPlaneUrl,
      createRegistrationPayload(snapshot)
    );

    console.log(JSON.stringify(registration, null, 2));
    return;
  }

  if (command === "claim") {
    const snapshot = await createSnapshotForCli();
    await registerNode(config.controlPlaneUrl, createRegistrationPayload(snapshot));

    const claimed = await claimJobs(config.controlPlaneUrl, {
      nodeId: snapshot.nodeId,
      hostname: snapshot.hostname,
      version: config.version,
      maxJobs: 4
    });

    console.log(JSON.stringify(claimed, null, 2));
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
