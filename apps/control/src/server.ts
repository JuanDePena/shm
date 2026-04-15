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
import type { ControlCandidateRuntimeSurface } from "./runtime-surface.js";

export interface ControlCandidateServerRuntime<
  TMode extends "combined-candidate" | "split-candidate"
> {
  readonly context: ControlProcessContext;
  readonly mode: TMode;
  readonly server: Server;
  readonly origin: string;
  close(): Promise<void>;
}

export interface CombinedControlServerRuntime
  extends ControlCandidateServerRuntime<"combined-candidate"> {
  readonly contract: CombinedControlRuntimeContract;
}

function resolveOrigin(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    return "http://127.0.0.1";
  }

  const host = address.address === "::" ? "127.0.0.1" : address.address;
  return `http://${host}:${address.port}`;
}

export async function startControlCandidateServer<TMode extends "combined-candidate" | "split-candidate">(
  args: {
    context: ControlProcessContext;
    surface: ControlCandidateRuntimeSurface<TMode>;
    host?: string;
    port?: number;
  }
): Promise<ControlCandidateServerRuntime<TMode>> {
  const server = createServer(args.surface.requestHandler);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      args.port ?? args.context.config.web.port,
      args.host ?? args.context.config.web.host,
      () => {
        server.off("error", reject);
        resolve();
      }
    );
  });

  return {
    context: args.context,
    mode: args.surface.mode,
    server,
    origin: resolveOrigin(server),
    close: async () => {
      await closeHttpServer(server);
      await args.surface.close();
    }
  };
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
  const runtime = await startControlCandidateServer({
    context,
    surface: {
      mode: contract.mode,
      context,
      requestHandler: contract.requestHandler,
      close: contract.close
    },
    host: args.host,
    port: args.port
  });

  return {
    context,
    mode: runtime.mode,
    contract,
    server: runtime.server,
    origin: runtime.origin,
    close: async () => {
      await runtime.close();
    }
  };
}
