import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import YAML from "yaml";

import type {
  MailboxCredentialMutationResult,
  MailboxCredentialReveal,
  MailboxCredentialState,
  DesiredStateAppInput,
  DesiredStateApplyResponse,
  DesiredStateDatabaseInput,
  DesiredStateMailPolicyInput,
  DesiredStateNodeInput,
  DesiredStateSpec,
  DesiredStateTenantInput,
  DesiredStateZoneInput,
  DnsRecordPayload,
  MailOverview,
  UpsertMailPolicyRequest
} from "@simplehost/control-contracts";
import {
  createDefaultMailPolicy,
  maximumMailboxQuotaBytes,
  minimumMailboxQuotaBytes
} from "@simplehost/control-contracts";

import { readPlatformInventory, type PlatformInventoryApp, type PlatformInventoryDocument } from "./inventory.js";
import { requireAuthorizedUser } from "./control-plane-store-auth.js";
import { insertAuditEvent, withTransaction } from "./control-plane-store-db.js";
import {
  createDesiredStateVersion,
  createStableId,
  decodeDesiredPassword,
  encodeDesiredPassword,
  relativeRecordNameForZone,
  titleizeSlug,
  toInventoryAppSummary,
  toInventoryDatabaseSummary,
  toInventoryExportSummary,
  toInventoryImportSummary,
  toInventoryNodeSummary,
  toInventoryZoneSummary
} from "./control-plane-store-helpers.js";
import type {
  BackupPolicyRow,
  ControlPlaneSpecMethods,
  InventoryAppRow,
  InventoryDatabaseRow,
  InventoryExportRow,
  InventoryImportRow,
  InventoryNodeRow,
  InventoryRecordRow,
  InventoryZoneRow,
  MailAliasRow,
  MailDnsDomainRow,
  MailDomainRow,
  MailPolicyRow,
  MailboxQuotaRow,
  MailboxRow,
  ControlPlaneStoreOptions
} from "./control-plane-store-types.js";

