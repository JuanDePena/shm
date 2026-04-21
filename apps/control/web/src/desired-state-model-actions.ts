import { createHash } from "node:crypto";

import { escapeHtml } from "@simplehost/ui";

import { type DnsRecordPayload } from "@simplehost/control-contracts";

import {
  type App,
  type BuildDesiredStateModelArgs,
  type Database,
  type DesiredStateActionModel,
  type DesiredStateActivityModel,
  type DesiredStateModelCopy,
  type DesiredStateSelectionModel,
  type Job,
  type Node,
  type Zone
} from "./desired-state-model-types.js";
import {
  type DesiredStateComparisonRow,
  type DesiredStateRelatedPanelItem
} from "./desired-state-shared.js";

type ComparisonRowFactory = (
  label: string,
  desiredValue: string,
  appliedValue?: string | null,
  options?: { appliedKnown?: boolean }
) => DesiredStateComparisonRow;

type PayloadStringReader = (
  payload: Record<string, unknown> | undefined,
  key: string
) => string | null;
type PayloadBooleanReader = (
  payload: Record<string, unknown> | undefined,
  key: string
) => boolean | null;
type PayloadStringArrayReader = (
  payload: Record<string, unknown> | undefined,
  key: string
) => string[];
type PayloadObjectArrayReader = (
  payload: Record<string, unknown> | undefined,
  key: string
) => Array<Record<string, unknown>>;
type DnsPreviewFormatter = (
  record: DnsRecordPayload | Record<string, unknown> | undefined
) => string;

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function joinComparisonValues(values: Array<string | null | undefined>): string {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return normalized.join(" | ");
}

function createKnownComparisonRow(
  createComparisonRow: ComparisonRowFactory,
  label: string,
  desiredValue: string,
  appliedValue: string
): DesiredStateComparisonRow {
  return createComparisonRow(label, desiredValue, appliedValue, {
    appliedKnown: true
  });
}

function buildActionDiffSummary(
  rows: DesiredStateComparisonRow[],
  fallback: string
): string {
  if (rows.length === 0) {
    return fallback;
  }

  const changedRows = rows.filter((row) => row.state === "changed");
  const unknownRows = rows.filter((row) => row.state === "unknown");

  if (changedRows.length === 0 && unknownRows.length === 0) {
    return `Matches last applied state across ${rows.length} field(s).`;
  }

  const parts: string[] = [];

  if (changedRows.length > 0) {
    parts.push(`${changedRows.length} field(s) differ`);
  }

  if (unknownRows.length > 0) {
    parts.push(`${unknownRows.length} field(s) still lack applied state`);
  }

  const focus = [...changedRows, ...unknownRows]
    .slice(0, 3)
    .map((row) => row.field)
    .join(" · ");

  return `${parts.join(" · ")}${focus ? `. Focus: ${focus}.` : ""}`;
}

function resolveComparisonTone(
  rows: DesiredStateComparisonRow[],
  extraDanger = false
): DesiredStateRelatedPanelItem["tone"] {
  if (extraDanger || rows.some((row) => row.state === "changed")) {
    return "danger";
  }

  if (rows.length > 0 && rows.every((row) => row.state === "match")) {
    return "success";
  }

  return "default";
}

function createActionDiffItem(args: {
  title: string;
  meta: string;
  rows: DesiredStateComparisonRow[];
  fallback: string;
  extraDanger?: boolean;
}): DesiredStateRelatedPanelItem {
  const { title, meta, rows, fallback, extraDanger = false } = args;

  return {
    title,
    meta: escapeHtml(meta),
    summary: escapeHtml(buildActionDiffSummary(rows, fallback)),
    tone: resolveComparisonTone(rows, extraDanger)
  };
}

function prefixDeltaItems(
  items: DesiredStateRelatedPanelItem[],
  prefix: string
): DesiredStateRelatedPanelItem[] {
  return items.map((item) => ({
    ...item,
    title: `${prefix} · ${item.title}`
  }));
}

function summarizePreviewList(
  values: string[],
  emptyValue: string,
  limit = 3
): string {
  const normalized = values.map((value) => normalizeText(value)).filter(Boolean);

  if (normalized.length === 0) {
    return emptyValue;
  }

  if (normalized.length <= limit) {
    return normalized.join(", ");
  }

  return `${normalized.slice(0, limit).join(", ")} +${normalized.length - limit} more`;
}

function relativeRecordNameForZone(hostname: string, zoneName: string): string {
  const normalizedHost = hostname.replace(/\.$/, "").toLowerCase();
  const normalizedZone = zoneName.replace(/\.$/, "").toLowerCase();

  if (normalizedHost === normalizedZone) {
    return "@";
  }

  const suffix = `.${normalizedZone}`;

  if (!normalizedHost.endsWith(suffix)) {
    throw new Error(`${hostname} does not belong to zone ${zoneName}.`);
  }

  return normalizedHost.slice(0, -suffix.length);
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

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length >= 2) {
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
    return "\"\"";
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

function buildMailReportAddress(domainName: string): string {
  return `postmaster@${domainName}`.toLowerCase();
}

function buildMailMtaStsHostname(domainName: string): string {
  return `mta-sts.${domainName}`;
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

function buildMailMtaStsPolicyId(domain: Pick<DashboardMailDomainRecord, "domainName" | "mailHost" | "dkimSelector">): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        domainName: domain.domainName,
        mailHost: domain.mailHost,
        dkimSelector: domain.dkimSelector,
        mode: "enforce",
        maxAgeSeconds: 86400
      })
    )
    .digest("hex")
    .slice(0, 12);
}

