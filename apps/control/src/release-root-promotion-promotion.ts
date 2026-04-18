import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  materializeCombinedControlReleaseRootPromotionDeployment
} from "./release-root-promotion-deployment.js";
import {
  activateCombinedControlReleaseRootPromotionVersion,
  readCombinedControlReleaseRootPromotionInventory,
  resolveActiveCombinedControlReleaseRootPromotion,
  type CombinedControlReleaseRootPromotionActivationManifest,
  type CombinedControlReleaseRootPromotionInventory
} from "./release-root-promotion-activation.js";
import {
  createCombinedControlReleaseRootPromotionLayout,
  type CombinedControlReleaseRootPromotionLayout
} from "./release-root-promotion-layout.js";

export interface CombinedControlReleaseRootPromotionManifest {
  readonly kind: "combined-release-root-promotion";
  readonly targetId: string;
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly activeVersion: string;
  readonly promotedAt: string;
  readonly strategy: "workspace-release-root-promotion";
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly applyManifestFile: string;
  readonly startupManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
  readonly availableVersions: readonly string[];
}

export interface CombinedControlReleaseRootPromotionRecord {
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly promotedAt: string;
  readonly origin: string;
}

export interface CombinedControlReleaseRootPromotionHistory {
  readonly kind: "combined-release-root-promotion-history";
  readonly targetId: string;
  readonly records: readonly CombinedControlReleaseRootPromotionRecord[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readPromotionStartupManifest(layout: CombinedControlReleaseRootPromotionLayout) {
  return JSON.parse(
    await readFile(layout.startupManifestFile, "utf8")
  ) as {
    origin: string;
    surfaces: readonly string[];
  };
}

export async function readCombinedControlReleaseRootPromotionHistory(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionHistory> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const history =
    safeReadJson<CombinedControlReleaseRootPromotionHistory>(layout.promotionHistoryFile);

  if (history) {
    return history;
  }

  return {
    kind: "combined-release-root-promotion-history",
    targetId: layout.targetId,
    records: []
  };
}

export async function readCombinedControlReleaseRootPromotionManifest(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionManifest | null> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  return safeReadJson<CombinedControlReleaseRootPromotionManifest>(
    layout.promotionManifestFile
  );
}

async function writeCombinedControlReleaseRootPromotionHistory(args: {
  layout: CombinedControlReleaseRootPromotionLayout;
  history: CombinedControlReleaseRootPromotionHistory;
}) {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.promotionHistoryFile,
    JSON.stringify(args.history, null, 2).concat("\n")
  );
}

export function formatCombinedControlReleaseRootPromotionManifest(
  manifest: CombinedControlReleaseRootPromotionManifest
): string {
  return [
    "Combined control release-root promotion",
    `Target: ${manifest.targetId}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous promoted version: ${manifest.previousPromotedVersion ?? "none"}`,
    `Active version: ${manifest.activeVersion}`,
    `Promoted: ${manifest.promotedAt}`,
    `Strategy: ${manifest.strategy}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Origin: ${manifest.origin}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export function formatCombinedControlReleaseRootPromotionHistory(
  history: CombinedControlReleaseRootPromotionHistory
): string {
  return [
    "Combined control release-root promotion history",
    `Target: ${history.targetId}`,
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

export async function promoteCombinedControlReleaseRootPromotionVersion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version: string;
}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  activation: CombinedControlReleaseRootPromotionActivationManifest;
  inventory: CombinedControlReleaseRootPromotionInventory;
  promotion: CombinedControlReleaseRootPromotionManifest;
  history: CombinedControlReleaseRootPromotionHistory;
}> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const previousPromotion =
    safeReadJson<CombinedControlReleaseRootPromotionManifest>(
      layout.promotionManifestFile
    );
  const activation = await activateCombinedControlReleaseRootPromotionVersion(args);
  const active = await resolveActiveCombinedControlReleaseRootPromotion({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId
  });
  const inventory = await readCombinedControlReleaseRootPromotionInventory({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId
  });
  const startup = await readPromotionStartupManifest(layout);
  const promotion: CombinedControlReleaseRootPromotionManifest = {
    kind: "combined-release-root-promotion",
    targetId: layout.targetId,
    promotedVersion: args.version,
    previousPromotedVersion: previousPromotion?.promotedVersion ?? null,
    activeVersion: activation.activeVersion,
    promotedAt: new Date().toISOString(),
    strategy: "workspace-release-root-promotion",
    emulatedReleaseRoot: "/opt/simplehostman/release",
    currentRoot: active.activation.currentRoot,
    currentEntrypoint: active.activation.currentEntrypoint,
    applyManifestFile: layout.applyManifestFile,
    startupManifestFile: layout.startupManifestFile,
    origin: startup.origin,
    surfaces: startup.surfaces,
    availableVersions: inventory.releases.map((release) => release.version)
  };
  const history = await readCombinedControlReleaseRootPromotionHistory({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId
  });
  const nextHistory: CombinedControlReleaseRootPromotionHistory = {
    kind: "combined-release-root-promotion-history",
    targetId: layout.targetId,
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
    formatCombinedControlReleaseRootPromotionManifest(promotion).concat("\n")
  );
  await writeCombinedControlReleaseRootPromotionHistory({
    layout,
    history: nextHistory
  });
  await materializeCombinedControlReleaseRootPromotionDeployment({
    layout,
    promotion,
    history: nextHistory
  });

  return {
    layout,
    activation,
    inventory,
    promotion,
    history: nextHistory
  };
}
