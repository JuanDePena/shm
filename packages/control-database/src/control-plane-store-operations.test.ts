import test from "node:test";
import assert from "node:assert/strict";

import type { PoolClient } from "pg";

import {
  createDefaultMailPolicy,
  createDispatchedJobEnvelope
} from "@simplehost/control-contracts";

import { createQueuedDispatchJob } from "./control-plane-store-helpers.js";
import {
  buildZoneDnsPlans,
  mergeJobHistoryRows,
  purgeOperationalHistoryRows,
  shouldDispatchQueuedJob
} from "./control-plane-store-operations.js";
import type { JobHistoryRow } from "./control-plane-store-types.js";

function createMailSyncJob(payload: Record<string, unknown>) {
  return createQueuedDispatchJob(
    createDispatchedJobEnvelope("mail.sync", "mail-a", "desired-v1", payload),
    "mail:mail-a",
    "mail"
  );
}

function createStubClient(rows: Array<Record<string, unknown>>): PoolClient {
  return {
    query: async () => ({ rows })
  } as unknown as PoolClient;
}

function createJobHistoryRow(
  id: string,
  kind: string,
  createdAt: string,
  resourceKey?: string | null
): JobHistoryRow {
  return {
    id,
    desired_state_version: "desired-v1",
    kind,
    node_id: "primary",
    created_at: createdAt,
    claimed_at: createdAt,
    completed_at: createdAt,
    payload: {},
    status: "applied",
    summary: `${kind} applied`,
    details: null,
    dispatch_reason: null,
    resource_key: resourceKey ?? null
  };
}

test("shouldDispatchQueuedJob skips stable pending mail.sync payloads", async () => {
  const job = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: job.payloadHash,
      completed_at: null,
      status: null,
      summary: null
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, job);

  assert.equal(shouldDispatch, false);
});

test("shouldDispatchQueuedJob skips stable applied mail.sync payloads", async () => {
  const job = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: job.payloadHash,
      completed_at: "2026-04-21T12:00:00.000Z",
      status: "applied",
      summary: "mail.sync applied"
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, job);

  assert.equal(shouldDispatch, false);
});

test("shouldDispatchQueuedJob redispatches when mail.sync payload changes", async () => {
  const previousJob = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const nextJob = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [
      { domainName: "example.com", deliveryRole: "primary" },
      { domainName: "example.org", deliveryRole: "primary" }
    ]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: previousJob.payloadHash,
      completed_at: "2026-04-21T12:00:00.000Z",
      status: "applied",
      summary: "mail.sync applied"
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, nextJob);

  assert.equal(shouldDispatch, true);
});

test("mergeJobHistoryRows keeps the latest applied dns.sync rows alongside recent churn", () => {
  const recentRows = [
    createJobHistoryRow("job-mail-2", "mail.sync", "2026-04-24T23:41:47.000Z", "mail:secondary"),
    createJobHistoryRow("job-mail-1", "mail.sync", "2026-04-24T23:41:46.000Z", "mail:primary")
  ];
  const latestAppliedDnsRows = [
    createJobHistoryRow(
      "job-dns-1",
      "dns.sync",
      "2026-04-24T22:33:55.000Z",
      "zone:adudoc.com"
    )
  ];

  const merged = mergeJobHistoryRows(recentRows, latestAppliedDnsRows);

  assert.deepEqual(
    merged.map((row) => row.id),
    ["job-mail-2", "job-mail-1", "job-dns-1"]
  );
});

test("mergeJobHistoryRows de-duplicates dns.sync rows already present in the recent window", () => {
  const dnsRow = createJobHistoryRow(
    "job-dns-1",
    "dns.sync",
    "2026-04-24T22:33:55.000Z",
    "zone:adudoc.com"
  );

  const merged = mergeJobHistoryRows([dnsRow], [dnsRow]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "job-dns-1");
});