function resolveZoneRecordName(hostname: string, zoneName: string): string | null {
  try {
    return relativeRecordNameForZone(hostname, zoneName);
  } catch {
    return null;
  }
}

function normalizeDnsRecords(records: DnsRecordPayload[]): DnsRecordPayload[] {
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

function buildZoneRecords(
  zoneName: string,
  publicIpv4: string,
  apps: App[]
): DnsRecordPayload[] {
  const recordMap = new Map<string, DnsRecordPayload>();

  for (const app of apps) {
    const hostnames = [app.canonicalDomain, ...app.aliases];

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

function buildMailZoneRecords(
  zoneName: string,
  mailDomains: DashboardMailDomainRecord[]
): DnsRecordPayload[] {
  const recordMap = new Map<string, DnsRecordPayload>();

  for (const domain of mailDomains) {
    const mailRecordName = resolveZoneRecordName(domain.mailHost, zoneName);
    const webmailHostname = `webmail.${domain.domainName}`;
    const webmailRecordName = resolveZoneRecordName(webmailHostname, zoneName);
    const mtaStsHostname = buildMailMtaStsHostname(domain.domainName);
    const mtaStsRecordName = resolveZoneRecordName(mtaStsHostname, zoneName);

    if (mailRecordName) {
      const key = `${mailRecordName}:A:${domain.primaryIpv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: mailRecordName,
          type: "A",
          value: domain.primaryIpv4,
          ttl: 300
        });
      }
    }

    if (webmailRecordName) {
      const key = `${webmailRecordName}:A:${domain.primaryIpv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: webmailRecordName,
          type: "A",
          value: domain.primaryIpv4,
          ttl: 300
        });
      }
    }

    if (mtaStsRecordName) {
      const key = `${mtaStsRecordName}:A:${domain.primaryIpv4}`;

      if (!recordMap.has(key)) {
        recordMap.set(key, {
          name: mtaStsRecordName,
          type: "A",
          value: domain.primaryIpv4,
          ttl: 300
        });
      }
    }

    const mxKey = `@:MX:${domain.mailHost}`;

    if (!recordMap.has(mxKey)) {
      recordMap.set(mxKey, {
        name: "@",
        type: "MX",
        value: `10 ${normalizeDnsTargetHost(domain.mailHost)}`,
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

    const dmarcValue = buildMailDmarcRecordValue(domain.domainName);
    const dmarcKey = `_dmarc:TXT:${dmarcValue}`;

    if (!recordMap.has(dmarcKey)) {
      recordMap.set(dmarcKey, {
        name: "_dmarc",
        type: "TXT",
        value: dmarcValue,
        ttl: 300
      });
    }

    const tlsRptValue = buildMailTlsRptRecordValue(domain.domainName);
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
  }

  return [...recordMap.values()].sort((left, right) =>
    `${left.name}:${left.type}:${left.value}`.localeCompare(
      `${right.name}:${right.type}:${right.value}`
    )
  );
}

function mergeDerivedDnsRecords(
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

type DashboardMailDomainRecord = {
  domainName: string;
  zoneName: string;
  primaryNodeId: string;
  mailHost: string;
  dkimSelector: string;
  primaryIpv4: string;
};

function buildDesiredDnsPayload(args: {
  zone: Zone;
  nodes: Node[];
  apps: App[];
  mailDomains: Array<{
    domainName: string;
    zoneName: string;
    primaryNodeId: string;
    mailHost: string;
    dkimSelector: string;
  }>;
}): {
  nodeId: string;
  nameservers: string[];
  records: DnsRecordPayload[];
} {
  const { zone, nodes, apps, mailDomains } = args;
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node] as const));
  const primaryNode = nodesById.get(zone.primaryNodeId);
  const siteRows = apps
    .filter((app) => app.zoneName === zone.zoneName)
    .map((app) => ({
      canonicalDomain: app.canonicalDomain,
      aliases: app.aliases
    }));
  const mailRows: DashboardMailDomainRecord[] = mailDomains
    .filter((domain) => domain.zoneName === zone.zoneName)
    .map((domain) => ({
      ...domain,
      primaryIpv4: nodesById.get(domain.primaryNodeId)?.publicIpv4 ?? ""
    }))
    .filter((domain) => Boolean(domain.primaryIpv4));
  const explicitRecords = normalizeDnsRecords(zone.records);
  const derivedSiteRecords =
    primaryNode?.publicIpv4 && siteRows.length > 0
      ? buildZoneRecords(zone.zoneName, primaryNode.publicIpv4, apps.filter((app) => app.zoneName === zone.zoneName))
      : [];
  const derivedMailRecords = buildMailZoneRecords(zone.zoneName, mailRows);

  return {
    nodeId: zone.primaryNodeId,
    nameservers: [`ns1.${zone.zoneName}`, `ns2.${zone.zoneName}`],
    records: mergeDerivedDnsRecords(explicitRecords, [
      ...derivedSiteRecords,
      ...derivedMailRecords
    ])
  };
}

function groupDnsRecordValues(
  records: Array<DnsRecordPayload | Record<string, unknown>>,
  formatDnsRecordPreview: DnsPreviewFormatter
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const record of records) {
    const name = "name" in record && typeof record.name === "string" ? record.name : "";
    const type = "type" in record && typeof record.type === "string" ? record.type : "";
    const value = "value" in record && typeof record.value === "string" ? record.value : "";
    const ttl =
      "ttl" in record && (typeof record.ttl === "number" || typeof record.ttl === "string")
        ? String(record.ttl)
        : "";
    const groupKey = [name || "@", type || "?"].join(" ");
    const preview = value
      ? `${value}${ttl ? ` (ttl ${ttl})` : ""}`
      : formatDnsRecordPreview(record);
    const entries = grouped.get(groupKey) ?? [];

    entries.push(preview);
    grouped.set(groupKey, entries);
  }

  return grouped;
}

function buildDnsComparisonRows(args: {
  copy: DesiredStateModelCopy;
  zone: Zone | undefined;
  appliedJob: Job | undefined;
  desiredPayload: ReturnType<typeof buildDesiredDnsPayload> | undefined;
  createComparisonRow: ComparisonRowFactory;
  readStringPayloadValue: PayloadStringReader;
  readStringArrayPayloadValue: PayloadStringArrayReader;
  readObjectArrayPayloadValue: PayloadObjectArrayReader;
  formatDnsRecordPreview: DnsPreviewFormatter;
  labelPrefix?: string;
}): DesiredStateComparisonRow[] {
  const {
    copy,
    zone,
    appliedJob,
    desiredPayload,
    createComparisonRow,
    readStringPayloadValue,
    readStringArrayPayloadValue,
    readObjectArrayPayloadValue,
    formatDnsRecordPreview,
    labelPrefix = ""
  } = args;

  if (!zone || !appliedJob || !desiredPayload) {
    return [];
  }

  const appliedNameservers = readStringArrayPayloadValue(appliedJob.payload, "nameservers");
  const appliedRecords = readObjectArrayPayloadValue(appliedJob.payload, "records");
  const desiredRecordGroups = groupDnsRecordValues(
    desiredPayload.records,
    formatDnsRecordPreview
  );
  const appliedRecordGroups = groupDnsRecordValues(appliedRecords, formatDnsRecordPreview);
  const recordKeys = [...new Set([...desiredRecordGroups.keys(), ...appliedRecordGroups.keys()])].sort(
    (left, right) => left.localeCompare(right)
  );
  const rows: DesiredStateComparisonRow[] = [
    createComparisonRow(
      `${labelPrefix}${copy.zoneColZone}`,
      zone.zoneName,
      readStringPayloadValue(appliedJob.payload, "zoneName")
    ),
    createKnownComparisonRow(
      createComparisonRow,
      `${labelPrefix}${copy.targetedNodesLabel}`,
      desiredPayload.nodeId,
      appliedJob.nodeId
    ),
    createKnownComparisonRow(
      createComparisonRow,
      `${labelPrefix}nameservers`,
      joinComparisonValues(desiredPayload.nameservers),
      joinComparisonValues(appliedNameservers)
    ),
    createKnownComparisonRow(
      createComparisonRow,
      `${labelPrefix}${copy.zoneColRecordCount}`,
      String(desiredPayload.records.length),
      String(appliedRecords.length)
    )
  ];

  for (const recordKey of recordKeys) {
    rows.push(
      createComparisonRow(
        `${labelPrefix}record set · ${recordKey}`,
        joinComparisonValues(desiredRecordGroups.get(recordKey) ?? []),
        joinComparisonValues(appliedRecordGroups.get(recordKey) ?? []),
        { appliedKnown: true }
      )
    );
  }

  return rows;
}

function buildAppComparisonRows(args: {
  copy: DesiredStateModelCopy;
  app: App | undefined;
  appliedJob: Job | undefined;
  appProxyDrifts: DesiredStateActivityModel["selectedAppProxyDrifts"];
  createComparisonRow: ComparisonRowFactory;
  readStringPayloadValue: PayloadStringReader;
  readBooleanPayloadValue: PayloadBooleanReader;
  readStringArrayPayloadValue: PayloadStringArrayReader;
}): DesiredStateComparisonRow[] {
  const {
    copy,
    app,
    appliedJob,
    appProxyDrifts,
    createComparisonRow,
    readStringPayloadValue,
    readBooleanPayloadValue,
    readStringArrayPayloadValue
  } = args;

  if (!app || !appliedJob) {
    return [];
  }

  const desiredNodeTargets = [
    app.primaryNodeId,
    ...(app.mode === "active-passive" &&
    app.standbyNodeId &&
    app.standbyNodeId !== app.primaryNodeId
      ? [app.standbyNodeId]
      : [])
  ];
  const appliedNodeTargets = [
    ...new Set(
      appProxyDrifts.length > 0
        ? appProxyDrifts.map((entry) => entry.nodeId)
        : [appliedJob.nodeId]
    )
  ].sort((left, right) => left.localeCompare(right));

  return [
    createKnownComparisonRow(
      createComparisonRow,
      `${copy.targetedNodesLabel}`,
      joinComparisonValues(desiredNodeTargets),
      joinComparisonValues(appliedNodeTargets)
    ),
    createComparisonRow(
      `${copy.appColDomain}`,
      app.canonicalDomain,
      readStringPayloadValue(appliedJob.payload, "serverName")
    ),
    createKnownComparisonRow(
      createComparisonRow,
      `${copy.aliasesLabel}`,
      joinComparisonValues(app.aliases),
      joinComparisonValues(
        readStringArrayPayloadValue(appliedJob.payload, "serverAliases")
      )
    ),
    createComparisonRow(
      `${copy.storageRootLabel}`,
      `${app.storageRoot}/current/public`,
      readStringPayloadValue(appliedJob.payload, "documentRoot")
    ),
    createComparisonRow(
      "vhost name",
      app.slug,
      readStringPayloadValue(appliedJob.payload, "vhostName")
    ),
    createComparisonRow(
      "proxy pass",
      `http://127.0.0.1:${app.backendPort}`,
      readStringPayloadValue(appliedJob.payload, "proxyPassUrl")
    ),
    createComparisonRow(
      "preserve host",
      "on",
      readBooleanPayloadValue(appliedJob.payload, "proxyPreserveHost") === null
        ? null
        : readBooleanPayloadValue(appliedJob.payload, "proxyPreserveHost")
          ? "on"
          : "off"
    ),
    createComparisonRow(
      `${copy.appColMode}`,
      "tls:on",
      readBooleanPayloadValue(appliedJob.payload, "tls") === null
        ? null
        : readBooleanPayloadValue(appliedJob.payload, "tls")
          ? "tls:on"
          : "tls:off"
    )
  ];
}

function buildDatabaseComparisonRows(args: {
  copy: DesiredStateModelCopy;
  database: Database | undefined;
  appliedJob: Job | undefined;
  createComparisonRow: ComparisonRowFactory;
  readStringPayloadValue: PayloadStringReader;
}): DesiredStateComparisonRow[] {
  const { copy, database, appliedJob, createComparisonRow, readStringPayloadValue } = args;

  if (!database || !appliedJob) {
    return [];
  }

  return [
    createComparisonRow(
      "app slug",
      database.appSlug,
      readStringPayloadValue(appliedJob.payload, "appSlug")
    ),
    createComparisonRow(
      `${copy.databaseColEngine}`,
      database.engine,
      appliedJob.kind === "postgres.reconcile" ? "postgresql" : "mariadb"
    ),
    createComparisonRow(
      `${copy.databaseColDatabase}`,
      database.databaseName,
      readStringPayloadValue(appliedJob.payload, "databaseName")
    ),
    createComparisonRow(
      `${copy.databaseColUser}`,
      database.databaseUser,
      readStringPayloadValue(appliedJob.payload, "roleName") ??
        readStringPayloadValue(appliedJob.payload, "userName")
    ),
    createKnownComparisonRow(
      createComparisonRow,
      `${copy.targetedNodesLabel}`,
      database.primaryNodeId,
      appliedJob.nodeId
    )
  ];
}

function createTenantPreviewItems(
  copy: DesiredStateModelCopy,
  selections: DesiredStateSelectionModel
): DesiredStateRelatedPanelItem[] {
  if (!selections.selectedTenant) {
    return [];
  }

  return [
    {
      title: "metadata.update",
      meta: escapeHtml(
        `${selections.selectedTenant.slug} · ${selections.selectedTenant.displayName}`
      ),
      summary: escapeHtml(
        `Apps: ${summarizePreviewList(
          selections.selectedTenantApps.map((app) => app.slug),
          copy.none
        )}. Zones: ${summarizePreviewList(
          selections.selectedTenantZones.map((zone) => zone.zoneName),
          copy.none
        )}. Policies: ${summarizePreviewList(
          selections.selectedTenantBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}.`
      ),
      tone: "default"
    },
    {
      title: "tenant.delete",
      meta: escapeHtml("cascade"),
      summary: escapeHtml(
        `Will remove desired state for apps: ${summarizePreviewList(
          selections.selectedTenantApps.map((app) => app.slug),
          copy.none
        )}; zones: ${summarizePreviewList(
          selections.selectedTenantZones.map((zone) => zone.zoneName),
          copy.none
        )}; backup policies: ${summarizePreviewList(
          selections.selectedTenantBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}.`
      ),
      tone:
        selections.selectedTenantApps.length +
          selections.selectedTenantZones.length +
          selections.selectedTenantBackupPolicies.length >
        0
          ? "danger"
          : "default"
    }
  ];
}

function createNodePreviewItems(
  copy: DesiredStateModelCopy,
  selections: DesiredStateSelectionModel,
  activity: DesiredStateActivityModel
): DesiredStateRelatedPanelItem[] {
  if (!selections.selectedNode) {
    return [];
  }

  return [
    {
      title: "node.update",
      meta: escapeHtml(
        `${selections.selectedNode.hostname} · ${selections.selectedNode.publicIpv4}`
      ),
      summary: escapeHtml(
        `Apps: ${summarizePreviewList(
          selections.selectedNodePrimaryApps.map((app) => app.slug),
          copy.none
        )}. Zones: ${summarizePreviewList(
          selections.selectedNodePrimaryZones.map((zone) => zone.zoneName),
          copy.none
        )}. Policies: ${summarizePreviewList(
          selections.selectedNodeBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}.`
      ),
      tone: "default"
    },
    {
      title: "node.delete",
      meta: escapeHtml("topology risk"),
      summary: escapeHtml(
        `Primary ownership includes apps: ${summarizePreviewList(
          selections.selectedNodePrimaryApps.map((app) => app.slug),
          copy.none
        )}; zones: ${summarizePreviewList(
          selections.selectedNodePrimaryZones.map((zone) => zone.zoneName),
          copy.none
        )}; policies: ${summarizePreviewList(
          selections.selectedNodeBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}. Related jobs: ${activity.selectedNodeDesiredJobs.length}, drift entries: ${
          activity.selectedNodeDesiredDrift.length
        }, audit events: ${activity.selectedNodeDesiredAuditEvents.length}.`
      ),
      tone:
        selections.selectedNodePrimaryApps.length +
          selections.selectedNodePrimaryZones.length +
          selections.selectedNodeBackupPolicies.length >
        0
          ? "danger"
          : "default"
    }
  ];
}

function createZoneDeleteItem(args: {
  copy: DesiredStateModelCopy;
  selections: DesiredStateSelectionModel;
  activity: DesiredStateActivityModel;
  desiredZonePayload: ReturnType<typeof buildDesiredDnsPayload> | undefined;
  readObjectArrayPayloadValue: PayloadObjectArrayReader;
}): DesiredStateRelatedPanelItem[] {
  const {
    copy,
    selections,
    activity,
    desiredZonePayload,
    readObjectArrayPayloadValue
  } = args;

  if (!selections.selectedZone) {
    return [];
  }

  const appliedRecordCount = activity.selectedZoneLatestAppliedDnsJob
    ? readObjectArrayPayloadValue(
        activity.selectedZoneLatestAppliedDnsJob.payload,
        "records"
      ).length
    : 0;

  return [
    {
      title: "zone.delete",
      meta: escapeHtml(`${selections.selectedZoneApps.length} app(s)`),
      summary: escapeHtml(
        `Removes ${
          desiredZonePayload?.records.length ?? selections.selectedZone.records.length
        } desired DNS record(s). Last applied dns.sync publishes ${appliedRecordCount} record(s) on ${
          activity.selectedZoneLatestAppliedDnsJob?.nodeId ?? selections.selectedZone.primaryNodeId
        }. Apps: ${summarizePreviewList(
          selections.selectedZoneApps.map((app) => app.slug),
          copy.none
        )}. Policies: ${summarizePreviewList(
          selections.selectedZoneBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}.`
      ),
      tone:
        selections.selectedZoneApps.length + selections.selectedZoneBackupPolicies.length > 0
          ? "danger"
          : "default"
    }
  ];
}

function createAppDeleteItem(args: {
  copy: DesiredStateModelCopy;
  selections: DesiredStateSelectionModel;
  activity: DesiredStateActivityModel;
  readStringPayloadValue: PayloadStringReader;
  readStringArrayPayloadValue: PayloadStringArrayReader;
}): DesiredStateRelatedPanelItem[] {
  const { copy, selections, activity, readStringPayloadValue, readStringArrayPayloadValue } = args;

  if (!selections.selectedApp) {
    return [];
  }

  const appliedServerName =
    activity.selectedAppLatestAppliedProxyJob
      ? readStringPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "serverName")
      : null;
  const appliedAliases = activity.selectedAppLatestAppliedProxyJob
    ? readStringArrayPayloadValue(
        activity.selectedAppLatestAppliedProxyJob.payload,
        "serverAliases"
      ).length
    : 0;
  const appliedDocumentRoot =
    activity.selectedAppLatestAppliedProxyJob
      ? readStringPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "documentRoot")
      : null;

  return [
    {
      title: "app.delete",
      meta: escapeHtml(selections.selectedApp.canonicalDomain),
      summary: escapeHtml(
        `Removes proxy planning for ${selections.selectedApp.canonicalDomain} and ${
          selections.selectedApp.aliases.length
        } alias(es). Last applied proxy.render serves ${
          appliedServerName ?? selections.selectedApp.canonicalDomain
        } with ${appliedAliases} alias(es) from ${
          appliedDocumentRoot ?? `${selections.selectedApp.storageRoot}/current/public`
        }. Databases: ${summarizePreviewList(
          selections.selectedAppDatabases.map((database) => database.databaseName),
          copy.none
        )}.`
      ),
      tone:
        selections.selectedAppDatabases.length + selections.selectedApp.aliases.length > 0
          ? "danger"
          : "default"
    }
  ];
}

