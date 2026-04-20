import assert from "node:assert/strict";
import test from "node:test";

import {
  createComparisonDeltaItems,
  createComparisonRow
} from "./comparison-utils.js";
import {
  formatDnsRecordPreview,
  readBooleanPayloadValue,
  readObjectArrayPayloadValue,
  readStringArrayPayloadValue,
  readStringPayloadValue
} from "./dashboard-formatters.js";
import { buildDesiredStateActionModel } from "./desired-state-model-actions.js";
import type {
  DashboardData
} from "./api-client.js";
import type {
  DesiredStateActivityModel,
  DesiredStateModelCopy,
  DesiredStateSelectionModel
} from "./desired-state-model-types.js";

type TestCopy = DesiredStateModelCopy & {
  comparisonAppliedLabel: string;
  comparisonChangedLabel: string;
  comparisonDesiredLabel: string;
  comparisonFieldLabel: string;
  comparisonMatchLabel: string;
  comparisonStatusLabel: string;
  comparisonUnknownLabel: string;
  noRelatedRecords: string;
};

function createCopy(): TestCopy {
  return {
    aliasesLabel: "Aliases",
    appColDomain: "Domain",
    appColMode: "Mode",
    databaseColDatabase: "Database",
    databaseColEngine: "Engine",
    databaseColUser: "User",
    migrationCompletedLabel: "Completed",
    migrationPendingLabel: "Pending",
    none: "none",
    recordPreviewTitle: "Record preview",
    selectedStateLabel: "Selected state",
    storageRootLabel: "Storage root",
    targetedNodesLabel: "Targeted nodes",
    zoneColRecordCount: "Record count",
    zoneColZone: "Zone",
    comparisonAppliedLabel: "Last applied",
    comparisonChangedLabel: "changed",
    comparisonDesiredLabel: "Desired",
    comparisonFieldLabel: "Field",
    comparisonMatchLabel: "match",
    comparisonStatusLabel: "Status",
    comparisonUnknownLabel: "unknown",
    noRelatedRecords: "No related records."
  };
}

function createData(): DashboardData {
  return {
    desiredState: {
      spec: {
        tenants: [
          {
            slug: "acme",
            displayName: "Acme"
          }
        ],
        nodes: [
          {
            nodeId: "node-a",
            hostname: "node-a.example.net",
            publicIpv4: "203.0.113.10",
            wireguardAddress: "10.0.0.10/24"
          },
          {
            nodeId: "node-b",
            hostname: "node-b.example.net",
            publicIpv4: "203.0.113.11",
            wireguardAddress: "10.0.0.11/24"
          },
          {
            nodeId: "mail-a",
            hostname: "mail-a.example.net",
            publicIpv4: "203.0.113.20",
            wireguardAddress: "10.0.0.20/24"
          }
        ],
        zones: [
          {
            zoneName: "example.com",
            tenantSlug: "acme",
            primaryNodeId: "node-a",
            records: [
              {
                name: "@",
                type: "TXT",
                value: "\"custom explicit\"",
                ttl: 600
              }
            ]
          }
        ],
        apps: [
          {
            slug: "adudoc",
            tenantSlug: "acme",
            zoneName: "example.com",
            primaryNodeId: "node-a",
            standbyNodeId: "node-b",
            canonicalDomain: "adudoc.example.com",
            aliases: ["www.adudoc.example.com"],
            backendPort: 8080,
            runtimeImage: "ghcr.io/simplehost/adudoc:latest",
            storageRoot: "/srv/www/adudoc",
            mode: "active-passive"
          }
        ],
        databases: [
          {
            appSlug: "adudoc",
            engine: "postgresql",
            databaseName: "app_adudoc",
            databaseUser: "app_adudoc",
            primaryNodeId: "node-a",
            standbyNodeId: "node-b"
          }
        ],
        backupPolicies: [
          {
            policySlug: "daily-acme",
            tenantSlug: "acme",
            targetNodeId: "node-a",
            schedule: "0 3 * * *",
            retentionDays: 14,
            storageLocation: "/srv/backups/acme",
            resourceSelectors: ["tenant:acme"]
          }
        ],
        mailDomains: [
          {
            domainName: "example.com",
            tenantSlug: "acme",
            zoneName: "example.com",
            primaryNodeId: "mail-a",
            mailHost: "mail.example.com",
            dkimSelector: "default"
          }
        ],
        mailboxes: [],
        mailAliases: [],
        mailboxQuotas: []
      }
    }
  } as unknown as DashboardData;
}

