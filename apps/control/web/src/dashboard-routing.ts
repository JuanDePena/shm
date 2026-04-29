export type DashboardView =
  | "overview"
  | "tenants"
  | "nodes"
  | "zones"
  | "proxies"
  | "apps"
  | "databases"
  | "mail"
  | "backup-policies"
  | "services"
  | "logs"
  | "certificates"
  | "storage"
  | "network"
  | "processes"
  | "containers"
  | "timers"
  | "packages"
  | "firewall"
  | "fail2ban"
  | "audit"
  | "jobs"
  | "node-health"
  | "resource-drift"
  | "job-history"
  | "backups"
  | "rustdesk"
  | "desired-state";

const desiredStateTabIds = [
  "desired-state-create",
  "desired-state-tenants",
  "desired-state-nodes",
  "desired-state-zones",
  "desired-state-apps",
  "desired-state-databases",
  "desired-state-backups"
] as const;

export type DesiredStateTabId = (typeof desiredStateTabIds)[number];
export type NodeWorkspaceTabId = "nodes-health" | "nodes-spec";
export const tenantWorkspaceTabIds = [
  "tenants-summary",
  "tenants-spec",
  "tenants-activity"
] as const;
export const zoneWorkspaceTabIds = ["zones-summary", "zones-spec", "zones-activity"] as const;
export const proxyWorkspaceTabIds = [
  "proxies-summary",
  "proxies-spec",
  "proxies-activity"
] as const;
export const appWorkspaceTabIds = ["apps-summary", "apps-spec", "apps-activity"] as const;
export const databaseWorkspaceTabIds = [
  "databases-summary",
  "databases-spec",
  "databases-activity"
] as const;
export const backupPolicyWorkspaceTabIds = [
  "backup-policies-summary",
  "backup-policies-spec"
] as const;

export type TenantWorkspaceTabId = (typeof tenantWorkspaceTabIds)[number];
export type ZoneWorkspaceTabId = (typeof zoneWorkspaceTabIds)[number];
export type ProxyWorkspaceTabId = (typeof proxyWorkspaceTabIds)[number];
export type AppWorkspaceTabId = (typeof appWorkspaceTabIds)[number];
export type DatabaseWorkspaceTabId = (typeof databaseWorkspaceTabIds)[number];
export type BackupPolicyWorkspaceTabId = (typeof backupPolicyWorkspaceTabIds)[number];

export interface DashboardCopyLabels {
  navTenants: string;
  navNodes: string;
  navZones: string;
  navProxies: string;
  navApps: string;
  navDatabases: string;
  navMail: string;
  navBackupPolicies: string;
  navServices: string;
  navLogs: string;
  navCertificates: string;
  navStorage: string;
  navNetwork: string;
  navProcesses: string;
  navContainers: string;
  navTimers: string;
  navPackages: string;
  navFirewall: string;
  navFail2Ban: string;
  navAudit: string;
  navJobs: string;
  navRustDesk: string;
  tenantWorkspaceDescription: string;
  nodeWorkspaceDescription: string;
  zoneWorkspaceDescription: string;
  proxyWorkspaceDescription: string;
  appWorkspaceDescription: string;
  databaseWorkspaceDescription: string;
  mailWorkspaceDescription: string;
  backupWorkspaceDescription: string;
  servicesWorkspaceDescription: string;
  logsWorkspaceDescription: string;
  certificatesWorkspaceDescription: string;
  storageWorkspaceDescription: string;
  networkWorkspaceDescription: string;
  processesWorkspaceDescription: string;
  containersWorkspaceDescription: string;
  timersWorkspaceDescription: string;
  firewallWorkspaceDescription: string;
  fail2banWorkspaceDescription: string;
  rustdeskWorkspaceDescription: string;
  dashboardHeading: string;
  dashboardSubheading: string;
  auditTrailTitle: string;
  auditTrailDescription: string;
  nodeHealthTitle: string;
  nodeHealthDescription: string;
  resourceDriftTitle: string;
  resourceDriftDescription: string;
  jobHistoryTitle: string;
  jobHistoryDescription: string;
  packagesDescription: string;
  backupsTitle: string;
  backupsDescription: string;
  desiredStateTitle: string;
  desiredStateDescription: string;
}

