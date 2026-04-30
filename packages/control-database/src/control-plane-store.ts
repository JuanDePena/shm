import { Pool } from "pg";

import { ensureBootstrapAdmin, createControlPlaneAuthMethods } from "./control-plane-store-auth.js";
import { deriveJobPayloadKey } from "./control-plane-store-helpers.js";
import { createControlPlaneOperationsMethods } from "./control-plane-store-operations.js";
import { createControlPlaneSpecMethods } from "./control-plane-store-spec.js";
import {
  NodeAuthorizationError,
  UserAuthorizationError,
  type ControlPlaneStore,
  type ControlPlaneStoreOptions
} from "./control-plane-store-types.js";
import { runControlDatabaseMigrations } from "./migrations.js";

export {
  NodeAuthorizationError,
  UserAuthorizationError,
  type ControlPlaneStore,
  type ControlPlaneStoreOptions
};

export async function createPostgresControlPlaneStore(
  databaseUrl: string,
  options: ControlPlaneStoreOptions
): Promise<ControlPlaneStore> {
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const jobPayloadKey = deriveJobPayloadKey(options.jobPayloadSecret);
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "simplehost-control-api"
  });

  await runControlDatabaseMigrations(pool);
  await ensureBootstrapAdmin(pool, options);

  return {
    ...createControlPlaneAuthMethods({
      pool,
      options,
      pollIntervalMs,
      jobPayloadKey
    }),
    ...createControlPlaneSpecMethods({
      pool,
      options,
      jobPayloadKey
    }),
    ...createControlPlaneOperationsMethods({
      pool,
      jobPayloadKey,
      runtimeEnv: process.env
    }),
    async close() {
      await pool.end();
    }
  };
}
