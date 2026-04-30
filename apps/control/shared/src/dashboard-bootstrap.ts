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
  EnvironmentParametersSnapshot,
  ResourceDriftSummary,
  RustDeskOverview
} from "@simplehost/control-contracts";

import type { ControlAuthSurface, ControlAuthenticatedSession } from "./auth.js";
import { requireControlSession } from "./auth.js";

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
  parameters: EnvironmentParametersSnapshot;
}

export interface ControlAuthenticatedDashboardBootstrap {
  session: ControlAuthenticatedSession;
  dashboard: ControlDashboardBootstrap;
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
  getParameters(token: string): Promise<EnvironmentParametersSnapshot>;
}

export type ControlDashboardBootstrapDataLoaders = Omit<
  ControlDashboardBootstrapLoaders,
  "getCurrentUser"
>;

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
    packages,
    parameters
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
    loaders.getPackages(token),
    loaders.getParameters(token)
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
    packages,
    parameters
  };
}

export async function loadAuthenticatedControlDashboardBootstrap(
  token: string | null,
  auth: Pick<ControlAuthSurface, "getCurrentUser">,
  loaders: ControlDashboardBootstrapDataLoaders
): Promise<ControlAuthenticatedDashboardBootstrap> {
  const session = await requireControlSession(token, auth);
  const [
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
    packages,
    parameters
  ] = await Promise.all([
    loaders.getOverview(session.token),
    loaders.getInventory(session.token),
    loaders.getDesiredState(session.token),
    loaders.getDrift(session.token),
    loaders.getNodeHealth(session.token),
    loaders.getJobHistory(session.token),
    loaders.getAuditEvents(session.token),
    loaders.getBackups(session.token),
    loaders.getRustDesk(session.token),
    loaders.getMail(session.token),
    loaders.getPackages(session.token),
    loaders.getParameters(session.token)
  ]);

  return {
    session,
    dashboard: {
      currentUser: session.currentUser,
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
      packages,
      parameters
    }
  };
}
