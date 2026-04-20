import { type BuildDesiredStateModelArgs, type DesiredStateSelectionModel, type DesiredStateModelCopy } from "./desired-state-model-types.js";

export function buildDesiredStateSelectionModel<Copy extends DesiredStateModelCopy>(
  args: Pick<BuildDesiredStateModelArgs<Copy>, "data" | "defaultTabId" | "focus">
): DesiredStateSelectionModel {
  const { data, defaultTabId, focus } = args;

  const tenantOptions = data.desiredState.spec.tenants.map((tenant) => ({
    value: tenant.slug,
    label: `${tenant.slug} · ${tenant.displayName}`
  }));
  const nodeOptions = data.desiredState.spec.nodes.map((node) => ({
    value: node.nodeId,
    label: `${node.nodeId} · ${node.hostname}`
  }));
  const zoneOptions = data.desiredState.spec.zones.map((zone) => ({
    value: zone.zoneName,
    label: zone.zoneName
  }));
  const appOptions = data.desiredState.spec.apps.map((app) => ({
    value: app.slug,
    label: `${app.slug} · ${app.canonicalDomain}`
  }));

  const selectedZone =
    defaultTabId === "desired-state-zones"
      ? data.desiredState.spec.zones.find((zone) => zone.zoneName === focus) ??
        data.desiredState.spec.zones[0]
      : undefined;
  const selectedApp =
    defaultTabId === "desired-state-apps"
      ? data.desiredState.spec.apps.find((app) => app.slug === focus) ??
        data.desiredState.spec.apps[0]
      : undefined;
  const selectedDatabase =
    defaultTabId === "desired-state-databases"
      ? data.desiredState.spec.databases.find(
          (database) =>
            database.appSlug === focus ||
            `${database.engine}:${database.databaseName}` === focus
        ) ?? data.desiredState.spec.databases[0]
      : undefined;
  const selectedTenant =
    defaultTabId === "desired-state-tenants"
      ? data.desiredState.spec.tenants.find((tenant) => tenant.slug === focus) ??
        data.desiredState.spec.tenants[0]
      : undefined;
  const selectedNode =
    defaultTabId === "desired-state-nodes"
      ? data.desiredState.spec.nodes.find((node) => node.nodeId === focus) ??
        data.desiredState.spec.nodes[0]
      : undefined;
  const selectedBackupPolicy =
    defaultTabId === "desired-state-backups"
      ? data.desiredState.spec.backupPolicies.find((policy) => policy.policySlug === focus) ??
        data.desiredState.spec.backupPolicies[0]
      : undefined;

  const selectedDatabaseApp = selectedDatabase
    ? data.desiredState.spec.apps.find((app) => app.slug === selectedDatabase.appSlug)
    : undefined;
  const selectedAppZone = selectedApp
    ? data.desiredState.spec.zones.find((zone) => zone.zoneName === selectedApp.zoneName)
    : undefined;

  const selectedTenantApps = selectedTenant
    ? data.desiredState.spec.apps.filter((app) => app.tenantSlug === selectedTenant.slug)
    : [];
  const selectedTenantZones = selectedTenant
    ? data.desiredState.spec.zones.filter((zone) => zone.tenantSlug === selectedTenant.slug)
    : [];
  const selectedTenantBackupPolicies = selectedTenant
    ? data.desiredState.spec.backupPolicies.filter((policy) => policy.tenantSlug === selectedTenant.slug)
    : [];
  const selectedTenantBackupRuns = selectedTenant
    ? data.backups.latestRuns.filter((run) =>
        selectedTenantBackupPolicies.some((policy) => policy.policySlug === run.policySlug)
      )
    : [];
  const selectedNodePrimaryApps = selectedNode
    ? data.desiredState.spec.apps.filter((app) => app.primaryNodeId === selectedNode.nodeId)
    : [];
  const selectedNodePrimaryZones = selectedNode
    ? data.desiredState.spec.zones.filter((zone) => zone.primaryNodeId === selectedNode.nodeId)
    : [];
  const selectedNodeBackupPolicies = selectedNode
    ? data.desiredState.spec.backupPolicies.filter((policy) => policy.targetNodeId === selectedNode.nodeId)
    : [];
  const selectedNodeBackupRuns = selectedNode
    ? data.backups.latestRuns.filter(
        (run) =>
          run.nodeId === selectedNode.nodeId ||
          selectedNodeBackupPolicies.some((policy) => policy.policySlug === run.policySlug)
      )
    : [];
  const selectedZoneApps = selectedZone
    ? data.desiredState.spec.apps.filter((app) => app.zoneName === selectedZone.zoneName)
    : [];
  const selectedZoneBackupPolicies = selectedZone
    ? data.desiredState.spec.backupPolicies.filter((policy) => policy.tenantSlug === selectedZone.tenantSlug)
    : [];
  const selectedZoneBackupRuns = selectedZone
    ? data.backups.latestRuns.filter((run) =>
        selectedZoneBackupPolicies.some((policy) => policy.policySlug === run.policySlug)
      )
    : [];
  const selectedAppDatabases = selectedApp
    ? data.desiredState.spec.databases.filter((database) => database.appSlug === selectedApp.slug)
    : [];
  const selectedAppBackupPolicies = selectedApp
    ? data.desiredState.spec.backupPolicies.filter((policy) => policy.tenantSlug === selectedApp.tenantSlug)
    : [];
  const selectedAppBackupRuns = selectedApp
    ? data.backups.latestRuns.filter((run) =>
        selectedAppBackupPolicies.some((policy) => policy.policySlug === run.policySlug)
      )
    : [];
  const selectedBackupRuns = selectedBackupPolicy
    ? data.backups.latestRuns.filter((run) => run.policySlug === selectedBackupPolicy.policySlug)
    : [];
  const selectedBackupTenantApps = selectedBackupPolicy
    ? data.desiredState.spec.apps.filter((app) => app.tenantSlug === selectedBackupPolicy.tenantSlug)
    : [];
  const selectedBackupTenantZones = selectedBackupPolicy
    ? data.desiredState.spec.zones.filter((zone) => zone.tenantSlug === selectedBackupPolicy.tenantSlug)
    : [];
  const selectedBackupTenantDatabases = selectedBackupPolicy
    ? data.desiredState.spec.databases.filter((database) => {
        const app = data.desiredState.spec.apps.find((entry) => entry.slug === database.appSlug);
        return app?.tenantSlug === selectedBackupPolicy.tenantSlug;
      })
    : [];
  const selectedDatabaseBackupPolicies = selectedDatabaseApp
    ? data.desiredState.spec.backupPolicies.filter((policy) => policy.tenantSlug === selectedDatabaseApp.tenantSlug)
    : [];
  const selectedDatabaseBackupRuns = selectedDatabaseApp
    ? data.backups.latestRuns.filter((run) =>
        selectedDatabaseBackupPolicies.some((policy) => policy.policySlug === run.policySlug)
      )
    : [];

  return {
    tenantOptions,
    nodeOptions,
    zoneOptions,
    appOptions,
    selectedTenant,
    selectedNode,
    selectedZone,
    selectedApp,
    selectedDatabase,
    selectedBackupPolicy,
    selectedDatabaseApp,
    selectedAppZone,
    selectedTenantApps,
    selectedTenantZones,
    selectedTenantBackupPolicies,
    selectedTenantBackupRuns,
    selectedNodePrimaryApps,
    selectedNodePrimaryZones,
    selectedNodeBackupPolicies,
    selectedNodeBackupRuns,
    selectedZoneApps,
    selectedZoneBackupPolicies,
    selectedZoneBackupRuns,
    selectedAppDatabases,
    selectedAppBackupPolicies,
    selectedAppBackupRuns,
    selectedBackupRuns,
    selectedBackupTenantApps,
    selectedBackupTenantZones,
    selectedBackupTenantDatabases,
    selectedDatabaseBackupPolicies,
    selectedDatabaseBackupRuns,
    tenantCounts: {
      apps: selectedTenantApps.length,
      zones: selectedTenantZones.length,
      backupPolicies: selectedTenantBackupPolicies.length
    },
    nodeCounts: {
      apps: selectedNodePrimaryApps.length,
      zones: selectedNodePrimaryZones.length,
      backupPolicies: selectedNodeBackupPolicies.length
    }
  };
}
