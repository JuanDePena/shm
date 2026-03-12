import type {
  DnsSyncPayload,
  ProxyRenderPayload,
  ShmJobResult,
  ShmNodeSnapshot
} from "@simplehost/manager-contracts";

export function renderNodeSnapshot(snapshot: ShmNodeSnapshot): string {
  return [
    `Node: ${snapshot.nodeId}`,
    `Host: ${snapshot.hostname}`,
    `Status: ${snapshot.status}`,
    `State dir: ${snapshot.stateDir}`,
    `Report buffer: ${snapshot.reportBufferDir}`,
    `Generated at: ${snapshot.generatedAt}`
  ].join("\n");
}

export function renderJobResult(result: ShmJobResult): string {
  return [
    `Job: ${result.jobId}`,
    `Kind: ${result.kind}`,
    `Node: ${result.nodeId}`,
    `Status: ${result.status}`,
    `Summary: ${result.summary}`,
    `Completed at: ${result.completedAt}`
  ].join("\n");
}

export function renderApacheVhost(payload: ProxyRenderPayload): string {
  const aliases = payload.serverAliases ?? [];

  return [
    "<VirtualHost *:80>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    `  DocumentRoot ${payload.documentRoot}`,
    "  <Directory " + payload.documentRoot + ">",
    "    AllowOverride All",
    "    Require all granted",
    "  </Directory>",
    payload.tls ? "  # TLS is expected to be terminated upstream." : "  # Plain HTTP bootstrap vhost.",
    "</VirtualHost>"
  ].join("\n");
}

export function renderDnsZoneFile(payload: DnsSyncPayload): string {
  return [
    `$ORIGIN ${payload.zoneName}.`,
    `$TTL 300`,
    `@ IN SOA ${payload.nameservers[0]}. hostmaster.${payload.zoneName}. (`,
    `  ${payload.serial}`,
    "  300",
    "  300",
    "  1209600",
    "  300",
    ")",
    ...payload.nameservers.map((nameserver) => `@ IN NS ${nameserver}.`),
    ...payload.records.map(
      (record) => `${record.name} ${record.ttl} IN ${record.type} ${record.value}`
    )
  ].join("\n");
}