function createDatabaseDeleteItem(args: {
  copy: DesiredStateModelCopy;
  selections: DesiredStateSelectionModel;
  activity: DesiredStateActivityModel;
  readStringPayloadValue: PayloadStringReader;
}): DesiredStateRelatedPanelItem[] {
  const { copy, selections, activity, readStringPayloadValue } = args;

  if (!selections.selectedDatabase) {
    return [];
  }

  const appliedDatabaseName =
    activity.selectedDatabaseLatestAppliedReconcileJob
      ? readStringPayloadValue(
          activity.selectedDatabaseLatestAppliedReconcileJob.payload,
          "databaseName"
        )
      : null;
  const appliedDatabaseUser =
    activity.selectedDatabaseLatestAppliedReconcileJob
      ? readStringPayloadValue(
          activity.selectedDatabaseLatestAppliedReconcileJob.payload,
          "roleName"
        ) ??
        readStringPayloadValue(
          activity.selectedDatabaseLatestAppliedReconcileJob.payload,
          "userName"
        )
      : null;

  return [
    {
      title: "database.delete",
      meta: escapeHtml(selections.selectedDatabase.databaseName),
      summary: escapeHtml(
        `Stops desired ${selections.selectedDatabase.engine} reconcile for ${selections.selectedDatabase.appSlug}. Last applied reconcile targets ${
          appliedDatabaseName ?? selections.selectedDatabase.databaseName
        } / ${appliedDatabaseUser ?? selections.selectedDatabase.databaseUser} on ${
          activity.selectedDatabaseLatestAppliedReconcileJob?.nodeId ??
          selections.selectedDatabase.primaryNodeId
        }. Backup policies: ${summarizePreviewList(
          selections.selectedDatabaseBackupPolicies.map((policy) => policy.policySlug),
          copy.none
        )}.`
      ),
      tone:
        selections.selectedDatabaseBackupPolicies.length > 0 ? "danger" : "default"
    }
  ];
}