export function normalizeDashboardView(value: string | null | undefined): DashboardView {
  switch (value) {
    case "tenants":
    case "nodes":
    case "zones":
    case "proxies":
    case "apps":
    case "databases":
    case "mail":
    case "backup-policies":
    case "services":
    case "logs":
    case "certificates":
    case "storage":
    case "network":
    case "processes":
    case "containers":
    case "timers":
    case "packages":
    case "firewall":
    case "fail2ban":
    case "audit":
    case "jobs":
    case "node-health":
    case "resource-drift":
    case "job-history":
    case "backups":
    case "rustdesk":
    case "desired-state":
      return value;
    default:
      return "overview";
  }
}

export function normalizeDesiredStateTab(value: string | null | undefined): DesiredStateTabId {
  return desiredStateTabIds.find((candidate) => candidate === value) ?? "desired-state-create";
}

export function normalizeNodeWorkspaceTab(value: string | null | undefined): NodeWorkspaceTabId {
  return value === "nodes-spec" ? "nodes-spec" : "nodes-health";
}

export function normalizeWorkspaceTab<T extends readonly string[]>(
  value: string | null | undefined,
  candidates: T,
  fallback: T[number]
): T[number] {
  return (candidates.find((candidate) => candidate === value) ?? fallback) as T[number];
}

export function resolveDesiredStateTabForView(
  view: DashboardView,
  tab: DesiredStateTabId
): DesiredStateTabId {
  switch (view) {
    case "tenants":
      return "desired-state-tenants";
    case "nodes":
      return "desired-state-nodes";
    case "zones":
      return "desired-state-zones";
    case "proxies":
      return "desired-state-apps";
    case "apps":
      return "desired-state-apps";
    case "databases":
      return "desired-state-databases";
    case "backup-policies":
      return "desired-state-backups";
    default:
      return tab;
  }
}

function getObjectViewLabel(
  copy: DashboardCopyLabels,
  view: DashboardView
): string | undefined {
  switch (view) {
    case "tenants":
      return copy.navTenants;
    case "nodes":
      return copy.navNodes;
    case "zones":
      return copy.navZones;
    case "proxies":
      return copy.navProxies;
    case "apps":
      return copy.navApps;
    case "databases":
      return copy.navDatabases;
    case "mail":
      return copy.navMail;
    case "backup-policies":
      return copy.navBackupPolicies;
    case "services":
      return copy.navServices;
    case "logs":
      return copy.navLogs;
    case "certificates":
      return copy.navCertificates;
    case "storage":
      return copy.navStorage;
    case "network":
      return copy.navNetwork;
    case "processes":
      return copy.navProcesses;
    case "containers":
      return copy.navContainers;
    case "timers":
      return copy.navTimers;
    case "packages":
      return copy.navPackages;
    case "firewall":
      return copy.navFirewall;
    case "fail2ban":
      return copy.navFail2Ban;
    case "audit":
      return copy.navAudit;
    case "jobs":
      return copy.navJobs;
    default:
      return undefined;
  }
}

