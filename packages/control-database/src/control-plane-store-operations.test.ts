import test from "node:test";
import assert from "node:assert/strict";

import type { PoolClient } from "pg";

import {
  createDefaultMailPolicy,
  createDispatchedJobEnvelope
} from "@simplehost/control-contracts";

import { createQueuedDispatchJob } from "./control-plane-store-helpers.js";
import { shouldDispatchQueuedJob } from "./control-plane-store-operations.js";

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
