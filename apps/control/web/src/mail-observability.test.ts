import assert from "node:assert/strict";
import test from "node:test";

import { type DashboardData } from "./api-client.js";
import {
  buildMailObservabilityModel,
  toneForMailObservabilityStatus
} from "./mail-observability.js";

function createDashboardData(): DashboardData {
  return {
    currentUser: {
      userId: "user-1",
      email: "ops@example.com",
      displayName: "Ops",
      globalRoles: ["platform_admin"],
      memberships: []
    },
    overview: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      nodeCount: 1,
      pendingJobCount: 0,
      failedJobCount: 0,
      backupPolicyCount: 0,
      driftedResourceCount: 0
    },
    inventory: {
      latestImport: null,
      latestExport: null,
      nodes: [],
      zones: [],
      apps: [],
      databases: []
    },
    desiredState: {
      exportedAt: "2026-04-21T00:00:00.000Z",
      summary: {
        tenantCount: 1,
        nodeCount: 1,
        zoneCount: 1,
        recordCount: 0,
        appCount: 0,
        databaseCount: 0,
        backupPolicyCount: 0,
        mailDomainCount: 1,
        mailboxCount: 1,
        mailAliasCount: 0,
        mailboxQuotaCount: 0
      },
      spec: {
        tenants: [
          {
            slug: "acme",
            displayName: "Acme"
          }
        ],
        nodes: [
          {
            nodeId: "mail-a",
            hostname: "mail-a.example.net",
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
        databases: [],
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
            credentialState: "configured"
          }
        ],
        mailAliases: [],
        mailboxQuotas: []
      },
      yaml: "mailDomains: []"
    },
    drift: [],
    nodeHealth: [
      {
        nodeId: "mail-a",
        hostname: "mail-a.example.net",
        desiredRole: "inventory",
        pendingJobCount: 0,
        mail: {
          postfixServiceName: "postfix",
          postfixEnabled: true,
          postfixActive: true,
          dovecotServiceName: "dovecot",
          dovecotEnabled: true,
          dovecotActive: true,
          rspamdServiceName: "rspamd",
          rspamdEnabled: true,
          rspamdActive: true,
          redisServiceName: "valkey",
          redisEnabled: true,
          redisActive: true,
          desiredStatePresent: true,
          runtimeConfigPresent: true,
          roundcubeDeployment: "packaged",
          webmailHealthy: true,
          firewallConfigured: true,
          policyDocumentCount: 1,
          healthyPolicyDocumentCount: 1,
          queue: {
            messageCount: 3,
            activeCount: 1,
            deferredCount: 2,
            holdCount: 0,
            incomingCount: 0,
            maildropCount: 0,
            topDeferReasons: ["connect to mx.remote.test timed out"]
          },
          recentDeliveryFailures: [
            {
              occurredAt: "2026-04-21T08:00:00.000Z",
              status: "deferred",
              recipient: "user@remote.test",
              reason: "connect to mx.remote.test timed out"
            }
          ],
          managedDomains: [
            {
              domainName: "example.com",
              mailHost: "mail.example.com",
              webmailHostname: "webmail.example.com",
              mtaStsHostname: "mta-sts.example.com",
              deliveryRole: "primary",
              mailboxCount: 1,
              aliasCount: 0,
              dkimSelector: "mail",
              dkimDnsTxtValue: "v=DKIM1; k=rsa; p=abc123",
              dkimAvailable: true,
              dmarcReportAddress: "postmaster@example.com",
              tlsReportAddress: "postmaster@example.com",
              mtaStsMode: "enforce",
              mtaStsMaxAgeSeconds: 86400,
              runtimeConfigPresent: true,
              maildirRoot: "/srv/mail/vmail/example.com",
              mailboxesReady: true,
              webmailDocumentRoot: "/srv/www/roundcube/acme/example.com/public",
              webmailDocumentPresent: true,
              mtaStsDocumentRoot: "/srv/www/mail-policies/acme/example.com/public",
              mtaStsPolicyPath:
                "/srv/www/mail-policies/acme/example.com/public/.well-known/mta-sts.txt",
              mtaStsPolicyPresent: true,
              promotionReady: true,
              promotionBlockers: []
            }
          ],
          checkedAt: "2026-04-21T09:00:00.000Z"
        }
      }
    ],
    jobHistory: [
      {
        jobId: "job-dns-1",
        desiredStateVersion: "v1",
        kind: "dns.sync",
        nodeId: "mail-a",
        createdAt: "2026-04-21T07:55:00.000Z",
        completedAt: "2026-04-21T07:56:00.000Z",
        status: "applied",
        payload: {
          zoneName: "example.com",
          serial: 2026042101,
          nameservers: ["ns1.example.com"],
          records: [
            { name: "@", type: "TXT", value: "\"v=spf1 mx -all\"", ttl: 300 },
            {
              name: "_dmarc",
              type: "TXT",
              value: "\"v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com\"",
              ttl: 300
            },
            {
              name: "_mta-sts",
              type: "TXT",
              value: "\"v=STSv1; id=abc123\"",
              ttl: 300
            },
            {
              name: "_smtp._tls",
              type: "TXT",
              value: "\"v=TLSRPTv1; rua=mailto:postmaster@example.com\"",
              ttl: 300
            },
            {
              name: "mta-sts",
              type: "A",
              value: "203.0.113.10",
              ttl: 300
            }
          ]
        }
      }
    ],
    auditEvents: [],
    backups: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      policies: [],
      latestRuns: []
    },
    rustdesk: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      keyConsistency: "unknown",
      nodes: []
    },
    mail: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      domains: [
        {
          domainName: "example.com",
          tenantSlug: "acme",
          zoneName: "example.com",
          primaryNodeId: "mail-a",
          mailHost: "mail.example.com",
          dkimSelector: "mail",
          mailboxCount: 1,
          aliasCount: 0
        }
      ],
      mailboxes: [
        {
          address: "ops@example.com",
          domainName: "example.com",
          localPart: "ops",
          primaryNodeId: "mail-a",
          hasCredential: true,
          credentialState: "configured"
        }
      ],
      aliases: [],
      quotas: []
    },
    packages: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      nodeCount: 1,
      packageCount: 0,
      packages: []
    }
  } as unknown as DashboardData;
}

