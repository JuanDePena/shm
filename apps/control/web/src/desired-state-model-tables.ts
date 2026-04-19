import { escapeHtml } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type BuildDesiredStateModelArgs,
  type DesiredStateModelCopy,
  type DesiredStateSelectionModel,
  type DesiredStateTableModel
} from "./desired-state-model-types.js";

export function buildDesiredStateTableModel<Copy extends DesiredStateModelCopy>(
  args: Pick<BuildDesiredStateModelArgs<Copy>, "copy" | "data" | "renderFocusLink" | "renderPill"> & {
    selections: DesiredStateSelectionModel;
  }
): DesiredStateTableModel {
  const { copy, data, renderFocusLink, renderPill, selections } = args;
  const renderDatabaseMigrationPill = (
    database: (typeof data.desiredState.spec.databases)[number]
  ): string => {
    if (database.pendingMigrationTo) {
      return renderPill(
        `${copy.migrationPendingLabel}: ${database.engine} -> ${database.pendingMigrationTo}`,
        "danger"
      );
    }

    if (database.migrationCompletedFrom) {
      return renderPill(
        `${copy.migrationCompletedLabel}: ${database.migrationCompletedFrom} -> ${database.engine}`,
        "success"
      );
    }

    return renderPill(copy.none, "muted");
  };

  const tenantTableRows = data.desiredState.spec.tenants.map((tenant) => ({
    selectionKey: tenant.slug,
    selected: selections.selectedTenant?.slug === tenant.slug,
    cells: [
      renderFocusLink(
        tenant.slug,
        buildDashboardViewUrl("tenants", undefined, tenant.slug),
        selections.selectedTenant?.slug === tenant.slug,
        copy.selectedStateLabel
      ),
      escapeHtml(tenant.displayName)
    ],
    searchText: `${tenant.slug} ${tenant.displayName}`.toLowerCase()
  }));
  const nodeTableRows = data.desiredState.spec.nodes.map((node) => ({
    selectionKey: node.nodeId,
    selected: selections.selectedNode?.nodeId === node.nodeId,
    cells: [
      renderFocusLink(
        node.nodeId,
        buildDashboardViewUrl("nodes", "nodes-spec", node.nodeId),
        selections.selectedNode?.nodeId === node.nodeId,
        copy.selectedStateLabel
      ),
      escapeHtml(node.hostname),
      `<span class="mono">${escapeHtml(node.publicIpv4)}</span>`,
      `<span class="mono">${escapeHtml(node.wireguardAddress)}</span>`
    ],
    searchText: [node.nodeId, node.hostname, node.publicIpv4, node.wireguardAddress]
      .join(" ")
      .toLowerCase()
  }));
  const zoneTableRows = data.desiredState.spec.zones.map((zone) => ({
    selectionKey: zone.zoneName,
    selected: selections.selectedZone?.zoneName === zone.zoneName,
    cells: [
      renderFocusLink(
        zone.zoneName,
        buildDashboardViewUrl("zones", undefined, zone.zoneName),
        selections.selectedZone?.zoneName === zone.zoneName,
        copy.selectedStateLabel
      ),
      escapeHtml(zone.tenantSlug),
      `<span class="mono">${escapeHtml(zone.primaryNodeId)}</span>`,
      renderPill(String(zone.records.length), zone.records.length > 0 ? "success" : "muted")
    ],
    searchText: [
      zone.zoneName,
      zone.tenantSlug,
      zone.primaryNodeId,
      ...zone.records.map((record) => `${record.name} ${record.type} ${record.value}`)
    ]
      .join(" ")
      .toLowerCase()
  }));
  const appTableRows = data.desiredState.spec.apps.map((app) => ({
    selectionKey: app.slug,
    selected: selections.selectedApp?.slug === app.slug,
    cells: [
      renderFocusLink(
        app.slug,
        buildDashboardViewUrl("apps", undefined, app.slug),
        selections.selectedApp?.slug === app.slug,
        copy.selectedStateLabel
      ),
      escapeHtml(app.tenantSlug),
      escapeHtml(app.canonicalDomain),
      renderPill(app.mode, app.mode === "active-active" ? "success" : "muted"),
      `<span class="mono">${escapeHtml(
        app.standbyNodeId ? `${app.primaryNodeId} -> ${app.standbyNodeId}` : app.primaryNodeId
      )}</span>`
    ],
    searchText: [
      app.slug,
      app.tenantSlug,
      app.zoneName,
      app.canonicalDomain,
      app.aliases.join(" "),
      app.mode,
      app.primaryNodeId,
      app.standbyNodeId ?? ""
    ]
      .join(" ")
      .toLowerCase()
  }));
  const proxyTableRows = data.desiredState.spec.apps.map((app) => ({
    selectionKey: app.slug,
    selected: selections.selectedApp?.slug === app.slug,
    cells: [
      renderFocusLink(
        app.canonicalDomain,
        buildDashboardViewUrl("proxies", undefined, app.slug),
        selections.selectedApp?.slug === app.slug,
        copy.selectedStateLabel
      ),
      escapeHtml(app.slug),
      escapeHtml(app.aliases.length > 0 ? app.aliases.join(", ") : copy.none),
      `<span class="mono">${escapeHtml(String(app.backendPort))}</span>`,
      `<span class="mono">${escapeHtml(
        app.standbyNodeId ? `${app.primaryNodeId} -> ${app.standbyNodeId}` : app.primaryNodeId
      )}</span>`
    ],
    searchText: [
      app.slug,
      app.canonicalDomain,
      app.aliases.join(" "),
      String(app.backendPort),
      app.primaryNodeId,
      app.standbyNodeId ?? "",
      app.zoneName,
      app.tenantSlug
    ]
      .join(" ")
      .toLowerCase()
  }));
  const databaseTableRows = data.desiredState.spec.databases.map((database) => ({
    selectionKey: `${database.engine}:${database.databaseName}`,
    selected: selections.selectedDatabase?.appSlug === database.appSlug,
    cells: [
      renderFocusLink(
        database.appSlug,
        buildDashboardViewUrl("databases", undefined, database.appSlug),
        selections.selectedDatabase?.appSlug === database.appSlug,
        copy.selectedStateLabel
      ),
      escapeHtml(database.engine),
      `<span class="mono">${escapeHtml(database.databaseName)}</span>`,
      `<span class="mono">${escapeHtml(database.databaseUser)}</span>`,
      `<span class="mono">${escapeHtml(
        database.standbyNodeId
          ? `${database.primaryNodeId} -> ${database.standbyNodeId}`
          : database.primaryNodeId
      )}</span>`,
      renderDatabaseMigrationPill(database)
    ],
    searchText: [
      database.appSlug,
      database.engine,
      database.databaseName,
      database.databaseUser,
      database.primaryNodeId,
      database.standbyNodeId ?? "",
      database.pendingMigrationTo ?? "",
      database.migrationCompletedFrom ?? "",
      database.migrationCompletedAt ?? ""
    ]
      .join(" ")
      .toLowerCase()
  }));
  const backupTableRows = data.desiredState.spec.backupPolicies.map((policy) => ({
    selectionKey: policy.policySlug,
    selected: selections.selectedBackupPolicy?.policySlug === policy.policySlug,
    cells: [
      renderFocusLink(
        policy.policySlug,
        buildDashboardViewUrl("backup-policies", undefined, policy.policySlug),
        selections.selectedBackupPolicy?.policySlug === policy.policySlug,
        copy.selectedStateLabel
      ),
      escapeHtml(policy.tenantSlug),
      `<span class="mono">${escapeHtml(policy.targetNodeId)}</span>`,
      `<span class="mono">${escapeHtml(policy.schedule)}</span>`,
      renderPill(String(policy.retentionDays), policy.retentionDays > 0 ? "success" : "muted")
    ],
    searchText: [
      policy.policySlug,
      policy.tenantSlug,
      policy.targetNodeId,
      policy.schedule,
      String(policy.retentionDays),
      policy.resourceSelectors.join(" ")
    ]
      .join(" ")
      .toLowerCase()
  }));

  return {
    tenantTableRows,
    nodeTableRows,
    zoneTableRows,
    appTableRows,
    proxyTableRows,
    databaseTableRows,
    backupTableRows
  };
}
