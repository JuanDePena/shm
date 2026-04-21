import type { DnsRecordPayload } from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";

export type MailObservabilityStatus = "ready" | "warning" | "missing" | "unreported";

export interface MailDeliverabilityCheck {
  status: MailObservabilityStatus;
  detail?: string;
}

export interface MailDeliverabilityRow {
  domainName: string;
  zoneName: string;
  primaryNodeId: string;
  checkedAt?: string;
  queueMessageCount?: number;
  recentFailureCount: number;
  topDeferReason?: string;
  spf: MailDeliverabilityCheck;
  dkim: MailDeliverabilityCheck;
  dmarc: MailDeliverabilityCheck;
  mtaSts: MailDeliverabilityCheck;
  tlsRpt: MailDeliverabilityCheck;
  webmail: MailDeliverabilityCheck;
  runtime: MailDeliverabilityCheck;
}

export interface MailHaNodeRow {
  nodeId: string;
  deliveryRole: "primary" | "standby";
  checkedAt?: string;
  services: MailDeliverabilityCheck;
  runtimeConfig: MailDeliverabilityCheck;
  mailboxes: MailDeliverabilityCheck;
  dkim: MailDeliverabilityCheck;
  policyDocuments: MailDeliverabilityCheck;
  webmail: MailDeliverabilityCheck;
  promotionReady: MailDeliverabilityCheck;
  blockers: string[];
}

export interface MailHaRow {
  domainName: string;
  mailHost: string;
  webmailHostname: string;
  primaryNodeId: string;
  standbyNodeId?: string;
  primary: MailHaNodeRow;
  standby?: MailHaNodeRow;
}

export interface MailObservabilityModel {
  deliverabilityRows: MailDeliverabilityRow[];
  haRows: MailHaRow[];
  totalQueuedMessages: number;
  totalRecentFailures: number;
}

type DomainRuntimeMatch = {
  nodeId: string;
  mail: NonNullable<DashboardData["nodeHealth"][number]["mail"]>;
  managedDomain: NonNullable<DashboardData["nodeHealth"][number]["mail"]>["managedDomains"][number];
};

function ready(detail?: string): MailDeliverabilityCheck {
  return { status: "ready", detail };
}

function warning(detail?: string): MailDeliverabilityCheck {
  return { status: "warning", detail };
}

function missing(detail?: string): MailDeliverabilityCheck {
  return { status: "missing", detail };
}

function unreported(detail?: string): MailDeliverabilityCheck {
  return { status: "unreported", detail };
}

function resolveZoneRecordName(fqdn: string, zoneName: string): string | undefined {
  if (fqdn === zoneName) {
    return "@";
  }

  if (!fqdn.endsWith(`.${zoneName}`)) {
    return undefined;
  }

  return fqdn.slice(0, -(`.${zoneName}`).length);
}

function findRecord(
  records: DnsRecordPayload[] | undefined,
  zoneName: string,
  fqdn: string,
  type: DnsRecordPayload["type"],
  predicate: (value: string) => boolean
): boolean {
  const recordName = resolveZoneRecordName(fqdn, zoneName);

  if (!records || !recordName) {
    return false;
  }

  return records.some(
    (record) => record.type === type && record.name === recordName && predicate(record.value)
  );
}

function statusFromPresence(
  sourceAvailable: boolean,
  present: boolean,
  detail?: string
): MailDeliverabilityCheck {
  if (!sourceAvailable) {
    return unreported(detail);
  }

  return present ? ready(detail) : missing(detail);
}

function combineStatus(
  left: MailDeliverabilityCheck,
  right: MailDeliverabilityCheck,
  detail?: string
): MailDeliverabilityCheck {
  if (left.status === "unreported" && right.status === "unreported") {
    return unreported(detail);
  }

  if (left.status === "ready" && right.status === "ready") {
    return ready(detail);
  }

  if (
    (left.status === "ready" && right.status === "unreported") ||
    (left.status === "unreported" && right.status === "ready")
  ) {
    return warning(detail);
  }

  if (left.status === "missing" || right.status === "missing") {
    return missing(detail);
  }

  return warning(detail);
}