const mailPolicyId = "mail-policy";
const mailSenderDomainPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const mailSenderAddressPattern =
  /^[a-z0-9._%+-]+@(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/;

function normalizeMailPolicy(
  policy: DesiredStateMailPolicyInput | undefined
): DesiredStateMailPolicyInput {
  const defaults = createDefaultMailPolicy();

  return {
    rejectThreshold: policy?.rejectThreshold ?? defaults.rejectThreshold,
    addHeaderThreshold: policy?.addHeaderThreshold ?? defaults.addHeaderThreshold,
    greylistThreshold: policy?.greylistThreshold ?? undefined,
    senderAllowlist: [...new Set((policy?.senderAllowlist ?? defaults.senderAllowlist).map((entry) => entry.trim().toLowerCase()).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right)
    ),
    senderDenylist: [...new Set((policy?.senderDenylist ?? defaults.senderDenylist).map((entry) => entry.trim().toLowerCase()).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right)
    ),
    rateLimit:
      policy?.rateLimit &&
      Number.isInteger(policy.rateLimit.burst) &&
      Number.isInteger(policy.rateLimit.periodSeconds) &&
      policy.rateLimit.burst > 0 &&
      policy.rateLimit.periodSeconds > 0
        ? {
            burst: policy.rateLimit.burst,
            periodSeconds: policy.rateLimit.periodSeconds
          }
        : undefined
  };
}

function isValidMailSenderPolicyEntry(value: string): boolean {
  if (value.startsWith("@")) {
    return mailSenderDomainPattern.test(value.slice(1));
  }

  return mailSenderAddressPattern.test(value);
}

function normalizeHostnameValue(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function parseMxRecordTarget(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return normalizeHostnameValue(parts[0]!);
  }

  const priority = Number.parseInt(parts[0]!, 10);
  const target = Number.isInteger(priority) ? parts[1] : parts.at(-1);

  return target ? normalizeHostnameValue(target) : null;
}

function formatStorageBytesForValidation(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let normalized = value;
  let unitIndex = 0;

  while (normalized >= 1024 && unitIndex < units.length - 1) {
    normalized /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = normalized >= 10 || unitIndex === 0 ? 0 : 1;
  return `${normalized.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function findMailAliasLoop(
  aliases: DesiredStateSpec["mailAliases"]
): string[] | null {
  const aliasesByAddress = new Map(aliases.map((alias) => [alias.address, alias] as const));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const visit = (address: string): string[] | null => {
    if (visiting.has(address)) {
      const loopStart = path.indexOf(address);
      return [...path.slice(loopStart), address];
    }

    if (visited.has(address)) {
      return null;
    }

    visiting.add(address);
    path.push(address);

    for (const destination of aliasesByAddress.get(address)?.destinations ?? []) {
      if (!aliasesByAddress.has(destination)) {
        continue;
      }

      const loop = visit(destination);

      if (loop) {
        return loop;
      }
    }

    path.pop();
    visiting.delete(address);
    visited.add(address);
    return null;
  };

  for (const address of aliasesByAddress.keys()) {
    const loop = visit(address);

    if (loop) {
      return loop;
    }
  }

  return null;
}

export async function getLatestInventoryImport(
  client: PoolClient
): Promise<ReturnType<typeof toInventoryImportSummary> | null> {
  const result = await client.query<InventoryImportRow>(
    `SELECT import_id, source_path, summary, imported_at
     FROM shp_inventory_import_runs
     ORDER BY imported_at DESC
     LIMIT 1`
  );

  return result.rows[0] ? toInventoryImportSummary(result.rows[0]) : null;
}

export async function getLatestInventoryExport(
  client: PoolClient
): Promise<ReturnType<typeof toInventoryExportSummary> | null> {
  const result = await client.query<InventoryExportRow>(
    `SELECT event_id, payload, occurred_at
     FROM shp_audit_events
     WHERE event_type = 'inventory.exported'
     ORDER BY occurred_at DESC
     LIMIT 1`
  );

  return result.rows[0] ? toInventoryExportSummary(result.rows[0]) : null;
}

function normalizeMailboxCredentialState(
  state: string | null | undefined,
  hasDesiredPassword: boolean
): MailboxCredentialState {
  if (
    state === "missing" ||
    state === "configured" ||
    state === "reset_required"
  ) {
    return state;
  }

  return hasDesiredPassword ? "configured" : "missing";
}

function createMailboxCredentialSecret(length = 20): string {
  return randomBytes(24)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, length);
}

async function createMailboxCredentialReveal(args: {
  client: PoolClient;
  mailboxId: string;
  actorId: string;
  action: "generated" | "rotated";
  credential: string;
  payloadKey: Buffer | null;
}): Promise<string> {
  const revealId = `mailbox-credential-reveal-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await args.client.query(
    `INSERT INTO shp_mailbox_credential_reveals (
       reveal_id,
       mailbox_id,
       actor_id,
       action,
       secret_payload,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      revealId,
      args.mailboxId,
      args.actorId,
      args.action,
      JSON.stringify(encodeDesiredPassword(args.credential, args.payloadKey)),
      expiresAt
    ]
  );

  return revealId;
}

export async function buildInventorySnapshot(client: PoolClient) {
  const [latestImport, latestExport, nodeResult, zoneResult, appResult, databaseResult] = await Promise.all([
    getLatestInventoryImport(client),
    getLatestInventoryExport(client),
    client.query<InventoryNodeRow>(
      `SELECT node_id, hostname, public_ipv4, wireguard_address
       FROM shp_nodes
       ORDER BY node_id ASC`
    ),
    client.query<InventoryZoneRow>(
      `SELECT
         zones.zone_id,
         zones.zone_name,
         tenants.slug AS tenant_slug,
         zones.primary_node_id
       FROM shp_dns_zones zones
       INNER JOIN shp_tenants tenants
         ON tenants.tenant_id = zones.tenant_id
       ORDER BY zones.zone_name ASC`
    ),
    client.query<InventoryAppRow>(
      `SELECT
         apps.slug,
         tenants.slug AS tenant_slug,
         zones.zone_name,
         apps.primary_node_id,
         apps.standby_node_id,
         sites.canonical_domain,
         sites.aliases,
         apps.backend_port,
         apps.runtime_image,
         apps.storage_root,
         apps.mode
       FROM shp_apps apps
       INNER JOIN shp_tenants tenants
         ON tenants.tenant_id = apps.tenant_id
       INNER JOIN shp_dns_zones zones
         ON zones.zone_id = apps.zone_id
       INNER JOIN shp_sites sites
         ON sites.app_id = apps.app_id
       ORDER BY apps.slug ASC`
    ),
    client.query<InventoryDatabaseRow>(
      `SELECT
         databases.database_id,
         apps.slug AS app_slug,
         databases.engine,
         databases.database_name,
         databases.database_user,
         databases.primary_node_id,
         databases.standby_node_id,
         databases.pending_migration_to,
         databases.migration_completed_from,
         databases.migration_completed_at,
         credentials.secret_payload AS desired_password
       FROM shp_databases databases
       INNER JOIN shp_apps apps
         ON apps.app_id = databases.app_id
       LEFT JOIN shp_database_credentials credentials
         ON credentials.database_id = databases.database_id
       ORDER BY apps.slug ASC`
    )
  ]);

  return {
    latestImport,
    latestExport,
    nodes: nodeResult.rows.map(toInventoryNodeSummary),
    zones: zoneResult.rows.map(toInventoryZoneSummary),
    apps: appResult.rows.map(toInventoryAppSummary),
    databases: databaseResult.rows.map(toInventoryDatabaseSummary)
  };
}

export async function buildDesiredStateSpecFromDatabase(
  client: PoolClient,
  payloadKey: Buffer | null
): Promise<DesiredStateSpec> {
  const [
    tenantResult,
    nodeResult,
    zoneResult,
    recordResult,
    appResult,
    databaseResult,
    backupPolicyResult,
    mailPolicyResult,
    mailDomainResult,
    mailboxResult,
    mailAliasResult,
    mailboxQuotaResult
  ] = await Promise.all([
    client.query<{ slug: string; display_name: string }>(
      `SELECT slug, display_name
       FROM shp_tenants
       ORDER BY slug ASC`
    ),
    client.query<InventoryNodeRow>(
      `SELECT node_id, hostname, public_ipv4, wireguard_address
       FROM shp_nodes
       ORDER BY node_id ASC`
    ),
    client.query<InventoryZoneRow>(
      `SELECT
         zone_id,
         zones.zone_name,
         tenants.slug AS tenant_slug,
         zones.primary_node_id
       FROM shp_dns_zones zones
       INNER JOIN shp_tenants tenants
         ON tenants.tenant_id = zones.tenant_id
       ORDER BY zones.zone_name ASC`
    ),
    client.query<InventoryRecordRow>(
      `SELECT
         zones.zone_name,
         records.name,
         records.type,
         records.value,
         records.ttl
       FROM shp_dns_records records
       INNER JOIN shp_dns_zones zones
         ON zones.zone_id = records.zone_id
       ORDER BY zones.zone_name ASC, records.name ASC, records.type ASC, records.value ASC`
    ),
    client.query<InventoryAppRow>(
      `SELECT
         apps.slug,
         tenants.slug AS tenant_slug,
         zones.zone_name,
         apps.primary_node_id,
         apps.standby_node_id,
         sites.canonical_domain,
         sites.aliases,
         apps.backend_port,
         apps.runtime_image,
         apps.storage_root,
         apps.mode
       FROM shp_apps apps
       INNER JOIN shp_tenants tenants
         ON tenants.tenant_id = apps.tenant_id
       INNER JOIN shp_dns_zones zones
         ON zones.zone_id = apps.zone_id
       INNER JOIN shp_sites sites
         ON sites.app_id = apps.app_id
       ORDER BY apps.slug ASC`
    ),
    client.query<InventoryDatabaseRow>(
      `SELECT
         databases.database_id,
         apps.slug AS app_slug,
         databases.engine,
         databases.database_name,
         databases.database_user,
         databases.primary_node_id,
         databases.standby_node_id,
         databases.pending_migration_to,
         databases.migration_completed_from,
         databases.migration_completed_at,
         credentials.secret_payload AS desired_password
       FROM shp_databases databases
       INNER JOIN shp_apps apps
         ON apps.app_id = databases.app_id
       LEFT JOIN shp_database_credentials credentials
         ON credentials.database_id = databases.database_id
       ORDER BY apps.slug ASC`
    ),
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
    client.query<MailPolicyRow>(
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
       WHERE policy_id = $1`,
      [mailPolicyId]
    ),
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
    client.query<MailboxRow>(
      `SELECT
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
    ),
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
    )
  ]);

  const recordsByZone = new Map<string, DnsRecordPayload[]>();

  for (const row of recordResult.rows) {
    const records = recordsByZone.get(row.zone_name) ?? [];
    records.push({
      name: row.name,
      type: row.type,
      value: row.value,
      ttl: row.ttl
    });
    recordsByZone.set(row.zone_name, records);
  }

  const mailPolicyRow = mailPolicyResult.rows[0];
  const mailPolicy = normalizeMailPolicy(
    mailPolicyRow
      ? {
          rejectThreshold: Number(mailPolicyRow.reject_threshold),
          addHeaderThreshold: Number(mailPolicyRow.add_header_threshold),
          greylistThreshold:
            mailPolicyRow.greylist_threshold === null
              ? undefined
              : Number(mailPolicyRow.greylist_threshold),
          senderAllowlist: mailPolicyRow.sender_allowlist,
          senderDenylist: mailPolicyRow.sender_denylist,
          rateLimit:
            mailPolicyRow.rate_limit_burst && mailPolicyRow.rate_limit_period_seconds
              ? {
                  burst: Number(mailPolicyRow.rate_limit_burst),
                  periodSeconds: Number(mailPolicyRow.rate_limit_period_seconds)
                }
              : undefined
        }
      : undefined
  );

  return {
    tenants: tenantResult.rows.map((row) => ({
      slug: row.slug,
      displayName: row.display_name
    })),
    nodes: nodeResult.rows.map((row) => toInventoryNodeSummary(row)),
    zones: zoneResult.rows.map((row) => ({
      zoneName: row.zone_name,
      tenantSlug: row.tenant_slug,
      primaryNodeId: row.primary_node_id,
      records: normalizeDnsRecords(recordsByZone.get(row.zone_name) ?? [])
    })),
    apps: appResult.rows.map((row) => ({
      slug: row.slug,
      tenantSlug: row.tenant_slug,
      zoneName: row.zone_name,
      primaryNodeId: row.primary_node_id,
      standbyNodeId: row.standby_node_id ?? undefined,
      canonicalDomain: row.canonical_domain,
      aliases: row.aliases,
      backendPort: row.backend_port,
      runtimeImage: row.runtime_image,
      storageRoot: row.storage_root,
      mode: row.mode
    })),
    databases: databaseResult.rows.map((row) => ({
      appSlug: row.app_slug,
      engine: row.engine,
      databaseName: row.database_name,
      databaseUser: row.database_user,
      primaryNodeId: row.primary_node_id,
      standbyNodeId: row.standby_node_id ?? undefined,
      pendingMigrationTo: row.pending_migration_to ?? undefined,
      migrationCompletedFrom: row.migration_completed_from ?? undefined,
      migrationCompletedAt: row.migration_completed_at
        ? new Date(row.migration_completed_at).toISOString()
        : undefined
    })),
    backupPolicies: backupPolicyResult.rows.map((row) => ({
      policySlug: row.policy_slug,
      tenantSlug: row.tenant_slug,
      targetNodeId: row.target_node_id,
      schedule: row.schedule,
      retentionDays: row.retention_days,
      storageLocation: row.storage_location,
      resourceSelectors: row.resource_selectors
    })),
    mailPolicy,
    mailDomains: mailDomainResult.rows.map((row) => ({
      domainName: row.domain_name,
      tenantSlug: row.tenant_slug,
      zoneName: row.zone_name,
      primaryNodeId: row.primary_node_id,
      standbyNodeId: row.standby_node_id ?? undefined,
      mailHost: row.mail_host,
      dkimSelector: row.dkim_selector
    })),
    mailboxes: mailboxResult.rows.map((row) => ({
      address: row.address,
      domainName: row.domain_name,
      localPart: row.local_part,
      primaryNodeId: row.primary_node_id,
      standbyNodeId: row.standby_node_id ?? undefined,
      credentialState: normalizeMailboxCredentialState(
        row.credential_state,
        Boolean(row.desired_password)
      ),
      desiredPassword:
        normalizeMailboxCredentialState(row.credential_state, Boolean(row.desired_password)) ===
          "configured" && row.desired_password
          ? decodeDesiredPassword(row.desired_password, payloadKey) ?? undefined
          : undefined
    })),
    mailAliases: mailAliasResult.rows.map((row) => ({
      address: row.address,
      domainName: row.domain_name,
      localPart: row.local_part,
      destinations: row.destinations
    })),
    mailboxQuotas: mailboxQuotaResult.rows.map((row) => ({
      mailboxAddress: row.mailbox_address,
      storageBytes: Number(row.storage_bytes)
    }))
  };
}

export function sanitizeDesiredStateSpecForExport(spec: DesiredStateSpec): DesiredStateSpec {
  return {
    ...spec,
    mailboxes: spec.mailboxes.map(({ desiredPassword: _desiredPassword, ...mailbox }) => ({
      ...mailbox
    }))
  };
}

export async function applyDesiredStateSpec(
  client: PoolClient,
  spec: DesiredStateSpec,
  payloadKey: Buffer | null
): Promise<void> {
  const resolvedSpec: DesiredStateSpec = {
    ...spec,
    mailPolicy: normalizeMailPolicy(spec.mailPolicy)
  };

  validateDesiredStateSpec(resolvedSpec);

  const desiredTenantIds = resolvedSpec.tenants.map((tenant) => `tenant-${tenant.slug}`);
  const desiredNodeIds = resolvedSpec.nodes.map((node) => node.nodeId);
  const desiredZoneIds = resolvedSpec.zones.map((zone) => `zone-${zone.zoneName}`);
  const desiredAppIds = resolvedSpec.apps.map((app) => `app-${app.slug}`);
  const desiredDatabaseIds = resolvedSpec.databases.map(
    (database) => `database-${database.appSlug}`
  );
  const desiredBackupPolicyIds = resolvedSpec.backupPolicies.map(
    (policy) => `backup-policy-${policy.policySlug}`
  );
  const desiredMailDomainIds = resolvedSpec.mailDomains.map(
    (mailDomain) => `mail-domain-${mailDomain.domainName}`
  );
  const desiredMailboxIds = resolvedSpec.mailboxes.map(
    (mailbox) => `mailbox-${mailbox.address}`
  );
  const desiredMailAliasIds = resolvedSpec.mailAliases.map(
    (mailAlias) => `mail-alias-${mailAlias.address}`
  );
  const existingMailboxCredentialRows = await client.query<{
    mailbox_id: string;
    secret_payload: Record<string, unknown>;
    credential_state: string;
  }>(
    `SELECT mailbox_id, secret_payload, credential_state
     FROM shp_mailbox_credentials`
  );
  const existingMailboxCredentials = new Map(
    existingMailboxCredentialRows.rows.map((row) => [row.mailbox_id, row] as const)
  );

  for (const tenant of resolvedSpec.tenants) {
    await client.query(
      `INSERT INTO shp_tenants (
         tenant_id,
         slug,
         display_name,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (slug)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         updated_at = EXCLUDED.updated_at`,
      [`tenant-${tenant.slug}`, tenant.slug, tenant.displayName]
    );
  }

  for (const node of resolvedSpec.nodes) {
    await client.query(
      `INSERT INTO shp_nodes (
         node_id,
         hostname,
         public_ipv4,
         wireguard_address,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (node_id)
       DO UPDATE SET
         hostname = EXCLUDED.hostname,
         public_ipv4 = EXCLUDED.public_ipv4,
         wireguard_address = EXCLUDED.wireguard_address,
         updated_at = EXCLUDED.updated_at`,
      [node.nodeId, node.hostname, node.publicIpv4, node.wireguardAddress]
    );
  }

  for (const zone of resolvedSpec.zones) {
    const zoneId = `zone-${zone.zoneName}`;

    await client.query(
      `INSERT INTO shp_dns_zones (
         zone_id,
         tenant_id,
         zone_name,
         primary_node_id,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (zone_name)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         primary_node_id = EXCLUDED.primary_node_id,
         updated_at = EXCLUDED.updated_at`,
      [zoneId, `tenant-${zone.tenantSlug}`, zone.zoneName, zone.primaryNodeId]
    );

    await client.query(`DELETE FROM shp_dns_records WHERE zone_id = $1`, [zoneId]);

    for (const record of normalizeDnsRecords(zone.records)) {
      await client.query(
        `INSERT INTO shp_dns_records (
           record_id,
           zone_id,
           name,
           type,
           value,
           ttl,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (zone_id, name, type, value)
         DO UPDATE SET
           ttl = EXCLUDED.ttl,
           updated_at = EXCLUDED.updated_at`,
        [
          createStableId("record", zone.zoneName, record.name, record.type, record.value),
          zoneId,
          record.name,
          record.type,
          record.value,
          record.ttl
        ]
      );
    }
  }

  await client.query(
    `INSERT INTO shp_mail_policy (
       policy_id,
       reject_threshold,
       add_header_threshold,
       greylist_threshold,
       sender_allowlist,
       sender_denylist,
       rate_limit_burst,
       rate_limit_period_seconds,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, NOW(), NOW())
     ON CONFLICT (policy_id)
     DO UPDATE SET
       reject_threshold = EXCLUDED.reject_threshold,
       add_header_threshold = EXCLUDED.add_header_threshold,
       greylist_threshold = EXCLUDED.greylist_threshold,
       sender_allowlist = EXCLUDED.sender_allowlist,
       sender_denylist = EXCLUDED.sender_denylist,
       rate_limit_burst = EXCLUDED.rate_limit_burst,
       rate_limit_period_seconds = EXCLUDED.rate_limit_period_seconds,
       updated_at = EXCLUDED.updated_at`,
    [
      mailPolicyId,
      resolvedSpec.mailPolicy?.rejectThreshold ?? createDefaultMailPolicy().rejectThreshold,
      resolvedSpec.mailPolicy?.addHeaderThreshold ?? createDefaultMailPolicy().addHeaderThreshold,
      resolvedSpec.mailPolicy?.greylistThreshold ?? null,
      JSON.stringify(resolvedSpec.mailPolicy?.senderAllowlist ?? []),
      JSON.stringify(resolvedSpec.mailPolicy?.senderDenylist ?? []),
      resolvedSpec.mailPolicy?.rateLimit?.burst ?? null,
      resolvedSpec.mailPolicy?.rateLimit?.periodSeconds ?? null
    ]
  );

  for (const mailDomain of resolvedSpec.mailDomains) {
    const mailDomainId = `mail-domain-${mailDomain.domainName}`;

    await client.query(
      `INSERT INTO shp_mail_domains (
         mail_domain_id,
         tenant_id,
         zone_id,
         primary_node_id,
         standby_node_id,
         domain_name,
         mail_host,
         dkim_selector,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (domain_name)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         zone_id = EXCLUDED.zone_id,
         primary_node_id = EXCLUDED.primary_node_id,
         standby_node_id = EXCLUDED.standby_node_id,
         mail_host = EXCLUDED.mail_host,
         dkim_selector = EXCLUDED.dkim_selector,
         updated_at = EXCLUDED.updated_at`,
      [
        mailDomainId,
        `tenant-${mailDomain.tenantSlug}`,
        `zone-${mailDomain.zoneName}`,
        mailDomain.primaryNodeId,
        mailDomain.standbyNodeId ?? null,
        mailDomain.domainName,
        mailDomain.mailHost,
        mailDomain.dkimSelector
      ]
    );
  }

  for (const mailbox of resolvedSpec.mailboxes) {
    const mailboxId = `mailbox-${mailbox.address}`;
    const credentialState = normalizeMailboxCredentialState(
      mailbox.credentialState,
      Boolean(mailbox.desiredPassword)
    );
    const existingCredential = existingMailboxCredentials.get(mailboxId);

    await client.query(
      `INSERT INTO shp_mailboxes (
         mailbox_id,
         mail_domain_id,
         primary_node_id,
         standby_node_id,
         address,
         local_part,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (address)
       DO UPDATE SET
         mail_domain_id = EXCLUDED.mail_domain_id,
         primary_node_id = EXCLUDED.primary_node_id,
         standby_node_id = EXCLUDED.standby_node_id,
         local_part = EXCLUDED.local_part,
         updated_at = EXCLUDED.updated_at`,
      [
        mailboxId,
        `mail-domain-${mailbox.domainName}`,
        mailbox.primaryNodeId,
        mailbox.standbyNodeId ?? null,
        mailbox.address,
        mailbox.localPart
      ]
    );

    const nextSecretPayload =
      credentialState === "configured"
        ? mailbox.desiredPassword
          ? encodeDesiredPassword(mailbox.desiredPassword, payloadKey)
          : existingCredential?.secret_payload ?? {}
        : {};

    await client.query(
      `INSERT INTO shp_mailbox_credentials (
         mailbox_id,
         secret_payload,
         credential_state,
         updated_at
       )
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (mailbox_id)
       DO UPDATE SET
         secret_payload = EXCLUDED.secret_payload,
         credential_state = EXCLUDED.credential_state,
         updated_at = EXCLUDED.updated_at`,
      [mailboxId, JSON.stringify(nextSecretPayload), credentialState]
    );
  }

  for (const mailAlias of resolvedSpec.mailAliases) {
    await client.query(
      `INSERT INTO shp_mail_aliases (
         mail_alias_id,
         mail_domain_id,
         address,
         local_part,
         destinations,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
       ON CONFLICT (address)
       DO UPDATE SET
         mail_domain_id = EXCLUDED.mail_domain_id,
         local_part = EXCLUDED.local_part,
         destinations = EXCLUDED.destinations,
         updated_at = EXCLUDED.updated_at`,
      [
        `mail-alias-${mailAlias.address}`,
        `mail-domain-${mailAlias.domainName}`,
        mailAlias.address,
        mailAlias.localPart,
        JSON.stringify(mailAlias.destinations)
      ]
    );
  }

  for (const quota of resolvedSpec.mailboxQuotas) {
    await client.query(
      `INSERT INTO shp_mailbox_quotas (
         mailbox_id,
         storage_bytes,
         updated_at
       )
       VALUES ($1, $2, NOW())
       ON CONFLICT (mailbox_id)
       DO UPDATE SET
         storage_bytes = EXCLUDED.storage_bytes,
         updated_at = EXCLUDED.updated_at`,
      [`mailbox-${quota.mailboxAddress}`, quota.storageBytes]
    );
  }

  for (const app of resolvedSpec.apps) {
    const appId = `app-${app.slug}`;

    await client.query(
      `INSERT INTO shp_apps (
         app_id,
         tenant_id,
         zone_id,
         primary_node_id,
         standby_node_id,
         slug,
         runtime_image,
         backend_port,
         storage_root,
         mode,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (slug)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         zone_id = EXCLUDED.zone_id,
         primary_node_id = EXCLUDED.primary_node_id,
         standby_node_id = EXCLUDED.standby_node_id,
         runtime_image = EXCLUDED.runtime_image,
         backend_port = EXCLUDED.backend_port,
         storage_root = EXCLUDED.storage_root,
         mode = EXCLUDED.mode,
         updated_at = EXCLUDED.updated_at`,
      [
        appId,
        `tenant-${app.tenantSlug}`,
        `zone-${app.zoneName}`,
        app.primaryNodeId,
        app.standbyNodeId ?? null,
        app.slug,
        app.runtimeImage,
        app.backendPort,
        app.storageRoot,
        app.mode
      ]
    );

    await client.query(`DELETE FROM shp_sites WHERE app_id = $1`, [appId]);

    await client.query(
      `INSERT INTO shp_sites (
         site_id,
         app_id,
         canonical_domain,
         aliases,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
       ON CONFLICT (canonical_domain)
       DO UPDATE SET
         app_id = EXCLUDED.app_id,
         aliases = EXCLUDED.aliases,
         updated_at = EXCLUDED.updated_at`,
      [`site-${app.slug}`, appId, app.canonicalDomain, JSON.stringify(app.aliases)]
    );
  }

  for (const database of resolvedSpec.databases) {
    const databaseId = `database-${database.appSlug}`;

    await client.query(
      `INSERT INTO shp_databases (
         database_id,
         app_id,
         primary_node_id,
         standby_node_id,
         engine,
         database_name,
         database_user,
         pending_migration_to,
         migration_completed_from,
         migration_completed_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (engine, database_name)
       DO UPDATE SET
         app_id = EXCLUDED.app_id,
         primary_node_id = EXCLUDED.primary_node_id,
         standby_node_id = EXCLUDED.standby_node_id,
         database_user = EXCLUDED.database_user,
         pending_migration_to = EXCLUDED.pending_migration_to,
         migration_completed_from = EXCLUDED.migration_completed_from,
         migration_completed_at = EXCLUDED.migration_completed_at,
         updated_at = EXCLUDED.updated_at`,
      [
        databaseId,
        `app-${database.appSlug}`,
        database.primaryNodeId,
        database.standbyNodeId ?? null,
        database.engine,
        database.databaseName,
        database.databaseUser,
        database.pendingMigrationTo ?? null,
        database.migrationCompletedFrom ?? null,
        database.migrationCompletedAt ?? null
      ]
    );

    if (database.desiredPassword) {
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
          databaseId,
          JSON.stringify(encodeDesiredPassword(database.desiredPassword, payloadKey))
        ]
      );
    }
  }

  for (const policy of resolvedSpec.backupPolicies) {
    await client.query(
      `INSERT INTO shp_backup_policies (
         policy_id,
         tenant_id,
         target_node_id,
         policy_slug,
         schedule,
         retention_days,
         storage_location,
         resource_selectors,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
       ON CONFLICT (policy_slug)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         target_node_id = EXCLUDED.target_node_id,
         schedule = EXCLUDED.schedule,
         retention_days = EXCLUDED.retention_days,
         storage_location = EXCLUDED.storage_location,
         resource_selectors = EXCLUDED.resource_selectors,
         updated_at = EXCLUDED.updated_at`,
      [
        `backup-policy-${policy.policySlug}`,
        `tenant-${policy.tenantSlug}`,
        policy.targetNodeId,
        policy.policySlug,
        policy.schedule,
        policy.retentionDays,
        policy.storageLocation,
        JSON.stringify(policy.resourceSelectors)
      ]
    );
  }

  await client.query(
    `DELETE FROM shp_backup_policies
     WHERE NOT (policy_id = ANY($1::text[]))`,
    [desiredBackupPolicyIds]
  );
  await client.query(
    `DELETE FROM shp_mailbox_quotas
     WHERE NOT (mailbox_id = ANY($1::text[]))`,
    [desiredMailboxIds]
  );
  await client.query(
    `DELETE FROM shp_mailbox_credentials
     WHERE NOT (mailbox_id = ANY($1::text[]))`,
    [desiredMailboxIds]
  );
  await client.query(
    `DELETE FROM shp_mail_aliases
     WHERE NOT (mail_alias_id = ANY($1::text[]))`,
    [desiredMailAliasIds]
  );
  await client.query(
    `DELETE FROM shp_mailboxes
     WHERE NOT (mailbox_id = ANY($1::text[]))`,
    [desiredMailboxIds]
  );
  await client.query(
    `DELETE FROM shp_mail_domains
     WHERE NOT (mail_domain_id = ANY($1::text[]))`,
    [desiredMailDomainIds]
  );
  await client.query(
    `DELETE FROM shp_database_credentials
     WHERE NOT (database_id = ANY($1::text[]))`,
    [desiredDatabaseIds]
  );
  await client.query(
    `DELETE FROM shp_databases
     WHERE NOT (database_id = ANY($1::text[]))`,
    [desiredDatabaseIds]
  );
  await client.query(
    `DELETE FROM shp_apps
     WHERE NOT (app_id = ANY($1::text[]))`,
    [desiredAppIds]
  );
  await client.query(
    `DELETE FROM shp_dns_zones
     WHERE NOT (zone_id = ANY($1::text[]))`,
    [desiredZoneIds]
  );
  await client.query(
    `DELETE FROM shp_nodes
     WHERE NOT (node_id = ANY($1::text[]))`,
    [desiredNodeIds]
  );
  await client.query(
    `DELETE FROM shp_tenants
     WHERE NOT (tenant_id = ANY($1::text[]))`,
    [desiredTenantIds]
  );
}

export function buildZoneRecords(
  zoneName: string,
  publicIpv4: string,
  siteRows: Array<{ canonical_domain: string; aliases: string[] }>
): DnsRecordPayload[] {
  const recordMap = new Map<string, DnsRecordPayload>();

  for (const site of siteRows) {
    const hostnames = [site.canonical_domain, ...site.aliases];

    for (const hostname of hostnames) {
      const name = relativeRecordNameForZone(hostname, zoneName);
      const key = `${name}:A:${publicIpv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name,
          type: "A",
          value: publicIpv4,
          ttl: 300
        });
      }
    }
  }

  return [...recordMap.values()].sort((left, right) =>
    `${left.name}:${left.type}:${left.value}`.localeCompare(
      `${right.name}:${right.type}:${right.value}`
    )
  );
}

export function buildMailWebDocumentRoot(tenantSlug: string, domainName: string): string {
  return `/srv/www/roundcube/${tenantSlug}/${domainName}/public`;
}

export function buildMailPolicyDocumentRoot(tenantSlug: string, domainName: string): string {
  return `/srv/www/mail-policies/${tenantSlug}/${domainName}/public`;
}

function normalizeDnsTargetHost(hostname: string): string {
  return `${hostname.replace(/\.$/, "").toLowerCase()}.`;
}

const dnsTxtSegmentLimit = 255;

function unescapeDnsTxtSegment(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

function decodeDnsTxtRecordValue(value: string): string {
  const trimmed = value.trim();
  const quotedSegments = [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) =>
    unescapeDnsTxtSegment(match[1] ?? "")
  );

  if (quotedSegments.length > 0) {
    return quotedSegments.join("").trim();
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return unescapeDnsTxtSegment(trimmed.slice(1, -1)).trim();
  }

  return trimmed;
}

function normalizeTxtRecordValue(value: string): string {
  return decodeDnsTxtRecordValue(value).toLowerCase();
}

function quoteDnsTxtRecordValue(value: string): string {
  const decoded = decodeDnsTxtRecordValue(value);

  if (!decoded) {
    return '""';
  }

  const segments: string[] = [];

  for (let index = 0; index < decoded.length; index += dnsTxtSegmentLimit) {
    segments.push(
      `"${decoded
        .slice(index, index + dnsTxtSegmentLimit)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')}"`
    );
  }

  return segments.join(" ");
}

function isSpfTxtRecord(value: string): boolean {
  return normalizeTxtRecordValue(value).startsWith("v=spf1");
}

function isDmarcTxtRecord(value: string): boolean {
  return normalizeTxtRecordValue(value).startsWith("v=dmarc1");
}

function isDkimTxtRecord(value: string): boolean {
  return normalizeTxtRecordValue(value).startsWith("v=dkim1");
}

function isMtaStsTxtRecord(value: string): boolean {
  return normalizeTxtRecordValue(value).startsWith("v=stsv1");
}

function isTlsRptTxtRecord(value: string): boolean {
  return normalizeTxtRecordValue(value).startsWith("v=tlsrptv1");
}

export function buildMailReportAddress(domainName: string): string {
  return `postmaster@${domainName}`.toLowerCase();
}

function buildMailSpfRecordValue(): string {
  return quoteDnsTxtRecordValue("v=spf1 mx -all");
}

function buildMailDmarcRecordValue(domainName: string): string {
  const reportAddress = buildMailReportAddress(domainName);
  return quoteDnsTxtRecordValue(
    `v=DMARC1; p=quarantine; adkim=s; aspf=s; fo=1; pct=100; rua=mailto:${reportAddress}; ruf=mailto:${reportAddress}`
  );
}

function buildMailTlsRptRecordValue(domainName: string): string {
  const reportAddress = buildMailReportAddress(domainName);
  return quoteDnsTxtRecordValue(`v=TLSRPTv1; rua=mailto:${reportAddress}`);
}

export function buildMailMtaStsHostname(domainName: string): string {
  return `mta-sts.${domainName}`;
}

function buildMailMtaStsPolicyId(domain: Pick<MailDnsDomainRow, "domain_name" | "mail_host" | "dkim_selector">): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        domainName: domain.domain_name,
        mailHost: domain.mail_host,
        dkimSelector: domain.dkim_selector,
        mode: "enforce",
        maxAgeSeconds: 86400
      })
    )
    .digest("hex")
    .slice(0, 12);
}

export interface MailDkimRuntimeRecord {
  domainName: string;
  dkimDnsTxtValue?: string;
}

function resolveZoneRecordName(hostname: string, zoneName: string): string | null {
  try {
    return relativeRecordNameForZone(hostname, zoneName);
  } catch {
    return null;
  }
}

export function mergeDerivedDnsRecords(
  explicitRecords: DnsRecordPayload[],
  derivedRecords: DnsRecordPayload[]
): DnsRecordPayload[] {
  const explicitAddressNames = new Set(
    explicitRecords
      .filter(
        (record) =>
          record.type === "A" || record.type === "AAAA" || record.type === "CNAME"
      )
      .map((record) => record.name.toLowerCase())
  );
  const explicitMxNames = new Set(
    explicitRecords
      .filter((record) => record.type === "MX")
      .map((record) => record.name.toLowerCase())
  );
  const explicitSpfNames = new Set(
    explicitRecords
      .filter((record) => record.type === "TXT" && isSpfTxtRecord(record.value))
      .map((record) => record.name.toLowerCase())
  );
  const explicitDmarcNames = new Set(
    explicitRecords
      .filter((record) => record.type === "TXT" && isDmarcTxtRecord(record.value))
      .map((record) => record.name.toLowerCase())
  );
  const explicitMtaStsNames = new Set(
    explicitRecords
      .filter((record) => record.type === "TXT" && isMtaStsTxtRecord(record.value))
      .map((record) => record.name.toLowerCase())
  );
  const explicitTlsRptNames = new Set(
    explicitRecords
      .filter((record) => record.type === "TXT" && isTlsRptTxtRecord(record.value))
      .map((record) => record.name.toLowerCase())
  );
  const explicitDkimNames = new Set(
    explicitRecords
      .filter((record) => record.type === "TXT" && isDkimTxtRecord(record.value))
      .map((record) => record.name.toLowerCase())
  );

  const filteredDerivedRecords = derivedRecords.filter((record) => {
    const normalizedName = record.name.toLowerCase();

    if (
      (record.type === "A" || record.type === "AAAA" || record.type === "CNAME") &&
      explicitAddressNames.has(normalizedName)
    ) {
      return false;
    }

    if (record.type === "MX" && explicitMxNames.has(normalizedName)) {
      return false;
    }

    if (record.type === "TXT" && isSpfTxtRecord(record.value) && explicitSpfNames.has(normalizedName)) {
      return false;
    }

    if (
      record.type === "TXT" &&
      isDmarcTxtRecord(record.value) &&
      explicitDmarcNames.has(normalizedName)
    ) {
      return false;
    }

    if (
      record.type === "TXT" &&
      isMtaStsTxtRecord(record.value) &&
      explicitMtaStsNames.has(normalizedName)
    ) {
      return false;
    }

    if (
      record.type === "TXT" &&
      isTlsRptTxtRecord(record.value) &&
      explicitTlsRptNames.has(normalizedName)
    ) {
      return false;
    }

    if (
      record.type === "TXT" &&
      isDkimTxtRecord(record.value) &&
      explicitDkimNames.has(normalizedName)
    ) {
      return false;
    }

    return true;
  });

  return normalizeDnsRecords([...explicitRecords, ...filteredDerivedRecords]);
}

export function buildMailZoneRecords(
  zoneName: string,
  mailDomainRows: MailDnsDomainRow[],
  dkimRuntimeRecords: MailDkimRuntimeRecord[] = []
): DnsRecordPayload[] {
  const recordMap = new Map<string, DnsRecordPayload>();
  const dkimRuntimeByDomain = new Map(
    dkimRuntimeRecords.map((record) => [record.domainName, record] as const)
  );

  for (const domain of mailDomainRows) {
    const mailRecordName = resolveZoneRecordName(domain.mail_host, zoneName);
    const webmailHostname = `webmail.${domain.domain_name}`;
    const webmailRecordName = resolveZoneRecordName(webmailHostname, zoneName);
    const mtaStsHostname = buildMailMtaStsHostname(domain.domain_name);
    const mtaStsRecordName = resolveZoneRecordName(mtaStsHostname, zoneName);

    if (mailRecordName) {
      const key = `${mailRecordName}:A:${domain.public_ipv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: mailRecordName,
          type: "A",
          value: domain.public_ipv4,
          ttl: 300
        });
      }
    }

    if (webmailRecordName) {
      const key = `${webmailRecordName}:A:${domain.public_ipv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: webmailRecordName,
          type: "A",
          value: domain.public_ipv4,
          ttl: 300
        });
      }
    }

    if (mtaStsRecordName) {
      const key = `${mtaStsRecordName}:A:${domain.public_ipv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: mtaStsRecordName,
          type: "A",
          value: domain.public_ipv4,
          ttl: 300
        });
      }
    }

    const mxKey = `@:MX:${domain.mail_host}`;

    if (!recordMap.has(mxKey)) {
      recordMap.set(mxKey, {
        name: "@",
        type: "MX",
        value: `10 ${normalizeDnsTargetHost(domain.mail_host)}`,
        ttl: 300
      });
    }

    const spfValue = buildMailSpfRecordValue();
    const spfKey = `@:TXT:${spfValue}`;

    if (!recordMap.has(spfKey)) {
      recordMap.set(spfKey, {
        name: "@",
        type: "TXT",
        value: spfValue,
        ttl: 300
      });
    }

    const dmarcValue = buildMailDmarcRecordValue(domain.domain_name);
    const dmarcKey = `_dmarc:TXT:${dmarcValue}`;

    if (!recordMap.has(dmarcKey)) {
      recordMap.set(dmarcKey, {
        name: "_dmarc",
        type: "TXT",
        value: dmarcValue,
        ttl: 300
      });
    }

    const tlsRptValue = buildMailTlsRptRecordValue(domain.domain_name);
    const tlsRptKey = `_smtp._tls:TXT:${tlsRptValue}`;

    if (!recordMap.has(tlsRptKey)) {
      recordMap.set(tlsRptKey, {
        name: "_smtp._tls",
        type: "TXT",
        value: tlsRptValue,
        ttl: 300
      });
    }

    const mtaStsValue = quoteDnsTxtRecordValue(
      `v=STSv1; id=${buildMailMtaStsPolicyId(domain)}`
    );
    const mtaStsKey = `_mta-sts:TXT:${mtaStsValue}`;

    if (!recordMap.has(mtaStsKey)) {
      recordMap.set(mtaStsKey, {
        name: "_mta-sts",
        type: "TXT",
        value: mtaStsValue,
        ttl: 300
      });
    }

    const dkimRuntimeRecord = dkimRuntimeByDomain.get(domain.domain_name);
    const dkimTxtValue = dkimRuntimeRecord?.dkimDnsTxtValue;

    if (dkimTxtValue) {
      const dkimRecordName = `${domain.dkim_selector}._domainkey`;
      const quotedDkimValue = quoteDnsTxtRecordValue(dkimTxtValue);
      const dkimKey = `${dkimRecordName}:TXT:${quotedDkimValue}`;

      if (!recordMap.has(dkimKey)) {
        recordMap.set(dkimKey, {
          name: dkimRecordName,
          type: "TXT",
          value: quotedDkimValue,
          ttl: 300
        });
      }
    }
  }

  return [...recordMap.values()].sort((left, right) =>
    `${left.name}:${left.type}:${left.value}`.localeCompare(
      `${right.name}:${right.type}:${right.value}`
    )
  );
}

function resolveDefaultPrimaryNodeId(inventory: PlatformInventoryDocument): string {
  return inventory.platform.postgresql_control.primary_node;
}

function resolveAppPrimaryNodeId(
  inventory: PlatformInventoryDocument,
  app: PlatformInventoryApp
): string {
  return app.database.engine === "postgresql"
    ? inventory.platform.postgresql_apps.primary_node
    : inventory.platform.mariadb_apps.primary_node;
}

function resolveAppStandbyNodeId(
  inventory: PlatformInventoryDocument,
  app: PlatformInventoryApp
): string | null {
  if (app.mode !== "active-passive") {
    return null;
  }

  return app.database.engine === "postgresql"
    ? inventory.platform.postgresql_apps.standby_node
    : inventory.platform.mariadb_apps.replica_node;
}

function resolveDatabaseStandbyNodeId(
  inventory: PlatformInventoryDocument,
  app: PlatformInventoryApp
): string | null {
  return app.database.engine === "postgresql"
    ? inventory.platform.postgresql_apps.standby_node
    : inventory.platform.mariadb_apps.replica_node;
}

export function normalizeDnsRecords(records: DnsRecordPayload[]): DnsRecordPayload[] {
  const unique = new Map<string, DnsRecordPayload>();

  for (const record of records) {
    const key = `${record.name}:${record.type}:${record.value}:${record.ttl}`;

    if (!unique.has(key)) {
      unique.set(key, {
        name: record.name,
        type: record.type,
        value: record.value,
        ttl: record.ttl
      });
    }
  }

  return [...unique.values()].sort((left, right) =>
    `${left.name}:${left.type}:${left.value}:${left.ttl}`.localeCompare(
      `${right.name}:${right.type}:${right.value}:${right.ttl}`
    )
  );
}

export function buildDesiredStateSpecFromInventory(
  inventory: PlatformInventoryDocument
): DesiredStateSpec {
  const tenants: DesiredStateTenantInput[] = [
    ...new Map(
      inventory.apps.map((app) => [
        app.client,
        {
          slug: app.client,
          displayName: titleizeSlug(app.client)
        } satisfies DesiredStateTenantInput
      ])
    ).values()
  ].sort((left, right) => left.slug.localeCompare(right.slug));
  const nodes: DesiredStateNodeInput[] = Object.entries(inventory.nodes)
    .map(([nodeId, node]) => ({
      nodeId,
      hostname: node.hostname,
      publicIpv4: node.public_ipv4,
      wireguardAddress: node.wireguard_address
    }))
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const apps: DesiredStateAppInput[] = inventory.apps
    .map((app) => ({
      slug: app.slug,
      tenantSlug: app.client,
      zoneName: app.zone,
      primaryNodeId: resolveAppPrimaryNodeId(inventory, app),
      standbyNodeId: resolveAppStandbyNodeId(inventory, app) ?? undefined,
      canonicalDomain: app.canonical_domain,
      aliases: app.aliases,
      backendPort: app.backend_port,
      runtimeImage: app.runtime_image,
      storageRoot: app.storage_root,
      mode: app.mode
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const zones: DesiredStateZoneInput[] = [...new Set(inventory.apps.map((app) => app.zone))]
    .map((zoneName) => {
      const zoneApps = inventory.apps.filter((app) => app.zone === zoneName);
      const primaryNodeId = resolveDefaultPrimaryNodeId(inventory);
      const publicIpv4 = inventory.nodes[primaryNodeId]?.public_ipv4;

      return {
        zoneName,
        tenantSlug: zoneApps[0]!.client,
        primaryNodeId,
        records: normalizeDnsRecords(
          publicIpv4
            ? buildZoneRecords(
                zoneName,
                publicIpv4,
                zoneApps.map((app) => ({
                  canonical_domain: app.canonical_domain,
                  aliases: app.aliases
                }))
              )
            : []
        )
      };
    })
    .sort((left, right) => left.zoneName.localeCompare(right.zoneName));
  const databases: DesiredStateDatabaseInput[] = inventory.apps
    .map((app) => ({
      appSlug: app.slug,
      engine: app.database.engine,
      databaseName: app.database.name,
      databaseUser: app.database.user,
      primaryNodeId:
        app.database.engine === "postgresql"
          ? inventory.platform.postgresql_apps.primary_node
          : inventory.platform.mariadb_apps.primary_node,
      standbyNodeId: resolveDatabaseStandbyNodeId(inventory, app) ?? undefined,
      pendingMigrationTo: app.database.pending_migration_to,
      migrationCompletedFrom: app.database.migration_completed_from,
      migrationCompletedAt: app.database.migration_completed_at
    }))
    .sort((left, right) => left.appSlug.localeCompare(right.appSlug));

  return {
    tenants,
    nodes,
    zones,
    apps,
    databases,
    backupPolicies: [],
    mailDomains: [],
    mailboxes: [],
    mailAliases: [],
    mailboxQuotas: []
  };
}

export function summarizeDesiredStateSpec(
  spec: DesiredStateSpec
): DesiredStateApplyResponse["summary"] {
  return {
    tenantCount: spec.tenants.length,
    nodeCount: spec.nodes.length,
    zoneCount: spec.zones.length,
    recordCount: spec.zones.reduce((count, zone) => count + zone.records.length, 0),
    appCount: spec.apps.length,
    databaseCount: spec.databases.length,
    backupPolicyCount: spec.backupPolicies.length,
    mailDomainCount: spec.mailDomains.length,
    mailboxCount: spec.mailboxes.length,
    mailAliasCount: spec.mailAliases.length,
    mailboxQuotaCount: spec.mailboxQuotas.length
  };
}

function ensureUnique(values: string[], label: string): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}.`);
    }

    seen.add(value);
  }
}

export function validateDesiredStateSpec(spec: DesiredStateSpec): void {
  const mailPolicy = normalizeMailPolicy(spec.mailPolicy);

  ensureUnique(
    spec.tenants.map((tenant) => tenant.slug),
    "tenant slug"
  );
  ensureUnique(
    spec.nodes.map((node) => node.nodeId),
    "node id"
  );
  ensureUnique(
    spec.zones.map((zone) => zone.zoneName),
    "zone name"
  );
  ensureUnique(
    spec.apps.map((app) => app.slug),
    "app slug"
  );
  ensureUnique(
    spec.apps.map((app) => app.canonicalDomain),
    "site canonical domain"
  );
  ensureUnique(
    spec.databases.map((database) => `${database.engine}:${database.databaseName}`),
    "database name"
  );
  ensureUnique(
    spec.databases.map((database) => `${database.engine}:${database.databaseUser}`),
    "database user"
  );
  ensureUnique(
    spec.backupPolicies.map((policy) => policy.policySlug),
    "backup policy slug"
  );
  ensureUnique(
    spec.mailDomains.map((mailDomain) => mailDomain.domainName),
    "mail domain"
  );
  ensureUnique(
    spec.mailDomains.map((mailDomain) => mailDomain.mailHost),
    "mail host"
  );
  ensureUnique(
    spec.mailboxes.map((mailbox) => mailbox.address),
    "mailbox address"
  );
  ensureUnique(
    spec.mailAliases.map((mailAlias) => mailAlias.address),
    "mail alias address"
  );
  ensureUnique(
    spec.mailboxQuotas.map((quota) => quota.mailboxAddress),
    "mailbox quota"
  );
  ensureUnique(mailPolicy.senderAllowlist, "mail sender allowlist entry");
  ensureUnique(mailPolicy.senderDenylist, "mail sender denylist entry");

  if (!Number.isFinite(mailPolicy.addHeaderThreshold) || mailPolicy.addHeaderThreshold <= 0) {
    throw new Error("Mail policy add-header threshold must be positive.");
  }

  if (!Number.isFinite(mailPolicy.rejectThreshold) || mailPolicy.rejectThreshold <= 0) {
    throw new Error("Mail policy reject threshold must be positive.");
  }

  if (mailPolicy.addHeaderThreshold >= mailPolicy.rejectThreshold) {
    throw new Error("Mail policy reject threshold must be greater than add-header threshold.");
  }

  if (
    mailPolicy.greylistThreshold !== undefined &&
    (!Number.isFinite(mailPolicy.greylistThreshold) || mailPolicy.greylistThreshold <= 0)
  ) {
    throw new Error("Mail policy greylist threshold must be positive when enabled.");
  }

  if (
    mailPolicy.greylistThreshold !== undefined &&
    mailPolicy.greylistThreshold >= mailPolicy.addHeaderThreshold
  ) {
    throw new Error(
      "Mail policy greylist threshold must stay below add-header threshold."
    );
  }

  if (
    mailPolicy.rateLimit &&
    (!Number.isInteger(mailPolicy.rateLimit.burst) || mailPolicy.rateLimit.burst <= 0)
  ) {
    throw new Error("Mail policy rate-limit burst must be a positive integer.");
  }

  if (
    mailPolicy.rateLimit &&
    (!Number.isInteger(mailPolicy.rateLimit.periodSeconds) ||
      mailPolicy.rateLimit.periodSeconds <= 0)
  ) {
    throw new Error("Mail policy rate-limit window must be a positive integer.");
  }

  for (const entry of [...mailPolicy.senderAllowlist, ...mailPolicy.senderDenylist]) {
    if (!isValidMailSenderPolicyEntry(entry)) {
      throw new Error(
        `Mail policy sender entry ${entry} must be a mailbox address or @domain.`
      );
    }
  }

  for (const entry of mailPolicy.senderAllowlist) {
    if (mailPolicy.senderDenylist.includes(entry)) {
      throw new Error(`Mail policy sender entry ${entry} cannot be allowlisted and denylisted.`);
    }
  }

  const tenantSlugs = new Set(spec.tenants.map((tenant) => tenant.slug));
  const nodeIds = new Set(spec.nodes.map((node) => node.nodeId));
  const zonesByName = new Map(spec.zones.map((zone) => [zone.zoneName, zone]));
  const appsBySlug = new Map(spec.apps.map((app) => [app.slug, app]));
  const mailDomainsByName = new Map(spec.mailDomains.map((mailDomain) => [mailDomain.domainName, mailDomain]));
  const mailboxAddresses = new Set(spec.mailboxes.map((mailbox) => mailbox.address));
  const aliasAddresses = new Set(spec.mailAliases.map((mailAlias) => mailAlias.address));

  for (const address of mailboxAddresses) {
    if (aliasAddresses.has(address)) {
      throw new Error(`Address ${address} cannot be both a mailbox and an alias.`);
    }
  }

  for (const zone of spec.zones) {
    if (!tenantSlugs.has(zone.tenantSlug)) {
      throw new Error(`Zone ${zone.zoneName} references unknown tenant ${zone.tenantSlug}.`);
    }

    if (!nodeIds.has(zone.primaryNodeId)) {
      throw new Error(`Zone ${zone.zoneName} references unknown node ${zone.primaryNodeId}.`);
    }
  }

  for (const app of spec.apps) {
    if (!tenantSlugs.has(app.tenantSlug)) {
      throw new Error(`Application ${app.slug} references unknown tenant ${app.tenantSlug}.`);
    }

    const zone = zonesByName.get(app.zoneName);

    if (!zone) {
      throw new Error(`Application ${app.slug} references unknown zone ${app.zoneName}.`);
    }

    if (zone.tenantSlug !== app.tenantSlug) {
      throw new Error(
        `Application ${app.slug} tenant ${app.tenantSlug} does not match zone tenant ${zone.tenantSlug}.`
      );
    }

    if (!nodeIds.has(app.primaryNodeId)) {
      throw new Error(`Application ${app.slug} references unknown node ${app.primaryNodeId}.`);
    }

    if (app.standbyNodeId && !nodeIds.has(app.standbyNodeId)) {
      throw new Error(
        `Application ${app.slug} references unknown standby node ${app.standbyNodeId}.`
      );
    }
  }

  for (const mailDomain of spec.mailDomains) {
    if (!tenantSlugs.has(mailDomain.tenantSlug)) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} references unknown tenant ${mailDomain.tenantSlug}.`
      );
    }

    const zone = zonesByName.get(mailDomain.zoneName);

    if (!zone) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} references unknown zone ${mailDomain.zoneName}.`
      );
    }

    if (zone.tenantSlug !== mailDomain.tenantSlug) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} tenant ${mailDomain.tenantSlug} does not match zone tenant ${zone.tenantSlug}.`
      );
    }

    if (mailDomain.domainName !== zone.zoneName) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} must use zone ${mailDomain.domainName}. The current mail DNS model only supports zone-apex mail domains.`
      );
    }

    if (!nodeIds.has(mailDomain.primaryNodeId)) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} references unknown node ${mailDomain.primaryNodeId}.`
      );
    }

    if (mailDomain.standbyNodeId && !nodeIds.has(mailDomain.standbyNodeId)) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} references unknown standby node ${mailDomain.standbyNodeId}.`
      );
    }

    if (mailDomain.standbyNodeId && mailDomain.standbyNodeId === mailDomain.primaryNodeId) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} must use a different standby node than the primary node.`
      );
    }

    if (normalizeHostnameValue(mailDomain.mailHost) === normalizeHostnameValue(mailDomain.domainName)) {
      throw new Error(
        `Mail domain ${mailDomain.domainName} must use a dedicated mail host below the domain, not the apex itself.`
      );
    }

    if (
      !normalizeHostnameValue(mailDomain.mailHost).endsWith(
        `.${normalizeHostnameValue(mailDomain.domainName)}`
      )
    ) {
      throw new Error(
        `Mail host ${mailDomain.mailHost} must stay under ${mailDomain.domainName} so MX and failover stay consistent.`
      );
    }

    for (const record of zone.records) {
      if (record.type !== "MX" || record.name.toLowerCase() !== "@") {
        continue;
      }

      const target = parseMxRecordTarget(record.value);

      if (target && target !== normalizeHostnameValue(mailDomain.mailHost)) {
        throw new Error(
          `Mail domain ${mailDomain.domainName} cannot publish MX ${record.value}. SimpleHostMan keeps MX aligned with ${mailDomain.mailHost}.`
        );
      }
    }
  }

  for (const mailbox of spec.mailboxes) {
    const mailDomain = mailDomainsByName.get(mailbox.domainName);

    if (!mailDomain) {
      throw new Error(
        `Mailbox ${mailbox.address} references unknown mail domain ${mailbox.domainName}.`
      );
    }

    const expectedAddress = `${mailbox.localPart}@${mailbox.domainName}`;

    if (mailbox.address !== expectedAddress) {
      throw new Error(
        `Mailbox ${mailbox.address} does not match local part ${mailbox.localPart} and domain ${mailbox.domainName}.`
      );
    }

    if (!nodeIds.has(mailbox.primaryNodeId)) {
      throw new Error(
        `Mailbox ${mailbox.address} references unknown node ${mailbox.primaryNodeId}.`
      );
    }

    if (mailbox.standbyNodeId && !nodeIds.has(mailbox.standbyNodeId)) {
      throw new Error(
        `Mailbox ${mailbox.address} references unknown standby node ${mailbox.standbyNodeId}.`
      );
    }

    if (mailbox.standbyNodeId && mailbox.standbyNodeId === mailbox.primaryNodeId) {
      throw new Error(
        `Mailbox ${mailbox.address} must use a different standby node than the primary node.`
      );
    }

    if (mailbox.primaryNodeId !== mailDomain.primaryNodeId) {
      throw new Error(
        `Mailbox ${mailbox.address} primary node ${mailbox.primaryNodeId} does not match mail domain ${mailDomain.domainName} primary node ${mailDomain.primaryNodeId}.`
      );
    }

    if (mailDomain.standbyNodeId) {
      if (mailbox.standbyNodeId !== mailDomain.standbyNodeId) {
        throw new Error(
          `Mailbox ${mailbox.address} must follow the same standby node as mail domain ${mailDomain.domainName} so failover stays coherent.`
        );
      }
    } else if (mailbox.standbyNodeId) {
      throw new Error(
        `Mailbox ${mailbox.address} cannot define a standby node before mail domain ${mailDomain.domainName} has one.`
      );
    }
  }

  for (const mailAlias of spec.mailAliases) {
    if (!mailDomainsByName.has(mailAlias.domainName)) {
      throw new Error(
        `Mail alias ${mailAlias.address} references unknown mail domain ${mailAlias.domainName}.`
      );
    }

    const expectedAddress = `${mailAlias.localPart}@${mailAlias.domainName}`;

    if (mailAlias.address !== expectedAddress) {
      throw new Error(
        `Mail alias ${mailAlias.address} does not match local part ${mailAlias.localPart} and domain ${mailAlias.domainName}.`
      );
    }

    if (mailAlias.destinations.length === 0) {
      throw new Error(`Mail alias ${mailAlias.address} must include at least one destination.`);
    }
  }

  const aliasLoop = findMailAliasLoop(spec.mailAliases);

  if (aliasLoop) {
    throw new Error(
      `Mail alias loop detected: ${aliasLoop.join(" -> ")}. Update the alias chain so it ends in a mailbox or external address.`
    );
  }

  for (const quota of spec.mailboxQuotas) {
    if (!mailboxAddresses.has(quota.mailboxAddress)) {
      throw new Error(
        `Mailbox quota ${quota.mailboxAddress} references unknown mailbox ${quota.mailboxAddress}.`
      );
    }

    if (!Number.isFinite(quota.storageBytes) || quota.storageBytes <= 0) {
      throw new Error(
        `Mailbox quota ${quota.mailboxAddress} must define a positive storage limit.`
      );
    }

    if (quota.storageBytes < minimumMailboxQuotaBytes) {
      throw new Error(
        `Mailbox quota ${quota.mailboxAddress} must be at least ${formatStorageBytesForValidation(minimumMailboxQuotaBytes)} so the current mail stack has usable headroom.`
      );
    }

    if (quota.storageBytes > maximumMailboxQuotaBytes) {
      throw new Error(
        `Mailbox quota ${quota.mailboxAddress} must stay below ${formatStorageBytesForValidation(maximumMailboxQuotaBytes)} in the current mail model.`
      );
    }
  }

  for (const database of spec.databases) {
    const app = appsBySlug.get(database.appSlug);

    if (!app) {
      throw new Error(
        `Database ${database.databaseName} references unknown application ${database.appSlug}.`
      );
    }

    if (!nodeIds.has(database.primaryNodeId)) {
      throw new Error(
        `Database ${database.databaseName} references unknown node ${database.primaryNodeId}.`
      );
    }

    if (database.standbyNodeId && !nodeIds.has(database.standbyNodeId)) {
      throw new Error(
        `Database ${database.databaseName} references unknown standby node ${database.standbyNodeId}.`
      );
    }

    if (database.engine !== "postgresql" && database.engine !== "mariadb") {
      throw new Error(`Database ${database.databaseName} uses unsupported engine ${database.engine}.`);
    }

    if (database.pendingMigrationTo && database.pendingMigrationTo === database.engine) {
      throw new Error(
        `Database ${database.databaseName} pending migration target matches the current engine.`
      );
    }

    if (database.migrationCompletedFrom && database.migrationCompletedFrom === database.engine) {
      throw new Error(
        `Database ${database.databaseName} migration completed source matches the current engine.`
      );
    }

    if (database.pendingMigrationTo && database.migrationCompletedFrom) {
      throw new Error(
        `Database ${database.databaseName} cannot be pending migration and completed migration at the same time.`
      );
    }

    if (database.migrationCompletedAt && !database.migrationCompletedFrom) {
      throw new Error(
        `Database ${database.databaseName} defines migration completed time without a source engine.`
      );
    }

    if (database.migrationCompletedAt) {
      const parsedMigrationCompletedAt = Date.parse(database.migrationCompletedAt);

      if (Number.isNaN(parsedMigrationCompletedAt)) {
        throw new Error(
          `Database ${database.databaseName} uses an invalid migration completed timestamp ${database.migrationCompletedAt}.`
        );
      }
    }

    if (app.primaryNodeId !== database.primaryNodeId) {
      throw new Error(
        `Database ${database.databaseName} primary node ${database.primaryNodeId} does not match app ${app.slug} primary node ${app.primaryNodeId}.`
      );
    }
  }

  for (const policy of spec.backupPolicies) {
    if (!tenantSlugs.has(policy.tenantSlug)) {
      throw new Error(
        `Backup policy ${policy.policySlug} references unknown tenant ${policy.tenantSlug}.`
      );
    }

    if (!nodeIds.has(policy.targetNodeId)) {
      throw new Error(
        `Backup policy ${policy.policySlug} references unknown node ${policy.targetNodeId}.`
      );
    }
  }
}

export function upsertSpecItem<T>(
  items: T[],
  next: T,
  getKey: (item: T) => string,
  originalKey?: string
): T[] {
  const normalizedOriginalKey = originalKey?.trim();
  const nextKey = getKey(next);
  const filtered = items.filter((item) => {
    const key = getKey(item);
    return key !== nextKey && (!normalizedOriginalKey || key !== normalizedOriginalKey);
  });

  return [...filtered, next].sort((left, right) =>
    getKey(left).localeCompare(getKey(right))
  );
}

export function removeSpecItem<T>(
  items: T[],
  targetKey: string,
  getKey: (item: T) => string
): T[] {
  return items.filter((item) => getKey(item) !== targetKey);
}

export async function buildMailOverview(client: PoolClient): Promise<MailOverview> {
  const spec = await buildDesiredStateSpecFromDatabase(client, null);
  const credentialResult = await client.query<{
    address: string;
    credential_state: "missing" | "configured" | "reset_required" | null;
    updated_at: Date | string | null;
  }>(
    `SELECT mailboxes.address, credentials.credential_state, credentials.updated_at
     FROM shp_mailbox_credentials credentials
     INNER JOIN shp_mailboxes mailboxes
       ON mailboxes.mailbox_id = credentials.mailbox_id
     ORDER BY mailboxes.address ASC`
  );
  const credentialRowsByAddress = new Map(
    credentialResult.rows.map((row) => [row.address, row] as const)
  );
  const quotasByMailbox = new Map(
    spec.mailboxQuotas.map((quota) => [quota.mailboxAddress, quota.storageBytes] as const)
  );
  const mailboxesByDomain = new Map<string, number>();
  const aliasesByDomain = new Map<string, number>();
  const mailboxDomainByAddress = new Map<string, string>();

  for (const mailbox of spec.mailboxes) {
    mailboxDomainByAddress.set(mailbox.address, mailbox.domainName);
    mailboxesByDomain.set(
      mailbox.domainName,
      (mailboxesByDomain.get(mailbox.domainName) ?? 0) + 1
    );
  }

  for (const alias of spec.mailAliases) {
    aliasesByDomain.set(alias.domainName, (aliasesByDomain.get(alias.domainName) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    policy: spec.mailPolicy,
    domains: spec.mailDomains.map((domain) => ({
      ...domain,
      mailboxCount: mailboxesByDomain.get(domain.domainName) ?? 0,
      aliasCount: aliasesByDomain.get(domain.domainName) ?? 0
    })),
    mailboxes: spec.mailboxes.map((mailbox) => ({
      ...mailbox,
      hasCredential:
        normalizeMailboxCredentialState(
          credentialRowsByAddress.get(mailbox.address)?.credential_state,
          Boolean(mailbox.desiredPassword)
        ) === "configured",
      credentialState: normalizeMailboxCredentialState(
        credentialRowsByAddress.get(mailbox.address)?.credential_state,
        Boolean(mailbox.desiredPassword)
      ),
      quotaBytes: quotasByMailbox.get(mailbox.address),
      credentialUpdatedAt: credentialRowsByAddress.get(mailbox.address)?.updated_at
        ? new Date(
            credentialRowsByAddress.get(mailbox.address)?.updated_at as Date | string
          ).toISOString()
        : undefined
    })),
    aliases: spec.mailAliases,
    quotas: spec.mailboxQuotas.map((quota) => ({
      ...quota,
      domainName: mailboxDomainByAddress.get(quota.mailboxAddress) ?? "unknown"
    }))
  };
}

interface ControlPlaneSpecContext {
  pool: Pool;
  options: ControlPlaneStoreOptions;
  jobPayloadKey: Buffer | null;
}

export function createControlPlaneSpecMethods(
  context: ControlPlaneSpecContext
): ControlPlaneSpecMethods {
  const { pool, options, jobPayloadKey } = context;

  const mutateDesiredStateAsUser = async (
    presentedToken: string | null,
    reason: string,
    eventType: string,
    entityType: string,
    entityId: string,
    mutate: (spec: DesiredStateSpec) => DesiredStateSpec
  ): Promise<MailOverview> =>
    withTransaction(pool, async (client) => {
      const actor = await requireAuthorizedUser(client, presentedToken, [
        "platform_admin",
        "platform_operator"
      ]);
      const currentSpec = await buildDesiredStateSpecFromDatabase(client, jobPayloadKey);
      const nextSpec = mutate(currentSpec);

      await applyDesiredStateSpec(client, nextSpec, jobPayloadKey);

      await insertAuditEvent(client, {
        actorType: "user",
        actorId: actor.userId,
        eventType,
        entityType,
        entityId,
        payload: {
          reason
        }
      });

      return buildMailOverview(client);
    });

  const updateMailboxCredentialTimestamps = async (
    client: PoolClient,
    mailboxAddress: string,
    options: {
      generated?: boolean;
      rotated?: boolean;
      reset?: boolean;
    }
  ): Promise<void> => {
    await client.query(
      `UPDATE shp_mailbox_credentials credentials
       SET
         generated_at = CASE WHEN $2 THEN NOW() ELSE credentials.generated_at END,
         rotated_at = CASE WHEN $3 THEN NOW() ELSE credentials.rotated_at END,
         reset_at = CASE WHEN $4 THEN NOW() ELSE credentials.reset_at END
       FROM shp_mailboxes mailboxes
       WHERE mailboxes.mailbox_id = credentials.mailbox_id
         AND mailboxes.address = $1`,
      [mailboxAddress, options.generated ?? false, options.rotated ?? false, options.reset ?? false]
    );
  };

  const consumeMailboxCredentialRevealById = async (
    client: PoolClient,
    revealId: string,
    actorId: string
  ): Promise<MailboxCredentialReveal | null> => {
    const result = await client.query<{
      reveal_id: string;
      action: "generated" | "rotated";
      secret_payload: Record<string, unknown>;
      created_at: Date | string;
      address: string;
    }>(
      `WITH consumed_reveal AS (
         UPDATE shp_mailbox_credential_reveals reveals
         SET consumed_at = NOW()
         WHERE reveals.reveal_id = $1
           AND reveals.actor_id = $2
           AND reveals.consumed_at IS NULL
           AND reveals.expires_at > NOW()
         RETURNING
           reveals.reveal_id,
           reveals.mailbox_id,
           reveals.action,
           reveals.secret_payload,
           reveals.created_at
       )
       SELECT
         consumed_reveal.reveal_id,
         consumed_reveal.action,
         consumed_reveal.secret_payload,
         consumed_reveal.created_at,
         mailboxes.address
       FROM consumed_reveal
       INNER JOIN shp_mailboxes mailboxes
         ON mailboxes.mailbox_id = consumed_reveal.mailbox_id`,
      [revealId, actorId]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const credential = decodeDesiredPassword(row.secret_payload, jobPayloadKey);

    if (!credential) {
      return null;
    }
    return {
      revealId: row.reveal_id,
      mailboxAddress: row.address,
      credential,
      action: row.action,
      generatedAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString()
    };
  };

  return {
    async importInventory(request, presentedToken) {
      const sourcePath = request.path?.trim() || options.defaultInventoryImportPath;
      const inventory = await readPlatformInventory(sourcePath);
      const desiredStateSpec = buildDesiredStateSpecFromInventory(inventory);
      const importedAt = new Date().toISOString();
      const importId = `import-${randomUUID()}`;

      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        await applyDesiredStateSpec(client, desiredStateSpec, jobPayloadKey);
        const desiredSummary = summarizeDesiredStateSpec(desiredStateSpec);
        const summary = {
          tenantCount: desiredSummary.tenantCount,
          nodeCount: desiredSummary.nodeCount,
          zoneCount: desiredSummary.zoneCount,
          appCount: desiredSummary.appCount,
          siteCount: desiredSummary.appCount,
          databaseCount: desiredSummary.databaseCount
        };

        await client.query(
          `INSERT INTO shp_inventory_import_runs (
             import_id,
             source_path,
             summary,
             imported_at
           )
           VALUES ($1, $2, $3::jsonb, $4)`,
          [importId, sourcePath, JSON.stringify(summary), importedAt]
        );

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "inventory.imported",
          entityType: "inventory",
          entityId: importId,
          payload: {
            sourcePath,
            summary
          },
          occurredAt: importedAt
        });

        return {
          importId,
          sourcePath,
          importedAt,
          ...summary
        };
      });
    },

    async getInventorySnapshot(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        return buildInventorySnapshot(client);
      });
    },

    async applyDesiredState(request, presentedToken) {
      const appliedAt = new Date().toISOString();
      const desiredStateVersion = createDesiredStateVersion();

      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        await applyDesiredStateSpec(client, request.spec, jobPayloadKey);
        const summary = summarizeDesiredStateSpec(request.spec);

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "desired_state.applied",
          entityType: "desired_state",
          entityId: desiredStateVersion,
          payload: {
            summary,
            reason: request.reason ?? null
          },
          occurredAt: appliedAt
        });

        return {
          appliedAt,
          desiredStateVersion,
          summary
        };
      });
    },

    async exportDesiredState(presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        const spec = await buildDesiredStateSpecFromDatabase(client, jobPayloadKey);
        const exportedSpec = sanitizeDesiredStateSpecForExport(spec);
        const summary = summarizeDesiredStateSpec(spec);
        const exportedAt = new Date().toISOString();
        const exportId = `export-${randomUUID()}`;

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "inventory.exported",
          entityType: "inventory",
          entityId: exportId,
          payload: {
            sourceKind: "desired_state_postgresql",
            summary
          },
          occurredAt: exportedAt
        });

        return {
          exportedAt,
          summary,
          spec: exportedSpec,
          yaml: YAML.stringify(exportedSpec)
        };
      });
    },

    async getMailOverview(presentedToken) {
      return withTransaction(pool, async (client) => {
        await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        return buildMailOverview(client);
      });
    },

    async upsertMailPolicy(request, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        "mail-policy.upsert",
        "mail.policy.updated",
        "mail_policy",
        mailPolicyId,
        (spec) => ({
          ...spec,
          mailPolicy: normalizeMailPolicy(request)
        })
      );
    },

    async upsertMailDomain(request, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mail-domain.upsert:${request.domainName}`,
        "mail.domain.upserted",
        "mail_domain",
        request.domainName,
        (spec) => ({
          ...spec,
          mailDomains: upsertSpecItem(
            spec.mailDomains,
            request,
            (item) => item.domainName
          )
        })
      );
    },

    async deleteMailDomain(domainName, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mail-domain.delete:${domainName}`,
        "mail.domain.deleted",
        "mail_domain",
        domainName,
        (spec) => ({
          ...spec,
          mailDomains: removeSpecItem(spec.mailDomains, domainName, (item) => item.domainName),
          mailboxes: spec.mailboxes.filter((mailbox) => mailbox.domainName !== domainName),
          mailAliases: spec.mailAliases.filter((alias) => alias.domainName !== domainName),
          mailboxQuotas: spec.mailboxQuotas.filter((quota) => {
            const mailbox = spec.mailboxes.find(
              (candidate) => candidate.address === quota.mailboxAddress
            );
            return mailbox?.domainName !== domainName;
          })
        })
      );
    },

    async upsertMailbox(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const currentSpec = await buildDesiredStateSpecFromDatabase(client, jobPayloadKey);
        const existingMailbox = currentSpec.mailboxes.find(
          (mailbox) => mailbox.address === request.address
        );
        const manualPassword = request.desiredPassword?.trim() || undefined;
        const generatedCredential =
          request.generateCredential && !manualPassword
            ? createMailboxCredentialSecret()
            : undefined;
        const credentialState =
          manualPassword || generatedCredential
            ? "configured"
            : request.credentialState === "missing"
              ? "missing"
              : existingMailbox?.credentialState ?? "missing";
        const nextMailbox = {
          address: request.address,
          domainName: request.domainName,
          localPart: request.localPart,
          primaryNodeId: request.primaryNodeId,
          standbyNodeId: request.standbyNodeId,
          credentialState,
          desiredPassword:
            manualPassword ??
            generatedCredential ??
            (credentialState === "configured" ? existingMailbox?.desiredPassword : undefined)
        };
        const nextSpec = {
          ...currentSpec,
          mailboxes: upsertSpecItem(currentSpec.mailboxes, nextMailbox, (item) => item.address)
        };

        await applyDesiredStateSpec(client, nextSpec, jobPayloadKey);

        let action: MailboxCredentialMutationResult["action"] =
          credentialState === "missing" ? "missing" : "configured";
        let revealId: string | undefined;

        if (generatedCredential) {
          action = existingMailbox ? "rotated" : "generated";
          revealId = await createMailboxCredentialReveal({
            client,
            mailboxId: `mailbox-${request.address}`,
            actorId: actor.userId,
            action: existingMailbox ? "rotated" : "generated",
            credential: generatedCredential,
            payloadKey: jobPayloadKey
          });
        } else if (manualPassword && existingMailbox) {
          action = "rotated";
        }

        if (generatedCredential && existingMailbox) {
          await updateMailboxCredentialTimestamps(client, request.address, { rotated: true });
        } else if (generatedCredential) {
          await updateMailboxCredentialTimestamps(client, request.address, { generated: true });
        } else if (manualPassword && existingMailbox) {
          await updateMailboxCredentialTimestamps(client, request.address, { rotated: true });
        }

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "mail.mailbox.upserted",
          entityType: "mailbox",
          entityId: request.address,
          payload: {
            reason: `mailbox.upsert:${request.address}`,
            credentialState,
            generatedCredential: Boolean(generatedCredential),
            manualPassword: Boolean(manualPassword)
          }
        });

        if (action === "generated" || action === "rotated") {
          await insertAuditEvent(client, {
            actorType: "user",
            actorId: actor.userId,
            eventType:
              action === "generated"
                ? "mail.mailbox_credential.generated"
                : "mail.mailbox_credential.rotated",
            entityType: "mailbox",
            entityId: request.address,
            payload: {
              credentialState,
              revealId: revealId ?? null,
              source: generatedCredential ? "generated" : "manual"
            }
          });
        }

        return {
          mailboxAddress: request.address,
          credentialState,
          action,
          revealId
        };
      });
    },

    async resetMailboxCredential(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const currentSpec = await buildDesiredStateSpecFromDatabase(client, jobPayloadKey);
        const existingMailbox = currentSpec.mailboxes.find(
          (mailbox) => mailbox.address === request.mailboxAddress
        );

        if (!existingMailbox) {
          throw new Error(`Mailbox ${request.mailboxAddress} does not exist.`);
        }

        const nextSpec = {
          ...currentSpec,
          mailboxes: currentSpec.mailboxes.map((mailbox) =>
            mailbox.address === request.mailboxAddress
              ? {
                  ...mailbox,
                  credentialState: "reset_required" as const,
                  desiredPassword: undefined
                }
              : mailbox
          )
        };

        await applyDesiredStateSpec(client, nextSpec, jobPayloadKey);
        await updateMailboxCredentialTimestamps(client, request.mailboxAddress, { reset: true });

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "mail.mailbox_credential.reset",
          entityType: "mailbox",
          entityId: request.mailboxAddress,
          payload: {
            previousCredentialState: existingMailbox.credentialState ?? "missing",
            credentialState: "reset_required"
          }
        });

        return {
          mailboxAddress: request.mailboxAddress,
          credentialState: "reset_required",
          action: "reset"
        };
      });
    },

    async rotateMailboxCredential(request, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);
        const currentSpec = await buildDesiredStateSpecFromDatabase(client, jobPayloadKey);
        const existingMailbox = currentSpec.mailboxes.find(
          (mailbox) => mailbox.address === request.mailboxAddress
        );

        if (!existingMailbox) {
          throw new Error(`Mailbox ${request.mailboxAddress} does not exist.`);
        }

        const generatedCredential = createMailboxCredentialSecret();
        const nextSpec = {
          ...currentSpec,
          mailboxes: currentSpec.mailboxes.map((mailbox) =>
            mailbox.address === request.mailboxAddress
              ? {
                  ...mailbox,
                  credentialState: "configured" as const,
                  desiredPassword: generatedCredential
                }
              : mailbox
          )
        };

        await applyDesiredStateSpec(client, nextSpec, jobPayloadKey);
        await updateMailboxCredentialTimestamps(client, request.mailboxAddress, { rotated: true });

        const revealId = await createMailboxCredentialReveal({
          client,
          mailboxId: `mailbox-${request.mailboxAddress}`,
          actorId: actor.userId,
          action: "rotated",
          credential: generatedCredential,
          payloadKey: jobPayloadKey
        });

        await insertAuditEvent(client, {
          actorType: "user",
          actorId: actor.userId,
          eventType: "mail.mailbox_credential.rotated",
          entityType: "mailbox",
          entityId: request.mailboxAddress,
          payload: {
            credentialState: "configured",
            revealId
          }
        });

        return {
          mailboxAddress: request.mailboxAddress,
          credentialState: "configured",
          action: "rotated",
          revealId
        };
      });
    },

    async consumeMailboxCredentialReveal(revealId, presentedToken) {
      return withTransaction(pool, async (client) => {
        const actor = await requireAuthorizedUser(client, presentedToken, [
          "platform_admin",
          "platform_operator"
        ]);

        return consumeMailboxCredentialRevealById(client, revealId, actor.userId);
      });
    },

    async deleteMailbox(address, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mailbox.delete:${address}`,
        "mail.mailbox.deleted",
        "mailbox",
        address,
        (spec) => ({
          ...spec,
          mailboxes: removeSpecItem(spec.mailboxes, address, (item) => item.address),
          mailboxQuotas: removeSpecItem(
            spec.mailboxQuotas,
            address,
            (item) => item.mailboxAddress
          )
        })
      );
    },

    async upsertMailAlias(request, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mail-alias.upsert:${request.address}`,
        "mail.alias.upserted",
        "mail_alias",
        request.address,
        (spec) => ({
          ...spec,
          mailAliases: upsertSpecItem(spec.mailAliases, request, (item) => item.address)
        })
      );
    },

    async deleteMailAlias(address, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mail-alias.delete:${address}`,
        "mail.alias.deleted",
        "mail_alias",
        address,
        (spec) => ({
          ...spec,
          mailAliases: removeSpecItem(spec.mailAliases, address, (item) => item.address)
        })
      );
    },

    async upsertMailboxQuota(request, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mailbox-quota.upsert:${request.mailboxAddress}`,
        "mail.mailbox_quota.upserted",
        "mailbox_quota",
        request.mailboxAddress,
        (spec) => ({
          ...spec,
          mailboxQuotas: upsertSpecItem(
            spec.mailboxQuotas,
            request,
            (item) => item.mailboxAddress
          )
        })
      );
    },

    async deleteMailboxQuota(mailboxAddress, presentedToken) {
      return mutateDesiredStateAsUser(
        presentedToken,
        `mailbox-quota.delete:${mailboxAddress}`,
        "mail.mailbox_quota.deleted",
        "mailbox_quota",
        mailboxAddress,
        (spec) => ({
          ...spec,
          mailboxQuotas: removeSpecItem(
            spec.mailboxQuotas,
            mailboxAddress,
            (item) => item.mailboxAddress
          )
        })
      );
    }
  };
}
