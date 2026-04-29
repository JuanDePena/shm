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
  navUpdates: string;
  navReboots: string;
  navConfig: string;
  navTime: string;
  navServices: string;
  navLogs: string;
  navCertificates: string;
  navStorage: string;
  navNetwork: string;
  navProcesses: string;
  navContainers: string;
  navTimers: string;
  navSelinux: string;
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
  bodySection: string;
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
    bodySection,
    topbarUserPanelHtml,
    userToggleIconHtml,
    overviewMetrics,
    renderSignalStrip,
    renderOverviewMetrics,
    renderStats
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
          id: "updates",
          label: copy.navUpdates,
          href: buildDashboardViewUrl("updates"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.packageUpdates?.updates.length ?? 0), 0)),
          active: view === "updates"
        },
        {
          id: "reboots",
          label: copy.navReboots,
          href: buildDashboardViewUrl("reboots"),
          badge: String(data.nodeHealth.filter((node) => node.rebootState?.needsReboot).length),
          active: view === "reboots"
        },
        {
          id: "config",
          label: copy.navConfig,
          href: buildDashboardViewUrl("config"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.configValidation?.checks.filter((check) => check.status === "failed").length ?? 0), 0)),
          active: view === "config"
        },
        {
          id: "time",
          label: copy.navTime,
          href: buildDashboardViewUrl("time"),
          badge: String(data.nodeHealth.filter((node) => node.timeSync?.synchronized === false).length),
          active: view === "time"
        },
        {
          id: "services",
          label: copy.navServices,
          href: buildDashboardViewUrl("services"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.services?.units.length ?? 0), 0)),
          active: view === "services"
        },
        {
          id: "logs",
          label: copy.navLogs,
          href: buildDashboardViewUrl("logs"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.logs?.entries.length ?? 0), 0)),
          active: view === "logs"
        },
        {
          id: "certificates",
          label: copy.navCertificates,
          href: buildDashboardViewUrl("certificates"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.tls?.certificates.length ?? 0), 0)),
          active: view === "certificates"
        },
        {
          id: "storage",
          label: copy.navStorage,
          href: buildDashboardViewUrl("storage"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.storage?.filesystems.length ?? 0), 0)),
          active: view === "storage"
        },
        {
          id: "network",
          label: copy.navNetwork,
          href: buildDashboardViewUrl("network"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.network?.listeners.length ?? 0), 0)),
          active: view === "network"
        },
        {
          id: "processes",
          label: copy.navProcesses,
          href: buildDashboardViewUrl("processes"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.processes?.processes.length ?? 0), 0)),
          active: view === "processes"
        },
        {
          id: "containers",
          label: copy.navContainers,
          href: buildDashboardViewUrl("containers"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.containers?.containers.length ?? 0), 0)),
          active: view === "containers"
        },
        {
          id: "timers",
          label: copy.navTimers,
          href: buildDashboardViewUrl("timers"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.timers?.timers.length ?? 0), 0)),
          active: view === "timers"
        },
        {
          id: "selinux",
          label: copy.navSelinux,
          href: buildDashboardViewUrl("selinux"),
          badge: String(data.nodeHealth.filter((node) => node.selinux?.currentMode).length),
          active: view === "selinux"
        },
        {
          id: "ssh",
          label: copy.navSsh,
          href: buildDashboardViewUrl("ssh"),
          badge: String(data.nodeHealth.filter((node) => node.ssh).length),
          active: view === "ssh"
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
          id: "jobs",
          label: copy.navJobs,
          href: buildDashboardViewUrl("jobs"),
          badge: String(data.jobHistory.length),
          active: view === "jobs" || view === "job-history"
        },
        {
          id: "audit",
          label: copy.navAudit,
          href: buildDashboardViewUrl("audit"),
          badge: String(data.auditEvents.length),
          active: view === "audit"
        }
      ]
    }
  ];

  const renderOverviewSection = (): string => `<section id="section-overview" class="panel section-panel">
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

  const body = view === "overview" ? renderOverviewSection() : bodySection;

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
    historyReplaceUrl,
    autoRefreshSeconds: view === "overview" ? 60 : undefined
  });
}