export function normalizeDashboardFocus(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeFilterValue(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveCanonicalDashboardTarget(
  view: DashboardView,
  tab?: string
): { view: DashboardView; tab?: string } {
  if (view === "job-history") {
    return { view: "jobs" };
  }

  if (view === "nodes") {
    return { view: "nodes" };
  }

  if (view === "node-health") {
    return { view: "nodes" };
  }

  if (view === "desired-state") {
    switch (tab) {
      case "desired-state-tenants":
        return { view: "tenants", tab: "tenants-spec" };
      case "desired-state-nodes":
        return { view: "nodes" };
      case "desired-state-zones":
        return { view: "zones", tab: "zones-spec" };
      case "desired-state-apps":
        return { view: "apps", tab: "apps-spec" };
      case "desired-state-databases":
        return { view: "databases", tab: "databases-spec" };
      case "desired-state-backups":
        return { view: "backup-policies", tab: "backup-policies-spec" };
      case "desired-state-create":
        return { view: "tenants", tab: "tenants-spec" };
      default:
        return { view, tab: tab ?? "desired-state-create" };
    }
  }

  return { view, tab };
}

export function buildDashboardViewUrl(
  view: DashboardView,
  tab?: string,
  focus?: string,
  filters: Record<string, string | undefined> = {}
): string {
  const search = new URLSearchParams();
  const target = resolveCanonicalDashboardTarget(view, tab);
  const targetView = target.view;
  const targetTab = target.tab;

  if (targetView !== "overview") {
    search.set("view", targetView);
  }

  if (targetView === "desired-state") {
    search.set("tab", targetTab ?? "desired-state-create");
  } else if (targetTab) {
    search.set("tab", targetTab);
  }

  if (targetView !== "overview" && focus) {
    search.set("focus", focus);
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

export function getDashboardHeading(copy: DashboardCopyLabels, view: DashboardView): string {
  const objectLabel = getObjectViewLabel(copy, view);

  if (objectLabel) {
    return objectLabel;
  }

  switch (view) {
    case "node-health":
      return copy.nodeHealthTitle;
    case "resource-drift":
      return copy.resourceDriftTitle;
    case "job-history":
      return copy.jobHistoryTitle;
    case "backups":
      return copy.backupsTitle;
    case "rustdesk":
      return copy.navRustDesk;
    case "desired-state":
      return copy.desiredStateTitle;
    case "overview":
    default:
      return copy.dashboardHeading;
  }
}

export function getDashboardSubheading(copy: DashboardCopyLabels, view: DashboardView): string {
  switch (view) {
    case "tenants":
      return copy.tenantWorkspaceDescription;
    case "nodes":
      return copy.nodeWorkspaceDescription;
    case "zones":
      return copy.zoneWorkspaceDescription;
    case "proxies":
      return copy.proxyWorkspaceDescription;
    case "apps":
      return copy.appWorkspaceDescription;
    case "databases":
      return copy.databaseWorkspaceDescription;
    case "mail":
      return copy.mailWorkspaceDescription;
    case "backup-policies":
      return copy.backupWorkspaceDescription;
    case "services":
      return copy.servicesWorkspaceDescription;
    case "logs":
      return copy.logsWorkspaceDescription;
    case "certificates":
      return copy.certificatesWorkspaceDescription;
    case "storage":
      return copy.storageWorkspaceDescription;
    case "network":
      return copy.networkWorkspaceDescription;
    case "processes":
      return copy.processesWorkspaceDescription;
    case "containers":
      return copy.containersWorkspaceDescription;
    case "timers":
      return copy.timersWorkspaceDescription;
    case "packages":
      return copy.packagesDescription;
    case "firewall":
      return copy.firewallWorkspaceDescription;
    case "fail2ban":
      return copy.fail2banWorkspaceDescription;
    case "jobs":
      return copy.jobHistoryDescription;
    case "audit":
      return copy.auditTrailDescription;
    default:
      break;
  }

  switch (view) {
    case "node-health":
      return copy.nodeHealthDescription;
    case "resource-drift":
      return copy.resourceDriftDescription;
    case "job-history":
      return copy.jobHistoryDescription;
    case "backups":
      return copy.backupsDescription;
    case "rustdesk":
      return copy.rustdeskWorkspaceDescription;
    case "desired-state":
      return copy.desiredStateDescription;
    case "overview":
    default:
      return copy.dashboardSubheading;
  }
}
