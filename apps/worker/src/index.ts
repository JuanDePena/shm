import { realpathSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { createControlRuntimeConfig } from "@simplehost/control-config";
import { createControlApiMetadata } from "@simplehost/control-contracts";
import { createPostgresControlPlaneStore } from "@simplehost/control-database";

type WorkerStore = Awaited<ReturnType<typeof createPostgresControlPlaneStore>>;

function createWorkerStore(
  config: ReturnType<typeof createControlRuntimeConfig>
): Promise<WorkerStore> {
  return createPostgresControlPlaneStore(config.database.url, {
    pollIntervalMs: config.worker.pollIntervalMs,
    bootstrapEnrollmentToken: config.auth.bootstrapEnrollmentToken,
    sessionTtlSeconds: config.auth.sessionTtlSeconds,
    bootstrapAdminEmail: config.auth.bootstrapAdminEmail,
    bootstrapAdminPassword: config.auth.bootstrapAdminPassword,
    bootstrapAdminName: config.auth.bootstrapAdminName,
    defaultInventoryImportPath: config.inventory.importPath,
    jobPayloadSecret: config.jobs.payloadSecret
  });
}

export async function runWorkerIteration(
  controlPlaneStore?: WorkerStore,
  config = createControlRuntimeConfig()
): Promise<void> {
  const metadata = createControlApiMetadata("worker", config.version);
  const ownsStore = !controlPlaneStore;
  const store = controlPlaneStore ?? await createWorkerStore(config);

  try {
    const reconciliation = await store.runReconciliationCycle();
    const historyPurge = await store.purgeOperationalHistory();
    const operations = await store.getOperationsOverview(null);

    console.log(
      JSON.stringify(
        {
          metadata,
          controlPlane: {
            pendingJobCount: operations.pendingJobCount,
            failedJobCount: operations.failedJobCount,
            driftedResourceCount: operations.driftedResourceCount,
            reconciliation: {
              runId: reconciliation.runId,
              generatedJobCount: reconciliation.generatedJobCount,
              skippedJobCount: reconciliation.skippedJobCount,
              missingCredentialCount: reconciliation.missingCredentialCount,
              startedAt: reconciliation.startedAt,
              completedAt: reconciliation.completedAt
            },
            historyRetention: {
              retentionDays: historyPurge.retentionDays,
              cutoffAt: historyPurge.cutoffAt,
              deletedJobCount: historyPurge.deletedJobCount,
              deletedJobResultCount: historyPurge.deletedJobResultCount,
              deletedAuditEventCount: historyPurge.deletedAuditEventCount
            }
          }
        },
        null,
        config.worker.logLevel === "debug" ? 2 : 0
      )
    );
  } finally {
    if (ownsStore) {
      await store.close();
    }
  }
}

export async function startPanelWorker(): Promise<void> {
  const config = createControlRuntimeConfig();
  const runOnce = process.env.SIMPLEHOST_WORKER_RUN_ONCE === "true";
  const controlPlaneStore = await createWorkerStore(config);

  try {
    do {
      await runWorkerIteration(controlPlaneStore, config);

      if (runOnce) {
        break;
      }

      await sleep(config.worker.reconciliationIntervalMs);
    } while (true);
  } finally {
    await controlPlaneStore.close();
  }
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
  startPanelWorker().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