function getLatestAppliedDnsRecordsByZone(
  data: DashboardData
): Map<string, DnsRecordPayload[]> {
  const latestRecordsByZone = new Map<
    string,
    { occurredAt: number; records: DnsRecordPayload[] }
  >();

  for (const job of data.jobHistory) {
    if (job.kind !== "dns.sync" || job.status !== "applied") {
      continue;
    }

    const zoneName = typeof job.payload.zoneName === "string" ? job.payload.zoneName : undefined;
    const records = Array.isArray(job.payload.records)
      ? (job.payload.records.filter(
          (record): record is DnsRecordPayload =>
            Boolean(record) &&
            typeof record === "object" &&
            typeof (record as Record<string, unknown>).name === "string" &&
            typeof (record as Record<string, unknown>).type === "string" &&
            typeof (record as Record<string, unknown>).value === "string" &&
            typeof (record as Record<string, unknown>).ttl === "number"
        ) as DnsRecordPayload[])
      : undefined;

    if (!zoneName || !records) {
      continue;
    }

    const occurredAt = Date.parse(job.completedAt ?? job.createdAt);
    const previous = latestRecordsByZone.get(zoneName);

    if (previous && previous.occurredAt >= occurredAt) {
      continue;
    }

    latestRecordsByZone.set(zoneName, {
      occurredAt,
      records
    });
  }

  return new Map(
    Array.from(latestRecordsByZone.entries(), ([zoneName, value]) => [
      zoneName,
      value.records
    ])
  );
}

function findDomainRuntime(
  data: DashboardData,
  domainName: string,
  primaryNodeId: string
): DomainRuntimeMatch | undefined {
  const exactPrimary = findDomainRuntimeOnNode(data, domainName, primaryNodeId);

  if (exactPrimary) {
    return exactPrimary;
  }

  for (const node of data.nodeHealth) {
    const managedDomain = node.mail?.managedDomains.find((domain) => domain.domainName === domainName);

    if (node.mail && managedDomain) {
      return {
        nodeId: node.nodeId,
        mail: node.mail,
        managedDomain
      };
    }
  }

  return undefined;
}

function findDomainRuntimeOnNode(
  data: DashboardData,
  domainName: string,
  nodeId: string
): DomainRuntimeMatch | undefined {
  const exactPrimary = data.nodeHealth.find(
    (node) =>
      node.nodeId === nodeId &&
      node.mail?.managedDomains.some((domain) => domain.domainName === domainName)
  );

  if (exactPrimary?.mail) {
    const managedDomain = exactPrimary.mail.managedDomains.find(
      (domain) => domain.domainName === domainName
    );

    if (managedDomain) {
      return {
        nodeId: exactPrimary.nodeId,
        mail: exactPrimary.mail,
        managedDomain
      };
    }
  }

  return undefined;
}

