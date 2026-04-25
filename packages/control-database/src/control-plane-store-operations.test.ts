import test from "node:test";
import assert from "node:assert/strict";

import type { PoolClient } from "pg";

import {
  createDefaultMailPolicy,
  createDispatchedJobEnvelope
} from "@simplehost/control-contracts";

import { createQueuedDispatchJob } from "./control-plane-store-helpers.js";
import {
  mergeJobHistoryRows,
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
