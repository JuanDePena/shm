import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMailZoneRecords,
  mergeDerivedDnsRecords,
  sanitizeDesiredStateSpecForExport,
  validateDesiredStateSpec,
  type MailDkimRuntimeRecord
} from "./control-plane-store-spec.js";
import {
  toBackupRunSummary,
  toInventoryExportSummary
} from "./control-plane-store-helpers.js";
import type { BackupRunRow } from "./control-plane-store-types.js";
import {
  minimumMailboxQuotaBytes,
  createDefaultMailPolicy,
  type DesiredStateSpec,
  type DnsRecordPayload
} from "@simplehost/control-contracts";

function createValidMailSpec(): DesiredStateSpec {
  return {
    tenants: [
      {
        slug: "acme",
        displayName: "Acme"
      }
    ],
    nodes: [
      {
        nodeId: "mail-a",
        hostname: "mail-a.example.com",
        publicIpv4: "203.0.113.10",
        wireguardAddress: "10.0.0.10/24"
      },
      {
        nodeId: "mail-b",
        hostname: "mail-b.example.com",
        publicIpv4: "203.0.113.11",
        wireguardAddress: "10.0.0.11/24"
      }
    ],
    zones: [
      {
        zoneName: "example.com",
        tenantSlug: "acme",
        primaryNodeId: "mail-a",
        records: []
      }
    ],
    apps: [],
    databases: [],
    backupPolicies: [],
    mailPolicy: createDefaultMailPolicy(),
    mailDomains: [
      {
        domainName: "example.com",
        tenantSlug: "acme",
        zoneName: "example.com",
        primaryNodeId: "mail-a",
        mailHost: "mail.example.com",
        dkimSelector: "mail"
      }
    ],
    mailboxes: [
      {
        address: "ops@example.com",
        domainName: "example.com",
        localPart: "ops",
        primaryNodeId: "mail-a",
        credentialState: "configured"
      }
    ],
    mailAliases: [],
    mailboxQuotas: [
      {
        mailboxAddress: "ops@example.com",
        storageBytes: minimumMailboxQuotaBytes
      }
    ]
  };
}

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

