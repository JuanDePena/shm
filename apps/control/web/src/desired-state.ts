import { isIP } from "node:net";

import {
  DesiredStateAppInput,
  DesiredStateBackupPolicyInput,
  DesiredStateDatabaseInput,
  type DesiredStateMailPolicyInput,
  DesiredStateNodeInput,
  DesiredStateTenantInput,
  DesiredStateZoneInput,
  DnsRecordPayload,
  UpsertMailAliasRequest,
  UpsertMailboxQuotaRequest,
  UpsertMailboxRequest,
  UpsertMailDomainRequest,
  createDefaultMailPolicy
} from "@simplehost/control-contracts";

const slugPattern = /^[a-z0-9](?:[a-z0-9-_]{0,61}[a-z0-9])?$/;
const hostnamePattern =
  /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/;
const domainPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const mailboxLocalPartPattern =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const mailboxQuotaUnitMultipliers = {
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4
} as const;
const minimumMailboxQuotaBytes = 64 * 1024 * 1024;
const maximumMailboxQuotaBytes = 10 * 1024 * 1024 * 1024 * 1024;

function normalizeHostnameValue(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLooseList(value: string): string[] {
  return value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertRequired(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function assertSlug(value: string, label: string): string {
  const normalized = assertRequired(value, label).toLowerCase();

  if (!slugPattern.test(normalized)) {
    throw new Error(
      `${label} must use lowercase letters, numbers, hyphen or underscore.`
    );
  }

  return normalized;
}

function assertHostname(value: string, label: string): string {
  const normalized = assertRequired(value, label).toLowerCase();

  if (!hostnamePattern.test(normalized)) {
    throw new Error(`${label} is not a valid hostname.`);
  }

  return normalized;
}

function assertDomain(value: string, label: string): string {
  const normalized = assertRequired(value, label).toLowerCase();

  if (!domainPattern.test(normalized)) {
    throw new Error(`${label} is not a valid domain name.`);
  }

  return normalized;
}

function assertMailboxLocalPart(value: string, label: string): string {
  const normalized = assertRequired(value, label).toLowerCase();

  if (!mailboxLocalPartPattern.test(normalized)) {
    throw new Error(`${label} may only use common mailbox characters before @.`);
  }

  return normalized;
}

function parseMailboxAddress(value: string, label: string): {
  address: string;
  domainName: string;
  localPart: string;
} {
  const normalized = assertRequired(value, label).toLowerCase();
  const parts = normalized.split("@");

  if (parts.length !== 2) {
    throw new Error(`${label} must be a full address like user@example.com.`);
  }

  const [localPartValue, domainNameValue] = parts;

  if (!localPartValue || !domainNameValue) {
    throw new Error(`${label} must be a full address like user@example.com.`);
  }

  const localPart = assertMailboxLocalPart(localPartValue, "Mailbox name");
  const domainName = assertDomain(domainNameValue, "Mailbox domain");

  return {
    address: `${localPart}@${domainName}`,
    domainName,
    localPart
  };
}

function assertIpv4(value: string, label: string): string {
  const normalized = assertRequired(value, label);

  if (isIP(normalized) !== 4) {
    throw new Error(`${label} must be a valid IPv4 address.`);
  }

  return normalized;
}

function assertWireguardAddress(value: string, label: string): string {
  const normalized = assertRequired(value, label);
  const [address, prefix] = normalized.split("/", 2);

  if (isIP(address) !== 4) {
    throw new Error(`${label} must use a valid IPv4 address.`);
  }

  if (prefix) {
    const parsedPrefix = Number.parseInt(prefix, 10);
    if (!Number.isInteger(parsedPrefix) || parsedPrefix < 0 || parsedPrefix > 32) {
      throw new Error(`${label} must use a valid CIDR prefix.`);
    }
  }

  return normalized;
}

function assertPositiveInt(
  value: number | undefined,
  label: string,
  options: { min?: number; max?: number } = {}
): number {
  if (value === undefined || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${label} must be at most ${options.max}.`);
  }

  return value;
}

function assertPositiveNumber(
  value: number | undefined,
  label: string
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return value;
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

function assertMailSenderEntry(value: string, label: string): string {
  const normalized = assertRequired(value, label).toLowerCase();

  if (normalized.startsWith("@")) {
    return `@${assertDomain(normalized.slice(1), label)}`;
  }

  const [localPart, domainName] = normalized.split("@", 2);

  if (!localPart || !domainName) {
    throw new Error(`${label} must be a full mailbox address or @domain.`);
  }

  return `${localPart}@${assertDomain(domainName, label)}`;
}

function assertCronish(value: string, label: string): string {
  const normalized = assertRequired(value, label);

  if (normalized.split(/\s+/).length < 5) {
    throw new Error(`${label} must look like a cron expression.`);
  }

  return normalized;
}

function parseZoneRecords(value: string): DnsRecordPayload[] {
  const records: DnsRecordPayload[] = [];
  const lines = value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  for (const line of lines) {
    const parts = line.split(/\s+/);

    if (parts.length < 4) {
      throw new Error(
        `Invalid zone record line "${line}". Expected: <name> <type> <value> <ttl>.`
      );
    }

    const ttl = Number.parseInt(parts.at(-1) ?? "", 10);

    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new Error(`Invalid TTL in zone record line "${line}".`);
    }

    const name = parts[0]!;
    const type = parts[1]!;
    const valuePart = parts.slice(2, -1).join(" ");

    if (
      type !== "A" &&
      type !== "AAAA" &&
      type !== "CNAME" &&
      type !== "MX" &&
      type !== "TXT"
    ) {
      throw new Error(`Unsupported record type ${type} in line "${line}".`);
    }

    records.push({
      name,
      type,
      value: valuePart,
      ttl
    });
  }

  return records;
}

export function formatZoneRecords(records: DnsRecordPayload[]): string {
  return records
    .map((record) => `${record.name} ${record.type} ${record.value} ${record.ttl}`)
    .join("\n");
}

export function upsertByKey<T>(
  items: T[],
  next: T,
  keyOf: (item: T) => string,
  originalKey?: string
): T[] {
  const nextKey = keyOf(next);

  return [
    ...items.filter((item) => {
      const key = keyOf(item);
      return key !== nextKey && key !== originalKey;
    }),
    next
  ].sort((left, right) => keyOf(left).localeCompare(keyOf(right)));
}

export function removeByKey<T>(
  items: T[],
  key: string,
  keyOf: (item: T) => string
): T[] {
  return items.filter((item) => keyOf(item) !== key);
}

function parseOptionalNumber(value: string, fallback?: number): number | undefined {
  if (value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected an integer but received "${value}".`);
  }

  return parsed;
}

export function parseTenantForm(form: URLSearchParams): DesiredStateTenantInput {
  return {
    slug: assertSlug(form.get("slug")?.trim() ?? "", "Tenant slug"),
    displayName: assertRequired(form.get("displayName")?.trim() ?? "", "Display name")
  };
}

export function parseNodeForm(form: URLSearchParams): DesiredStateNodeInput {
  return {
    nodeId: assertSlug(form.get("nodeId")?.trim() ?? "", "Node ID"),
    hostname: assertHostname(form.get("hostname")?.trim() ?? "", "Hostname"),
    publicIpv4: assertIpv4(form.get("publicIpv4")?.trim() ?? "", "Public IPv4"),
    wireguardAddress: assertWireguardAddress(
      form.get("wireguardAddress")?.trim() ?? "",
      "WireGuard address"
    )
  };
}

export function parseZoneForm(form: URLSearchParams): DesiredStateZoneInput {
  return {
    zoneName: assertDomain(form.get("zoneName")?.trim() ?? "", "Zone name"),
    tenantSlug: assertSlug(form.get("tenantSlug")?.trim() ?? "", "Tenant slug"),
    primaryNodeId: assertSlug(form.get("primaryNodeId")?.trim() ?? "", "Primary node"),
    records: parseZoneRecords(form.get("records")?.trim() ?? "")
  };
}

export function parseAppForm(form: URLSearchParams): DesiredStateAppInput {
  const slug = assertSlug(form.get("slug")?.trim() ?? "", "App slug");
  const tenantSlug = assertSlug(form.get("tenantSlug")?.trim() ?? "", "Tenant slug");
  const zoneName = assertDomain(form.get("zoneName")?.trim() ?? "", "Zone name");
  const primaryNodeId = assertSlug(form.get("primaryNodeId")?.trim() ?? "", "Primary node");
  const standbyNodeId = form.get("standbyNodeId")?.trim()
    ? assertSlug(form.get("standbyNodeId")?.trim() ?? "", "Standby node")
    : undefined;
  const canonicalDomain = assertDomain(
    form.get("canonicalDomain")?.trim() ?? "",
    "Canonical domain"
  );
  const aliases = parseCommaSeparated(form.get("aliases") ?? "").map((alias) =>
    assertDomain(alias, "Alias")
  );
  const backendPort = assertPositiveInt(
    parseOptionalNumber(form.get("backendPort")?.trim() ?? ""),
    "Backend port",
    { min: 1, max: 65535 }
  );

  if (standbyNodeId && standbyNodeId === primaryNodeId) {
    throw new Error("Standby node must differ from primary node.");
  }

  return {
    slug,
    tenantSlug,
    zoneName,
    primaryNodeId,
    standbyNodeId,
    canonicalDomain,
    aliases,
    backendPort,
    runtimeImage: assertRequired(form.get("runtimeImage")?.trim() ?? "", "Runtime image"),
    storageRoot: assertRequired(form.get("storageRoot")?.trim() ?? "", "Storage root"),
    mode: form.get("mode")?.trim() ?? "active-passive"
  };
}

export function parseDatabaseForm(form: URLSearchParams): DesiredStateDatabaseInput {
  const engine = form.get("engine")?.trim();
  const pendingMigrationValue = form.get("pendingMigrationTo")?.trim() || undefined;
  const migrationCompletedFromValue =
    form.get("migrationCompletedFrom")?.trim() || undefined;
  const migrationCompletedAt = form.get("migrationCompletedAt")?.trim() || undefined;

  if (engine !== "postgresql" && engine !== "mariadb") {
    throw new Error(`Unsupported database engine ${engine ?? ""}.`);
  }

  if (
    pendingMigrationValue &&
    pendingMigrationValue !== "postgresql" &&
    pendingMigrationValue !== "mariadb"
  ) {
    throw new Error(`Unsupported pending migration target ${pendingMigrationValue}.`);
  }

  if (
    migrationCompletedFromValue &&
    migrationCompletedFromValue !== "postgresql" &&
    migrationCompletedFromValue !== "mariadb"
  ) {
    throw new Error(
      `Unsupported completed migration source ${migrationCompletedFromValue}.`
    );
  }

  const pendingMigrationTo =
    pendingMigrationValue as DesiredStateDatabaseInput["pendingMigrationTo"];
  const migrationCompletedFrom =
    migrationCompletedFromValue as DesiredStateDatabaseInput["migrationCompletedFrom"];
  const primaryNodeId = assertSlug(form.get("primaryNodeId")?.trim() ?? "", "Primary node");
  const standbyNodeId = form.get("standbyNodeId")?.trim()
    ? assertSlug(form.get("standbyNodeId")?.trim() ?? "", "Standby node")
    : undefined;

  if (standbyNodeId && standbyNodeId === primaryNodeId) {
    throw new Error("Standby node must differ from primary node.");
  }

  if (pendingMigrationTo && pendingMigrationTo === engine) {
    throw new Error("Pending migration target must differ from the current engine.");
  }

  if (migrationCompletedFrom && migrationCompletedFrom === engine) {
    throw new Error("Completed migration source must differ from the current engine.");
  }

  if (pendingMigrationTo && migrationCompletedFrom) {
    throw new Error("Pending and completed migration markers are mutually exclusive.");
  }

  if (migrationCompletedAt && !migrationCompletedFrom) {
    throw new Error("Migration completed time requires a source engine.");
  }

  if (migrationCompletedAt && Number.isNaN(Date.parse(migrationCompletedAt))) {
    throw new Error(`Invalid migration completed timestamp ${migrationCompletedAt}.`);
  }

  return {
    appSlug: assertSlug(form.get("appSlug")?.trim() ?? "", "App slug"),
    engine,
    databaseName: assertRequired(form.get("databaseName")?.trim() ?? "", "Database name"),
    databaseUser: assertRequired(form.get("databaseUser")?.trim() ?? "", "Database user"),
    primaryNodeId,
    standbyNodeId,
    pendingMigrationTo,
    migrationCompletedFrom,
    migrationCompletedAt,
    desiredPassword: form.get("desiredPassword")?.trim() || undefined
  };
}

export function parseBackupPolicyForm(
  form: URLSearchParams
): DesiredStateBackupPolicyInput {
  const retentionDays = assertPositiveInt(
    parseOptionalNumber(form.get("retentionDays")?.trim() ?? ""),
    "Retention days",
    { min: 1 }
  );

  return {
    policySlug: assertSlug(form.get("policySlug")?.trim() ?? "", "Policy slug"),
    tenantSlug: assertSlug(form.get("tenantSlug")?.trim() ?? "", "Tenant slug"),
    targetNodeId: assertSlug(form.get("targetNodeId")?.trim() ?? "", "Target node"),
    schedule: assertCronish(form.get("schedule")?.trim() ?? "", "Schedule"),
    retentionDays,
    storageLocation: assertRequired(
      form.get("storageLocation")?.trim() ?? "",
      "Storage location"
    ),
    resourceSelectors: parseCommaSeparated(form.get("resourceSelectors") ?? "")
  };
}

export function parseMailDomainForm(
  form: URLSearchParams
): UpsertMailDomainRequest {
  const primaryNodeId = assertSlug(form.get("primaryNodeId")?.trim() ?? "", "Primary node");
  const standbyNodeId = form.get("standbyNodeId")?.trim()
    ? assertSlug(form.get("standbyNodeId")?.trim() ?? "", "Standby node")
    : undefined;

  if (standbyNodeId && standbyNodeId === primaryNodeId) {
    throw new Error("Standby node must differ from primary node.");
  }

  const domainName = assertDomain(form.get("domainName")?.trim() ?? "", "Mail domain");
  const zoneName = assertDomain(form.get("zoneName")?.trim() ?? "", "Zone name");
  const mailHost = assertDomain(form.get("mailHost")?.trim() ?? "", "Mail host");

  if (zoneName !== domainName) {
    throw new Error(
      "Mail domain must use the matching zone. The current mail DNS model only supports zone-apex mail domains."
    );
  }

  if (normalizeHostnameValue(mailHost) === normalizeHostnameValue(domainName)) {
    throw new Error("Mail host must live below the domain apex, not at the apex itself.");
  }

  if (!normalizeHostnameValue(mailHost).endsWith(`.${normalizeHostnameValue(domainName)}`)) {
    throw new Error(`Mail host must stay under ${domainName}.`);
  }

  return {
    domainName,
    tenantSlug: assertSlug(form.get("tenantSlug")?.trim() ?? "", "Tenant slug"),
    zoneName,
    primaryNodeId,
    standbyNodeId,
    mailHost,
    dkimSelector: assertSlug(form.get("dkimSelector")?.trim() ?? "", "DKIM selector")
  };
}

export function parseMailPolicyForm(form: URLSearchParams): DesiredStateMailPolicyInput {
  const defaults = createDefaultMailPolicy();
  const rejectThreshold = Number.parseFloat(
    form.get("rejectThreshold")?.trim() ?? String(defaults.rejectThreshold)
  );
  const addHeaderThreshold = Number.parseFloat(
    form.get("addHeaderThreshold")?.trim() ?? String(defaults.addHeaderThreshold)
  );
  const greylistRaw = form.get("greylistThreshold")?.trim() ?? "";
  const rateLimitBurstRaw = form.get("rateLimitBurst")?.trim() ?? "";
  const rateLimitPeriodRaw = form.get("rateLimitPeriodSeconds")?.trim() ?? "";
  const senderAllowlist = parseLooseList(form.get("senderAllowlist") ?? "").map((entry) =>
    assertMailSenderEntry(entry, "Sender allowlist entry")
  );
  const senderDenylist = parseLooseList(form.get("senderDenylist") ?? "").map((entry) =>
    assertMailSenderEntry(entry, "Sender denylist entry")
  );

  const policy: DesiredStateMailPolicyInput = {
    rejectThreshold: assertPositiveNumber(rejectThreshold, "Reject threshold"),
    addHeaderThreshold: assertPositiveNumber(addHeaderThreshold, "Add-header threshold"),
    greylistThreshold:
      greylistRaw.length > 0
        ? assertPositiveNumber(
            Number.parseFloat(greylistRaw),
            "Greylist threshold"
          )
        : undefined,
    senderAllowlist,
    senderDenylist,
    rateLimit:
      rateLimitBurstRaw.length > 0 || rateLimitPeriodRaw.length > 0
        ? {
            burst: assertPositiveInt(
              Number.parseInt(rateLimitBurstRaw, 10),
              "Rate-limit burst"
            ),
            periodSeconds: assertPositiveInt(
              Number.parseInt(rateLimitPeriodRaw, 10),
              "Rate-limit period"
            )
          }
        : undefined
  };

  if (policy.addHeaderThreshold >= policy.rejectThreshold) {
    throw new Error("Reject threshold must be greater than add-header threshold.");
  }

  if (
    policy.greylistThreshold !== undefined &&
    policy.greylistThreshold >= policy.addHeaderThreshold
  ) {
    throw new Error("Greylist threshold must be below add-header threshold.");
  }

  return policy;
}

export function parseMailboxForm(form: URLSearchParams): UpsertMailboxRequest {
  const primaryNodeId = assertSlug(form.get("primaryNodeId")?.trim() ?? "", "Primary node");
  const standbyNodeId = form.get("standbyNodeId")?.trim()
    ? assertSlug(form.get("standbyNodeId")?.trim() ?? "", "Standby node")
    : undefined;
  const desiredPassword = form.get("desiredPassword")?.trim() || undefined;
  const credentialStrategy = (form.get("credentialStrategy")?.trim() ?? "keep").toLowerCase();
  const domainName = assertDomain(form.get("domainName")?.trim() ?? "", "Mail domain");
  const addressInput = form.get("address")?.trim() ?? "";
  const mailboxIdentity =
    addressInput.length > 0
      ? parseMailboxAddress(addressInput, "Mailbox address")
      : (() => {
          const mailboxName = assertMailboxLocalPart(
            form.get("localPart")?.trim() ?? "",
            "Mailbox name"
          );

          return {
            address: `${mailboxName}@${domainName}`,
            domainName,
            localPart: mailboxName
          };
        })();

  if (standbyNodeId && standbyNodeId === primaryNodeId) {
    throw new Error("Standby node must differ from primary node.");
  }

  if (mailboxIdentity.domainName !== domainName) {
    throw new Error(`Mailbox address must stay under ${domainName}.`);
  }

  const request: UpsertMailboxRequest = {
    address: mailboxIdentity.address,
    domainName,
    localPart: mailboxIdentity.localPart,
    primaryNodeId,
    standbyNodeId
  };

  switch (credentialStrategy) {
    case "generate":
      request.generateCredential = true;
      request.credentialState = "configured";
      return request;
    case "manual":
      request.desiredPassword = assertRequired(desiredPassword ?? "", "Manual password");
      request.credentialState = "configured";
      return request;
    case "missing":
      request.credentialState = "missing";
      return request;
    case "keep":
    default:
      if (desiredPassword) {
        request.desiredPassword = desiredPassword;
        request.credentialState = "configured";
      }
      return request;
  }
}

export function parseMailAliasForm(form: URLSearchParams): UpsertMailAliasRequest {
  return {
    address: assertRequired(form.get("address")?.trim() ?? "", "Alias address"),
    domainName: assertDomain(form.get("domainName")?.trim() ?? "", "Mail domain"),
    localPart: assertRequired(form.get("localPart")?.trim() ?? "", "Local part"),
    destinations: parseCommaSeparated(form.get("destinations") ?? "").map((destination) =>
      assertRequired(destination, "Alias destination")
    )
  };
}

export function parseMailboxQuotaForm(
  form: URLSearchParams
): UpsertMailboxQuotaRequest {
  const storageBytes = assertPositiveInt(
    parseOptionalNumber(form.get("storageBytes")?.trim() ?? ""),
    "Storage bytes",
    { min: 1 }
  );

  if (storageBytes < minimumMailboxQuotaBytes) {
    throw new Error(
      `Mailbox quota must be at least ${formatStorageBytesForValidation(minimumMailboxQuotaBytes)}.`
    );
  }

  if (storageBytes > maximumMailboxQuotaBytes) {
    throw new Error(
      `Mailbox quota must stay below ${formatStorageBytesForValidation(maximumMailboxQuotaBytes)}.`
    );
  }

  return {
    mailboxAddress: assertRequired(
      form.get("mailboxAddress")?.trim() ?? "",
      "Mailbox address"
    ),
    storageBytes
  };
}

export function parseMailboxQuotaEditorForm(
  form: URLSearchParams,
  mailboxAddress: string
): UpsertMailboxQuotaRequest | null {
  const quotaValueRaw = form.get("quotaValue")?.trim() ?? "";

  if (quotaValueRaw.length === 0) {
    return null;
  }

  const quotaValue = Number.parseFloat(quotaValueRaw);

  if (!Number.isFinite(quotaValue) || quotaValue < 0) {
    throw new Error("Quota must be zero or a positive number.");
  }

  if (quotaValue === 0) {
    return null;
  }

  const quotaUnitRaw = (form.get("quotaUnit")?.trim() ?? "gb").toLowerCase();

  if (
    quotaUnitRaw !== "mb" &&
    quotaUnitRaw !== "gb" &&
    quotaUnitRaw !== "tb"
  ) {
    throw new Error("Quota unit must be MB, GB, or TB.");
  }

  const storageBytes = Math.round(
    quotaValue * mailboxQuotaUnitMultipliers[quotaUnitRaw]
  );
  const quotaForm = new URLSearchParams();
  quotaForm.set("mailboxAddress", mailboxAddress);
  quotaForm.set("storageBytes", String(storageBytes));
  return parseMailboxQuotaForm(quotaForm);
}
