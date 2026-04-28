import {
  escapeHtml,
  renderAdminShell,
  type AdminNavGroup,
  type PanelNotice
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import {
  buildDashboardViewUrl,
  getDashboardHeading,
  getDashboardSubheading,
  type DashboardCopyLabels,
  type DashboardView,
  type DesiredStateTabId
} from "./dashboard-routing.js";
import type { OverviewMetricsSnapshot } from "./overview-metrics.js";
import { type WebLocale } from "./request.js";

type DashboardShellCopy = DashboardCopyLabels & {
  appName: string;
  eyebrow: string;
  driftMissingSecrets: string;
  failedBackups: string;
  healthyNodes: string;
  inventoryImport: string;
  languageLabel: string;
  latestReconciliation: string;
  managedNodes: string;
  metricsApiService: string;
  metricsCpuCores: string;
  metricsCpuLoad: string;
  metricsCurrentIpv4: string;
  metricsDirectories: string;
  metricsFiles: string;
  metricsHostname: string;
  metricsLines: string;
  metricsMemoryFree: string;
  metricsMemoryTotal: string;
  metricsSourceCodeTitle: string;
  metricsSourceSize: string;
  metricsStorageAvailable: string;
  metricsStorageTotal: string;
  metricsSystemTitle: string;
  metricsUiService: string;
  metricsUpdatedAt: string;
  metricsVersion: string;
  navApps: string;
  navBackups: string;
  navBackupPolicies: string;
  navPackages: string;
  navFirewall: string;
  navFail2Ban: string;
  navControlPlane: string;
  navDatabases: string;
  navAudit: string;
  navJobs: string;
  navMail: string;
  navNodes: string;
  navOperations: string;
  navOverview: string;
  navProxies: string;
  navResources: string;
  navRustDesk: string;
  navTenants: string;
  navZones: string;
  operationalSignalsTitle: string;
  overviewDescription: string;
  overviewTitle: string;
  pendingJobs: string;
  sidebarSearchPlaceholder: string;
  staleNodes: string;
  usersAndScope: string;
  versionLabel: string;
};

export function renderDashboardShell<Copy extends DashboardShellCopy>(args: {
  copy: Copy;
  data: DashboardData;
  locale: WebLocale;
  currentPath: string;
  historyReplaceUrl?: string;
  version: string;
  view: DashboardView;
  focus?: string;
  resolvedDesiredStateTab: DesiredStateTabId;
  notice?: PanelNotice;
  filteredDrift: DashboardData["drift"];
  filteredBackupRuns: DashboardData["backups"]["latestRuns"];
  actionBar: string;
  bootstrapInventoryPanel: string;
  topbarUserPanelHtml: string;
  userToggleIconHtml: string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
  overviewMetrics: OverviewMetricsSnapshot;
  renderOverviewMetrics: (
    overviewMetrics: OverviewMetricsSnapshot,
    copy: Copy,
    locale: WebLocale
  ) => string;
  renderStats: (overview: DashboardData["overview"], copy: Copy, locale: WebLocale) => string;
  sections: {
    desiredStateSection: string;
    tenantsSection: string;
    nodesSection: string;
    zonesSection: string;
    proxiesSection: string;
    appsSection: string;
    databasesSection: string;
    mailSection: string;
    backupPoliciesSection: string;
    packagesSection: string;
    firewallSection: string;
    fail2banSection: string;
    auditSection: string;
    jobHistorySection: string;
    nodeHealthSection: string;
    resourceDriftSection: string;
    backupsSection: string;
    rustdeskSection: string;
  };
}): string {
  const {
    copy,
    data,
    locale,
    currentPath,
    historyReplaceUrl,
    version,
    view,
    focus,
    resolvedDesiredStateTab,
    notice,
    filteredDrift,
    filteredBackupRuns,
    actionBar,
    bootstrapInventoryPanel,
    topbarUserPanelHtml,
    userToggleIconHtml,
    overviewMetrics,
    renderSignalStrip,
    renderOverviewMetrics,
    renderStats,
    sections
  } = args;

  const now = Date.now();
  const staleThresholdMs = 15 * 60 * 1000;
  const staleNodeCount = data.nodeHealth.filter((node) => {
    const lastSeenAt = node.lastSeenAt ? Date.parse(node.lastSeenAt) : Number.NaN;
    return Number.isFinite(lastSeenAt) && now - lastSeenAt > staleThresholdMs;
  }).length;
  const healthyNodeCount = data.nodeHealth.filter((node) => {
    const lastSeenAt = node.lastSeenAt ? Date.parse(node.lastSeenAt) : Number.NaN;
    const stale = Number.isFinite(lastSeenAt) && now - lastSeenAt > staleThresholdMs;
    return !stale && node.pendingJobCount === 0 && node.latestJobStatus !== "failed";
  }).length;
  const driftMissingSecretCount = filteredDrift.filter(
    (entry) => entry.driftStatus === "missing_secret"
  ).length;
  const backupFailedCount = filteredBackupRuns.filter((run) => run.status === "failed").length;

  const topbarActionsHtml = `<div class="locale-switch" role="group" aria-label="${escapeHtml(copy.languageLabel)}">
    <form method="post" action="/preferences/locale" class="inline-form">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <input type="hidden" name="locale" value="es" />
      <button
        type="submit"
        class="locale-button${locale === "es" ? " active" : ""}"
        aria-pressed="${locale === "es" ? "true" : "false"}"
      >ES</button>
    </form>
    <form method="post" action="/preferences/locale" class="inline-form">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <input type="hidden" name="locale" value="en" />
      <button
        type="submit"
        class="locale-button${locale === "en" ? " active" : ""}"
        aria-pressed="${locale === "en" ? "true" : "false"}"
      >EN</button>
    </form>
  </div>
  <div class="topbar-disclosure" data-topbar-disclosure>
    <button
      type="button"
      class="secondary icon-button"
      data-topbar-toggle
      aria-label="${escapeHtml(data.currentUser.displayName)}"
      aria-expanded="false"
      title="${escapeHtml(data.currentUser.displayName)}"
    >
      ${userToggleIconHtml}
      <span class="sr-only">${escapeHtml(data.currentUser.displayName)}</span>
    </button>
    <aside class="topbar-panel" data-topbar-panel hidden>
      ${topbarUserPanelHtml}
    </aside>
  </div>`;

  const sidebarGroups: AdminNavGroup[] = [
    {
      id: "control-plane",
      label: copy.navControlPlane,
      items: [
        {
          id: "overview",
          label: copy.navOverview,
          href: buildDashboardViewUrl("overview"),
          keywords: [
            copy.overviewTitle,
            copy.managedNodes,
            copy.pendingJobs,
            copy.usersAndScope,
            copy.inventoryImport,
            copy.latestReconciliation
          ],
          active: view === "overview"
        }
      ]
    },
    {
      id: "resources",
      label: copy.navResources,
      items: [
        {
          id: "tenants",
          label: copy.navTenants,
          href: buildDashboardViewUrl("tenants", undefined, focus),
          badge: String(data.desiredState.spec.tenants.length),
          active:
            view === "tenants" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-tenants")
        },
        {
          id: "nodes",
          label: copy.navNodes,
          href: buildDashboardViewUrl("nodes", "nodes-health", focus),
          badge: String(data.nodeHealth.length),
          active: view === "nodes" || view === "node-health"
        },
        {
          id: "zones",
          label: copy.navZones,
          href: buildDashboardViewUrl("zones", undefined, focus),
          badge: String(data.desiredState.spec.zones.length),
          active:
            view === "zones" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-zones")
        },
        {
          id: "proxies",
          label: copy.navProxies,
          href: buildDashboardViewUrl("proxies", undefined, focus),
          badge: String(data.desiredState.spec.apps.length),
          active: view === "proxies"
        },
        {
          id: "apps",
          label: copy.navApps,
          href: buildDashboardViewUrl("apps", undefined, focus),
          badge: String(data.desiredState.spec.apps.length),
          active:
            view === "apps" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-apps")
        },
        {
          id: "databases",
          label: copy.navDatabases,
          href: buildDashboardViewUrl("databases", undefined, focus),
          badge: String(data.desiredState.spec.databases.length),
          active:
            view === "databases" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-databases")
        },
        {
          id: "mail",
          label: copy.navMail,
          href: buildDashboardViewUrl("mail", undefined, focus),
          badge: String(data.mail.domains.length),
          active: view === "mail"
        }
      ]
    },
    {
      id: "operations",
      label: copy.navOperations,
      items: [
        {
          id: "backup-policies",
          label: copy.navBackupPolicies,
          href: buildDashboardViewUrl("backup-policies", undefined, focus),
          badge: String(data.desiredState.spec.backupPolicies.length),
          active:
            view === "backup-policies" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-backups")
        },
        {
          id: "backups",
          label: copy.navBackups,
          href: buildDashboardViewUrl("backups"),
          badge: String(data.backups.latestRuns.length),
          active: view === "backups"
        },
        {
          id: "rustdesk",
          label: copy.navRustDesk,
          href: buildDashboardViewUrl("rustdesk"),
          badge: String(data.rustdesk.nodes.length),
          active: view === "rustdesk"
        },
        {
          id: "packages",
          label: copy.navPackages,
          href: buildDashboardViewUrl("packages"),
          badge: String(new Set(data.packages.packages.map((entry) => entry.packageName)).size),
          active: view === "packages"
        },
        {
          id: "firewall",
          label: copy.navFirewall,
          href: buildDashboardViewUrl("firewall"),
          badge: String(data.nodeHealth.filter((node) => node.firewall?.active).length),
          active: view === "firewall"
        },
        {
          id: "fail2ban",
          label: copy.navFail2Ban,
          href: buildDashboardViewUrl("fail2ban"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.fail2ban?.jails.length ?? 0), 0)),
          active: view === "fail2ban"
        },
        {
          id: "audit",
          label: copy.navAudit,
          href: buildDashboardViewUrl("audit"),
          badge: String(data.auditEvents.length),
          active: view === "audit"
        },
        {
          id: "jobs",
          label: copy.navJobs,
          href: buildDashboardViewUrl("jobs"),
          badge: String(data.jobHistory.length),
          active: view === "jobs" || view === "job-history"
        }
      ]
    }
  ];

  const overviewSection = `<section id="section-overview" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(copy.overviewTitle)}</h2>
        <p class="muted section-description">${escapeHtml(copy.overviewDescription)}</p>
      </div>
    </div>
    <div class="overview-layout">
      <div class="overview-main">
        ${renderStats(data.overview, copy, locale)}
        <div class="stack">
          <div>
            <h3>${escapeHtml(copy.operationalSignalsTitle)}</h3>
          </div>
          ${renderSignalStrip([
            { label: copy.healthyNodes, value: String(healthyNodeCount), tone: healthyNodeCount > 0 ? "success" : "muted" },
            { label: copy.staleNodes, value: String(staleNodeCount), tone: staleNodeCount > 0 ? "danger" : "success" },
            { label: copy.driftMissingSecrets, value: String(driftMissingSecretCount), tone: driftMissingSecretCount > 0 ? "danger" : "success" },
            { label: copy.failedBackups, value: String(backupFailedCount), tone: backupFailedCount > 0 ? "danger" : "success" }
          ])}
        </div>
        ${actionBar}
        ${bootstrapInventoryPanel}
      </div>
      ${renderOverviewMetrics(overviewMetrics, copy, locale)}
    </div>
  </section>`;

  const body = (() => {
    switch (view) {
      case "tenants":
        return sections.tenantsSection;
      case "nodes":
        return sections.nodesSection;
      case "zones":
        return sections.zonesSection;
      case "proxies":
        return sections.proxiesSection;
      case "apps":
        return sections.appsSection;
      case "databases":
        return sections.databasesSection;
      case "mail":
        return sections.mailSection;
      case "backup-policies":
        return sections.backupPoliciesSection;
      case "packages":
        return sections.packagesSection;
      case "firewall":
        return sections.firewallSection;
      case "fail2ban":
        return sections.fail2banSection;
      case "audit":
        return sections.auditSection;
      case "jobs":
        return sections.jobHistorySection;
      case "node-health":
        return sections.nodeHealthSection;
      case "resource-drift":
        return sections.resourceDriftSection;
      case "job-history":
        return sections.jobHistorySection;
      case "backups":
        return sections.backupsSection;
      case "rustdesk":
        return sections.rustdeskSection;
      case "desired-state":
        return sections.desiredStateSection;
      case "overview":
      default:
        return overviewSection;
    }
  })();

  return renderAdminShell({
    lang: locale,
    title: `${copy.appName} · ${getDashboardHeading(copy, view)}`,
    appName: copy.appName,
    heading: getDashboardHeading(copy, view),
    eyebrow: copy.eyebrow,
    subheading: getDashboardSubheading(copy, view),
    notice,
    headerActionsHtml: topbarActionsHtml,
    versionLabel: copy.versionLabel,
    versionValue: version,
    sidebarSearchPlaceholder: copy.sidebarSearchPlaceholder,
    sidebarGroups,
    body,
    historyReplaceUrl
  });
}
