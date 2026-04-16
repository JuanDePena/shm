import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";

import type { CombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import {
  createCombinedControlReleaseSandboxLayout,
  type CombinedControlReleaseSandboxLayout
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseSandboxReleaseRecord {
  readonly version: string;
  readonly releaseVersionRoot: string;
  readonly bundleManifestFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly packedAt: string;
  readonly sourceCommitish: string;
}

export interface CombinedControlReleaseSandboxInventory {
  readonly kind: "combined-release-sandbox-inventory";
  readonly sandboxId: string;
  readonly workspaceRoot: string;
  readonly releases: readonly CombinedControlReleaseSandboxReleaseRecord[];
}

export interface CombinedControlReleaseSandboxActivationManifest {
  readonly kind: "combined-release-sandbox-activation";
  readonly sandboxId: string;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly activatedAt: string;
  readonly availableVersions: readonly string[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseSandboxInventory(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxInventory> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  const inventory =
    safeReadJson<CombinedControlReleaseSandboxInventory>(layout.releasesInventoryFile);

  if (inventory) {
    return inventory;
  }

  return {
    kind: "combined-release-sandbox-inventory",
    sandboxId: layout.sandboxId,
    workspaceRoot: layout.workspaceRoot,
    releases: []
  };
}

export async function writeCombinedControlReleaseSandboxInventory(args: {
  layout: CombinedControlReleaseSandboxLayout;
  inventory: CombinedControlReleaseSandboxInventory;
}): Promise<void> {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.releasesInventoryFile,
    JSON.stringify(args.inventory, null, 2).concat("\n")
  );
}

export async function upsertCombinedControlReleaseSandboxRelease(args: {
  layout: CombinedControlReleaseSandboxLayout;
  bundle: CombinedControlReleaseSandboxBundle;
}): Promise<CombinedControlReleaseSandboxInventory> {
  const current = await readCombinedControlReleaseSandboxInventory({
    workspaceRoot: args.layout.workspaceRoot,
    sandboxId: args.layout.sandboxId
  });
  const nextRecord: CombinedControlReleaseSandboxReleaseRecord = {
    version: args.bundle.version,
    releaseVersionRoot: args.layout.releaseVersionRoot,
    bundleManifestFile: args.layout.bundleManifestFile,
    startupManifestFile: args.layout.startupManifestFile,
    startupSummaryFile: args.layout.startupSummaryFile,
    packedAt: args.bundle.createdAt,
    sourceCommitish: args.bundle.sourceCommitish
  };
  const releases = [
    ...current.releases.filter((release) => release.version !== nextRecord.version),
    nextRecord
  ].sort((left, right) => left.version.localeCompare(right.version));
  const inventory: CombinedControlReleaseSandboxInventory = {
    kind: "combined-release-sandbox-inventory",
    sandboxId: args.layout.sandboxId,
    workspaceRoot: args.layout.workspaceRoot,
    releases
  };

  await writeCombinedControlReleaseSandboxInventory({
    layout: args.layout,
    inventory
  });

  return inventory;
}

export function formatCombinedControlReleaseSandboxInventory(
  inventory: CombinedControlReleaseSandboxInventory
): string {
  return [
    "Combined control release-sandbox inventory",
    `Sandbox: ${inventory.sandboxId}`,
    `Workspace root: ${inventory.workspaceRoot}`,
    `Versions: ${
      inventory.releases.length > 0
        ? inventory.releases.map((release) => release.version).join(", ")
        : "none"
    }`
  ].join("\n");
}

export function formatCombinedControlReleaseSandboxActivation(
  manifest: CombinedControlReleaseSandboxActivationManifest
): string {
  return [
    "Combined control release-sandbox activation",
    `Sandbox: ${manifest.sandboxId}`,
    `Active version: ${manifest.activeVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Activated: ${manifest.activatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export async function activateCombinedControlReleaseSandboxVersion(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version: string;
}): Promise<CombinedControlReleaseSandboxActivationManifest> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  const inventory = await readCombinedControlReleaseSandboxInventory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const targetRelease = inventory.releases.find((release) => release.version === args.version);

  if (!targetRelease) {
    throw new Error(
      `Release version ${args.version} is not available in sandbox ${layout.sandboxId}`
    );
  }

  await mkdir(layout.sharedMetaDir, { recursive: true });

  const previousActivation =
    safeReadJson<CombinedControlReleaseSandboxActivationManifest>(
      layout.activationManifestFile
    );
  const previousVersion = previousActivation?.activeVersion ?? null;

  try {
    const currentStat = lstatSync(layout.currentRoot);
    if (currentStat.isSymbolicLink() || currentStat.isDirectory()) {
      await rm(layout.currentRoot, { recursive: true, force: true });
    }
  } catch {
    // current link does not exist yet
  }

  await symlink(targetRelease.releaseVersionRoot, layout.currentRoot);
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(`Sandbox current root is not a symlink: ${layout.currentRoot}`);
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(targetRelease.releaseVersionRoot)) {
    throw new Error("Sandbox current root does not point at the requested release version");
  }

  const manifest: CombinedControlReleaseSandboxActivationManifest = {
    kind: "combined-release-sandbox-activation",
    sandboxId: layout.sandboxId,
    activeVersion: args.version,
    previousVersion,
    currentRoot: layout.currentRoot,
    currentEntrypoint: layout.currentEntrypoint,
    activatedAt: new Date().toISOString(),
    availableVersions: inventory.releases.map((release) => release.version)
  };

  await writeFile(
    layout.activationManifestFile,
    JSON.stringify(manifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.activationSummaryFile,
    formatCombinedControlReleaseSandboxActivation(manifest).concat("\n")
  );

  return manifest;
}

export async function resolveActiveCombinedControlReleaseSandbox(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseSandboxLayout;
  activation: CombinedControlReleaseSandboxActivationManifest;
  bundle: CombinedControlReleaseSandboxBundle;
}> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  const activation =
    safeReadJson<CombinedControlReleaseSandboxActivationManifest>(
      layout.activationManifestFile
    );

  if (!activation) {
    throw new Error(`Sandbox activation manifest missing: ${layout.activationManifestFile}`);
  }

  const activeLayout = createCombinedControlReleaseSandboxLayout({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId,
    version: activation.activeVersion
  });
  const bundleManifestFile = activeLayout.bundleManifestFile;
  const bundle = safeReadJson<CombinedControlReleaseSandboxBundle>(bundleManifestFile);

  if (!bundle) {
    throw new Error(`Sandbox bundle manifest missing for active release: ${bundleManifestFile}`);
  }

  return {
    layout: activeLayout,
    activation,
    bundle
  };
}
