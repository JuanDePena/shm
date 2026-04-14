import { type Server } from "node:http";

import {
  createPanelRuntimeConfig,
  type PanelRuntimeConfig
} from "@simplehost/panel-config";

export interface ControlProcessContext {
  config: PanelRuntimeConfig;
  startedAt: number;
}

export function createControlProcessContext(
  env: NodeJS.ProcessEnv = process.env
): ControlProcessContext {
  return {
    config: createPanelRuntimeConfig(env),
    startedAt: Date.now()
  };
}

export async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
