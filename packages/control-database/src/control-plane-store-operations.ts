import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  type CodeServerUpdatePayload,
  type ContainerReconcilePayload,
  createDefaultMailPolicy,
  createDispatchedJobEnvelope,
  type DnsSyncPayload,
  type Fail2BanApplyPayload,
  type FirewallApplyPayload,
  type PackageInstallPayload,
  type PackageInventoryCollectPayload,
  type MailSyncPayload,
  type ProxyRenderPayload,
  type ResourceDriftSummary
} from "@simplehost/control-contracts";

import { requireAuthorizedUser } from "./control-plane-store-auth.js";
import { insertAuditEvent, withTransaction } from "./control-plane-store-db.js";
import {
  createDesiredStateVersion,
  createQueuedDispatchJob,
  createResourceDriftSummary,
  decodeDesiredPassword,
  encodeStoredJobPayload,
  encodeDesiredPassword,
  sanitizePayload,
  toInstalledPackageSummary,
  toAuditEventSummary,
  toBackupPolicySummary,
  toBackupRunSummary,
  toDispatchedJob,
  toJobHistoryEntry,
  toNodeHealthSnapshot,
  toReconciliationRunSummary,
  toRegisteredNodeState,
  toReportedJobResult
} from "./control-plane-store-helpers.js";
import {
  buildMailMtaStsHostname,
  buildMailPolicyDocumentRoot,
  buildMailReportAddress,
  buildMailWebDocumentRoot,
  buildMailZoneRecords,
  buildZoneRecords,
  mergeDerivedDnsRecords
} from "./control-plane-store-spec.js";
import type {
  AppContainerDispatchRow,
  AppDispatchRow,
  AppServiceGapRow,
  AuditEventRow,
  BackupPolicyRow,
  BackupRunRow,
  ControlPlaneOperationsMethods,
  DatabaseDispatchRow,
  DriftStatusRow,
  InventoryNodeRow,
  InventoryRecordRow,
  InstalledPackageRow,
  JobHistoryRow,
  JobRow,
  MailAliasRow,
  MailDnsDomainRow,
  MailDomainRow,
  MailPolicyRow,
  MailProxyDispatchRow,
  MailboxQuotaRow,
  MailboxRow,
  NodeHealthRow,
  NodeRow,
  QueuedDispatchJob,
  ReconciliationRunRow,
  ResultRow,
  ZoneDispatchRow
} from "./control-plane-store-types.js";

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate?.code === "42P01" &&
    typeof candidate.message === "string" &&
    candidate.message.includes(`"${relationName}"`)
  );
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate?.code === "42703" &&
    typeof candidate.message === "string" &&
    candidate.message.includes(columnName)
  );
}