function createSelections(data: DashboardData): DesiredStateSelectionModel {
  const zone = data.desiredState.spec.zones[0];
  const app = data.desiredState.spec.apps[0];
  const database = data.desiredState.spec.databases[0];
  const tenant = data.desiredState.spec.tenants[0];
  const node = data.desiredState.spec.nodes[0];
  const backupPolicy = data.desiredState.spec.backupPolicies[0];

  return {
    tenantOptions: [],
    nodeOptions: [],
    zoneOptions: [],
    appOptions: [],
    selectedTenant: tenant,
    selectedNode: node,
    selectedZone: zone,
    selectedApp: app,
    selectedDatabase: database,
    selectedBackupPolicy: backupPolicy,
    selectedDatabaseApp: app,
    selectedAppZone: zone,
    selectedTenantApps: [app],
    selectedTenantZones: [zone],
    selectedTenantBackupPolicies: [backupPolicy],
    selectedTenantBackupRuns: [],
    selectedNodePrimaryApps: [app],
    selectedNodePrimaryZones: [zone],
    selectedNodeBackupPolicies: [backupPolicy],
    selectedNodeBackupRuns: [],
    selectedZoneApps: [app],
    selectedZoneBackupPolicies: [backupPolicy],
    selectedZoneBackupRuns: [],
    selectedAppDatabases: [database],
    selectedAppBackupPolicies: [backupPolicy],
    selectedAppBackupRuns: [],
    selectedBackupRuns: [],
    selectedBackupTenantApps: [app],
    selectedBackupTenantZones: [zone],
    selectedBackupTenantDatabases: [database],
    selectedDatabaseBackupPolicies: [backupPolicy],
    selectedDatabaseBackupRuns: [],
    tenantCounts: {
      apps: 1,
      zones: 1,
      backupPolicies: 1
    },
    nodeCounts: {
      apps: 1,
      zones: 1,
      backupPolicies: 1
    }
  };
}

function createActivity(): DesiredStateActivityModel {
  const zoneDnsJob = {
    jobId: "job-zone-dns",
    desiredStateVersion: "test-v1",
    kind: "dns.sync",
    nodeId: "node-a",
    createdAt: "2026-04-19T00:00:00.000Z",
    completedAt: "2026-04-19T00:01:00.000Z",
    status: "applied",
    summary: "zone sync applied",
    payload: {
      zoneName: "example.com",
      nameservers: ["ns1.example.com"],
      records: [
        {
          name: "adudoc",
          type: "A",
          value: "203.0.113.10",
          ttl: 300
        }
      ]
    }
  };
  const proxyJob = {
    jobId: "job-proxy",
    desiredStateVersion: "test-v1",
    kind: "proxy.render",
    nodeId: "node-a",
    createdAt: "2026-04-19T00:02:00.000Z",
    completedAt: "2026-04-19T00:03:00.000Z",
    status: "applied",
    summary: "proxy rendered",
    payload: {
      vhostName: "adudoc",
      serverName: "adudoc.example.com",
      serverAliases: [],
      documentRoot: "/srv/www/adudoc/releases/current/public",
      proxyPassUrl: "http://127.0.0.1:9090",
      proxyPreserveHost: false,
      tls: true
    }
  };
  const databaseJob = {
    jobId: "job-db",
    desiredStateVersion: "test-v1",
    kind: "postgres.reconcile",
    nodeId: "node-a",
    createdAt: "2026-04-19T00:04:00.000Z",
    completedAt: "2026-04-19T00:05:00.000Z",
    status: "applied",
    summary: "database reconciled",
    payload: {
      appSlug: "adudoc",
      databaseName: "app_adudoc_old",
      roleName: "app_adudoc_old"
    }
  };

  return {
    selectedTenantJobs: [],
    selectedTenantAuditEvents: [],
    selectedNodeDesiredJobs: [],
    selectedNodeDesiredAuditEvents: [],
    selectedNodeDesiredDrift: [],
    selectedZoneJobs: [zoneDnsJob as never],
    selectedZoneAuditEvents: [],
    selectedAppJobs: [proxyJob as never, zoneDnsJob as never],
    selectedAppAuditEvents: [],
    selectedDatabaseJobs: [databaseJob as never],
    selectedDatabaseAuditEvents: [],
    selectedBackupRun: undefined,
    selectedBackupAuditEvents: [],
    selectedTenantLatestFailure: undefined,
    selectedTenantLatestSuccess: undefined,
    selectedNodeLatestFailure: undefined,
    selectedNodeLatestSuccess: undefined,
    selectedZoneLatestFailure: undefined,
    selectedZoneLatestSuccess: zoneDnsJob as never,
    selectedAppLatestFailure: undefined,
    selectedAppLatestSuccess: proxyJob as never,
    selectedDatabaseLatestFailure: undefined,
    selectedDatabaseLatestSuccess: databaseJob as never,
    selectedBackupLatestFailureRun: undefined,
    selectedBackupLatestSuccessRun: undefined,
    selectedNodeHealthSnapshot: undefined,
    selectedBackupTargetHealth: undefined,
    selectedZonePrimaryNodeHealth: undefined,
    selectedAppPrimaryNodeHealth: undefined,
    selectedDatabasePrimaryNodeHealth: undefined,
    selectedZoneDrift: {
      resourceKind: "dns",
      resourceKey: "zone:example.com",
      nodeId: "node-a",
      driftStatus: "out_of_sync",
      dispatchRecommended: true
    } as never,
    selectedAppProxyDrifts: [
      {
        resourceKind: "site",
        resourceKey: "app:adudoc:proxy:node-a",
        nodeId: "node-a",
        driftStatus: "out_of_sync",
        dispatchRecommended: true
      },
      {
        resourceKind: "site",
        resourceKey: "app:adudoc:proxy:node-b",
        nodeId: "node-b",
        driftStatus: "out_of_sync",
        dispatchRecommended: true
      }
    ] as never,
    selectedDatabaseDrift: {
      resourceKind: "database",
      resourceKey: "database:adudoc",
      nodeId: "node-a",
      driftStatus: "out_of_sync",
      dispatchRecommended: true
    } as never,
    selectedZoneLatestAppliedDnsJob: zoneDnsJob as never,
    selectedAppLatestAppliedProxyJob: proxyJob as never,
    selectedDatabaseLatestAppliedReconcileJob: databaseJob as never
  };
}

