import { createServer } from "node:http";

import {
  closeHttpServer,
  createControlProcessContext,
  isMainModule,
  registerGracefulShutdown,
  type ControlAuthSurface,
  type ControlProcessContext
} from "@simplehost/control-shared";
import {
  type ControlPlaneStore,
  createPostgresControlPlaneStore,
  NodeAuthorizationError,
  UserAuthorizationError
} from "@simplehost/control-database";

import { writeJson } from "./api-http.js";
import { createApiRequestHandler } from "./api-routes.js";

export { writeJson } from "./api-http.js";

export interface ControlApiSurface {
  auth: ControlAuthSurface;
  controlPlaneStore: ControlPlaneStore;
  requestHandler: ReturnType<typeof createApiRequestHandler>;
  close: () => Promise<void>;
}

export function createControlApiHttpHandler(
  requestHandler: ReturnType<typeof createApiRequestHandler>
): ReturnType<typeof createApiRequestHandler> {
  return async (request, response) => {
    try {
      await requestHandler(request, response);
    } catch (error: unknown) {
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
    }
  };
}

export async function createControlApiSurface(
  context: ControlProcessContext = createControlProcessContext()
): Promise<ControlApiSurface> {
  const controlPlaneStore = await createPostgresControlPlaneStore(
    context.config.database.url,
    {
      pollIntervalMs: context.config.worker.pollIntervalMs,
      bootstrapEnrollmentToken: context.config.auth.bootstrapEnrollmentToken,
      sessionTtlSeconds: context.config.auth.sessionTtlSeconds,
      bootstrapAdminEmail: context.config.auth.bootstrapAdminEmail,
      bootstrapAdminPassword: context.config.auth.bootstrapAdminPassword,
      bootstrapAdminName: context.config.auth.bootstrapAdminName,
      jobPayloadSecret: context.config.jobs.payloadSecret
    }
  );
  const requestHandler = createApiRequestHandler({
    config: context.config,
    startedAt: context.startedAt,
    controlPlaneStore
  });
  const auth: ControlAuthSurface = {
    login: async (credentials) => controlPlaneStore.loginUser(credentials),
    logout: async (token) => {
      await controlPlaneStore.logoutUser(token);
    },
    getCurrentUser: async (token) => controlPlaneStore.getCurrentUser(token)
  };

  return {
    auth,
    controlPlaneStore,
    requestHandler,
    close: async () => {
      await controlPlaneStore.close();
    }
  };
}

export async function createControlApiRuntime(
  context: ControlProcessContext = createControlProcessContext()
): Promise<{
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
}> {
  const surface = await createControlApiSurface(context);
  const server = createServer(createControlApiHttpHandler(surface.requestHandler));

  server.listen(context.config.api.port, context.config.api.host, () => {
    console.log(`SimpleHost Control API listening on http://${context.config.api.host}:${context.config.api.port}`);
  });

  return {
    server,
    close: async () => {
      await closeHttpServer(server);
      await surface.close();
    }
  };
}

export async function startControlApi(
  context: ControlProcessContext = createControlProcessContext()
): Promise<ReturnType<typeof createServer>> {
  const runtime = await createControlApiRuntime(context);
  return runtime.server;
}

if (isMainModule(import.meta.url)) {
  createControlApiRuntime()
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
