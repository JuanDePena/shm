import { type Server } from "node:http";

import {
  createPanelRuntimeConfig,
  type PanelRuntimeConfig
} from "@simplehost/panel-config";

export interface RuntimeHealthSnapshot {
  service: string;
  status: "ok";
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}

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

export function createRuntimeHealthSnapshot<TExtra extends Record<string, unknown> = {}>({
  config,
  service,
  startedAt,
  extra
}: {
  config: Pick<PanelRuntimeConfig, "env" | "version">;
  service: string;
  startedAt: number;
  extra?: TExtra;
}): RuntimeHealthSnapshot & TExtra {
  return {
    service,
    status: "ok",
    version: config.version,
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ...(extra ?? ({} as TExtra))
  };
}

export async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
