import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import {
  createCombinedControlReleaseRootPromotionLayout,
  type CombinedControlReleaseRootPromotionLayout
} from "./release-root-promotion-layout.js";
import type {
  CombinedControlReleaseRootPromotionHistory,
  CombinedControlReleaseRootPromotionManifest
} from "./release-root-promotion-promotion.js";

export interface CombinedControlReleaseRootPromotionDeployManifest {
  readonly kind: "combined-release-root-promotion-deploy";
  readonly targetId: string;
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly targetService: "control";
  readonly activeVersion: string;
  readonly promotedVersion: string;
  readonly previousVersion: string | null;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-promotion";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly applyManifestFile: string;
  readonly startupManifestFile: string;
  readonly promotionManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
}

export interface CombinedControlReleaseRootPromotionRollbackManifest {
  readonly kind: "combined-release-root-promotion-rollback";
  readonly targetId: string;
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly targetService: "control";
  readonly rollbackVersion: string | null;
  readonly currentVersion: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-promotion";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly promotionManifestFile: string;
  readonly reason: string;
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseRootPromotionDeployManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionDeployManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  return safeReadJson<CombinedControlReleaseRootPromotionDeployManifest>(
    layout.deployManifestFile
  );
}

export async function readCombinedControlReleaseRootPromotionRollbackManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionRollbackManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  return safeReadJson<CombinedControlReleaseRootPromotionRollbackManifest>(
    layout.rollbackManifestFile
  );
}

export function formatCombinedControlReleaseRootPromotionDeployManifest(
  manifest: CombinedControlReleaseRootPromotionDeployManifest
): string {
  return [
    "Combined control release-root promotion deploy manifest",
    `Target: ${manifest.targetId}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Target service: ${manifest.targetService}`,
    `Active version: ${manifest.activeVersion}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Origin: ${manifest.origin}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`
  ].join("\n");
}

export function formatCombinedControlReleaseRootPromotionRollbackManifest(
  manifest: CombinedControlReleaseRootPromotionRollbackManifest
): string {
  return [
    "Combined control release-root promotion rollback manifest",
    `Target: ${manifest.targetId}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Target service: ${manifest.targetService}`,
    `Current version: ${manifest.currentVersion}`,
    `Rollback version: ${manifest.rollbackVersion ?? "none"}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Reason: ${manifest.reason}`
  ].join("\n");
}

export async function materializeCombinedControlReleaseRootPromotionDeployment(args: {
  layout: CombinedControlReleaseRootPromotionLayout;
  promotion: CombinedControlReleaseRootPromotionManifest;
  history: CombinedControlReleaseRootPromotionHistory;
}): Promise<{
  deployManifest: CombinedControlReleaseRootPromotionDeployManifest;
  rollbackManifest: CombinedControlReleaseRootPromotionRollbackManifest;
}> {
  void args.history;

  const rollbackVersion = args.promotion.previousPromotedVersion;
  const deployManifest: CombinedControlReleaseRootPromotionDeployManifest = {
    kind: "combined-release-root-promotion-deploy",
    targetId: args.layout.targetId,
    emulatedReleaseRoot: "/opt/simplehostman/release",
    targetService: "control",
    activeVersion: args.promotion.activeVersion,
    promotedVersion: args.promotion.promotedVersion,
    previousVersion: args.promotion.previousPromotedVersion,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-promotion",
    currentRoot: args.promotion.currentRoot,
    currentEntrypoint: args.promotion.currentEntrypoint,
    applyManifestFile: args.layout.applyManifestFile,
    startupManifestFile: args.promotion.startupManifestFile,
    promotionManifestFile: args.layout.promotionManifestFile,
    origin: args.promotion.origin,
    surfaces: args.promotion.surfaces
  };
  const rollbackManifest: CombinedControlReleaseRootPromotionRollbackManifest = {
    kind: "combined-release-root-promotion-rollback",
    targetId: args.layout.targetId,
    emulatedReleaseRoot: "/opt/simplehostman/release",
    targetService: "control",
    rollbackVersion,
    currentVersion: args.promotion.promotedVersion,
    generatedAt: deployManifest.generatedAt,
    strategy: "workspace-release-root-promotion",
    currentRoot: args.promotion.currentRoot,
    currentEntrypoint: args.promotion.currentEntrypoint,
    promotionManifestFile: args.layout.promotionManifestFile,
    reason:
      rollbackVersion !== null
        ? `rollback available via prior promoted version ${rollbackVersion}`
        : "no previous promoted version recorded"
  };

  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.deployManifestFile,
    JSON.stringify(deployManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.deploySummaryFile,
    formatCombinedControlReleaseRootPromotionDeployManifest(deployManifest).concat("\n")
  );
  await writeFile(
    args.layout.rollbackManifestFile,
    JSON.stringify(rollbackManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.rollbackSummaryFile,
    formatCombinedControlReleaseRootPromotionRollbackManifest(rollbackManifest).concat("\n")
  );

  return {
    deployManifest,
    rollbackManifest
  };
}