function createBackupPreviewItems(
  copy: DesiredStateModelCopy,
  selections: DesiredStateSelectionModel
): DesiredStateRelatedPanelItem[] {
  if (!selections.selectedBackupPolicy) {
    return [];
  }

  return [
    {
      title: "policy.update",
      meta: escapeHtml(
        `${selections.selectedBackupPolicy.targetNodeId} · ${selections.selectedBackupPolicy.schedule}`
      ),
      summary: escapeHtml(
        `Apps: ${summarizePreviewList(
          selections.selectedBackupTenantApps.map((app) => app.slug),
          copy.none
        )}. Zones: ${summarizePreviewList(
          selections.selectedBackupTenantZones.map((zone) => zone.zoneName),
          copy.none
        )}. Databases: ${summarizePreviewList(
          selections.selectedBackupTenantDatabases.map((database) => database.databaseName),
          copy.none
        )}.`
      ),
      tone: "default"
    },
    {
      title: "policy.delete",
      meta: escapeHtml(`${selections.selectedBackupRuns.length} recorded run(s)`),
      summary: escapeHtml(
        `Coverage would disappear for apps: ${summarizePreviewList(
          selections.selectedBackupTenantApps.map((app) => app.slug),
          copy.none
        )}; zones: ${summarizePreviewList(
          selections.selectedBackupTenantZones.map((zone) => zone.zoneName),
          copy.none
        )}; databases: ${summarizePreviewList(
          selections.selectedBackupTenantDatabases.map((database) => database.databaseName),
          copy.none
        )}.`
      ),
      tone:
        selections.selectedBackupTenantApps.length +
          selections.selectedBackupTenantZones.length +
          selections.selectedBackupTenantDatabases.length >
        0
          ? "danger"
          : "default"
    },
    {
      title: "coverage.apps",
      meta: escapeHtml(`${selections.selectedBackupTenantApps.length} app(s)`),
      summary: escapeHtml(
        summarizePreviewList(
          selections.selectedBackupTenantApps.map((app) => `${app.slug} · ${app.primaryNodeId}`),
          copy.none
        )
      ),
      tone: selections.selectedBackupTenantApps.length > 0 ? "success" : "default"
    },
    {
      title: "coverage.databases",
      meta: escapeHtml(`${selections.selectedBackupTenantDatabases.length} database(s)`),
      summary: escapeHtml(
        summarizePreviewList(
          selections.selectedBackupTenantDatabases.map(
            (database) => `${database.databaseName} · ${database.engine}`
          ),
          copy.none
        )
      ),
      tone: selections.selectedBackupTenantDatabases.length > 0 ? "success" : "default"
    },
    {
      title: "coverage.zones",
      meta: escapeHtml(`${selections.selectedBackupTenantZones.length} zone(s)`),
      summary: escapeHtml(
        summarizePreviewList(
          selections.selectedBackupTenantZones.map(
            (zone) => `${zone.zoneName} · ${zone.primaryNodeId}`
          ),
          copy.none
        )
      ),
      tone: selections.selectedBackupTenantZones.length > 0 ? "success" : "default"
    }
  ];
}

