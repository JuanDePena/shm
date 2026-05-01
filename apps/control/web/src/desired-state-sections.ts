import { type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type DesiredStateLayoutSection } from "./desired-state-layout.js";

type DesiredStateSectionsCopy = {
  aliasesLabel: string;
  appColDomain: string;
  appColMode: string;
  appColNodes: string;
  appColSlug: string;
  appColTenant: string;
  backendPortLabel: string;
  backupPolicyColRetention: string;
  backupPolicyColSchedule: string;
  backupPolicyColSlug: string;
  backupPolicyColTargetNode: string;
  backupPolicyColTenant: string;
  databaseColApp: string;
  databaseColDatabase: string;
  databaseColEngine: string;
  databaseColMigration: string;
  databaseColNodes: string;
  databaseColUser: string;
  noApps: string;
  noBackupPolicies: string;
  noDatabases: string;
  noNodes: string;
  noTenants: string;
  noZones: string;
  nodeColHostname: string;
  nodeColNode: string;
  nodeSpecColPublicIpv4: string;
  nodeSpecColWireguard: string;
  tabActivity: string;
  tabApps: string;
  tabBackupPolicies: string;
  tabDatabases: string;
  tabNodes: string;
  tabSpec: string;
  tabSummary: string;
  tabTenants: string;
  tabZones: string;
  tenantColDisplayName: string;
  tenantColSlug: string;
  zoneColPrimaryNode: string;
  zoneColRecordCount: string;
  zoneColTenant: string;
  zoneColZone: string;
};

type DesiredStateTableRenderer = (
  id: string,
  columns: Array<{ label: string; className?: string }>,
  rows: DataTableRow[],
  emptyMessage: string
) => string;

