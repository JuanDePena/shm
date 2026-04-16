import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import type { CombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import {
  activateCombinedControlReleaseSandboxVersion,
  readCombinedControlReleaseSandboxInventory,
  resolveActiveCombinedControlReleaseSandbox,
  type CombinedControlReleaseSandboxActivationManifest,
  type CombinedControlReleaseSandboxInventory
} from "./release-sandbox-activation.js";
import {
  createCombinedControlReleaseSandboxLayout,
  type CombinedControlReleaseSandboxLayout
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseSandboxPromotionManifest {
  readonly kind: "combined-release-sandbox-promotion";
  readonly sandboxId: string;
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly activeVersion: string;
  readonly promotedAt: string;
  readonly strategy: "workspace-release-sandbox";
  readonly releaseRootTarget: "/opt/simplehostman/release";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly bundleManifestFile: string;
  readonly startupManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
  readonly availableVersions: readonly string[];
}

export interface CombinedControlReleaseSandboxPromotionRecord {
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly promotedAt: string;
  readonly origin: string;
}

export interface CombinedControlReleaseSandboxPromotionHistory {
  readonly kind: "combined-release-sandbox-promotion-history";
  readonly sandboxId: string;
  readonly records: readonly CombinedControlReleaseSandboxPromotionRecord[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseSandboxPromotionHistory(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxPromotionHistory> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  const history =
    safeReadJson<CombinedControlReleaseSandboxPromotionHistory>(
      layout.promotionHistoryFile
    );

  if (history) {
    return history;
  }

  return {
    kind: "combined-release-sandbox-promotion-history",
    sandboxId: layout.sandboxId,
    records: []
  };
}

export async function readCombinedControlReleaseSandboxPromotionManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxPromotionManifest | null> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  return safeReadJson<CombinedControlReleaseSandboxPromotionManifest>(
    layout.promotionManifestFile
  );
}

async function writeCombinedControlReleaseSandboxPromotionHistory(args: {
  layout: CombinedControlReleaseSandboxLayout;
  history: CombinedControlReleaseSandboxPromotionHistory;
}): Promise<void> {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.promotionHistoryFile,
    JSON.stringify(args.history, null, 2).concat("\n")
  );
}

export function formatCombinedControlReleaseSandboxPromotion(
  manifest: CombinedControlReleaseSandboxPromotionManifest
): string {
  return [
    "Combined control release-sandbox promotion",
    `Sandbox: ${manifest.sandboxId}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous promoted version: ${manifest.previousPromotedVersion ?? "none"}`,
    `Active version: ${manifest.activeVersion}`,
    `Promoted: ${manifest.promotedAt}`,
    `Strategy: ${manifest.strategy}`,
    `Release target: ${manifest.releaseRootTarget}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Origin: ${manifest.origin}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export function formatCombinedControlReleaseSandboxPromotionHistory(
  history: CombinedControlReleaseSandboxPromotionHistory
): string {
  return [
    "Combined control release-sandbox promotion history",
    `Sandbox: ${history.sandboxId}`,
    ...(
      history.records.length > 0
        ? history.records.map(
            (record, index) =>
              `${index + 1}. ${record.promotedAt} :: ${record.promotedVersion} (previous: ${
                record.previousPromotedVersion ?? "none"
              }, origin: ${record.origin})`
          )
        : ["No promotions recorded."]
    )
  ].join("\n");
}

export async function promoteCombinedControlReleaseSandboxVersion(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version: string;
}): Promise<{
  layout: CombinedControlReleaseSandboxLayout;
  activation: CombinedControlReleaseSandboxActivationManifest;
  inventory: CombinedControlReleaseSandboxInventory;
  bundle: CombinedControlReleaseSandboxBundle;
  promotion: CombinedControlReleaseSandboxPromotionManifest;
  history: CombinedControlReleaseSandboxPromotionHistory;
}> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  const previousPromotion =
    safeReadJson<CombinedControlReleaseSandboxPromotionManifest>(
      layout.promotionManifestFile
    );
  const activation = await activateCombinedControlReleaseSandboxVersion(args);
  const active = await resolveActiveCombinedControlReleaseSandbox({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const inventory = await readCombinedControlReleaseSandboxInventory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const promotion: CombinedControlReleaseSandboxPromotionManifest = {
    kind: "combined-release-sandbox-promotion",
    sandboxId: layout.sandboxId,
    promotedVersion: args.version,
    previousPromotedVersion: previousPromotion?.promotedVersion ?? null,
    activeVersion: activation.activeVersion,
    promotedAt: new Date().toISOString(),
    strategy: "workspace-release-sandbox",
    releaseRootTarget: active.bundle.releaseRootTarget,
    currentRoot: active.layout.currentRoot,
    currentEntrypoint: activation.currentEntrypoint,
    bundleManifestFile: active.layout.bundleManifestFile,
    startupManifestFile: active.layout.startupManifestFile,
    origin: active.bundle.startup.origin,
    surfaces: active.bundle.startup.surfaces,
    availableVersions: inventory.releases.map((release) => release.version)
  };
  const history = await readCombinedControlReleaseSandboxPromotionHistory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const nextHistory: CombinedControlReleaseSandboxPromotionHistory = {
    kind: "combined-release-sandbox-promotion-history",
    sandboxId: layout.sandboxId,
    records: [
      ...history.records,
      {
        promotedVersion: promotion.promotedVersion,
        previousPromotedVersion: promotion.previousPromotedVersion,
        promotedAt: promotion.promotedAt,
        origin: promotion.origin
      }
    ]
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.promotionManifestFile,
    JSON.stringify(promotion, null, 2).concat("\n")
  );
  await writeFile(
    layout.promotionSummaryFile,
    formatCombinedControlReleaseSandboxPromotion(promotion).concat("\n")
  );
  await writeCombinedControlReleaseSandboxPromotionHistory({
    layout,
    history: nextHistory
  });

  return {
    layout,
    activation,
    inventory,
    bundle: active.bundle,
    promotion,
    history: nextHistory
  };
}
