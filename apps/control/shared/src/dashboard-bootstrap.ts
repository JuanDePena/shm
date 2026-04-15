import type {
  AuditEventSummary,
  AuthenticatedUserSummary,
  BackupsOverview,
  DesiredStateExportResponse,
  InventoryStateSnapshot,
  JobHistoryEntry,
  MailOverview,
  NodeHealthSnapshot,
  OperationsOverview,
  PackageInventorySnapshot,
  ResourceDriftSummary,
  RustDeskOverview
} from "@simplehost/panel-contracts";

export interface ControlDashboardBootstrap {
  currentUser: AuthenticatedUserSummary;
  overview: OperationsOverview;
  inventory: InventoryStateSnapshot;
  desiredState: DesiredStateExportResponse;
  drift: ResourceDriftSummary[];
  nodeHealth: NodeHealthSnapshot[];
  jobHistory: JobHistoryEntry[];
  auditEvents: AuditEventSummary[];
  backups: BackupsOverview;
  rustdesk: RustDeskOverview;
  mail: MailOverview;
  packages: PackageInventorySnapshot;
}

export interface ControlDashboardBootstrapLoaders {
  getCurrentUser(token: string): Promise<AuthenticatedUserSummary>;
  getOverview(token: string): Promise<OperationsOverview>;
  getInventory(token: string): Promise<InventoryStateSnapshot>;
  getDesiredState(token: string): Promise<DesiredStateExportResponse>;
  getDrift(token: string): Promise<ResourceDriftSummary[]>;
  getNodeHealth(token: string): Promise<NodeHealthSnapshot[]>;
  getJobHistory(token: string): Promise<JobHistoryEntry[]>;
  getAuditEvents(token: string): Promise<AuditEventSummary[]>;
  getBackups(token: string): Promise<BackupsOverview>;
  getRustDesk(token: string): Promise<RustDeskOverview>;
  getMail(token: string): Promise<MailOverview>;
  getPackages(token: string): Promise<PackageInventorySnapshot>;
}

export async function loadControlDashboardBootstrap(
  token: string,
  loaders: ControlDashboardBootstrapLoaders
): Promise<ControlDashboardBootstrap> {
  const [
    currentUser,
    overview,
    inventory,
    desiredState,
    drift,
    nodeHealth,
    jobHistory,
    auditEvents,
    backups,
    rustdesk,
    mail,
    packages
  ] = await Promise.all([
    loaders.getCurrentUser(token),
    loaders.getOverview(token),
    loaders.getInventory(token),
    loaders.getDesiredState(token),
    loaders.getDrift(token),
    loaders.getNodeHealth(token),
    loaders.getJobHistory(token),
    loaders.getAuditEvents(token),
    loaders.getBackups(token),
    loaders.getRustDesk(token),
    loaders.getMail(token),
    loaders.getPackages(token)
  ]);

  return {
    currentUser,
    overview,
    inventory,
    desiredState,
    drift,
    nodeHealth,
    jobHistory,
    auditEvents,
    backups,
    rustdesk,
    mail,
    packages
  };
}