function buildMailHaNodeRow(args: {
  runtime: DomainRuntimeMatch | undefined;
  nodeId: string;
  deliveryRole: "primary" | "standby";
}): MailHaNodeRow {
  const { runtime, nodeId, deliveryRole } = args;

  if (!runtime) {
    return {
      nodeId,
      deliveryRole,
      services: unreported("No node runtime snapshot for this mail role."),
      runtimeConfig: unreported("No node runtime snapshot for this mail role."),
      mailboxes: unreported("No node runtime snapshot for this mail role."),
      dkim: unreported("No node runtime snapshot for this mail role."),
      policyDocuments: unreported("No node runtime snapshot for this mail role."),
      webmail: unreported("No node runtime snapshot for this mail role."),
      promotionReady: unreported("No node runtime snapshot for this mail role."),
      blockers: ["No node runtime snapshot for this mail role."]
    };
  }

  const servicesReady =
    runtime.mail.postfixActive &&
    runtime.mail.dovecotActive &&
    runtime.mail.rspamdActive &&
    runtime.mail.redisActive &&
    runtime.mail.firewallConfigured === true;
  const runtimeConfig = statusFromPresence(
    true,
    runtime.managedDomain.runtimeConfigPresent === true && runtime.mail.runtimeConfigPresent === true,
    runtime.mail.runtimeConfigPresent
      ? "Generated Postfix, Dovecot, and Rspamd config is present."
      : "Generated mail runtime config is incomplete."
  );
  const mailboxes = statusFromPresence(
    true,
    runtime.managedDomain.mailboxesReady === true,
    runtime.managedDomain.mailboxesReady
      ? "Expected Maildir scaffolds are present on this node."
      : "One or more expected Maildir trees are missing."
  );
  const dkim = statusFromPresence(
    true,
    Boolean(runtime.managedDomain.dkimAvailable || runtime.managedDomain.dkimDnsTxtValue),
    runtime.managedDomain.dkimAvailable
      ? "DKIM key material is present."
      : "DKIM key material is missing."
  );
  const policyDocuments = statusFromPresence(
    true,
    runtime.managedDomain.mtaStsPolicyPresent === true,
    runtime.managedDomain.mtaStsPolicyPresent
      ? "The node-local MTA-STS policy is present."
      : "The node-local MTA-STS policy is missing."
  );
  const webmail = statusFromPresence(
    true,
    runtime.mail.webmailHealthy === true && runtime.managedDomain.webmailDocumentPresent === true,
    runtime.mail.webmailHealthy && runtime.managedDomain.webmailDocumentPresent
      ? "Roundcube and the domain webmail root are present."
      : "Roundcube or the domain webmail root is incomplete."
  );
  const blockers = runtime.managedDomain.promotionBlockers ?? [];

  return {
    nodeId,
    deliveryRole,
    checkedAt: runtime.mail.checkedAt,
    services: statusFromPresence(
      true,
      servicesReady,
      servicesReady
        ? "Postfix, Dovecot, Rspamd, Redis, and firewall policy are active."
        : "Core mail services or firewall policy are not fully active."
    ),
    runtimeConfig,
    mailboxes,
    dkim,
    policyDocuments,
    webmail,
    promotionReady: statusFromPresence(
      true,
      runtime.managedDomain.promotionReady === true,
      runtime.managedDomain.promotionReady
        ? "This node satisfies the current promotion checks."
        : blockers[0] ?? "This node is not ready for mail promotion."
    ),
    blockers
  };
}