test("buildDesiredStateActionModel uses real per-action diffs against applied payloads", () => {
  const copy = createCopy();
  const model = buildDesiredStateActionModel({
    activity: createActivity(),
    copy,
    createComparisonDeltaItems,
    createComparisonRow,
    data: createData(),
    formatDnsRecordPreview,
    readBooleanPayloadValue,
    readObjectArrayPayloadValue,
    readStringArrayPayloadValue,
    readStringPayloadValue,
    selections: createSelections(createData()),
    summarizeComparisonRows: () => {
      throw new Error("Unexpected legacy summary fallback in test");
    }
  });

  const dmarcRow = model.zoneComparisonRows.find(
    (row) => row.field === "record set · _dmarc TXT"
  );
  const proxyPassRow = model.appComparisonRows.find(
    (row) => row.field === "proxy pass"
  );
  const databaseNameRow = model.databaseComparisonRows.find(
    (row) => row.field === "Database"
  );

  assert.ok(dmarcRow);
  assert.equal(dmarcRow.state, "changed");
  assert.match(dmarcRow.desiredValue, /v=DMARC1/i);
  assert.equal(dmarcRow.appliedValue, "");

  assert.ok(proxyPassRow);
  assert.equal(proxyPassRow.state, "changed");
  assert.match(proxyPassRow.desiredValue, /8080/);
  assert.match(proxyPassRow.appliedValue, /9090/);

  assert.ok(databaseNameRow);
  assert.equal(databaseNameRow.state, "changed");
  assert.equal(databaseNameRow.desiredValue, "app_adudoc");
  assert.equal(databaseNameRow.appliedValue, "app_adudoc_old");

  assert.equal(model.selectedAppPlanItems[0]?.title, "dns.sync");
  assert.match(model.selectedAppPlanItems[0]?.summary ?? "", /field\(s\) differ/);
  assert.match(model.selectedAppPlanItems[1]?.summary ?? "", /proxy pass/);

  const appDnsDeltaItem = model.selectedAppActionPreviewItems.find((item) =>
    item.title.includes("dns.sync · record set · _dmarc TXT")
  );
  const appDeleteItem = model.selectedAppActionPreviewItems.find(
    (item) => item.title === "app.delete"
  );
  const databaseDeleteItem = model.selectedDatabaseActionPreviewItems.find(
    (item) => item.title === "database.delete"
  );

  assert.ok(appDnsDeltaItem);
  assert.ok(appDeleteItem);
  assert.match(appDeleteItem.summary ?? "", /Last applied proxy\.render serves/);
  assert.ok(databaseDeleteItem);
  assert.match(databaseDeleteItem.summary ?? "", /Last applied reconcile targets/);
});
