import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CombinedControlReleaseSandboxLayout {
  readonly workspaceRoot: string;
  readonly sandboxRoot: string;
  readonly sandboxId: string;
  readonly releasesRoot: string;
  readonly releaseVersionRoot: string;
  readonly currentRoot: string;
  readonly sharedRoot: string;
  readonly sharedTmpDir: string;
  readonly sharedLogsDir: string;
  readonly sharedRunDir: string;
  readonly appsRoot: string;
  readonly appsControlRoot: string;
  readonly controlDistRoot: string;
  readonly nodeModulesLink: string;
  readonly appsControlNodeModulesLink: string;
  readonly envDir: string;
  readonly envFile: string;
  readonly metaDir: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly bundleManifestFile: string;
  readonly bundleSummaryFile: string;
  readonly logsDir: string;
  readonly runDir: string;
  readonly version: string;
}

function readWorkspacePackageName(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const value = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };
    return typeof value.name === "string" ? value.name : null;
  } catch {
    return null;
  }
}

export function resolveWorkspaceRoot(
  startDir: string = dirname(fileURLToPath(import.meta.url))
): string {
  let current = startDir;

  while (true) {
    const packageJsonPath = join(current, "package.json");
    if (readWorkspacePackageName(packageJsonPath) === "simplehost-source") {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Unable to resolve workspace root from ${startDir}`);
    }
    current = parent;
  }
}

export function readWorkspaceVersion(workspaceRoot: string): string {
  const packageJsonPath = join(workspaceRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
    throw new Error(`Workspace version missing in ${packageJsonPath}`);
  }

  return parsed.version;
}

export function createCombinedControlReleaseSandboxLayout(args: {
  workspaceRoot?: string;
  version?: string;
  sandboxId?: string;
} = {}): CombinedControlReleaseSandboxLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const sandboxId = args.sandboxId ?? "default";
  const sandboxRoot = join(
    workspaceRoot,
    ".tmp",
    "control-release-sandbox",
    version,
    sandboxId
  );
  const releasesRoot = join(sandboxRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(sandboxRoot, "current");
  const sharedRoot = join(sandboxRoot, "shared");
  const sharedTmpDir = join(sharedRoot, "tmp");
  const sharedLogsDir = join(sharedRoot, "logs");
  const sharedRunDir = join(sharedRoot, "run");
  const appsRoot = join(releaseVersionRoot, "apps");
  const appsControlRoot = join(appsRoot, "control");
  const controlDistRoot = join(appsControlRoot, "dist");
  const envDir = join(releaseVersionRoot, "env");
  const metaDir = join(releaseVersionRoot, "meta");
  const runDir = join(sharedRunDir, "control");
  const logsDir = join(sharedLogsDir, "control");

  return {
    workspaceRoot,
    sandboxRoot,
    sandboxId,
    releasesRoot,
    releaseVersionRoot,
    currentRoot,
    sharedRoot,
    sharedTmpDir,
    sharedLogsDir,
    sharedRunDir,
    appsRoot,
    appsControlRoot,
    controlDistRoot,
    nodeModulesLink: join(releaseVersionRoot, "node_modules"),
    appsControlNodeModulesLink: join(appsControlRoot, "node_modules"),
    envDir,
    envFile: join(envDir, "control.env"),
    metaDir,
    startupManifestFile: join(metaDir, "startup-manifest.json"),
    startupSummaryFile: join(metaDir, "startup-summary.txt"),
    bundleManifestFile: join(metaDir, "bundle.json"),
    bundleSummaryFile: join(metaDir, "bundle-summary.txt"),
    logsDir,
    runDir,
    version
  };
}
