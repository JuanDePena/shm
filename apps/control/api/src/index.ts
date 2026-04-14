import { createServer } from "node:http";

import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlProcessContext
} from "@simplehost/control-shared";
import {
  createPostgresControlPlaneStore,
  NodeAuthorizationError,
  UserAuthorizationError
} from "@simplehost/panel-database";

import { writeJson } from "./api-http.js";
import { createApiRequestHandler } from "./api-routes.js";

export async function createPanelApiRuntime(
  context: ControlProcessContext = createControlProcessContext()
): Promise<{
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
}> {
  const controlPlaneStore = await createPostgresControlPlaneStore(
    context.config.database.url,
    {
      pollIntervalMs: context.config.worker.pollIntervalMs,
      bootstrapEnrollmentToken: context.config.auth.bootstrapEnrollmentToken,
      sessionTtlSeconds: context.config.auth.sessionTtlSeconds,
      bootstrapAdminEmail: context.config.auth.bootstrapAdminEmail,
      bootstrapAdminPassword: context.config.auth.bootstrapAdminPassword,
      bootstrapAdminName: context.config.auth.bootstrapAdminName,
      defaultInventoryImportPath: context.config.inventory.importPath,
      jobPayloadSecret: context.config.jobs.payloadSecret
    }
  );
  const requestHandler = createApiRequestHandler({
    config: context.config,
    startedAt: context.startedAt,
    controlPlaneStore
  });
  const server = createServer((request, response) => {
    void requestHandler(request, response).catch((error: unknown) => {
      if (error instanceof NodeAuthorizationError) {
        writeJson(response, 401, {
          error: "Unauthorized",
          message: error.message
        });
        return;
      }

      if (error instanceof UserAuthorizationError) {
        writeJson(
          response,
          error.message.includes("required role") ? 403 : 401,
          {
            error: error.message.includes("required role") ? "Forbidden" : "Unauthorized",
            message: error.message
          }
        );
        return;
      }

      writeJson(response, 500, {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error)
      });
    });
  });

  server.listen(context.config.api.port, context.config.api.host, () => {
    console.log(`SHP API listening on http://${context.config.api.host}:${context.config.api.port}`);
  });

  return {
    server,
    close: async () => {
      await closeHttpServer(server);
      await controlPlaneStore.close();
    }
  };
}

export async function startPanelApi(
  context: ControlProcessContext = createControlProcessContext()
): Promise<ReturnType<typeof createServer>> {
  const runtime = await createPanelApiRuntime(context);
  return runtime.server;
}

if (isMainModule(import.meta.url)) {
  createPanelApiRuntime()
    .then(({ close, server }) => {
      registerGracefulShutdown(close, {
        onBeforeExit: () => {
          if (server.listening) {
            server.unref();
          }
        },
        onShutdownError: (error) => {
          console.error(error);
        }
      });
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