test("buildMailObservabilityModel marks a fully reported mail domain as ready", () => {
  const model = buildMailObservabilityModel(createDashboardData());
  const row = model.deliverabilityRows[0];
  const haRow = model.haRows[0];

  assert.ok(row);
  assert.ok(haRow);
  assert.equal(row.spf.status, "ready");
  assert.equal(row.dkim.status, "ready");
  assert.equal(row.dmarc.status, "ready");
  assert.equal(row.mtaSts.status, "ready");
  assert.equal(row.tlsRpt.status, "ready");
  assert.equal(row.webmail.status, "ready");
  assert.equal(row.runtime.status, "ready");
  assert.equal(row.queueMessageCount, 3);
  assert.equal(row.recentFailureCount, 1);
  assert.equal(row.topDeferReason, "connect to mx.remote.test timed out");
  assert.equal(model.totalQueuedMessages, 3);
  assert.equal(model.totalRecentFailures, 1);
  assert.equal(haRow.primary.services.status, "ready");
  assert.equal(haRow.primary.promotionReady.status, "ready");
});

test("buildMailObservabilityModel marks deliverability as unreported without dns or runtime data", () => {
  const data = createDashboardData();
  data.jobHistory = [];
  data.nodeHealth = [];

  const model = buildMailObservabilityModel(data);
  const row = model.deliverabilityRows[0];

  assert.ok(row);
  assert.equal(row.spf.status, "unreported");
  assert.equal(row.dkim.status, "unreported");
  assert.equal(row.dmarc.status, "unreported");
  assert.equal(row.mtaSts.status, "unreported");
  assert.equal(row.tlsRpt.status, "unreported");
  assert.equal(row.webmail.status, "unreported");
  assert.equal(row.runtime.status, "unreported");
  assert.equal(model.totalQueuedMessages, 0);
  assert.equal(model.totalRecentFailures, 0);
});

