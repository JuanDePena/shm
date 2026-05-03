import type { DashboardData } from "./api-client.js";
import { buildMailObservabilityModel } from "./mail-observability.js";

export interface MailReleaseBaselineCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface MailReleaseBaselineResult {
  ok: boolean;
  detail: string;
  checks: MailReleaseBaselineCheck[];
}

export function createMailReleaseBaselineData(): DashboardData {
  return {
    currentUser: {
      userId: "user-1",
      email: "ops@example.com",
      displayName: "Ops",
      status: "active",
      globalRoles: ["platform_admin"],
      tenantMemberships: []
    },
    users: [
      {
        userId: "user-1",
        email: "ops@example.com",
        displayName: "Ops",
        status: "active",
        globalRoles: ["platform_admin"],
        tenantMemberships: []
      }
    ],
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
          firewallExpectedPorts: [25, 465, 587, 993, 995],
          firewallOpenPorts: [25, 465, 587, 993, 995],
          portListeners: [
            {
              label: "smtp",
              protocol: "tcp",
              port: 25,
              exposure: "public",
              addresses: ["0.0.0.0"],
              listening: true
            },
            {
              label: "submissions",
              protocol: "tcp",
              port: 465,
              exposure: "public",
              addresses: ["0.0.0.0"],
              listening: true
            },
            {
              label: "submission",
              protocol: "tcp",
              port: 587,
              exposure: "public",
              addresses: ["0.0.0.0"],
              listening: true
            },
            {
              label: "imaps",
              protocol: "tcp",
              port: 993,
              exposure: "public",
              addresses: ["0.0.0.0"],
              listening: true
            },
            {
              label: "pop3s",
              protocol: "tcp",
              port: 995,
              exposure: "public",
              addresses: ["0.0.0.0"],
              listening: true
            },
            {
              label: "rspamd-milter",
              protocol: "tcp",
              port: 11332,
              exposure: "local",
              addresses: ["127.0.0.1"],
              listening: true
            }
          ],
          milter: {
            endpoint: "inet:127.0.0.1:11332",
            postfixConfigured: true,
            rspamdConfigPresent: true,
            listenerReady: true
          },
          policyDocumentCount: 1,
          healthyPolicyDocumentCount: 1,
          queue: {
            messageCount: 1,
            activeCount: 1,
            deferredCount: 0,
            holdCount: 0,
            incomingCount: 0,
            maildropCount: 0,
            topDeferReasons: []
          },
          recentDeliveryFailures: [],
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
            { name: "@", type: "MX", value: "10 mail.example.com.", ttl: 300 },
            { name: "mail", type: "A", value: "203.0.113.10", ttl: 300 },
            { name: "@", type: "TXT", value: "\"v=spf1 mx \" \"-all\"", ttl: 300 },
            {
              name: "_dmarc",
              type: "TXT",
              value: "\"v=DMARC1; p=quarantine; rua=mailto:postmaster@\" \"example.com\"",
              ttl: 300
            },
            {
              name: "_mta-sts",
              type: "TXT",
              value: "\"v=STSv1; \" \"id=abc123\"",
              ttl: 300
            },
            {
              name: "_smtp._tls",
              type: "TXT",
              value: "\"v=TLSRPTv1; rua=mailto:postmaster@\" \"example.com\"",
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
    },
    parameters: {
      generatedAt: "2026-04-21T00:00:00.000Z",
      parameterCount: 0,
      runtimeCount: 0,
      uiManagedCount: 0,
      parameters: []
    }
  } as unknown as DashboardData;
}

export function runMailReleaseBaseline(): MailReleaseBaselineResult {
  const model = buildMailObservabilityModel(createMailReleaseBaselineData());
  const deliverability = model.deliverabilityRows[0];
  const ha = model.haRows[0];
  const validation = model.validationRows[0];
  const checks: MailReleaseBaselineCheck[] = [
    {
      name: "deliverability",
      ok: Boolean(
        deliverability &&
          deliverability.spf.status === "ready" &&
          deliverability.dkim.status === "ready" &&
          deliverability.dmarc.status === "ready" &&
          deliverability.mtaSts.status === "ready" &&
          deliverability.tlsRpt.status === "ready"
      ),
      detail: deliverability
        ? `${deliverability.domainName} reports SPF, DKIM, DMARC, MTA-STS, and TLS-RPT as ready.`
        : "No deliverability row was produced for the release baseline."
    },
    {
      name: "runtime",
      ok: Boolean(
        deliverability &&
          deliverability.runtime.status === "ready" &&
          deliverability.webmail.status === "ready"
      ),
      detail: deliverability
        ? `${deliverability.domainName} runtime reports ready services, listeners, firewall, milter, and webmail posture.`
        : "No runtime row was produced for the release baseline."
    },
    {
      name: "validation",
      ok: Boolean(validation && validation.warningCount === 0 && validation.dispatchWarningCount === 0),
      detail: validation
        ? `${validation.domainName} has ${validation.warningCount} total warnings and ${validation.dispatchWarningCount} dispatch blockers.`
        : "No validation row was produced for the release baseline."
    },
    {
      name: "ha-primary",
      ok: Boolean(
        ha &&
          ha.primary.services.status === "ready" &&
          ha.primary.promotionReady.status === "ready"
      ),
      detail: ha
        ? `${ha.domainName} primary readiness is ${ha.primary.promotionReady.status}.`
        : "No HA row was produced for the release baseline."
    }
  ];
  const failedChecks = checks.filter((check) => !check.ok);

  return {
    ok: failedChecks.length === 0,
    detail:
      failedChecks.length === 0
        ? `Mail baseline passed (${checks.length}/${checks.length}): ${checks.map((check) => check.name).join(", ")}.`
        : `Mail baseline failed: ${failedChecks.map((check) => `${check.name} (${check.detail})`).join("; ")}`,
    checks
  };
}