export function buildDesiredStateLayoutSections<Copy extends DesiredStateSectionsCopy>(args: {
  copy: Copy;
  data: DashboardData;
  focus?: string;
  options: {
    workspaceTabId?: string;
    workspaceKind?: "apps" | "proxies";
  };
  createFormPanels: Map<string, string>;
  renderDesiredStateTable: DesiredStateTableRenderer;
  renderEmptyDesiredStatePanel: (message: string) => string;
  tenantTableRows: DataTableRow[];
  nodeTableRows: DataTableRow[];
  zoneTableRows: DataTableRow[];
  appTableRows: DataTableRow[];
  proxyTableRows: DataTableRow[];
  databaseTableRows: DataTableRow[];
  backupTableRows: DataTableRow[];
  tenantDetailPanel?: string;
  tenantEditorPanel?: string;
  tenantActivityHtml?: string;
  tenantWorkspacePanel?: string;
  nodeDetailPanel?: string;
  nodeEditorPanel?: string;
  zoneDetailPanel?: string;
  zoneEditorPanel?: string;
  zoneActivityHtml?: string;
  zoneWorkspacePanel?: string;
  appDetailPanel?: string;
  appEditorPanel?: string;
  appActivityHtml?: string;
  appWorkspacePanel?: string;
  proxyDetailPanel?: string;
  proxyEditorPanel?: string;
  proxyActivityHtml?: string;
  proxyWorkspacePanel?: string;
  databaseDetailPanel?: string;
  databaseEditorPanel?: string;
  databaseActivityHtml?: string;
  databaseWorkspacePanel?: string;
  backupDetailPanel?: string;
  backupEditorPanel?: string;
}): DesiredStateLayoutSection[] {
  const {
    copy,
    data,
    focus,
    options,
    createFormPanels,
    renderDesiredStateTable,
    renderEmptyDesiredStatePanel,
    tenantTableRows,
    nodeTableRows,
    zoneTableRows,
    appTableRows,
    proxyTableRows,
    databaseTableRows,
    backupTableRows,
    tenantDetailPanel,
    tenantEditorPanel,
    tenantActivityHtml,
    tenantWorkspacePanel,
    nodeDetailPanel,
    nodeEditorPanel,
    zoneDetailPanel,
    zoneEditorPanel,
    zoneActivityHtml,
    zoneWorkspacePanel,
    appDetailPanel,
    appEditorPanel,
    appActivityHtml,
    appWorkspacePanel,
    proxyDetailPanel,
    proxyEditorPanel,
    proxyActivityHtml,
    proxyWorkspacePanel,
    databaseDetailPanel,
    databaseEditorPanel,
    databaseActivityHtml,
    databaseWorkspacePanel,
    backupDetailPanel,
    backupEditorPanel
  } = args;

  const noTenantsPanel = renderEmptyDesiredStatePanel(copy.noTenants);
  const noNodesPanel = renderEmptyDesiredStatePanel(copy.noNodes);
  const noZonesPanel = renderEmptyDesiredStatePanel(copy.noZones);
  const noAppsPanel = renderEmptyDesiredStatePanel(copy.noApps);
  const noDatabasesPanel = renderEmptyDesiredStatePanel(copy.noDatabases);
  const noBackupPoliciesPanel = renderEmptyDesiredStatePanel(copy.noBackupPolicies);

  const tenantTableHtml = renderDesiredStateTable(
    "desired-state-tenants-table",
    [
      { label: copy.tenantColSlug, className: "mono" },
      { label: copy.tenantColDisplayName }
    ],
    tenantTableRows,
    copy.noTenants
  );
  const nodeTableHtml = renderDesiredStateTable(
    "desired-state-nodes-table",
    [
      { label: copy.nodeColNode, className: "mono" },
      { label: copy.nodeColHostname },
      { label: copy.nodeSpecColPublicIpv4, className: "mono" },
      { label: copy.nodeSpecColWireguard, className: "mono" }
    ],
    nodeTableRows,
    copy.noNodes
  );
  const zoneTableHtml = renderDesiredStateTable(
    "desired-state-zones-table",
    [
      { label: copy.zoneColZone, className: "mono" },
      { label: copy.zoneColTenant },
      { label: copy.zoneColPrimaryNode, className: "mono" },
      { label: copy.zoneColRecordCount }
    ],
    zoneTableRows,
    copy.noZones
  );
  const appTableHtml = renderDesiredStateTable(
    "desired-state-apps-table",
    [
      { label: copy.appColSlug, className: "mono" },
      { label: copy.appColTenant },
      { label: copy.appColDomain },
      { label: copy.appColMode },
      { label: copy.appColNodes, className: "mono" }
    ],
    appTableRows,
    copy.noApps
  );
  const databaseTableHtml = renderDesiredStateTable(
    "desired-state-databases-table",
    [
      { label: copy.databaseColApp, className: "mono" },
      { label: copy.databaseColEngine },
      { label: copy.databaseColDatabase, className: "mono" },
      { label: copy.databaseColUser, className: "mono" },
      { label: copy.databaseColNodes, className: "mono" }
    ],
    databaseTableRows,
    copy.noDatabases
  );
  const backupTableHtml = renderDesiredStateTable(
    "desired-state-backups-table",
    [
      { label: copy.backupPolicyColSlug, className: "mono" },
      { label: copy.backupPolicyColTenant },
      { label: copy.backupPolicyColTargetNode, className: "mono" },
      { label: copy.backupPolicyColSchedule, className: "mono" },
      { label: copy.backupPolicyColRetention }
    ],
    backupTableRows,
    copy.noBackupPolicies
  );

  const appsWorkspaceTabPrefix = options.workspaceKind === "proxies" ? "proxies" : "apps";
  const appsWorkspaceSectionId =
    options.workspaceKind === "proxies" ? "section-proxies" : "section-apps";
  const appsWorkspaceTableHtml =
    options.workspaceKind === "proxies"
      ? renderDesiredStateTable(
          "proxies-object-table",
          [
            { label: copy.appColDomain },
            { label: copy.appColSlug, className: "mono" },
            { label: copy.aliasesLabel },
            { label: copy.backendPortLabel, className: "mono" },
            { label: copy.appColNodes, className: "mono" }
          ],
          proxyTableRows,
          copy.noApps
        )
      : renderDesiredStateTable(
          "apps-object-table",
          [
            { label: copy.appColSlug, className: "mono" },
            { label: copy.appColTenant },
            { label: copy.appColDomain },
            { label: copy.appColMode },
            { label: copy.appColNodes, className: "mono" }
          ],
          appTableRows,
          copy.noApps
        );

  return [
    {
      id: "desired-state-tenants",
      label: copy.tabTenants,
      badge: String(data.desiredState.spec.tenants.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-tenants"),
      full: {
        tableHtml: tenantTableHtml,
        summaryHtml: tenantDetailPanel,
        specHtml: tenantEditorPanel,
        emptyPanelHtml: noTenantsPanel
      },
      workspace: {
        sectionId: "section-tenants",
        defaultTabId: options.workspaceTabId ?? "tenants-summary",
        tableHtml: renderDesiredStateTable(
          "tenants-object-table",
          [
            { label: copy.tenantColSlug, className: "mono" },
            { label: copy.tenantColDisplayName }
          ],
          tenantTableRows,
          copy.noTenants
        ),
        emptyPanelHtml: noTenantsPanel,
        singlePanelGrid: true,
        singlePanelHtml: tenantWorkspacePanel ?? noTenantsPanel,
        summary: {
          id: "tenants-summary",
          label: copy.tabSummary,
          href: buildDashboardViewUrl("tenants", "tenants-summary", focus),
          panelHtml: tenantDetailPanel
        },
        spec: {
          id: "tenants-spec",
          label: copy.tabSpec,
          href: buildDashboardViewUrl("tenants", "tenants-spec", focus),
          panelHtml: tenantEditorPanel ?? createFormPanels.get("create-tenant-form")
        },
        activity: {
          id: "tenants-activity",
          label: copy.tabActivity,
          href: buildDashboardViewUrl("tenants", "tenants-activity", focus),
          panelHtml: tenantActivityHtml
        }
      }
    },
    {
      id: "desired-state-nodes",
      label: copy.tabNodes,
      badge: String(data.desiredState.spec.nodes.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-nodes"),
      full: {
        tableHtml: nodeTableHtml,
        summaryHtml: nodeDetailPanel,
        specHtml: nodeEditorPanel,
        emptyPanelHtml: noNodesPanel
      }
    },
    {
      id: "desired-state-zones",
      label: copy.tabZones,
      badge: String(data.desiredState.spec.zones.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-zones"),
      full: {
        tableHtml: zoneTableHtml,
        summaryHtml: zoneDetailPanel,
        specHtml: zoneEditorPanel,
        emptyPanelHtml: noZonesPanel
      },
      workspace: {
        sectionId: "section-zones",
        defaultTabId: options.workspaceTabId ?? "zones-summary",
        tableHtml: renderDesiredStateTable(
          "zones-object-table",
          [
            { label: copy.zoneColZone, className: "mono" },
            { label: copy.zoneColTenant },
            { label: copy.zoneColPrimaryNode, className: "mono" },
            { label: copy.zoneColRecordCount }
          ],
          zoneTableRows,
          copy.noZones
        ),
        emptyPanelHtml: noZonesPanel,
        singlePanelGrid: true,
        singlePanelHtml: zoneWorkspacePanel ?? noZonesPanel,
        summary: {
          id: "zones-summary",
          label: copy.tabSummary,
          href: buildDashboardViewUrl("zones", "zones-summary", focus),
          panelHtml: zoneDetailPanel
        },
        spec: {
          id: "zones-spec",
          label: copy.tabSpec,
          href: buildDashboardViewUrl("zones", "zones-spec", focus),
          panelHtml: zoneEditorPanel ?? createFormPanels.get("create-zone-form")
        },
        activity: {
          id: "zones-activity",
          label: copy.tabActivity,
          href: buildDashboardViewUrl("zones", "zones-activity", focus),
          panelHtml: zoneActivityHtml
        }
      }
    },
    {
      id: "desired-state-apps",
      label: copy.tabApps,
      badge: String(data.desiredState.spec.apps.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-apps"),
      full: {
        tableHtml: appTableHtml,
        summaryHtml: appDetailPanel,
        specHtml: appEditorPanel,
        emptyPanelHtml: noAppsPanel
      },
      workspace: {
        sectionId: appsWorkspaceSectionId,
        defaultTabId: options.workspaceTabId ?? `${appsWorkspaceTabPrefix}-summary`,
        tableHtml: appsWorkspaceTableHtml,
        emptyPanelHtml: noAppsPanel,
        singlePanelGrid: true,
        singlePanelHtml:
          options.workspaceKind === "proxies"
            ? (proxyWorkspacePanel ?? noAppsPanel)
            : (appWorkspacePanel ?? noAppsPanel),
        summary: {
          id: `${appsWorkspaceTabPrefix}-summary`,
          label: copy.tabSummary,
          href: buildDashboardViewUrl(
            options.workspaceKind === "proxies" ? "proxies" : "apps",
            `${appsWorkspaceTabPrefix}-summary`,
            focus
          ),
          panelHtml: options.workspaceKind === "proxies" ? proxyDetailPanel : appDetailPanel
        },
        spec: {
          id: `${appsWorkspaceTabPrefix}-spec`,
          label: copy.tabSpec,
          href: buildDashboardViewUrl(
            options.workspaceKind === "proxies" ? "proxies" : "apps",
            `${appsWorkspaceTabPrefix}-spec`,
            focus
          ),
          panelHtml:
            (options.workspaceKind === "proxies" ? proxyEditorPanel : appEditorPanel) ??
            createFormPanels.get("create-app-form")
        },
        activity: {
          id: `${appsWorkspaceTabPrefix}-activity`,
          label: copy.tabActivity,
          href: buildDashboardViewUrl(
            options.workspaceKind === "proxies" ? "proxies" : "apps",
            `${appsWorkspaceTabPrefix}-activity`,
            focus
          ),
          panelHtml: options.workspaceKind === "proxies" ? proxyActivityHtml : appActivityHtml
        }
      }
    },
    {
      id: "desired-state-databases",
      label: copy.tabDatabases,
      badge: String(data.desiredState.spec.databases.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-databases"),
      full: {
        tableHtml: databaseTableHtml,
        summaryHtml: databaseDetailPanel,
        specHtml: databaseEditorPanel,
        emptyPanelHtml: noDatabasesPanel
      },
      workspace: {
        sectionId: "section-databases",
        defaultTabId: options.workspaceTabId ?? "databases-summary",
        tableHtml: renderDesiredStateTable(
          "databases-object-table",
          [
            { label: copy.databaseColApp, className: "mono" },
            { label: copy.databaseColEngine },
            { label: copy.databaseColDatabase, className: "mono" },
            { label: copy.databaseColUser, className: "mono" },
            { label: copy.databaseColNodes, className: "mono" }
          ],
          databaseTableRows,
          copy.noDatabases
        ),
        emptyPanelHtml: noDatabasesPanel,
        singlePanelGrid: true,
        singlePanelHtml: databaseWorkspacePanel ?? noDatabasesPanel,
        summary: {
          id: "databases-summary",
          label: copy.tabSummary,
          href: buildDashboardViewUrl("databases", "databases-summary", focus),
          panelHtml: databaseDetailPanel
        },
        spec: {
          id: "databases-spec",
          label: copy.tabSpec,
          href: buildDashboardViewUrl("databases", "databases-spec", focus),
          panelHtml: databaseEditorPanel ?? createFormPanels.get("create-database-form")
        },
        activity: {
          id: "databases-activity",
          label: copy.tabActivity,
          href: buildDashboardViewUrl("databases", "databases-activity", focus),
          panelHtml: databaseActivityHtml
        }
      }
    },
    {
      id: "desired-state-backups",
      label: copy.tabBackupPolicies,
      badge: String(data.desiredState.spec.backupPolicies.length),
      href: buildDashboardViewUrl("desired-state", "desired-state-backups"),
      full: {
        tableHtml: backupTableHtml,
        summaryHtml: backupDetailPanel,
        specHtml: backupEditorPanel,
        emptyPanelHtml: noBackupPoliciesPanel
      },
      workspace: {
        sectionId: "section-backup-policies",
        defaultTabId: options.workspaceTabId ?? "backup-policies-summary",
        tableHtml: renderDesiredStateTable(
          "backup-policies-object-table",
          [
            { label: copy.backupPolicyColSlug, className: "mono" },
            { label: copy.backupPolicyColTenant },
            { label: copy.backupPolicyColTargetNode, className: "mono" },
            { label: copy.backupPolicyColSchedule, className: "mono" },
            { label: copy.backupPolicyColRetention }
          ],
          backupTableRows,
          copy.noBackupPolicies
        ),
        emptyPanelHtml: noBackupPoliciesPanel,
        summary: {
          id: "backup-policies-summary",
          label: copy.tabSummary,
          href: buildDashboardViewUrl("backup-policies", "backup-policies-summary", focus),
          panelHtml: backupDetailPanel
        },
        spec: {
          id: "backup-policies-spec",
          label: copy.tabSpec,
          href: buildDashboardViewUrl("backup-policies", "backup-policies-spec", focus),
          panelHtml: backupEditorPanel ?? createFormPanels.get("create-backup-form")
        }
      }
    }
  ];
}