test("buildMailObservabilityModel uses the latest applied dns.sync per zone", () => {
  const data = createDashboardData();

  data.jobHistory = [
    {
      jobId: "job-dns-old",
      desiredStateVersion: "v0",
      kind: "dns.sync",
      nodeId: "mail-a",
      createdAt: "2026-04-20T07:55:00.000Z",
      completedAt: "2026-04-20T07:56:00.000Z",
      status: "applied",
      payload: {
        zoneName: "example.com",
        serial: 2026042001,
        nameservers: ["ns1.example.com"],
        records: []
      }
    },
    ...data.jobHistory
  ];

  const model = buildMailObservabilityModel(data);
  const row = model.deliverabilityRows[0];

  assert.ok(row);
  assert.equal(row.spf.status, "ready");
  assert.equal(row.dmarc.status, "ready");
  assert.equal(row.mtaSts.status, "ready");
  assert.equal(row.tlsRpt.status, "ready");
});

test("buildMailObservabilityModel reports standby promotion readiness when both mail roles are present", () => {
  const data = createDashboardData();

  data.desiredState.spec.nodes.push({
    nodeId: "mail-b",
    hostname: "mail-b.example.net",
    publicIpv4: "203.0.113.11",
    wireguardAddress: "10.0.0.11/24"
  });
  data.desiredState.summary.nodeCount = 2;
  data.mail.domains[0] = {
    ...data.mail.domains[0],
    standbyNodeId: "mail-b"
  };
  data.mail.mailboxes[0] = {
    ...data.mail.mailboxes[0],
    standbyNodeId: "mail-b"
  };
  data.nodeHealth = [
    {
      ...data.nodeHealth[0]!,
      mail: {
        ...data.nodeHealth[0]!.mail!,
        firewallConfigured: true,
        runtimeConfigPresent: true,
        managedDomains: [
          {
            ...data.nodeHealth[0]!.mail!.managedDomains[0]!,
            runtimeConfigPresent: true,
            maildirRoot: "/srv/mail/vmail/example.com",
            mailboxesReady: true,
            promotionReady: true,
            promotionBlockers: []
          }
        ]
      }
    },
    {
      nodeId: "mail-b",
      hostname: "mail-b.example.net",
      desiredRole: "inventory",
      pendingJobCount: 0,
      mail: {
        ...data.nodeHealth[0]!.mail!,
        checkedAt: "2026-04-21T09:05:00.000Z",
        firewallConfigured: true,
        runtimeConfigPresent: true,
        managedDomains: [
          {
            ...data.nodeHealth[0]!.mail!.managedDomains[0]!,
            deliveryRole: "standby",
            runtimeConfigPresent: true,
            maildirRoot: "/srv/mail/vmail/example.com",
            mailboxesReady: true,
            promotionReady: true,
            promotionBlockers: []
          }
        ]
      }
    }
  ];

  const model = buildMailObservabilityModel(data);
  const haRow = model.haRows[0];

  assert.ok(haRow);
  assert.equal(haRow.primary.promotionReady.status, "ready");
  assert.equal(haRow.standby?.promotionReady.status, "ready");
  assert.equal(haRow.standby?.runtimeConfig.status, "ready");
  assert.equal(haRow.standby?.mailboxes.status, "ready");
});

test("toneForMailObservabilityStatus maps states to the expected UI tones", () => {
  assert.equal(toneForMailObservabilityStatus("ready"), "success");
  assert.equal(toneForMailObservabilityStatus("warning"), "default");
  assert.equal(toneForMailObservabilityStatus("missing"), "danger");
  assert.equal(toneForMailObservabilityStatus("unreported"), "muted");
});
