export interface InventoryImportRequest {
  path?: string;
}

export interface InventoryImportSummary {
  importId: string;
  sourcePath: string;
  importedAt: string;
  tenantCount: number;
  nodeCount: number;
  zoneCount: number;
  appCount: number;
  siteCount: number;
  databaseCount: number;
}

export interface InventoryExportSummary {
  exportId: string;
  exportedAt: string;
  tenantCount: number;
  nodeCount: number;
  zoneCount: number;
  appCount: number;
  siteCount: number;
  databaseCount: number;
}

export interface InventoryNodeSummary {
  nodeId: string;
  hostname: string;
  publicIpv4: string;
  wireguardAddress: string;
}

export interface InventoryZoneSummary {
  zoneName: string;
  tenantSlug: string;
  primaryNodeId: string;
}

export interface InventoryAppSummary {
  slug: string;
  tenantSlug: string;
  zoneName: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  canonicalDomain: string;
  aliases: string[];
  backendPort: number;
  runtimeImage: string;
  storageRoot: string;
  mode: string;
}

export interface InventoryDatabaseSummary {
  appSlug: string;
  engine: "postgresql" | "mariadb";
  databaseName: string;
  databaseUser: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  pendingMigrationTo?: "postgresql" | "mariadb";
  migrationCompletedFrom?: "postgresql" | "mariadb";
  migrationCompletedAt?: string;
}

export interface InventoryStateSnapshot {
  latestImport: InventoryImportSummary | null;
  latestExport: InventoryExportSummary | null;
  nodes: InventoryNodeSummary[];
  zones: InventoryZoneSummary[];
  apps: InventoryAppSummary[];
  databases: InventoryDatabaseSummary[];
}
