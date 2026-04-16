import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseSandboxBundleChecks {
  readonly pack: readonly string[];
  readonly runtime: readonly string[];
  readonly parity: readonly string[];
}

export interface CombinedControlReleaseSandboxStartupMetadata {
  readonly mode: CombinedControlStartupManifest["mode"];
  readonly origin: string;
  readonly listener: string;
  readonly configSource: CombinedControlStartupManifest["configSource"];
  readonly surfaces: readonly string[];
}

export interface CombinedControlReleaseSandboxBundlePaths {
  readonly workspaceRoot: string;
  readonly sandboxRoot: string;
  readonly releasesRoot: string;
  readonly releaseVersionRoot: string;
  readonly currentRoot: string;
  readonly sharedRoot: string;
  readonly sharedTmpDir: string;
  readonly sharedLogsDir: string;
  readonly sharedRunDir: string;
  readonly entrypoint: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly bundleManifestFile: string;
  readonly bundleSummaryFile: string;
  readonly logsDir: string;
  readonly runDir: string;
}

export interface CombinedControlReleaseSandboxBundle {
  readonly kind: "combined-release-sandbox-bundle";
  readonly version: string;
  readonly createdAt: string;
  readonly sandboxId: string;
  readonly sourceCommitish: string;
  readonly releaseRootTarget: "/opt/simplehostman/release";
  readonly paths: CombinedControlReleaseSandboxBundlePaths;
  readonly startup: CombinedControlReleaseSandboxStartupMetadata;
  readonly checks: CombinedControlReleaseSandboxBundleChecks;
}

export function createCombinedControlReleaseSandboxBundle(args: {
  version: string;
  createdAt?: string;
  sandboxId: string;
  sourceCommitish: string;
  releaseRootTarget?: "/opt/simplehostman/release";
  paths: CombinedControlReleaseSandboxBundlePaths;
  startupManifest: CombinedControlStartupManifest;
}): CombinedControlReleaseSandboxBundle {
  const { startupManifest } = args;

  return {
    kind: "combined-release-sandbox-bundle",
    version: args.version,
    createdAt: args.createdAt ?? new Date().toISOString(),
    sandboxId: args.sandboxId,
    sourceCommitish: args.sourceCommitish,
    releaseRootTarget: args.releaseRootTarget ?? "/opt/simplehostman/release",
    paths: args.paths,
    startup: {
      mode: startupManifest.mode,
      origin: startupManifest.origin,
      listener: `${startupManifest.listener.host}:${startupManifest.listener.port}`,
      configSource: startupManifest.configSource,
      surfaces: startupManifest.surfaces
    },
    checks: {
      pack: [
        "artifact copied to sandbox current/apps/control/dist",
        "workspace package.json mirrored into sandbox current",
        "control package.json mirrored into sandbox current/apps/control",
        "env file written to sandbox current/env/control.env",
        "startup manifest and summary written to sandbox current/meta"
      ],
      runtime: [
        "sandbox runtime boots from copied entrypoint",
        "healthz reachable over HTTP",
        "startup manifest origin matches the booted runtime",
        "env file resolves combined release-sandbox mode"
      ],
      parity: [
        "representative routes match direct combined candidate",
        "startup metadata remains aligned with workspace candidate"
      ]
    }
  };
}

export function formatCombinedControlReleaseSandboxBundle(
  bundle: CombinedControlReleaseSandboxBundle
): string {
  return [
    "Combined control release-sandbox bundle",
    `Version: ${bundle.version}`,
    `Created: ${bundle.createdAt}`,
    `Sandbox: ${bundle.sandboxId}`,
    `Source commitish: ${bundle.sourceCommitish}`,
    `Release target: ${bundle.releaseRootTarget}`,
    `Releases root: ${bundle.paths.releasesRoot}`,
    `Release version root: ${bundle.paths.releaseVersionRoot}`,
    `Current: ${bundle.paths.currentRoot}`,
    `Shared root: ${bundle.paths.sharedRoot}`,
    `Origin: ${bundle.startup.origin}`,
    `Listener: ${bundle.startup.listener}`,
    `Mode: ${bundle.startup.mode}`,
    `Config source: ${bundle.startup.configSource}`,
    `Surfaces: ${bundle.startup.surfaces.join(", ")}`,
    `Entrypoint: ${bundle.paths.entrypoint}`,
    `Env file: ${bundle.paths.envFile}`,
    `Startup manifest: ${bundle.paths.startupManifestFile}`,
    `Bundle manifest: ${bundle.paths.bundleManifestFile}`
  ].join("\n");
}
