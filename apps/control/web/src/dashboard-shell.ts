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
  type DesiredStateTabId,
  type StatusInterval
} from "./dashboard-routing.js";
import type { OverviewMetricsSnapshot } from "./overview-metrics.js";
import { type WebLocale } from "./request.js";

type DashboardShellCopy = DashboardCopyLabels & {
  appName: string;
  eyebrow: string;
  driftMissingSecrets: string;
  failedBackups: string;
  healthyNodes: string;
  languageLabel: string;
  latestReconciliation: string;
  managedNodes: string;
  overviewIntervalDay: string;
  overviewIntervalLabel: string;
  overviewIntervalMonth: string;
  overviewIntervalWeek: string;
  overviewIntervalYear: string;
  metricsControlService: string;
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
  metricsUpdatedAt: string;
  metricsVersion: string;
  navApps: string;
  navBackups: string;
  navBackupPolicies: string;
  navUpdates: string;
  navRepositories: string;
  navReboots: string;
  navConfig: string;
  navTime: string;
  navResolver: string;
  navAccounts: string;
  navServices: string;
  navLogs: string;
  navCertificates: string;
  navStorage: string;
  navMounts: string;
  navKernel: string;
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
  navOperators: string;
  navParameters: string;
  navMail: string;
  navNodes: string;
  navOperations: string;
  navGroupContinuity: string;
  navGroupObservability: string;
  navGroupPackages: string;
  navGroupSecurity: string;
  navGroupSystem: string;
  navOverview: string;
  navProxies: string;
  navReconciliation: string;
  navResources: string;
  navRustDesk: string;
  navTenants: string;
  navZones: string;
  operationalSignalsTitle: string;
  overviewDescription: string;
  overviewStatusTitle: string;
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
  statusInterval: StatusInterval;
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
    bodySection,
    topbarUserPanelHtml,
    userToggleIconHtml,
    overviewMetrics,
    renderSignalStrip,
    renderOverviewMetrics,
    renderStats,
    statusInterval
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
  const renderStatusIntervalSelector = (): string => {
    const intervals = [
      { id: "day", label: copy.overviewIntervalDay },
      { id: "week", label: copy.overviewIntervalWeek },
      { id: "month", label: copy.overviewIntervalMonth },
      { id: "year", label: copy.overviewIntervalYear }
    ];
    const currentUrl = new URL(currentPath, "http://localhost");
    currentUrl.searchParams.delete("statusInterval");
    const hiddenInputs = Array.from(currentUrl.searchParams.entries())
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`
      )
      .join("");

    return `<form method="get" action="/" class="overview-interval-selector" data-status-interval-form>
      ${hiddenInputs}
      <label class="sr-only" for="overview-status-interval">${escapeHtml(copy.overviewIntervalLabel)}</label>
      <select
        id="overview-status-interval"
        name="statusInterval"
        class="overview-interval-select"
        data-select-search="false"
        data-submit-on-change="true"
        data-status-interval-storage-key="simplehost:overview:status-interval:v1"
        data-status-interval-select
        aria-label="${escapeHtml(copy.overviewIntervalLabel)}"
      >
        ${intervals
          .map(
            (interval) => `<option value="${escapeHtml(interval.id)}"${
              interval.id === statusInterval ? " selected" : ""
            }>${escapeHtml(interval.label)}</option>`
          )
          .join("")}
      </select>
    </form>`;
  };

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
            copy.overviewStatusTitle,
            copy.operationalSignalsTitle
          ],
          active: view === "overview"
        },
        {
          id: "reconciliation",
          label: copy.navReconciliation,
          href: buildDashboardViewUrl("reconciliation"),
          keywords: [copy.latestReconciliation],
          active: view === "reconciliation"
        },
        {
          id: "jobs",
          label: copy.navJobs,
          href: buildDashboardViewUrl("jobs"),
          badge: String(data.jobHistory.length),
          active: view === "jobs" || view === "job-history"
        },
        {
          id: "parameters",
          label: copy.navParameters,
          href: buildDashboardViewUrl("parameters"),
          badge: String(data.parameters.parameterCount),
          active: view === "parameters"
        },
        {
          id: "operators",
          label: copy.navOperators,
          href: buildDashboardViewUrl("operators"),
          badge: String(data.users.length),
          active: view === "operators"
        },
        {
          id: "audit",
          label: copy.navAudit,
          href: buildDashboardViewUrl("audit"),
          badge: String(data.auditEvents.length),
          active: view === "audit"
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
          id: "apps",
          label: copy.navApps,
          href: buildDashboardViewUrl("apps", undefined, focus),
          badge: String(data.desiredState.spec.apps.length),
          active:
            view === "apps" ||
            (view === "desired-state" && resolvedDesiredStateTab === "desired-state-apps")
        },
        {
          id: "proxies",
          label: copy.navProxies,
          href: buildDashboardViewUrl("proxies", undefined, focus),
          badge: String(data.desiredState.spec.apps.length),
          active: view === "proxies"
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
        },
        {
          id: "rustdesk",
          label: copy.navRustDesk,
          href: buildDashboardViewUrl("rustdesk"),
          badge: String(data.rustdesk.nodes.length),
          active: view === "rustdesk"
        }
      ]
    },
    {
      id: "continuity",
      label: copy.navGroupContinuity,
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
        }
      ]
    },
    {
      id: "package-management",
      label: copy.navGroupPackages,
      items: [
        {
          id: "packages",
          label: copy.navPackages,
          href: buildDashboardViewUrl("packages"),
          badge: String(new Set(data.packages.packages.map((entry) => entry.packageName)).size),
          active: view === "packages"
        },
        {
          id: "updates",
          label: copy.navUpdates,
          href: buildDashboardViewUrl("updates"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.packageUpdates?.updates.length ?? 0), 0)),
          active: view === "updates"
        },
        {
          id: "repositories",
          label: copy.navRepositories,
          href: buildDashboardViewUrl("repositories"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.packageRepositories?.repositories.length ?? 0), 0)),
          active: view === "repositories"
        },
        {
          id: "reboots",
          label: copy.navReboots,
          href: buildDashboardViewUrl("reboots"),
          badge: String(data.nodeHealth.filter((node) => node.rebootState?.needsReboot).length),
          active: view === "reboots"
        }
      ]
    },
    {
      id: "observability",
      label: copy.navGroupObservability,
      items: [
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
        }
      ]
    },
    {
      id: "system",
      label: copy.navGroupSystem,
      items: [
        {
          id: "storage",
          label: copy.navStorage,
          href: buildDashboardViewUrl("storage"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.storage?.filesystems.length ?? 0), 0)),
          active: view === "storage"
        },
        {
          id: "mounts",
          label: copy.navMounts,
          href: buildDashboardViewUrl("mounts"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.mounts?.entries.length ?? 0), 0)),
          active: view === "mounts"
        },
        {
          id: "kernel",
          label: copy.navKernel,
          href: buildDashboardViewUrl("kernel"),
          badge: String(data.nodeHealth.filter((node) => node.kernel).length),
          active: view === "kernel"
        },
        {
          id: "network",
          label: copy.navNetwork,
          href: buildDashboardViewUrl("network"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.network?.listeners.length ?? 0), 0)),
          active: view === "network"
        },
        {
          id: "time",
          label: copy.navTime,
          href: buildDashboardViewUrl("time"),
          badge: String(data.nodeHealth.filter((node) => node.timeSync?.synchronized === false).length),
          active: view === "time"
        },
        {
          id: "resolver",
          label: copy.navResolver,
          href: buildDashboardViewUrl("resolver"),
          badge: String(data.nodeHealth.filter((node) => node.dnsResolver && node.dnsResolver.nameservers.length === 0 && node.dnsResolver.resolvedServers.length === 0).length),
          active: view === "resolver"
        }
      ]
    },
    {
      id: "security",
      label: copy.navGroupSecurity,
      items: [
        {
          id: "accounts",
          label: copy.navAccounts,
          href: buildDashboardViewUrl("accounts"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.accounts?.users.filter((user) => user.loginEnabled).length ?? 0), 0)),
          active: view === "accounts"
        },
        {
          id: "config",
          label: copy.navConfig,
          href: buildDashboardViewUrl("config"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.configValidation?.checks.filter((check) => check.status === "failed").length ?? 0), 0)),
          active: view === "config"
        },
        {
          id: "certificates",
          label: copy.navCertificates,
          href: buildDashboardViewUrl("certificates"),
          badge: String(data.nodeHealth.reduce((count, node) => count + (node.tls?.certificates.length ?? 0), 0)),
          active: view === "certificates"
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
        }
      ]
    }
  ];
  const compareSidebarEntries = <Entry extends { id: string; label: string }>(
    left: Entry,
    right: Entry
  ): number =>
    left.label.localeCompare(right.label, locale, { sensitivity: "base" }) ||
    left.id.localeCompare(right.id);
  const compareSidebarGroups = (
    left: AdminNavGroup,
    right: AdminNavGroup
  ): number =>
    left.id === right.id
      ? 0
      : left.id === "control-plane"
      ? -1
      : right.id === "control-plane"
        ? 1
        : compareSidebarEntries(left, right);
  const compareSidebarItems = (
    left: AdminNavGroup["items"][number],
    right: AdminNavGroup["items"][number]
  ): number =>
    left.id === right.id
      ? 0
      : left.id === "overview"
      ? -1
      : right.id === "overview"
        ? 1
        : compareSidebarEntries(left, right);
  const orderedSidebarGroups = sidebarGroups
    .map((group) => ({
      ...group,
      items: [...group.items].sort(compareSidebarItems)
    }))
    .sort(compareSidebarGroups);

  const renderOverviewSection = (): string => `<section id="section-overview" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(copy.overviewTitle)}</h2>
        <p class="muted section-description">${escapeHtml(copy.overviewDescription)}</p>
      </div>
    </div>
    <div class="overview-layout">
      <div class="overview-main">
        <article class="overview-metric-panel overview-status-card">
          <div class="overview-metric-panel-header">
            <h3>${escapeHtml(copy.overviewStatusTitle)}</h3>
            ${renderStatusIntervalSelector()}
          </div>
          <div class="overview-status-content">
            ${renderStats(data.overview, copy, locale)}
          </div>
        </article>
        <article class="overview-metric-panel overview-signal-card">
          <h3>${escapeHtml(copy.operationalSignalsTitle)}</h3>
          <div class="overview-signal-content">
            ${renderSignalStrip([
              { label: copy.healthyNodes, value: String(healthyNodeCount), tone: healthyNodeCount > 0 ? "success" : "muted" },
              { label: copy.staleNodes, value: String(staleNodeCount), tone: staleNodeCount > 0 ? "danger" : "success" },
              { label: copy.driftMissingSecrets, value: String(driftMissingSecretCount), tone: driftMissingSecretCount > 0 ? "danger" : "success" },
              { label: copy.failedBackups, value: String(backupFailedCount), tone: backupFailedCount > 0 ? "danger" : "success" }
            ])}
          </div>
        </article>
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
    sidebarGroups: orderedSidebarGroups,
    body,
    historyReplaceUrl,
    autoRefreshSeconds: view === "overview" ? 60 : undefined
  });
}