export function buildDesiredStateActionModel<Copy extends DesiredStateModelCopy>(
  args: Pick<
    BuildDesiredStateModelArgs<Copy>,
    | "copy"
    | "createComparisonDeltaItems"
    | "createComparisonRow"
    | "data"
    | "formatDnsRecordPreview"
    | "readBooleanPayloadValue"
    | "readObjectArrayPayloadValue"
    | "readStringArrayPayloadValue"
    | "readStringPayloadValue"
    | "summarizeComparisonRows"
  > & {
    activity: DesiredStateActivityModel;
    selections: DesiredStateSelectionModel;
  }
): DesiredStateActionModel {
  const {
    activity,
    copy,
    createComparisonDeltaItems,
    createComparisonRow,
    data,
    formatDnsRecordPreview,
    readBooleanPayloadValue,
    readObjectArrayPayloadValue,
    readStringArrayPayloadValue,
    readStringPayloadValue,
    selections
  } = args;

  const selectedAppLatestAppliedDnsJob = selections.selectedApp
    ? activity.selectedAppJobs.find(
        (job) => job.kind === "dns.sync" && job.status === "applied"
      )
    : undefined;
  const desiredZonePayload = selections.selectedZone
    ? buildDesiredDnsPayload({
        zone: selections.selectedZone,
        nodes: data.desiredState.spec.nodes,
        apps: data.desiredState.spec.apps,
        mailDomains: data.desiredState.spec.mailDomains
      })
    : undefined;
  const desiredAppZonePayload = selections.selectedAppZone
    ? buildDesiredDnsPayload({
        zone: selections.selectedAppZone,
        nodes: data.desiredState.spec.nodes,
        apps: data.desiredState.spec.apps,
        mailDomains: data.desiredState.spec.mailDomains
      })
    : undefined;

  const zoneComparisonRows = buildDnsComparisonRows({
    copy,
    zone: selections.selectedZone,
    appliedJob: activity.selectedZoneLatestAppliedDnsJob,
    desiredPayload: desiredZonePayload,
    createComparisonRow,
    readStringPayloadValue,
    readStringArrayPayloadValue,
    readObjectArrayPayloadValue,
    formatDnsRecordPreview
  });
  const appDnsComparisonRows = buildDnsComparisonRows({
    copy,
    zone: selections.selectedAppZone,
    appliedJob: selectedAppLatestAppliedDnsJob,
    desiredPayload: desiredAppZonePayload,
    createComparisonRow,
    readStringPayloadValue,
    readStringArrayPayloadValue,
    readObjectArrayPayloadValue,
    formatDnsRecordPreview,
    labelPrefix: "dns.sync · "
  });
  const appComparisonRows = buildAppComparisonRows({
    copy,
    app: selections.selectedApp,
    appliedJob: activity.selectedAppLatestAppliedProxyJob,
    appProxyDrifts: activity.selectedAppProxyDrifts,
    createComparisonRow,
    readStringPayloadValue,
    readBooleanPayloadValue,
    readStringArrayPayloadValue
  });
  const databaseComparisonRows = buildDatabaseComparisonRows({
    copy,
    database: selections.selectedDatabase,
    appliedJob: activity.selectedDatabaseLatestAppliedReconcileJob,
    createComparisonRow,
    readStringPayloadValue
  });

  const zoneDeltaPreviewItems = createComparisonDeltaItems(copy, zoneComparisonRows, 4);
  const appDeltaPreviewItems = createComparisonDeltaItems(copy, appComparisonRows, 4);
  const appDnsDeltaPreviewItems = prefixDeltaItems(
    createComparisonDeltaItems(copy, appDnsComparisonRows, 3),
    "dns.sync"
  );
  const databaseDeltaPreviewItems = createComparisonDeltaItems(copy, databaseComparisonRows, 4);

  const selectedAppPlanItems = selections.selectedApp
    ? [
        createActionDiffItem({
          title: "dns.sync",
          meta: [
            selections.selectedApp.zoneName,
            desiredAppZonePayload?.nodeId ?? selections.selectedApp.primaryNodeId
          ].join(" · "),
          rows: appDnsComparisonRows,
          fallback: selections.selectedAppZone
            ? "No successful dns.sync payload recorded yet for this app zone."
            : "No DNS zone is linked to this app yet.",
          extraDanger: Boolean(
            activity.selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
          )
        }),
        createActionDiffItem({
          title: "proxy.render",
          meta: selections.selectedApp.standbyNodeId
            ? `${selections.selectedApp.primaryNodeId} + ${selections.selectedApp.standbyNodeId}`
            : selections.selectedApp.primaryNodeId,
          rows: appComparisonRows,
          fallback: "No successful proxy.render payload recorded yet for this app.",
          extraDanger: activity.selectedAppProxyDrifts.some(
            (entry) => entry.dispatchRecommended
          )
        })
      ]
    : [];
  const selectedDatabasePlanItems = selections.selectedDatabase
    ? [
        createActionDiffItem({
          title:
            selections.selectedDatabase.engine === "postgresql"
              ? "postgres.reconcile"
              : "mariadb.reconcile",
          meta: selections.selectedDatabase.primaryNodeId,
          rows: databaseComparisonRows,
          fallback: "No successful database reconcile payload recorded yet for this resource.",
          extraDanger: Boolean(activity.selectedDatabaseDrift?.dispatchRecommended)
        })
      ]
    : [];
  const selectedZonePlanItems = selections.selectedZone
    ? [
        createActionDiffItem({
          title: "dns.sync",
          meta: `${selections.selectedZone.primaryNodeId} · ${
            desiredZonePayload?.records.length ?? selections.selectedZone.records.length
          } record(s)`,
          rows: zoneComparisonRows,
          fallback: "No successful dns.sync payload recorded yet for this zone.",
          extraDanger: Boolean(activity.selectedZoneDrift?.dispatchRecommended)
        })
      ]
    : [];

  return {
    selectedAppPlanItems,
    selectedDatabasePlanItems,
    selectedZonePlanItems,
    zoneComparisonRows,
    appComparisonRows,
    databaseComparisonRows,
    selectedTenantActionPreviewItems: createTenantPreviewItems(copy, selections),
    selectedNodeActionPreviewItems: createNodePreviewItems(copy, selections, activity),
    selectedZoneActionPreviewItems: selections.selectedZone
      ? [
          createActionDiffItem({
            title: "dns.sync",
            meta: `${selections.selectedZone.primaryNodeId} · ${
              desiredZonePayload?.records.length ?? selections.selectedZone.records.length
            } record(s)`,
            rows: zoneComparisonRows,
            fallback: "No successful dns.sync payload recorded yet for this zone.",
            extraDanger: Boolean(activity.selectedZoneDrift?.dispatchRecommended)
          }),
          ...createZoneDeleteItem({
            copy,
            selections,
            activity,
            desiredZonePayload,
            readObjectArrayPayloadValue
          }),
          ...zoneDeltaPreviewItems
        ]
      : [],
    selectedAppActionPreviewItems: selections.selectedApp
      ? [
          createActionDiffItem({
            title: "dns.sync",
            meta: `${selections.selectedApp.zoneName} · ${
              desiredAppZonePayload?.records.length ?? selections.selectedAppZone?.records.length ?? 0
            } record(s)`,
            rows: appDnsComparisonRows,
            fallback: selections.selectedAppZone
              ? "No successful dns.sync payload recorded yet for this app zone."
              : "No DNS zone is linked to this app yet.",
            extraDanger: activity.selectedAppProxyDrifts.some(
              (entry) => entry.dispatchRecommended
            )
          }),
          createActionDiffItem({
            title: "proxy.render",
            meta: selections.selectedApp.standbyNodeId
              ? `${selections.selectedApp.primaryNodeId} -> ${selections.selectedApp.standbyNodeId}`
              : selections.selectedApp.primaryNodeId,
            rows: appComparisonRows,
            fallback: "No successful proxy.render payload recorded yet for this app.",
            extraDanger: activity.selectedAppProxyDrifts.some(
              (entry) => entry.dispatchRecommended
            )
          }),
          {
            title: "app.reconcile",
            meta: escapeHtml(
              `${selections.selectedAppDatabases.length} database(s) · ${selections.selectedApp.aliases.length} alias(es)`
            ),
            summary: escapeHtml(
              `dns.sync: ${buildActionDiffSummary(
                appDnsComparisonRows,
                selections.selectedAppZone
                  ? "No successful dns.sync payload recorded yet for this app zone."
                  : "No DNS zone is linked to this app yet."
              )} Proxy: ${buildActionDiffSummary(
                appComparisonRows,
                "No successful proxy.render payload recorded yet for this app."
              )}`
            ),
            tone:
              activity.selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended) ||
              appComparisonRows.some((row) => row.state === "changed") ||
              appDnsComparisonRows.some((row) => row.state === "changed")
                ? "danger"
                : "default"
          },
          ...createAppDeleteItem({
            copy,
            selections,
            activity,
            readStringPayloadValue,
            readStringArrayPayloadValue
          }),
          ...appDnsDeltaPreviewItems,
          ...appDeltaPreviewItems
        ]
      : [],
    selectedDatabaseActionPreviewItems: selections.selectedDatabase
      ? [
          createActionDiffItem({
            title: `${selections.selectedDatabase.engine}.reconcile`,
            meta: selections.selectedDatabase.primaryNodeId,
            rows: databaseComparisonRows,
            fallback: "No successful database reconcile payload recorded yet for this resource.",
            extraDanger: Boolean(activity.selectedDatabaseDrift?.dispatchRecommended)
          }),
          ...createDatabaseDeleteItem({
            copy,
            selections,
            activity,
            readStringPayloadValue
          }),
          ...databaseDeltaPreviewItems
        ]
      : [],
    selectedBackupActionPreviewItems: createBackupPreviewItems(copy, selections)
  };
}