test("purgeOperationalHistoryRows preserves latest resource jobs while deleting old history", async () => {
  const statements: string[] = [];
  const client = {
    query: async (statement: string, params?: unknown[]) => {
      statements.push(statement);
      assert.deepEqual(params, ["2026-01-30T00:00:00.000Z"]);

      if (statement.includes("latest_resource_jobs")) {
        assert.match(statement, /resource_key IS NOT NULL/);
        assert.match(statement, /jobs\.completed_at IS NOT NULL/);
        assert.match(statement, /jobs\.completed_at < \$1::timestamptz/);
        assert.match(statement, /NOT EXISTS/);

        return {
          rows: [
            {
              deleted_job_count: "3",
              deleted_job_result_count: "3",
              kept_latest_resource_job_count: "5"
            }
          ]
        };
      }

      if (statement.includes("latest_inventory_export")) {
        assert.match(statement, /event_type = 'inventory\.exported'/);
        assert.match(statement, /events\.occurred_at < \$1::timestamptz/);
        assert.match(statement, /NOT EXISTS/);

        return {
          rows: [
            {
              deleted_audit_event_count: "2"
            }
          ]
        };
      }

      throw new Error(`Unexpected purge query: ${statement}`);
    }
  } as unknown as PoolClient;

  const summary = await purgeOperationalHistoryRows(client, "2026-01-30T00:00:00.000Z");

  assert.equal(statements.length, 2);
  assert.deepEqual(summary, {
    deletedAuditEventCount: 2,
    deletedJobCount: 3,
    deletedJobResultCount: 3,
    keptLatestResourceJobCount: 5
  });
});

test("buildZoneDnsPlans publishes node hostnames and dispatches primary plus secondary plans", async () => {
  const client = {
    query: async (statement: string, params?: unknown[]) => {
      if (
        statement.includes("FROM shp_dns_zones zones") &&
        statement.includes("desired_updated_at")
      ) {
        return {
          rows: [
            {
              zone_name: "adudoc.com",
              primary_node_id: "primary",
              hostname: "vps-3dbbfb0b.vps.ovh.ca",
              public_ipv4: "51.222.204.86",
              wireguard_address: "10.89.0.1/24",
              desired_updated_at: "2026-04-26T02:00:00.000Z"
            }
          ]
        };
      }

      if (statement.includes("FROM shp_nodes") && statement.includes("CASE WHEN node_id = $1")) {
        assert.deepEqual(params, ["primary"]);
        return {
          rows: [
            {
              node_id: "primary",
              hostname: "vps-3dbbfb0b.vps.ovh.ca",
              public_ipv4: "51.222.204.86",
              wireguard_address: "10.89.0.1/24"
            },
            {
              node_id: "secondary",
              hostname: "vps-16535090.vps.ovh.ca",
              public_ipv4: "51.222.206.196",
              wireguard_address: "10.89.0.2/24"
            }
          ]
        };
      }

      if (statement.includes("FROM shp_dns_records records")) {
        return { rows: [] };
      }

      if (statement.includes("FROM shp_sites sites")) {
        return { rows: [] };
      }

      if (statement.includes("FROM shp_mail_domains domains")) {
        return { rows: [] };
      }

      if (statement.includes("FROM control_plane_job_results results")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query in buildZoneDnsPlans test: ${statement}`);
    }
  } as unknown as PoolClient;

  const plans = await buildZoneDnsPlans(client, "adudoc.com");

  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.map((plan) => plan.nodeId),
    ["primary", "secondary"]
  );
  assert.deepEqual(plans[0]?.payload.nameservers, [
    "vps-3dbbfb0b.vps.ovh.ca",
    "vps-16535090.vps.ovh.ca"
  ]);
  assert.deepEqual(plans[0]?.payload.primaryAddresses, ["51.222.204.86", "10.89.0.1"]);
  assert.equal(plans[0]?.payload.deliveryRole, "primary");
  assert.equal(plans[1]?.payload.deliveryRole, "secondary");
});
