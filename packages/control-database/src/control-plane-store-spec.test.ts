import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMailZoneRecords,
  mergeDerivedDnsRecords,
  type MailDkimRuntimeRecord
} from "./control-plane-store-spec.js";
import { toInventoryExportSummary } from "./control-plane-store-helpers.js";
import type { DnsRecordPayload } from "@simplehost/control-contracts";

test("buildMailZoneRecords derives phase-2 deliverability records", () => {
  const dkimRuntimeRecords: MailDkimRuntimeRecord[] = [
    {
      domainName: "adudoc.com",
      dkimDnsTxtValue: "v=DKIM1; k=rsa; p=abc123"
    }
  ];
  const records = buildMailZoneRecords(
    "adudoc.com",
    [
      {
        domain_name: "adudoc.com",
        tenant_slug: "adudoc",
        mail_host: "mail.adudoc.com",
        dkim_selector: "mail",
        primary_node_id: "primary",
        public_ipv4: "51.222.204.86"
      }
    ],
    dkimRuntimeRecords
  );

  assert.ok(records.find((record) => record.name === "mail" && record.type === "A"));
  assert.ok(records.find((record) => record.name === "webmail" && record.type === "A"));
  assert.ok(records.find((record) => record.name === "mta-sts" && record.type === "A"));
  assert.ok(
    records.find(
      (record) =>
        record.name === "_mta-sts" &&
        record.type === "TXT" &&
        record.value.includes("v=STSv1; id=")
    )
  );
  assert.ok(
    records.find(
      (record) =>
        record.name === "_smtp._tls" &&
        record.type === "TXT" &&
        record.value.includes("v=TLSRPTv1; rua=mailto:postmaster@adudoc.com")
    )
  );
  assert.ok(
    records.find(
      (record) =>
        record.name === "_dmarc" &&
        record.type === "TXT" &&
        record.value.includes("p=quarantine") &&
        record.value.includes("rua=mailto:postmaster@adudoc.com")
    )
  );
  assert.ok(
    records.find(
      (record) =>
        record.name === "mail._domainkey" &&
        record.type === "TXT" &&
        record.value === '"v=DKIM1; k=rsa; p=abc123"'
    )
  );
  assert.ok(
    records.find(
      (record) =>
        record.name === "@" && record.type === "TXT" && record.value === '"v=spf1 mx -all"'
    )
  );
});

test("mergeDerivedDnsRecords keeps explicit phase-2 TXT overrides authoritative", () => {
  const explicitRecords: DnsRecordPayload[] = [
    {
      name: "_mta-sts",
      type: "TXT",
      value: '"v=STSv1; id=manual"',
      ttl: 300
    },
    {
      name: "_smtp._tls",
      type: "TXT",
      value: '"v=TLSRPTv1; rua=mailto:security@adudoc.com"',
      ttl: 300
    },
    {
      name: "mail._domainkey",
      type: "TXT",
      value: '"v=DKIM1; k=rsa; p=manual"',
      ttl: 300
    }
  ];
  const derivedRecords: DnsRecordPayload[] = [
    {
      name: "_mta-sts",
      type: "TXT",
      value: '"v=STSv1; id=generated"',
      ttl: 300
    },
    {
      name: "_smtp._tls",
      type: "TXT",
      value: '"v=TLSRPTv1; rua=mailto:postmaster@adudoc.com"',
      ttl: 300
    },
    {
      name: "mail._domainkey",
      type: "TXT",
      value: '"v=DKIM1; k=rsa; p=generated"',
      ttl: 300
    }
  ];

  const merged = mergeDerivedDnsRecords(explicitRecords, derivedRecords);

  assert.equal(
    merged.filter((record) => record.name === "_mta-sts" && record.type === "TXT").length,
    1
  );
  assert.equal(
    merged.filter((record) => record.name === "_smtp._tls" && record.type === "TXT").length,
    1
  );
  assert.equal(
    merged.filter((record) => record.name === "mail._domainkey" && record.type === "TXT").length,
    1
  );
  assert.ok(merged.find((record) => record.value.includes("id=manual")));
  assert.ok(merged.find((record) => record.value.includes("security@adudoc.com")));
  assert.ok(merged.find((record) => record.value.includes("p=manual")));
});

test("toInventoryExportSummary reads audit-backed export metadata", () => {
  const summary = toInventoryExportSummary({
    event_id: "export-123",
    occurred_at: "2026-04-20T12:34:56Z",
    payload: {
      sourceKind: "desired_state_postgresql",
      summary: {
        tenantCount: 3,
        nodeCount: 2,
        zoneCount: 4,
        appCount: 5,
        siteCount: 5,
        databaseCount: 5
      }
    }
  });

  assert.deepEqual(summary, {
    exportId: "export-123",
    exportedAt: "2026-04-20T12:34:56.000Z",
    tenantCount: 3,
    nodeCount: 2,
    zoneCount: 4,
    appCount: 5,
    siteCount: 5,
    databaseCount: 5
  });
});