export function buildMailObservabilityModel(data: DashboardData): MailObservabilityModel {
  const dnsRecordsByZone = getLatestAppliedDnsRecordsByZone(data);
  const deliverabilityRows: MailDeliverabilityRow[] = data.mail.domains.map((domain) => {
    const runtime = findDomainRuntime(data, domain.domainName, domain.primaryNodeId);
    const dnsRecords = dnsRecordsByZone.get(domain.zoneName);
    const dnsReported = Boolean(dnsRecords);
    const spf = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, domain.domainName, "TXT", (value) =>
        value.toLowerCase().includes("v=spf1")
      ),
      dnsReported ? "Derived SPF TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const dmarc = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_dmarc.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=dmarc1")
      ),
      dnsReported ? "DMARC TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const tlsRpt = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_smtp._tls.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=tlsrptv1")
      ),
      dnsReported ? "TLS-RPT TXT in last applied dns.sync." : "No applied dns.sync payload."
    );
    const mtaStsDns = statusFromPresence(
      dnsReported,
      findRecord(dnsRecords, domain.zoneName, `_mta-sts.${domain.domainName}`, "TXT", (value) =>
        value.toLowerCase().includes("v=stsv1")
      ) &&
        findRecord(dnsRecords, domain.zoneName, `mta-sts.${domain.domainName}`, "A", () => true),
      dnsReported
        ? "MTA-STS TXT and host A record in last applied dns.sync."
        : "No applied dns.sync payload."
    );
    const dkim = runtime
      ? statusFromPresence(
          true,
          Boolean(runtime.managedDomain.dkimAvailable || runtime.managedDomain.dkimDnsTxtValue),
          "DKIM TXT reported by SimpleHost Agent."
        )
      : unreported("No node runtime snapshot for the domain.");
    const mtaStsPolicy = runtime
      ? statusFromPresence(
          true,
          Boolean(runtime.managedDomain.mtaStsPolicyPresent),
          "Node-local mta-sts.txt policy document."
        )
      : unreported("No node runtime snapshot for the domain.");
    const mtaSts = combineStatus(mtaStsDns, mtaStsPolicy, "DNS posture plus local policy document.");
    const webmail = runtime
      ? runtime.mail.webmailHealthy && runtime.managedDomain.webmailDocumentPresent
        ? ready("Roundcube deployment and domain document root are present.")
        : runtime.mail.roundcubeDeployment === "packaged" || runtime.mail.webmailHealthy
          ? warning("Roundcube is present but the domain root looks incomplete.")
          : missing("Roundcube is not fully deployed on the primary node.")
      : unreported("No node runtime snapshot for the domain.");
    const runtimeStatus = runtime
      ? runtime.mail.postfixActive && runtime.mail.dovecotActive && runtime.mail.rspamdActive
        ? ready("Postfix, Dovecot, and Rspamd are active.")
        : warning("One or more core mail services are not active.")
      : unreported("No node runtime snapshot for the domain.");

    return {
      domainName: domain.domainName,
      zoneName: domain.zoneName,
      primaryNodeId: domain.primaryNodeId,
      checkedAt: runtime?.mail.checkedAt,
      queueMessageCount: runtime?.mail.queue?.messageCount,
      recentFailureCount: runtime?.mail.recentDeliveryFailures?.length ?? 0,
      topDeferReason: runtime?.mail.queue?.topDeferReasons[0],
      spf,
      dkim,
      dmarc,
      mtaSts,
      tlsRpt,
      webmail,
      runtime: runtimeStatus
    };
  });
  const haRows: MailHaRow[] = data.mail.domains.map((domain) => {
    const primaryRuntime = findDomainRuntimeOnNode(data, domain.domainName, domain.primaryNodeId);
    const standbyRuntime = domain.standbyNodeId
      ? findDomainRuntimeOnNode(data, domain.domainName, domain.standbyNodeId)
      : undefined;
    const primary = buildMailHaNodeRow({
      runtime: primaryRuntime,
      nodeId: domain.primaryNodeId,
      deliveryRole: "primary"
    });
    const standby = domain.standbyNodeId
      ? buildMailHaNodeRow({
          runtime: standbyRuntime,
          nodeId: domain.standbyNodeId,
          deliveryRole: "standby"
        })
      : undefined;

    return {
      domainName: domain.domainName,
      mailHost: domain.mailHost,
      webmailHostname: primaryRuntime?.managedDomain.webmailHostname ?? `webmail.${domain.domainName}`,
      primaryNodeId: domain.primaryNodeId,
      standbyNodeId: domain.standbyNodeId,
      primary,
      standby
    };
  });

  return {
    deliverabilityRows,
    haRows,
    totalQueuedMessages: data.nodeHealth.reduce(
      (total, node) => total + (node.mail?.queue?.messageCount ?? 0),
      0
    ),
    totalRecentFailures: data.nodeHealth.reduce(
      (total, node) => total + (node.mail?.recentDeliveryFailures?.length ?? 0),
      0
    )
  };
}

export function toneForMailObservabilityStatus(
  status: MailObservabilityStatus
): "success" | "danger" | "muted" | "default" {
  switch (status) {
    case "ready":
      return "success";
    case "warning":
      return "default";
    case "missing":
      return "danger";
    case "unreported":
    default:
      return "muted";
  }
}
