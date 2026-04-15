import { createServer, type Server } from "node:http";

import {
  closeHttpServer,
  createControlProcessContext,
  type ControlProcessContext
} from "@simplehost/control-shared";

import {
  createCombinedControlRuntimeContract,
  type CombinedControlRuntimeContract
} from "./runtime-contract.js";
import type { ControlCombinedSurface } from "./combined-surface.js";

export interface CombinedControlServerRuntime {
  readonly context: ControlProcessContext;
  readonly contract: CombinedControlRuntimeContract;
  readonly server: Server;
  readonly origin: string;
  close(): Promise<void>;
}

function resolveOrigin(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    return "http://127.0.0.1";
  }

  const host = address.address === "::" ? "127.0.0.1" : address.address;
  return `http://${host}:${address.port}`;
}

export async function startCombinedControlServer(args: {
  context?: ControlProcessContext;
  surface?: ControlCombinedSurface;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlServerRuntime> {
  const context = args.context ?? createControlProcessContext();
  const contract = args.surface
    ? {
        mode: "combined-candidate" as const,
        context,
        requestHandler: args.surface.requestHandler,
        surface: args.surface,
        close: args.surface.close
      }
    : await createCombinedControlRuntimeContract(context);
  const server = createServer(contract.requestHandler);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      args.port ?? context.config.web.port,
      args.host ?? context.config.web.host,
      () => {
        server.off("error", reject);
        resolve();
      }
    );
  });

  return {
    context,
    contract,
    server,
    origin: resolveOrigin(server),
    close: async () => {
      await closeHttpServer(server);
      await contract.close();
    }
  };
}