test("buildMailZoneRecords segments long DKIM TXT values into DNS-safe chunks", () => {
  const dkimRuntimeRecords: MailDkimRuntimeRecord[] = [
    {
      domainName: "adudoc.com",
      dkimDnsTxtValue: `v=DKIM1; k=rsa; p=${"a".repeat(520)}`
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
  const dkimRecord = records.find(
    (record) => record.name === "mail._domainkey" && record.type === "TXT"
  );

  assert.ok(dkimRecord);
  const segments = [...dkimRecord.value.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");

  assert.ok(segments.length > 1);
  assert.ok(segments.every((segment) => segment.length <= 255));
  assert.equal(segments.join(""), dkimRuntimeRecords[0]!.dkimDnsTxtValue);
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

test("mergeDerivedDnsRecords treats segmented explicit DKIM TXT overrides as authoritative", () => {
  const manualDkimValue = `"v=DKIM1; k=rsa; p=${"m".repeat(250)}" "${"m".repeat(120)}"`;
  const explicitRecords: DnsRecordPayload[] = [
    {
      name: "mail._domainkey",
      type: "TXT",
      value: manualDkimValue,
      ttl: 300
    }
  ];
  const derivedRecords: DnsRecordPayload[] = [
    {
      name: "mail._domainkey",
      type: "TXT",
      value: '"v=DKIM1; k=rsa; p=generated"',
      ttl: 300
    }
  ];

  const merged = mergeDerivedDnsRecords(explicitRecords, derivedRecords);

  assert.equal(
    merged.filter((record) => record.name === "mail._domainkey" && record.type === "TXT").length,
    1
  );
  assert.equal(
    merged.find((record) => record.name === "mail._domainkey" && record.type === "TXT")?.value,
    manualDkimValue
  );
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

test("toBackupRunSummary preserves mail backup details for dashboard restore readiness", () => {
  const row: BackupRunRow = {
    run_id: "backup-run-1",
    policy_slug: "mail-acme",
    node_id: "mail-a",
    status: "succeeded",
    summary: "Validated mailbox restore for ops@example.com",
    started_at: "2026-04-21T09:00:00.000Z",
    completed_at: "2026-04-21T09:12:00.000Z",
    details: {
      mail: {
        artifactPaths: {
          maildir: ["/srv/mail/vmail/example.com"],
          dkim: ["/srv/mail/dkim/example.com/mail.key"],
          runtimeConfig: ["/srv/mail/config"],
          webmailState: ["/srv/www/roundcube/_shared/roundcube.sqlite"]
        },
        restoreChecks: [
          {
            scope: "mailbox",
            target: "ops@example.com",
            status: "validated",
            summary: "Mailbox restore rehearsal completed.",
            validatedAt: "2026-04-21T09:10:00.000Z"
          }
        ]
      }
    }
  };

  const summary = toBackupRunSummary(row);

  assert.equal(summary.runId, "backup-run-1");
  assert.deepEqual(summary.details?.mail?.artifactPaths.maildir, [
    "/srv/mail/vmail/example.com"
  ]);
  assert.equal(summary.details?.mail?.restoreChecks[0]?.scope, "mailbox");
  assert.equal(
    summary.details?.mail?.restoreChecks[0]?.summary,
    "Mailbox restore rehearsal completed."
  );
});

test("sanitizeDesiredStateSpecForExport strips mailbox desired passwords only from operator exports", () => {
  const spec: DesiredStateSpec = {
    tenants: [
      {
        slug: "acme",
        displayName: "Acme"
      }
    ],
    nodes: [
      {
        nodeId: "mail-a",
        hostname: "mail-a.example.com",
        publicIpv4: "203.0.113.10",
        wireguardAddress: "10.0.0.10/24"
      }
    ],
    zones: [
      {
        zoneName: "example.com",
        tenantSlug: "acme",
        primaryNodeId: "mail-a",
        records: []
      }
    ],
    apps: [],
    databases: [
      {
        appSlug: "adudoc",
        engine: "postgresql",
        databaseName: "app_adudoc",
        databaseUser: "app_adudoc",
        primaryNodeId: "mail-a",
        desiredPassword: "db-secret"
      }
    ],
    backupPolicies: [],
    mailDomains: [
      {
        domainName: "example.com",
        tenantSlug: "acme",
        zoneName: "example.com",
        primaryNodeId: "mail-a",
        mailHost: "mail.example.com",
        dkimSelector: "mail"
      }
    ],
    mailboxes: [
      {
        address: "ops@example.com",
        domainName: "example.com",
        localPart: "ops",
        primaryNodeId: "mail-a",
        credentialState: "configured",
        desiredPassword: "mail-secret"
      },
      {
        address: "pending@example.com",
        domainName: "example.com",
        localPart: "pending",
        primaryNodeId: "mail-a",
        credentialState: "reset_required"
      }
    ],
    mailAliases: [],
    mailboxQuotas: []
  };

  const sanitized = sanitizeDesiredStateSpecForExport(spec);

  assert.equal(sanitized.mailboxes[0]?.desiredPassword, undefined);
  assert.equal(sanitized.mailboxes[0]?.credentialState, "configured");
  assert.equal(sanitized.mailboxes[1]?.desiredPassword, undefined);
  assert.equal(sanitized.databases[0]?.desiredPassword, "db-secret");
  assert.equal(spec.mailboxes[0]?.desiredPassword, "mail-secret");
  assert.notEqual(sanitized.mailboxes[0], spec.mailboxes[0]);
});

test("validateDesiredStateSpec rejects sender entries that are both allowlisted and denylisted", () => {
  const spec: DesiredStateSpec = {
    tenants: [],
    nodes: [],
    zones: [],
    apps: [],
    databases: [],
    backupPolicies: [],
    mailDomains: [],
    mailboxes: [],
    mailAliases: [],
    mailboxQuotas: [],
    mailPolicy: {
      ...createDefaultMailPolicy(),
      senderAllowlist: ["vip@example.com"],
      senderDenylist: ["vip@example.com"]
    }
  };

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /cannot be allowlisted and denylisted/i
  );
});

test("validateDesiredStateSpec rejects mail domains outside the current zone-apex model", () => {
  const spec = createValidMailSpec();

  spec.zones[0] = {
    ...spec.zones[0]!,
    zoneName: "platform.example.com"
  };
  spec.mailDomains[0] = {
    ...spec.mailDomains[0]!,
    zoneName: "platform.example.com"
  };

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /zone-apex mail domains/i
  );
});

test("validateDesiredStateSpec rejects mail domains with conflicting explicit MX records", () => {
  const spec = createValidMailSpec();

  spec.zones[0] = {
    ...spec.zones[0]!,
    records: [
      {
        name: "@",
        type: "MX",
        value: "10 mx.backup.example.net.",
        ttl: 300
      }
    ]
  };

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /keeps MX aligned/i
  );
});

test("validateDesiredStateSpec rejects alias loops", () => {
  const spec = createValidMailSpec();

  spec.mailAliases = [
    {
      address: "sales@example.com",
      domainName: "example.com",
      localPart: "sales",
      destinations: ["support@example.com"]
    },
    {
      address: "support@example.com",
      domainName: "example.com",
      localPart: "support",
      destinations: ["sales@example.com"]
    }
  ];

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /alias loop detected/i
  );
});

test("validateDesiredStateSpec rejects mailbox standby topology that diverges from its domain", () => {
  const spec = createValidMailSpec();

  spec.mailDomains[0] = {
    ...spec.mailDomains[0]!,
    standbyNodeId: "mail-b"
  };

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /must follow the same standby node/i
  );
});

test("validateDesiredStateSpec rejects mailbox quotas below the supported floor", () => {
  const spec = createValidMailSpec();

  spec.mailboxQuotas[0] = {
    mailboxAddress: "ops@example.com",
    storageBytes: minimumMailboxQuotaBytes - 1
  };

  assert.throws(
    () => validateDesiredStateSpec(spec),
    /must be at least/i
  );
});