async function hasMailPolicyTable(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.shp_mail_policy') IS NOT NULL AS exists`
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasMailboxCredentialStateColumn(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'shp_mailbox_credentials'
         AND column_name = 'credential_state'
     ) AS exists`
  );

  return Boolean(result.rows[0]?.exists);
}

async function queryMailPolicyRows(client: PoolClient): Promise<MailPolicyRow[]> {
  if (!(await hasMailPolicyTable(client))) {
    return [];
  }

  const result = await client.query<MailPolicyRow>(
    `SELECT
       policy_id,
       reject_threshold,
       add_header_threshold,
       greylist_threshold,
       sender_allowlist,
       sender_denylist,
       rate_limit_burst,
       rate_limit_period_seconds
     FROM shp_mail_policy
     WHERE policy_id = 'mail-policy'`
  );

  return result.rows;
}

async function queryMailboxRows(client: PoolClient): Promise<MailboxRow[]> {
  const hasCredentialState = await hasMailboxCredentialStateColumn(client);
  const result = await client.query<MailboxRow>(
    hasCredentialState
      ? `SELECT
         mailboxes.address,
         domains.domain_name,
         mailboxes.local_part,
         mailboxes.primary_node_id,
         mailboxes.standby_node_id,
         credentials.secret_payload AS desired_password,
         credentials.credential_state,
         credentials.updated_at AS credential_updated_at
       FROM shp_mailboxes mailboxes
       INNER JOIN shp_mail_domains domains
         ON domains.mail_domain_id = mailboxes.mail_domain_id
       LEFT JOIN shp_mailbox_credentials credentials
         ON credentials.mailbox_id = mailboxes.mailbox_id
       ORDER BY mailboxes.address ASC`
      : `SELECT
         mailboxes.address,
         domains.domain_name,
         mailboxes.local_part,
         mailboxes.primary_node_id,
         mailboxes.standby_node_id,
         credentials.secret_payload AS desired_password,
         NULL::text AS credential_state,
         credentials.updated_at AS credential_updated_at
       FROM shp_mailboxes mailboxes
       INNER JOIN shp_mail_domains domains
         ON domains.mail_domain_id = mailboxes.mail_domain_id
       LEFT JOIN shp_mailbox_credentials credentials
         ON credentials.mailbox_id = mailboxes.mailbox_id
       ORDER BY mailboxes.address ASC`
  );

  return result.rows;
}

export function mergeJobHistoryRows(
  recentRows: JobHistoryRow[],
  latestAppliedDnsRows: JobHistoryRow[]
): JobHistoryRow[] {
  const rowsById = new Map<string, JobHistoryRow>();

  for (const row of [...recentRows, ...latestAppliedDnsRows]) {
    rowsById.set(row.id, row);
  }

  return [...rowsById.values()].sort((left, right) => {
    const createdAtDiff =
      Date.parse(String(right.created_at)) - Date.parse(String(left.created_at));

    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return right.id.localeCompare(left.id);
  });
}

export async function buildMailSyncPlans(
  client: PoolClient,
  payloadKey: Buffer | null
): Promise<Array<{ nodeId: string; payload: MailSyncPayload }>> {
  const [mailDomainResult, mailboxResult, aliasResult, quotaResult, mailPolicyResult] =
    await Promise.all([
    client.query<MailDomainRow>(
      `SELECT
         domains.domain_name,
         tenants.slug AS tenant_slug,
         zones.zone_name,
         domains.primary_node_id,
         domains.standby_node_id,
         domains.mail_host,
         domains.dkim_selector
       FROM shp_mail_domains domains
       INNER JOIN shp_tenants tenants
         ON tenants.tenant_id = domains.tenant_id
       INNER JOIN shp_dns_zones zones
         ON zones.zone_id = domains.zone_id
       ORDER BY domains.domain_name ASC`
    ),
    queryMailboxRows(client),
    client.query<MailAliasRow>(
      `SELECT
         aliases.address,
         domains.domain_name,
         aliases.local_part,
         aliases.destinations
       FROM shp_mail_aliases aliases
       INNER JOIN shp_mail_domains domains
         ON domains.mail_domain_id = aliases.mail_domain_id
       ORDER BY aliases.address ASC`
    ),
    client.query<MailboxQuotaRow>(
      `SELECT
         mailboxes.address AS mailbox_address,
         quotas.storage_bytes
       FROM shp_mailbox_quotas quotas
       INNER JOIN shp_mailboxes mailboxes
         ON mailboxes.mailbox_id = quotas.mailbox_id
       ORDER BY mailboxes.address ASC`
    ),
    queryMailPolicyRows(client)
  ]);

  const defaultMailPolicy = createDefaultMailPolicy();
  const mailPolicyRow = mailPolicyResult[0];
  const mailPolicy: MailSyncPayload["policy"] = {
    rejectThreshold: Number(mailPolicyRow?.reject_threshold ?? defaultMailPolicy.rejectThreshold),
    addHeaderThreshold: Number(
      mailPolicyRow?.add_header_threshold ?? defaultMailPolicy.addHeaderThreshold
    ),
    greylistThreshold:
      mailPolicyRow?.greylist_threshold === null || mailPolicyRow?.greylist_threshold === undefined
        ? undefined
        : Number(mailPolicyRow.greylist_threshold),
    senderAllowlist: [...new Set(mailPolicyRow?.sender_allowlist ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    senderDenylist: [...new Set(mailPolicyRow?.sender_denylist ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    rateLimit:
      mailPolicyRow?.rate_limit_burst && mailPolicyRow?.rate_limit_period_seconds
        ? {
            burst: Number(mailPolicyRow.rate_limit_burst),
            periodSeconds: Number(mailPolicyRow.rate_limit_period_seconds)
          }
        : undefined
  };

  const quotasByMailbox = new Map(
    quotaResult.rows.map((row) => [row.mailbox_address, Number(row.storage_bytes)] as const)
  );
  const mailboxesByDomain = new Map<
    string,
    Array<MailSyncPayload["domains"][number]["mailboxes"][number]>
  >();
  const aliasesByDomain = new Map<
    string,
    Array<MailSyncPayload["domains"][number]["aliases"][number]>
  >();

  for (const mailbox of mailboxResult) {
    const entries = mailboxesByDomain.get(mailbox.domain_name) ?? [];
    const credentialState =
      mailbox.credential_state === "missing" ||
      mailbox.credential_state === "configured" ||
      mailbox.credential_state === "reset_required"
        ? mailbox.credential_state
        : mailbox.desired_password
          ? "configured"
          : "missing";
    entries.push({
      address: mailbox.address,
      localPart: mailbox.local_part,
      credentialState,
      desiredPassword: mailbox.desired_password
        ? decodeDesiredPassword(mailbox.desired_password, payloadKey) ?? undefined
        : undefined,
      quotaBytes: quotasByMailbox.get(mailbox.address)
    });
    mailboxesByDomain.set(mailbox.domain_name, entries);
  }

  for (const alias of aliasResult.rows) {
    const entries = aliasesByDomain.get(alias.domain_name) ?? [];
    entries.push({
      address: alias.address,
      localPart: alias.local_part,
      destinations: alias.destinations
    });
    aliasesByDomain.set(alias.domain_name, entries);
  }

  const plansByNode = new Map<string, MailSyncPayload["domains"]>();

  for (const domain of mailDomainResult.rows) {
    const domainMailboxes = mailboxesByDomain.get(domain.domain_name) ?? [];
    const domainAliases = aliasesByDomain.get(domain.domain_name) ?? [];
    const targets: Array<{ nodeId: string; deliveryRole: "primary" | "standby" }> = [
      {
        nodeId: domain.primary_node_id,
        deliveryRole: "primary"
      }
    ];

    if (
      domain.standby_node_id &&
      domain.standby_node_id !== domain.primary_node_id
    ) {
      targets.push({
        nodeId: domain.standby_node_id,
        deliveryRole: "standby"
      });
    }

    for (const target of targets) {
      const entries = plansByNode.get(target.nodeId) ?? [];
      entries.push({
        domainName: domain.domain_name,
        tenantSlug: domain.tenant_slug,
        zoneName: domain.zone_name,
        mailHost: domain.mail_host,
        webmailHostname: `webmail.${domain.domain_name}`,
        mtaStsHostname: buildMailMtaStsHostname(domain.domain_name),
        dkimSelector: domain.dkim_selector,
        dmarcReportAddress: buildMailReportAddress(domain.domain_name),
        tlsReportAddress: buildMailReportAddress(domain.domain_name),
        mtaStsMode: "enforce",
        mtaStsMaxAgeSeconds: 86400,
        deliveryRole: target.deliveryRole,
        mailboxes: domainMailboxes,
        aliases: domainAliases
      });
      plansByNode.set(target.nodeId, entries);
    }
  }

  return [...plansByNode.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([nodeId, domains]) => ({
      nodeId,
      payload: {
        policy: mailPolicy,
        domains: domains.sort((left, right) => {
          const keyLeft = `${left.domainName}:${left.deliveryRole}`;
          const keyRight = `${right.domainName}:${right.deliveryRole}`;
          return keyLeft.localeCompare(keyRight);
        })
      }
    }));
}

export async function buildMailProxyPlans(
  client: PoolClient
): Promise<Array<{ nodeId: string; resourceKey: string; payload: ProxyRenderPayload }>> {
  const result = await client.query<MailProxyDispatchRow>(
    `SELECT
       domains.domain_name,
       tenants.slug AS tenant_slug,
       domains.primary_node_id,
       domains.standby_node_id
     FROM shp_mail_domains domains
     INNER JOIN shp_tenants tenants
       ON tenants.tenant_id = domains.tenant_id
     ORDER BY domains.domain_name ASC`
  );
  const plans: Array<{ nodeId: string; resourceKey: string; payload: ProxyRenderPayload }> = [];

  for (const domain of result.rows) {
    const payload: ProxyRenderPayload = {
      vhostName: `webmail-${domain.domain_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`,
      serverName: `webmail.${domain.domain_name}`,
      documentRoot: buildMailWebDocumentRoot(domain.tenant_slug, domain.domain_name),
      tls: true
    };
    const policyPayload: ProxyRenderPayload = {
      vhostName: `mta-sts-${domain.domain_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`,
      serverName: buildMailMtaStsHostname(domain.domain_name),
      documentRoot: buildMailPolicyDocumentRoot(domain.tenant_slug, domain.domain_name),
      tls: true
    };
    const targets = [domain.primary_node_id];

    if (
      domain.standby_node_id &&
      domain.standby_node_id !== domain.primary_node_id
    ) {
      targets.push(domain.standby_node_id);
    }

    for (const nodeId of targets) {
      plans.push({
        nodeId,
        resourceKey: `mail:${domain.domain_name}:webmail:${nodeId}`,
        payload
      });
      plans.push({
        nodeId,
        resourceKey: `mail:${domain.domain_name}:mta-sts:${nodeId}`,
        payload: policyPayload
      });
    }
  }

  return plans.sort((left, right) =>
    `${left.resourceKey}:${left.nodeId}`.localeCompare(`${right.resourceKey}:${right.nodeId}`)
  );
}

export async function buildZoneDnsPlans(
  client: PoolClient,
  zoneName: string
): Promise<Array<{ nodeId: string; payload: DnsSyncPayload }>> {
  const zoneResult = await client.query<ZoneDispatchRow>(
    `SELECT
       zones.zone_name,
       zones.primary_node_id,
       nodes.hostname,
       nodes.public_ipv4,
       nodes.wireguard_address,
       GREATEST(
         zones.updated_at,
         nodes.updated_at,
         COALESCE(MAX(records.updated_at), zones.updated_at),
         COALESCE(MAX(mail_domains.updated_at), zones.updated_at),
         COALESCE(MAX(mail_nodes.updated_at), zones.updated_at),
         COALESCE(MAX(apps.updated_at), zones.updated_at),
         COALESCE(MAX(sites.updated_at), zones.updated_at)
       ) AS desired_updated_at
     FROM shp_dns_zones zones
     INNER JOIN shp_nodes nodes
       ON nodes.node_id = zones.primary_node_id
     LEFT JOIN shp_dns_records records
       ON records.zone_id = zones.zone_id
     LEFT JOIN shp_mail_domains mail_domains
       ON mail_domains.zone_id = zones.zone_id
     LEFT JOIN shp_nodes mail_nodes
       ON mail_nodes.node_id = mail_domains.primary_node_id
     LEFT JOIN shp_apps apps
       ON apps.zone_id = zones.zone_id
     LEFT JOIN shp_sites sites
       ON sites.app_id = apps.app_id
     WHERE zones.zone_name = $1
     GROUP BY
       zones.zone_name,
       zones.primary_node_id,
       nodes.hostname,
       nodes.public_ipv4,
       nodes.wireguard_address,
       nodes.updated_at,
       zones.updated_at`,
    [zoneName]
  );
  const zone = zoneResult.rows[0];

  if (!zone) {
    throw new Error(`Zone ${zoneName} does not exist in SimpleHost Control inventory.`);
  }

  const nodeResult = await client.query<InventoryNodeRow>(
    `SELECT
       node_id,
       hostname,
       public_ipv4,
       wireguard_address
     FROM shp_nodes
     ORDER BY
       CASE WHEN node_id = $1 THEN 0 ELSE 1 END,
       node_id ASC`,
    [zone.primary_node_id]
  );
  const targetNodes = nodeResult.rows;
  const nameservers = targetNodes.map((row) => row.hostname).slice(0, 2);

  if (nameservers.length < 2) {
    throw new Error(
      `Zone ${zoneName} requires at least two inventory nodes to publish authoritative nameservers.`
    );
  }

  const primaryAddresses = Array.from(
    new Set(
      [zone.public_ipv4, stripCidrSuffix(zone.wireguard_address)].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  if (primaryAddresses.length === 0) {
    throw new Error(`Zone ${zoneName} does not have any reachable primary node addresses.`);
  }

  const recordResult = await client.query<InventoryRecordRow>(
    `SELECT
       zones.zone_name,
       records.name,
       records.type,
       records.value,
       records.ttl
     FROM shp_dns_records records
     INNER JOIN shp_dns_zones zones
       ON zones.zone_id = records.zone_id
     WHERE zones.zone_name = $1
     ORDER BY records.name ASC, records.type ASC, records.value ASC`,
    [zoneName]
  );
  const siteResult = await client.query<{
    canonical_domain: string;
    aliases: string[];
  }>(
    `SELECT sites.canonical_domain, sites.aliases
     FROM shp_sites sites
     INNER JOIN shp_apps apps
       ON apps.app_id = sites.app_id
     INNER JOIN shp_dns_zones zones
       ON zones.zone_id = apps.zone_id
     WHERE zones.zone_name = $1
     ORDER BY sites.canonical_domain ASC`,
    [zoneName]
  );
  const mailDomainResult = await client.query<MailDnsDomainRow>(
    `SELECT
       domains.domain_name,
       tenants.slug AS tenant_slug,
       domains.mail_host,
       domains.dkim_selector,
       domains.primary_node_id,
       nodes.public_ipv4
     FROM shp_mail_domains domains
     INNER JOIN shp_tenants tenants
       ON tenants.tenant_id = domains.tenant_id
     INNER JOIN shp_nodes nodes
       ON nodes.node_id = domains.primary_node_id
     INNER JOIN shp_dns_zones zones
       ON zones.zone_id = domains.zone_id
     WHERE zones.zone_name = $1
     ORDER BY domains.domain_name ASC`,
    [zoneName]
  );
  const mailRuntimeRows =
    mailDomainResult.rows.length > 0
      ? (
          await client.query<ResultRow>(
          `SELECT results.job_id,
                  results.kind,
                  results.node_id,
                  results.status,
                  results.summary,
                  results.details,
                  results.completed_at
             FROM control_plane_job_results results
            WHERE results.kind = 'mail.sync'
              AND results.status = 'applied'
              AND results.node_id = ANY($1::text[])
            ORDER BY results.completed_at DESC`,
          [mailDomainResult.rows.map((row) => row.primary_node_id)]
        )
        ).rows
      : [];
  const explicitRecords = recordResult.rows.map((row) => ({
    name: row.name,
    type: row.type,
    value: row.value,
    ttl: row.ttl
  }));
  const derivedSiteRecords = zone.public_ipv4
      ? buildZoneRecords(zoneName, zone.public_ipv4, siteResult.rows)
      : [];
  const latestMailRuntimeByNode = new Map<string, ResultRow>();

  for (const row of mailRuntimeRows) {
    if (!latestMailRuntimeByNode.has(row.node_id)) {
      latestMailRuntimeByNode.set(row.node_id, row);
    }
  }

  const dkimRuntimeRecords = mailDomainResult.rows.flatMap((domain) => {
    const latestResult = latestMailRuntimeByNode.get(domain.primary_node_id);
    const details = latestResult?.details;

    if (!details || Array.isArray(details)) {
      return [];
    }

    const domains = (details as Record<string, unknown>).domains;

    if (!Array.isArray(domains)) {
      return [];
    }

    const match = domains.find((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return false;
      }

      return (entry as Record<string, unknown>).domainName === domain.domain_name;
    }) as Record<string, unknown> | undefined;

    if (!match || typeof match.dkimDnsTxtValue !== "string") {
      return [];
    }

    return [
      {
        domainName: domain.domain_name,
        dkimDnsTxtValue: match.dkimDnsTxtValue
      }
    ];
  });
  const derivedMailRecords = buildMailZoneRecords(
    zoneName,
    mailDomainResult.rows,
    dkimRuntimeRecords
  );
  const payloadBase: Omit<DnsSyncPayload, "deliveryRole"> = {
    zoneName,
    serial: Math.max(1, Math.floor(new Date(zone.desired_updated_at).getTime() / 1000)),
    nameservers,
    primaryAddresses,
    records: mergeDerivedDnsRecords(explicitRecords, [
      ...derivedSiteRecords,
      ...derivedMailRecords
    ])
  };

  return targetNodes.map((node) => ({
    nodeId: node.node_id,
    payload: {
      ...payloadBase,
      deliveryRole: node.node_id === zone.primary_node_id ? "primary" : "secondary"
    }
  }));
}

function stripCidrSuffix(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const [address] = value.split("/", 1);
  return address?.trim() || undefined;
}

export async function buildProxyPayload(
  client: PoolClient,
  appSlug: string
): Promise<{
  plans: Array<{ nodeId: string; payload: ProxyRenderPayload }>;
  zoneName: string;
}> {
  const result = await client.query<AppDispatchRow>(
    `SELECT
       apps.app_id,
       apps.slug,
       apps.backend_port,
       apps.runtime_image,
       apps.primary_node_id,
       apps.standby_node_id,
       apps.mode,
       zones.zone_name,
       sites.canonical_domain,
       sites.aliases,
       apps.storage_root
     FROM shp_apps apps
     INNER JOIN shp_sites sites
       ON sites.app_id = apps.app_id
     INNER JOIN shp_dns_zones zones
       ON zones.zone_id = apps.zone_id
     WHERE apps.slug = $1`,
    [appSlug]
  );
  const app = result.rows[0];

  if (!app) {
    throw new Error(`Application ${appSlug} does not exist in SimpleHost Control inventory.`);
  }

  const payload: ProxyRenderPayload = {
    vhostName: app.slug,
    serverName: app.canonical_domain,
    serverAliases: app.aliases,
    documentRoot: `${app.storage_root}/current/public`,
    proxyPassUrl: `http://127.0.0.1:${app.backend_port}`,
    proxyPreserveHost: true,
    tls: true
  };
  const plans = [
    {
      nodeId: app.primary_node_id,
      payload
    }
  ];

  if (
    app.mode === "active-passive" &&
    app.standby_node_id &&
    app.standby_node_id !== app.primary_node_id
  ) {
    plans.push({
      nodeId: app.standby_node_id,
      payload
    });
  }

  return {
    zoneName: app.zone_name,
    plans
  };
}

export async function buildAppContainerPlans(
  client: PoolClient,
  appSlug: string,
  payloadKey: Buffer | null
): Promise<{
  plans: Array<{ nodeId: string; payload: ContainerReconcilePayload }>;
  credentialMissing: boolean;
}> {
  const result = await client.query<AppContainerDispatchRow>(
    `SELECT
       apps.slug,
       apps.backend_port,
       apps.runtime_image,
       apps.storage_root,
       apps.primary_node_id,
       apps.standby_node_id,
       apps.mode,
       sites.canonical_domain,
       sites.aliases,
       databases.engine AS database_engine,
       databases.database_name,
       databases.database_user,
       databases.primary_node_id AS database_primary_node_id,
       nodes.wireguard_address AS database_primary_wireguard_address,
       credentials.secret_payload AS desired_password
     FROM shp_apps apps
     INNER JOIN shp_sites sites
       ON sites.app_id = apps.app_id
     LEFT JOIN shp_databases databases
       ON databases.app_id = apps.app_id
     LEFT JOIN shp_nodes nodes
       ON nodes.node_id = databases.primary_node_id
     LEFT JOIN shp_database_credentials credentials
       ON credentials.database_id = databases.database_id
     WHERE apps.slug = $1`,
    [appSlug]
  );
  const app = result.rows[0];

  if (!app) {
    throw new Error(`Application ${appSlug} does not exist in SimpleHost Control inventory.`);
  }

  const desiredPassword = decodeDesiredPassword(app.desired_password, payloadKey);

  if (
    app.database_engine &&
    (!app.database_name ||
      !app.database_user ||
      !stripCidrSuffix(app.database_primary_wireguard_address) ||
      !desiredPassword)
  ) {
    return {
      plans: [],
      credentialMissing: true
    };
  }

  const environment: Record<string, string> = {
    APP_NAME: app.slug,
    APP_ENV: "production",
    APP_URL: `https://${app.canonical_domain}`,
    APP_CANONICAL_DOMAIN: app.canonical_domain,
    APP_ALIASES: app.aliases.join(","),
    APP_DATA_DIR: `${app.storage_root}/app`,
    APP_UPLOADS_DIR: `${app.storage_root}/uploads`,
    APP_SERVICE_NAME: `app-${app.slug}.service`,
    APP_CONTAINER_NAME: `app-${app.slug}`
  };

  if (
    app.database_engine &&
    app.database_name &&
    app.database_user &&
    desiredPassword
  ) {
    environment.DB_ENGINE = app.database_engine;
    environment.DB_HOST = stripCidrSuffix(app.database_primary_wireguard_address) ?? "127.0.0.1";
    environment.DB_PORT = app.database_engine === "postgresql" ? "5432" : "3306";
    environment.DB_NAME = app.database_name;
    environment.DB_USER = app.database_user;
    environment.DB_PASSWORD = desiredPassword;
  }

  const payload: ContainerReconcilePayload = {
    serviceName: `app-${app.slug}.service`,
    containerName: `app-${app.slug}`,
    image: app.runtime_image,
    description: `Managed app runtime for ${app.slug}`,
    publishPorts: [`127.0.0.1:${app.backend_port}:80`],
    volumes: [
      `${app.storage_root}/app:/var/www/html:Z`,
      `${app.storage_root}/uploads:/var/www/html/public/uploads:Z`,
      `${app.storage_root}/uploads:/var/www/html/storage/uploads:Z`
    ],
    hostDirectories: [
      app.storage_root,
      `${app.storage_root}/app`,
      `${app.storage_root}/uploads`
    ],
    environment,
    envFileName: `app-${app.slug}.env`,
    restart: "always",
    restartSec: 5,
    wantedBy: "multi-user.target",
    enable: true,
    start: true
  };
  const plans = [
    {
      nodeId: app.primary_node_id,
      payload
    }
  ];

  if (
    app.mode === "active-passive" &&
    app.standby_node_id &&
    app.standby_node_id !== app.primary_node_id
  ) {
    plans.push({
      nodeId: app.standby_node_id,
      payload
    });
  }

  return {
    plans,
    credentialMissing: false
  };
}

export async function buildDatabasePayload(
  client: PoolClient,
  appSlug: string,
  password: string | null,
  payloadKey: Buffer | null
): Promise<{
  nodeId: string;
  kind: "postgres.reconcile" | "mariadb.reconcile";
  payload: Record<string, unknown>;
}> {
  const result = await client.query<DatabaseDispatchRow>(
    `SELECT
       apps.slug,
       databases.database_id,
       databases.engine,
       databases.database_name,
       databases.database_user,
       databases.primary_node_id,
       credentials.secret_payload AS desired_password
     FROM shp_databases databases
     INNER JOIN shp_apps apps
       ON apps.app_id = databases.app_id
     LEFT JOIN shp_database_credentials credentials
       ON credentials.database_id = databases.database_id
     WHERE apps.slug = $1`,
    [appSlug]
  );
  const database = result.rows[0];

  if (!database) {
    throw new Error(`Database for application ${appSlug} does not exist in SimpleHost Control inventory.`);
  }

  const desiredPassword =
    password ?? decodeDesiredPassword(database.desired_password, payloadKey);

  if (!desiredPassword) {
    throw new Error(
      `Database ${database.database_name} does not have a desired password stored in SimpleHost Control.`
    );
  }

  if (database.engine === "postgresql") {
    return {
      nodeId: database.primary_node_id,
      kind: "postgres.reconcile",
      payload: {
        appSlug: database.slug,
        databaseName: database.database_name,
        roleName: database.database_user,
        password: desiredPassword
      }
    };
  }

  return {
    nodeId: database.primary_node_id,
    kind: "mariadb.reconcile",
    payload: {
      appSlug: database.slug,
      databaseName: database.database_name,
      userName: database.database_user,
      password: desiredPassword
    }
  };
}

export async function ensureControlPlaneTargetNode(
  client: PoolClient,
  nodeId: string,
  timestamp: string
): Promise<void> {
  const nodeResult = await client.query<InventoryNodeRow>(
    `SELECT node_id, hostname, public_ipv4, wireguard_address
     FROM shp_nodes
     WHERE node_id = $1`,
    [nodeId]
  );
  const node = nodeResult.rows[0];

  if (!node) {
    throw new Error(`Managed node ${nodeId} does not exist in SimpleHost Control inventory.`);
  }

  await client.query(
    `INSERT INTO control_plane_nodes (
       node_id,
       hostname,
       version,
       supported_job_kinds,
       accepted_at,
       last_seen_at
     )
     VALUES ($1, $2, 'inventory', '[]'::jsonb, $3, $3)
     ON CONFLICT (node_id) DO NOTHING`,
    [nodeId, node.hostname, timestamp]
  );
}

export async function insertDispatchedJobs(
  client: PoolClient,
  jobs: QueuedDispatchJob[],
  actorUserId: string | null,
  dispatchReason: string,
  payloadKey: Buffer | null
): Promise<void> {
  const createdAt = new Date().toISOString();

  for (const nodeId of new Set(jobs.map((job) => job.envelope.nodeId))) {
    await ensureControlPlaneTargetNode(client, nodeId, createdAt);
  }

  for (const job of jobs) {
    await client.query(
      `INSERT INTO control_plane_jobs (
         id,
         desired_state_version,
         kind,
         node_id,
         created_at,
         payload,
         dispatched_by_user_id,
         dispatch_reason,
         resource_key,
         resource_kind,
         payload_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)`,
      [
        job.envelope.id,
        job.envelope.desiredStateVersion,
        job.envelope.kind,
        job.envelope.nodeId,
        job.envelope.createdAt,
        JSON.stringify(encodeStoredJobPayload(job.envelope.payload, payloadKey)),
        actorUserId,
        dispatchReason,
        job.resourceKey,
        job.resourceKind,
        job.payloadHash
      ]
    );

    await insertAuditEvent(client, {
      actorType: actorUserId ? "user" : "system",
      actorId: actorUserId ?? "reconciler",
      eventType: "job.dispatched",
      entityType: "job",
      entityId: job.envelope.id,
      payload: {
        kind: job.envelope.kind,
        nodeId: job.envelope.nodeId,
        dispatchReason,
        resourceKey: job.resourceKey
      },
      occurredAt: job.envelope.createdAt
    });
  }
}

async function resolveTargetNodeIds(
  client: PoolClient,
  requestedNodeIds: string[] | undefined,
  emptyMessage: string
): Promise<string[]> {
  const uniqueRequestedNodeIds = Array.from(
    new Set((requestedNodeIds ?? []).map((value) => value.trim()).filter(Boolean))
  );
  const nodeResult = uniqueRequestedNodeIds.length > 0
    ? await client.query<{ node_id: string }>(
        `SELECT node_id
         FROM shp_nodes
         WHERE node_id = ANY($1::text[])
         ORDER BY node_id ASC`,
        [uniqueRequestedNodeIds]
      )
    : await client.query<{ node_id: string }>(
        `SELECT node_id
         FROM shp_nodes
         ORDER BY node_id ASC`
      );
  const targetNodeIds = nodeResult.rows.map((row) => row.node_id);

  if (uniqueRequestedNodeIds.length > 0 && targetNodeIds.length !== uniqueRequestedNodeIds.length) {
    const missingNodeIds = uniqueRequestedNodeIds.filter(
      (nodeId) => !targetNodeIds.includes(nodeId)
    );
    throw new Error(`Unknown target node(s): ${missingNodeIds.join(", ")}.`);
  }

  if (targetNodeIds.length === 0) {
    throw new Error(emptyMessage);
  }

  return targetNodeIds;
}

export async function shouldDispatchQueuedJob(
  client: PoolClient,
  job: QueuedDispatchJob
): Promise<boolean> {
  const result = await client.query<DriftStatusRow>(
    `SELECT
       jobs.id,
       jobs.payload_hash,
       jobs.completed_at,
       results.status,
       results.summary
     FROM control_plane_jobs jobs
     LEFT JOIN control_plane_job_results results
       ON results.job_id = jobs.id
     WHERE jobs.node_id = $1
       AND jobs.kind = $2
       AND jobs.resource_key = $3
     ORDER BY jobs.created_at DESC
     LIMIT 1`,
    [job.envelope.nodeId, job.envelope.kind, job.resourceKey]
  );
  const latest = result.rows[0];

  if (!latest) {
    return true;
  }

  if (!latest.completed_at) {
    return latest.payload_hash !== job.payloadHash;
  }

  if (latest.payload_hash !== job.payloadHash) {
    return true;
  }

  return latest.status !== "applied";
}

export async function getLatestResourceJob(
  client: PoolClient,
  job: QueuedDispatchJob
): Promise<DriftStatusRow | null> {
  const result = await client.query<DriftStatusRow>(
    `SELECT
       jobs.id,
       jobs.payload_hash,
       jobs.completed_at,
       results.status,
       results.summary
     FROM control_plane_jobs jobs
     LEFT JOIN control_plane_job_results results
       ON results.job_id = jobs.id
     WHERE jobs.node_id = $1
       AND jobs.kind = $2
       AND jobs.resource_key = $3
     ORDER BY jobs.created_at DESC
     LIMIT $4`,
    [job.envelope.nodeId, job.envelope.kind, job.resourceKey, 1]
  );

  return result.rows[0] ?? null;
}

export async function getLatestReconciliationRun(
  client: PoolClient
): Promise<ReturnType<typeof toReconciliationRunSummary> | null> {
  const result = await client.query<ReconciliationRunRow>(
    `SELECT
       run_id,
       desired_state_version,
       generated_job_count,
       skipped_job_count,
       missing_credential_count,
       summary,
       started_at,
       completed_at
     FROM shp_reconciliation_runs
     ORDER BY completed_at DESC
     LIMIT 1`
  );

  return result.rows[0] ? toReconciliationRunSummary(result.rows[0]) : null;
}

export async function listAppContainerCredentialGaps(
  client: PoolClient
): Promise<Array<{ resourceKey: string; nodeId: string }>> {
  const result = await client.query<AppServiceGapRow>(
    `SELECT
       apps.slug,
       apps.primary_node_id,
       apps.standby_node_id,
       apps.mode
     FROM shp_apps apps
     INNER JOIN shp_databases databases
       ON databases.app_id = apps.app_id
     LEFT JOIN shp_database_credentials credentials
       ON credentials.database_id = databases.database_id
     WHERE credentials.database_id IS NULL
     ORDER BY apps.slug ASC`
  );
  const gaps: Array<{ resourceKey: string; nodeId: string }> = [];

  for (const row of result.rows) {
    gaps.push({
      resourceKey: `app:${row.slug}:container:${row.primary_node_id}`,
      nodeId: row.primary_node_id
    });

    if (
      row.mode === "active-passive" &&
      row.standby_node_id &&
      row.standby_node_id !== row.primary_node_id
    ) {
      gaps.push({
        resourceKey: `app:${row.slug}:container:${row.standby_node_id}`,
        nodeId: row.standby_node_id
      });
    }
  }

  return gaps;
}

export async function buildReconciliationCandidates(
  client: PoolClient,
  payloadKey: Buffer | null,
  desiredStateVersion: string
): Promise<{ jobs: QueuedDispatchJob[]; missingCredentialCount: number }> {
  const jobs: QueuedDispatchJob[] = [];
  let missingCredentialCount = 0;
  const zoneResult = await client.query<{ zone_name: string }>(
    `SELECT zone_name
     FROM shp_dns_zones
     ORDER BY zone_name ASC`
  );

  for (const row of zoneResult.rows) {
    for (const plan of await buildZoneDnsPlans(client, row.zone_name)) {
      if (plan.payload.records.length === 0) {
        continue;
      }

      jobs.push(
        createQueuedDispatchJob(
          createDispatchedJobEnvelope(
            "dns.sync",
            plan.nodeId,
            desiredStateVersion,
            plan.payload as unknown as Record<string, unknown>
          ),
          `zone:${row.zone_name}`,
          "dns"
        )
      );
    }
  }

  const appResult = await client.query<{ slug: string }>(
    `SELECT slug
     FROM shp_apps
     ORDER BY slug ASC`
  );

  for (const row of appResult.rows) {
    const plan = await buildProxyPayload(client, row.slug);
    const containerPlans = await buildAppContainerPlans(client, row.slug, payloadKey);

    for (const target of plan.plans) {
      jobs.push(
        createQueuedDispatchJob(
          createDispatchedJobEnvelope(
            "proxy.render",
            target.nodeId,
            desiredStateVersion,
            target.payload as unknown as Record<string, unknown>
          ),
          `app:${row.slug}:proxy:${target.nodeId}`,
          "site"
        )
      );
    }

    for (const target of containerPlans.plans) {
      jobs.push(
        createQueuedDispatchJob(
          createDispatchedJobEnvelope(
            "container.reconcile",
            target.nodeId,
            desiredStateVersion,
            target.payload as unknown as Record<string, unknown>
          ),
          `app:${row.slug}:container:${target.nodeId}`,
          "site"
        )
      );
    }
  }

  const databaseResult = await client.query<{ slug: string }>(
    `SELECT apps.slug
     FROM shp_databases databases
     INNER JOIN shp_apps apps
       ON apps.app_id = databases.app_id
     ORDER BY apps.slug ASC`
  );

  for (const row of databaseResult.rows) {
    try {
      const plan = await buildDatabasePayload(client, row.slug, null, payloadKey);
      jobs.push(
        createQueuedDispatchJob(
          createDispatchedJobEnvelope(
            plan.kind,
            plan.nodeId,
            desiredStateVersion,
            plan.payload
          ),
          `database:${row.slug}`,
          "database"
        )
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("does not have a desired password stored in SimpleHost Control")
      ) {
        missingCredentialCount += 1;
        continue;
      }

      throw error;
    }
  }

  for (const plan of await buildMailSyncPlans(client, payloadKey)) {
    if (plan.payload.domains.length === 0) {
      continue;
    }

    jobs.push(
      createQueuedDispatchJob(
        createDispatchedJobEnvelope(
          "mail.sync",
          plan.nodeId,
          desiredStateVersion,
          plan.payload as unknown as Record<string, unknown>
        ),
        `mail:${plan.nodeId}`,
        "mail"
      )
    );
  }

  for (const plan of await buildMailProxyPlans(client)) {
    jobs.push(
      createQueuedDispatchJob(
        createDispatchedJobEnvelope(
          "proxy.render",
          plan.nodeId,
          desiredStateVersion,
          plan.payload as unknown as Record<string, unknown>
        ),
        plan.resourceKey,
        "mail"
      )
    );
  }

  return {
    jobs,
    missingCredentialCount
  };
}

const resourceDriftCacheTtlMs = 60 * 1000;

interface ResourceDriftCacheEntry {
  expiresAtMs: number;
  promise: Promise<ResourceDriftSummary[]>;
}

function sortResourceDriftSummaries(
  summaries: ResourceDriftSummary[]
): ResourceDriftSummary[] {
  return summaries.sort((left, right) =>
    `${left.resourceKind}:${left.resourceKey}:${left.nodeId}`.localeCompare(
      `${right.resourceKind}:${right.resourceKey}:${right.nodeId}`
    )
  );
}

async function buildResourceDriftSummaries(
  client: PoolClient,
  payloadKey: Buffer | null
): Promise<ResourceDriftSummary[]> {
  const { jobs, missingCredentialCount } = await buildReconciliationCandidates(
    client,
    payloadKey,
    `drift-${Date.now()}`
  );
  const appCredentialGaps = await listAppContainerCredentialGaps(client);
  const summaries: ResourceDriftSummary[] = [];

  for (const job of jobs) {
    summaries.push(createResourceDriftSummary(job, await getLatestResourceJob(client, job)));
  }

  for (const gap of appCredentialGaps) {
    summaries.push({
      resourceKind: "site",
      resourceKey: gap.resourceKey,
      nodeId: gap.nodeId,
      driftStatus: "missing_secret",
      dispatchRecommended: false
    });
  }

  if (missingCredentialCount > 0) {
    const missingDatabases = await client.query<{ slug: string; primary_node_id: string }>(
      `SELECT apps.slug, databases.primary_node_id
       FROM shp_databases databases
       INNER JOIN shp_apps apps
         ON apps.app_id = databases.app_id
       LEFT JOIN shp_database_credentials credentials
         ON credentials.database_id = databases.database_id
       WHERE credentials.database_id IS NULL
       ORDER BY apps.slug ASC`
    );

    for (const row of missingDatabases.rows) {
      summaries.push({
        resourceKind: "database",
        resourceKey: `database:${row.slug}`,
        nodeId: row.primary_node_id,
        driftStatus: "missing_secret",
        dispatchRecommended: false
      });
    }
  }

  return sortResourceDriftSummaries(summaries);
}

interface ControlPlaneOperationsContext {
  pool: Pool;
  jobPayloadKey: Buffer | null;
}

export function createControlPlaneOperationsMethods(
  context: ControlPlaneOperationsContext
): ControlPlaneOperationsMethods {
  const { pool, jobPayloadKey } = context;
  let resourceDriftCache: ResourceDriftCacheEntry | undefined;

  const loadResourceDriftSummaries = (): Promise<ResourceDriftSummary[]> => {
    const now = Date.now();

    if (resourceDriftCache && resourceDriftCache.expiresAtMs > now) {
      return resourceDriftCache.promise;
    }

    const promise = withTransaction(pool, async (client) =>
      buildResourceDriftSummaries(client, jobPayloadKey)
    );
    resourceDriftCache = {
      expiresAtMs: now + resourceDriftCacheTtlMs,
      promise
    };

    promise.catch(() => {
      if (resourceDriftCache?.promise === promise) {
        resourceDriftCache = undefined;
      }
    });

    return promise;
  };

  return {
    async dispatchZoneSync(zoneName, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const jobs = (await buildZoneDnsPlans(client, zoneName)).map((plan) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "dns.sync",
              plan.nodeId,
              desiredStateVersion,
              plan.payload as unknown as Record<string, unknown>
            ),
            `zone:${zoneName}`,
            "dns"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `dns.sync:${zoneName}`,
          jobPayloadKey
        );

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchAppReconcile(appSlug, request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const jobs: QueuedDispatchJob[] = [];
        const includeContainer = request.includeContainer ?? true;
        const includeDns = request.includeDns ?? true;
        const includeProxy = request.includeProxy ?? true;
        const includeStandbyProxy = request.includeStandbyProxy ?? true;
        const proxyPlan = await buildProxyPayload(client, appSlug);
        const containerPlan = includeContainer
          ? await buildAppContainerPlans(client, appSlug, jobPayloadKey)
          : { plans: [], credentialMissing: false };

        if (includeProxy) {
          const primaryNodeId = proxyPlan.plans[0]?.nodeId;

          for (const plan of proxyPlan.plans) {
            if (!includeStandbyProxy && plan.nodeId !== primaryNodeId) {
              continue;
            }

            jobs.push(
              createQueuedDispatchJob(
                createDispatchedJobEnvelope(
                  "proxy.render",
                  plan.nodeId,
                  desiredStateVersion,
                  plan.payload as unknown as Record<string, unknown>
                ),
                `app:${appSlug}:proxy:${plan.nodeId}`,
                "site"
              )
            );
          }
        }

        if (includeContainer) {
          const primaryNodeId = containerPlan.plans[0]?.nodeId;

          for (const plan of containerPlan.plans) {
            if (!includeStandbyProxy && plan.nodeId !== primaryNodeId) {
              continue;
            }

            jobs.push(
              createQueuedDispatchJob(
                createDispatchedJobEnvelope(
                  "container.reconcile",
                  plan.nodeId,
                  desiredStateVersion,
                  plan.payload as unknown as Record<string, unknown>
                ),
                `app:${appSlug}:container:${plan.nodeId}`,
                "site"
              )
            );
          }
        }

        if (includeDns) {
          for (const dnsPlan of await buildZoneDnsPlans(client, proxyPlan.zoneName)) {
            jobs.push(
              createQueuedDispatchJob(
                createDispatchedJobEnvelope(
                  "dns.sync",
                  dnsPlan.nodeId,
                  desiredStateVersion,
                  dnsPlan.payload as unknown as Record<string, unknown>
                ),
                `zone:${proxyPlan.zoneName}`,
                "dns"
              )
            );
          }
        }

        if (jobs.length === 0) {
          if (includeContainer && containerPlan.credentialMissing) {
            throw new Error(
              `Application ${appSlug} requires a desired database password before container.reconcile can be queued.`
            );
          }

          throw new Error(`No jobs were selected for application ${appSlug}.`);
        }

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `app.reconcile:${appSlug}`,
          jobPayloadKey
        );

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async getAppProxyPayload(appSlug, presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const proxyPlan = await buildProxyPayload(client, appSlug);
        return sanitizePayload(
          (proxyPlan.plans[0]?.payload ?? {}) as unknown as Record<string, unknown>
        ) as unknown as ProxyRenderPayload;
      });
    },

    async dispatchDatabaseReconcile(appSlug, request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const databasePlan = await buildDatabasePayload(
          client,
          appSlug,
          request.password ?? null,
          jobPayloadKey
        );

        if (request.password) {
          await client.query(
            `INSERT INTO shp_database_credentials (
               database_id,
               secret_payload,
               updated_at
             )
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (database_id)
             DO UPDATE SET
               secret_payload = EXCLUDED.secret_payload,
               updated_at = EXCLUDED.updated_at`,
            [
              `database-${appSlug}`,
              JSON.stringify(encodeDesiredPassword(request.password, jobPayloadKey))
            ]
          );
        }

        const jobs = [
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              databasePlan.kind,
              databasePlan.nodeId,
              desiredStateVersion,
              databasePlan.payload
            ),
            `database:${appSlug}`,
            "database"
          )
        ];

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `database.reconcile:${appSlug}`,
          jobPayloadKey
        );

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchCodeServerUpdate(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const rpmUrl = request.rpmUrl.trim();

        if (!/^https?:\/\//i.test(rpmUrl)) {
          throw new Error("code-server RPM URL must be an absolute http(s) URL.");
        }

        const desiredStateVersion = createDesiredStateVersion();
        const targetNodeIds = await resolveTargetNodeIds(
          client,
          request.nodeIds,
          "No managed nodes are available for code-server updates."
        );
        const requestedNodeIds = Array.from(
          new Set((request.nodeIds ?? []).map((value) => value.trim()).filter(Boolean))
        );

        const jobs = targetNodeIds.map((nodeId) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "code-server.update",
              nodeId,
              desiredStateVersion,
              {
                rpmUrl,
                expectedSha256: request.expectedSha256
              } satisfies CodeServerUpdatePayload
            ),
            `node:${nodeId}:code-server`,
            "service"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `code-server.update:${requestedNodeIds.length > 0 ? requestedNodeIds.join(",") : "all"}`,
          jobPayloadKey
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "code_server.update.requested",
          entityType: "service",
          entityId: "code-server",
          payload: {
            nodeIds: targetNodeIds,
            rpmUrl
          }
        });

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchPackageInventoryRefresh(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const targetNodeIds = await resolveTargetNodeIds(
          client,
          request.nodeIds,
          "No managed nodes are available for package inventory refresh."
        );
        const requestedNodeIds = Array.from(
          new Set((request.nodeIds ?? []).map((value) => value.trim()).filter(Boolean))
        );
        const jobs = targetNodeIds.map((nodeId) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "package.inventory.collect",
              nodeId,
              desiredStateVersion,
              {} satisfies PackageInventoryCollectPayload
            ),
            `node:${nodeId}:packages`,
            "service"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `package.inventory.collect:${
            requestedNodeIds.length > 0 ? requestedNodeIds.join(",") : "all"
          }`,
          jobPayloadKey
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "package_inventory.refresh.requested",
          entityType: "service",
          entityId: "packages",
          payload: {
            nodeIds: targetNodeIds
          }
        });

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchPackageInstall(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const packageNames = Array.from(
          new Set((request.packageNames ?? []).map((value) => value.trim()).filter(Boolean))
        );
        const rpmUrl = request.rpmUrl?.trim();

        if (!rpmUrl && packageNames.length === 0) {
          throw new Error("Provide one or more package names or an RPM URL.");
        }

        if (rpmUrl && !/^https?:\/\//i.test(rpmUrl)) {
          throw new Error("Package RPM URL must be an absolute http(s) URL.");
        }

        const desiredStateVersion = createDesiredStateVersion();
        const targetNodeIds = await resolveTargetNodeIds(
          client,
          request.nodeIds,
          "No managed nodes are available for package installation."
        );
        const payload: PackageInstallPayload = {
          packageNames: packageNames.length > 0 ? packageNames : undefined,
          rpmUrl: rpmUrl || undefined,
          expectedSha256: request.expectedSha256,
          allowReinstall: request.allowReinstall
        };
        const jobs = targetNodeIds.map((nodeId) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "package.install",
              nodeId,
              desiredStateVersion,
              payload as unknown as Record<string, unknown>
            ),
            `node:${nodeId}:packages`,
            "service"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `package.install:${packageNames.length > 0 ? packageNames.join(",") : rpmUrl ?? "url"}`,
          jobPayloadKey
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "package.install.requested",
          entityType: "service",
          entityId: "packages",
          payload: {
            nodeIds: targetNodeIds,
            packageNames,
            rpmUrl: rpmUrl || undefined,
            allowReinstall: request.allowReinstall ?? false
          }
        });

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchFirewallApply(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const targetNodeIds = await resolveTargetNodeIds(
          client,
          request.nodeIds,
          "No managed nodes are available for firewall configuration."
        );
        const requestedNodeIds = Array.from(
          new Set((request.nodeIds ?? []).map((value) => value.trim()).filter(Boolean))
        );
        const payload: FirewallApplyPayload = {
          installPackage: request.installPackage ?? false,
          enableService: request.enableService ?? true,
          applyPublicZone: request.applyPublicZone ?? true,
          applyWireGuardZone: request.applyWireGuardZone ?? false,
          reload: request.reload ?? true
        };
        const jobs = targetNodeIds.map((nodeId) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "firewall.apply",
              nodeId,
              desiredStateVersion,
              payload as unknown as Record<string, unknown>
            ),
            `node:${nodeId}:firewall`,
            "service"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `firewall.apply:${requestedNodeIds.length > 0 ? requestedNodeIds.join(",") : "all"}`,
          jobPayloadKey
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "firewall.apply.requested",
          entityType: "service",
          entityId: "firewalld",
          payload: {
            nodeIds: targetNodeIds,
            ...payload
          }
        });

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async dispatchFail2BanApply(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const desiredStateVersion = createDesiredStateVersion();
        const targetNodeIds = await resolveTargetNodeIds(
          client,
          request.nodeIds,
          "No managed nodes are available for Fail2Ban configuration."
        );
        const requestedNodeIds = Array.from(
          new Set((request.nodeIds ?? []).map((value) => value.trim()).filter(Boolean))
        );
        const payload: Fail2BanApplyPayload = {
          installPackage: request.installPackage ?? false,
          applySshdJail: request.applySshdJail ?? true,
          enableService: request.enableService ?? true,
          restartService: request.restartService ?? true
        };
        const jobs = targetNodeIds.map((nodeId) =>
          createQueuedDispatchJob(
            createDispatchedJobEnvelope(
              "fail2ban.apply",
              nodeId,
              desiredStateVersion,
              payload as unknown as Record<string, unknown>
            ),
            `node:${nodeId}:fail2ban`,
            "service"
          )
        );

        await insertDispatchedJobs(
          client,
          jobs,
          actor.userId,
          `fail2ban.apply:${requestedNodeIds.length > 0 ? requestedNodeIds.join(",") : "all"}`,
          jobPayloadKey
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "fail2ban.apply.requested",
          entityType: "service",
          entityId: "fail2ban",
          payload: {
            nodeIds: targetNodeIds,
            ...payload
          }
        });

        return {
          desiredStateVersion,
          jobs: jobs.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async runReconciliationCycle(presentedToken) {
      const startedAt = new Date().toISOString();
      const desiredStateVersion = createDesiredStateVersion();
      const runId = `reconcile-${randomUUID()}`;

      return withTransaction(pool, async (client) => {
        if (presentedToken) {
          await requireAuthorizedUser(client, presentedToken, [
            "platform_admin",
            "platform_operator"
          ]);
        }

        const { jobs: candidates, missingCredentialCount } =
          await buildReconciliationCandidates(client, jobPayloadKey, desiredStateVersion);
        const jobsToDispatch: QueuedDispatchJob[] = [];
        let skippedJobCount = 0;

        for (const candidate of candidates) {
          if (await shouldDispatchQueuedJob(client, candidate)) {
            jobsToDispatch.push(candidate);
          } else {
            skippedJobCount += 1;
          }
        }

        if (jobsToDispatch.length > 0) {
          await insertDispatchedJobs(
            client,
            jobsToDispatch,
            null,
            "worker.reconcile",
            jobPayloadKey
          );
        }

        const completedAt = new Date().toISOString();

        await client.query(
          `INSERT INTO shp_reconciliation_runs (
             run_id,
             desired_state_version,
             generated_job_count,
             skipped_job_count,
             missing_credential_count,
             summary,
             started_at,
             completed_at
           )
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
          [
            runId,
            desiredStateVersion,
            jobsToDispatch.length,
            skippedJobCount,
            missingCredentialCount,
            JSON.stringify({
              jobs: jobsToDispatch.map((job) => ({
                ...job.envelope,
                payload: sanitizePayload(job.envelope.payload)
              }))
            }),
            startedAt,
            completedAt
          ]
        );

        return {
          runId,
          desiredStateVersion,
          startedAt,
          completedAt,
          generatedJobCount: jobsToDispatch.length,
          skippedJobCount,
          missingCredentialCount,
          jobs: jobsToDispatch.map((job) => ({
            ...job.envelope,
            payload: sanitizePayload(job.envelope.payload) as Record<string, unknown>
          }))
        };
      });
    },

    async getOperationsOverview(presentedToken) {
      const counts = await withTransaction(pool, async (client) => {
        if (presentedToken) {
          await requireAuthorizedUser(client, presentedToken, [
            "platform_admin",
            "platform_operator"
          ]);
        }

        const countResult = await client.query<{
          node_count: string;
          pending_job_count: string;
          failed_job_count: string;
          backup_policy_count: string;
        }>(
          `SELECT
             (SELECT COUNT(*) FROM shp_nodes) AS node_count,
             (SELECT COUNT(*) FROM control_plane_jobs WHERE completed_at IS NULL)
               AS pending_job_count,
             (SELECT COUNT(*) FROM control_plane_job_results WHERE status = 'failed')
               AS failed_job_count,
             (SELECT COUNT(*) FROM shp_backup_policies) AS backup_policy_count`
        );
        const latestReconciliation = await getLatestReconciliationRun(client);
        const row = countResult.rows[0];

        return {
          nodeCount: Number(row?.node_count ?? 0),
          pendingJobCount: Number(row?.pending_job_count ?? 0),
          failedJobCount: Number(row?.failed_job_count ?? 0),
          backupPolicyCount: Number(row?.backup_policy_count ?? 0),
          latestReconciliation: latestReconciliation ?? undefined
        };
      });
      const drift = await loadResourceDriftSummaries();

      return {
        generatedAt: new Date().toISOString(),
        nodeCount: counts.nodeCount,
        pendingJobCount: counts.pendingJobCount,
        failedJobCount: counts.failedJobCount,
        backupPolicyCount: counts.backupPolicyCount,
        driftedResourceCount: drift.filter((item) => item.driftStatus !== "in_sync").length,
        latestReconciliation: counts.latestReconciliation
      };
    },

    async getResourceDrift(presentedToken) {
      await withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
      });

      return loadResourceDriftSummaries();
    },

    async getNodeHealth(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        const result = await client.query<NodeHealthRow>(
          `SELECT
             nodes.node_id,
             nodes.hostname,
             control.version AS current_version,
             control.runtime_snapshot,
             control.last_seen_at,
             COALESCE(pending.pending_job_count, 0) AS pending_job_count,
             0 AS drifted_resource_count,
             COALESCE(zones.primary_zone_count, 0) AS primary_zone_count,
             COALESCE(apps.primary_app_count, 0) AS primary_app_count,
             COALESCE(backups.backup_policy_count, 0) AS backup_policy_count,
             latest.status AS latest_job_status,
             latest.summary AS latest_job_summary
           FROM shp_nodes nodes
           LEFT JOIN control_plane_nodes control
             ON control.node_id = nodes.node_id
           LEFT JOIN (
             SELECT node_id, COUNT(*) AS pending_job_count
             FROM control_plane_jobs
             WHERE completed_at IS NULL
             GROUP BY node_id
           ) pending
             ON pending.node_id = nodes.node_id
           LEFT JOIN (
             SELECT primary_node_id AS node_id, COUNT(*) AS primary_zone_count
             FROM shp_dns_zones
             GROUP BY primary_node_id
           ) zones
             ON zones.node_id = nodes.node_id
           LEFT JOIN (
             SELECT primary_node_id AS node_id, COUNT(*) AS primary_app_count
             FROM shp_apps
             GROUP BY primary_node_id
           ) apps
             ON apps.node_id = nodes.node_id
           LEFT JOIN (
             SELECT target_node_id AS node_id, COUNT(*) AS backup_policy_count
             FROM shp_backup_policies
             GROUP BY target_node_id
           ) backups
             ON backups.node_id = nodes.node_id
           LEFT JOIN (
             SELECT DISTINCT ON (jobs.node_id)
               jobs.node_id,
               results.status,
               results.summary
             FROM control_plane_jobs jobs
             INNER JOIN control_plane_job_results results
               ON results.job_id = jobs.id
             ORDER BY jobs.node_id, results.completed_at DESC
           ) latest
             ON latest.node_id = nodes.node_id
           ORDER BY nodes.node_id ASC`
        );

        return result.rows.map(toNodeHealthSnapshot);
      });
    },

    async getPackageInventory(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        const result = await client.query<InstalledPackageRow>(
          `SELECT
             packages.node_id,
             COALESCE(control.hostname, inventory.hostname, packages.node_id) AS hostname,
             packages.package_name,
             packages.epoch,
             packages.version,
             packages.release,
             packages.arch,
             packages.nevra,
             packages.source,
             packages.installed_at,
             packages.last_collected_at
           FROM shp_node_installed_packages packages
           LEFT JOIN control_plane_nodes control
             ON control.node_id = packages.node_id
           LEFT JOIN shp_nodes inventory
             ON inventory.node_id = packages.node_id
           ORDER BY packages.package_name ASC, packages.node_id ASC, packages.arch ASC`
        );

        return {
          generatedAt: new Date().toISOString(),
          nodeCount: new Set(result.rows.map((row) => row.node_id)).size,
          packageCount: result.rows.length,
          packages: result.rows.map(toInstalledPackageSummary)
        };
      });
    },

    async getRustDeskNodeHealth() {
      const result = await pool.query<NodeHealthRow>(
        `SELECT
           nodes.node_id,
           nodes.hostname,
           control.version AS current_version,
           control.runtime_snapshot,
           control.last_seen_at,
           0 AS pending_job_count,
           0 AS drifted_resource_count,
           0 AS primary_zone_count,
           0 AS primary_app_count,
           0 AS backup_policy_count,
           NULL::text AS latest_job_status,
           NULL::text AS latest_job_summary
         FROM shp_nodes nodes
         LEFT JOIN control_plane_nodes control
           ON control.node_id = nodes.node_id
         ORDER BY nodes.node_id ASC`
      );

      return result.rows.map(toNodeHealthSnapshot);
    },

    async listJobHistory(presentedToken, limit = 50) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const boundedLimit = Math.max(1, Math.min(limit, 200));
        const recentResult = await client.query<JobHistoryRow>(
          `SELECT
             jobs.id,
             jobs.desired_state_version,
             jobs.kind,
             jobs.node_id,
             jobs.created_at,
             jobs.claimed_at,
             jobs.completed_at,
             jobs.payload,
             results.status,
             results.summary,
             results.details,
             jobs.dispatch_reason,
             jobs.resource_key
           FROM control_plane_jobs jobs
           LEFT JOIN control_plane_job_results results
             ON results.job_id = jobs.id
           ORDER BY jobs.created_at DESC
           LIMIT $1`,
          [boundedLimit]
        );

        const latestAppliedDnsResult = await client.query<JobHistoryRow>(
          `SELECT DISTINCT ON (jobs.resource_key)
             jobs.id,
             jobs.desired_state_version,
             jobs.kind,
             jobs.node_id,
             jobs.created_at,
             jobs.claimed_at,
             jobs.completed_at,
             jobs.payload,
             results.status,
             results.summary,
             results.details,
             jobs.dispatch_reason,
             jobs.resource_key
           FROM control_plane_jobs jobs
           INNER JOIN control_plane_job_results results
             ON results.job_id = jobs.id
           WHERE jobs.kind = 'dns.sync'
             AND results.status = 'applied'
             AND jobs.resource_key IS NOT NULL
           ORDER BY jobs.resource_key ASC, jobs.created_at DESC`
        );

        return mergeJobHistoryRows(recentResult.rows, latestAppliedDnsResult.rows).map((row) =>
          toJobHistoryEntry(row, jobPayloadKey)
        );
      });
    },

    async listAuditEvents(presentedToken, limit = 50) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const boundedLimit = Math.max(1, Math.min(limit, 200));
        const result = await client.query<AuditEventRow>(
          `SELECT
             event_id,
             actor_type,
             actor_id,
             event_type,
             entity_type,
             entity_id,
             payload,
             occurred_at
           FROM shp_audit_events
           ORDER BY occurred_at DESC
           LIMIT $1`,
          [boundedLimit]
        );

        return result.rows.map(toAuditEventSummary);
      });
    },

    async getBackupsOverview(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const [policyResult, runResult] = await Promise.all([
          client.query<BackupPolicyRow>(
            `SELECT
               policies.policy_slug,
               tenants.slug AS tenant_slug,
               policies.target_node_id,
               policies.schedule,
               policies.retention_days,
               policies.storage_location,
               policies.resource_selectors
             FROM shp_backup_policies policies
             INNER JOIN shp_tenants tenants
               ON tenants.tenant_id = policies.tenant_id
             ORDER BY policies.policy_slug ASC`
          ),
          client.query<BackupRunRow>(
            `SELECT DISTINCT ON (policies.policy_slug)
               runs.run_id,
               policies.policy_slug,
               runs.node_id,
               runs.status,
               runs.summary,
               runs.started_at,
               runs.completed_at,
               runs.details
             FROM shp_backup_runs runs
             INNER JOIN shp_backup_policies policies
               ON policies.policy_id = runs.policy_id
             ORDER BY policies.policy_slug ASC, runs.started_at DESC`
          )
        ]);

        return {
          policies: policyResult.rows.map(toBackupPolicySummary),
          latestRuns: runResult.rows.map(toBackupRunSummary)
        };
      });
    },

    async recordBackupRun(request, presentedToken) {
      const startedAt = new Date().toISOString();

      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const runId = `backup-run-${randomUUID()}`;

        await client.query(
          `INSERT INTO shp_backup_runs (
             run_id,
             policy_id,
             node_id,
             status,
             summary,
             started_at,
             completed_at,
             details
           )
           VALUES (
             $1,
             (SELECT policy_id FROM shp_backup_policies WHERE policy_slug = $2),
             $3,
             $4,
             $5,
             $6,
             $7,
             $8::jsonb
           )`,
          [
            runId,
            request.policySlug,
            request.nodeId,
            request.status,
            request.summary,
            startedAt,
            request.completedAt ?? null,
            JSON.stringify(request.details ?? {})
          ]
        );

        return toBackupRunSummary({
          run_id: runId,
          policy_slug: request.policySlug,
          node_id: request.nodeId,
          status: request.status,
          summary: request.summary,
          started_at: startedAt,
          completed_at: request.completedAt ?? null,
          details: (request.details ?? {}) as Record<string, unknown>
        });
      });
    },

    async getStateSnapshot() {
      const [nodeResult, pendingJobResult, reportedResult] = await Promise.all([
        pool.query<NodeRow>(
          `SELECT
             node_id,
             hostname,
             version,
             supported_job_kinds,
             accepted_at,
             last_seen_at
           FROM control_plane_nodes
           ORDER BY accepted_at ASC`
        ),
        pool.query<JobRow>(
          `SELECT
             id,
             desired_state_version,
             kind,
             node_id,
             created_at,
             payload
           FROM control_plane_jobs
           WHERE claimed_at IS NULL
             AND completed_at IS NULL
           ORDER BY created_at ASC`
        ),
        pool.query<ResultRow>(
          `SELECT
             job_id,
             kind,
             node_id,
             status,
             summary,
             details,
             completed_at
           FROM control_plane_job_results
           ORDER BY completed_at ASC`
        )
      ]);

      const pendingJobs: Record<string, ReturnType<typeof toDispatchedJob>[]> = {};

      for (const row of pendingJobResult.rows) {
        const job = toDispatchedJob(row, jobPayloadKey);
        pendingJobs[job.nodeId] ??= [];
        pendingJobs[job.nodeId].push(job);
      }

      return {
        nodes: nodeResult.rows.map(toRegisteredNodeState),
        pendingJobs,
        reportedResults: reportedResult.rows.map(toReportedJobResult)
      };
    }
  };
}
