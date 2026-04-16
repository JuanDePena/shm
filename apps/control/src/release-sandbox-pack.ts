import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { createControlProcessContext } from "@simplehost/control-shared";

import {
  createCombinedControlReleaseCandidateConfig,
  type CombinedControlReleaseCandidateConfig
} from "./release-candidate-config.js";
import {
  createCombinedControlReleaseSandboxLayout,
  type CombinedControlReleaseSandboxLayout
} from "./release-sandbox-layout.js";
import {
  createCombinedControlStartupManifest,
  formatCombinedControlStartupManifest,
  type CombinedControlStartupManifest
} from "./startup-manifest.js";

export interface CombinedControlReleaseSandboxBundle {
  readonly kind: "combined-release-sandbox-bundle";
  readonly version: string;
  readonly workspaceRoot: string;
  readonly sandboxRoot: string;
  readonly currentRoot: string;
  readonly entrypoint: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
}

export interface PackCombinedControlReleaseSandboxResult {
  readonly layout: CombinedControlReleaseSandboxLayout;
  readonly config: CombinedControlReleaseCandidateConfig;
  readonly startupManifest: CombinedControlStartupManifest;
  readonly bundle: CombinedControlReleaseSandboxBundle;
}

function toEnvFileContent(config: CombinedControlReleaseCandidateConfig): string {
  return [
    `NODE_ENV=${config.environment}`,
    `SHP_VERSION=${config.version}`,
    `SHP_WEB_HOST=${config.host}`,
    `SHP_WEB_PORT=${config.port}`,
    `SHP_INVENTORY_PATH=${config.inventoryImportPath}`,
    "SIMPLEHOST_CONTROL_RUNTIME_MODE=combined",
    "SIMPLEHOST_CONTROL_SANDBOX_MODE=release-sandbox",
    `SIMPLEHOST_CONTROL_SANDBOX_ORIGIN=${config.origin}`
  ].join("\n").concat("\n");
}

export async function packCombinedControlReleaseSandbox(args: {
  workspaceRoot?: string;
  version?: string;
  sandboxId?: string;
  host?: string;
  port?: number;
  clean?: boolean;
} = {}): Promise<PackCombinedControlReleaseSandboxResult> {
  const layout = createCombinedControlReleaseSandboxLayout({
    workspaceRoot: args.workspaceRoot,
    version: args.version,
    sandboxId: args.sandboxId
  });
  const context = createControlProcessContext({
    ...process.env,
    SHP_WEB_HOST: args.host ?? process.env.SHP_WEB_HOST ?? "127.0.0.1",
    SHP_WEB_PORT: String(args.port ?? process.env.SHP_WEB_PORT ?? "3200")
  });
  const config = createCombinedControlReleaseCandidateConfig({
    context,
    host: args.host,
    port: args.port
  });
  const startupManifest = createCombinedControlStartupManifest(config);
  const bundle: CombinedControlReleaseSandboxBundle = {
    kind: "combined-release-sandbox-bundle",
    version: layout.version,
    workspaceRoot: layout.workspaceRoot,
    sandboxRoot: layout.sandboxRoot,
    currentRoot: layout.currentRoot,
    entrypoint: join(layout.controlDistRoot, "release-sandbox-entrypoint.js"),
    envFile: layout.envFile,
    startupManifestFile: layout.startupManifestFile,
    startupSummaryFile: layout.startupSummaryFile
  };

  if (args.clean !== false) {
    await rm(layout.sandboxRoot, { recursive: true, force: true });
  }

  await mkdir(layout.controlDistRoot, { recursive: true });
  await mkdir(layout.envDir, { recursive: true });
  await mkdir(layout.metaDir, { recursive: true });
  await mkdir(layout.logsDir, { recursive: true });
  await mkdir(layout.runDir, { recursive: true });

  await cp(
    join(layout.workspaceRoot, "apps", "control", "dist"),
    layout.controlDistRoot,
    { recursive: true }
  );
  await writeFile(
    join(layout.appsControlRoot, "package.json"),
    await readFile(join(layout.workspaceRoot, "apps", "control", "package.json"), "utf8")
  );
  await writeFile(
    join(layout.currentRoot, "package.json"),
    await readFile(join(layout.workspaceRoot, "package.json"), "utf8")
  );

  if (existsSync(layout.nodeModulesLink)) {
    await rm(layout.nodeModulesLink, { recursive: true, force: true });
  }
  if (existsSync(layout.appsControlNodeModulesLink)) {
    await rm(layout.appsControlNodeModulesLink, { recursive: true, force: true });
  }

  await symlink(join(layout.workspaceRoot, "node_modules"), layout.nodeModulesLink);
  await symlink(
    join(layout.workspaceRoot, "apps", "control", "node_modules"),
    layout.appsControlNodeModulesLink
  );
  await writeFile(layout.envFile, toEnvFileContent(config));
  await writeFile(
    layout.startupManifestFile,
    JSON.stringify(startupManifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.startupSummaryFile,
    formatCombinedControlStartupManifest(startupManifest).concat("\n")
  );
  await writeFile(
    layout.bundleManifestFile,
    JSON.stringify(bundle, null, 2).concat("\n")
  );

  return {
    layout,
    config,
    startupManifest,
    bundle
  };
}
