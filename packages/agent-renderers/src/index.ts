import type {
  ContainerReconcilePayload,
  DnsSyncPayload,
  MailSyncPayload,
  ProxyRenderPayload,
  AgentJobResult,
  AgentNodeSnapshot
} from "@simplehost/agent-contracts";

export function renderNodeSnapshot(snapshot: AgentNodeSnapshot): string {
  return [
    `Node: ${snapshot.nodeId}`,
    `Host: ${snapshot.hostname}`,
    `Status: ${snapshot.status}`,
    `State dir: ${snapshot.stateDir}`,
    `Report buffer: ${snapshot.reportBufferDir}`,
    `Generated at: ${snapshot.generatedAt}`
  ].join("\n");
}

export function renderJobResult(result: AgentJobResult): string {
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
  const documentRoot = payload.documentRoot ?? "/var/www/html";
  const proxyPassUrl = payload.proxyPassUrl
    ? `${payload.proxyPassUrl.replace(/\/+$/, "")}/`
    : undefined;

  return [
    "<VirtualHost *:80>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    `  DocumentRoot ${documentRoot}`,
    ...(payload.documentRoot
      ? [
          "  <Directory " + payload.documentRoot + ">",
          "    AllowOverride All",
          "    Require all granted",
          "  </Directory>"
        ]
      : []),
    ...(proxyPassUrl
      ? [
          `  ProxyPreserveHost ${payload.proxyPreserveHost === false ? "Off" : "On"}`,
          "  ProxyRequests Off",
          `  ProxyPass / ${proxyPassUrl} retry=0 timeout=120`,
          `  ProxyPassReverse / ${proxyPassUrl}`
        ]
      : []),
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

function renderEnvironmentValue(value: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderEnvironmentFile(
  environment: Record<string, string> = {}
): string {
  return Object.entries(environment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${renderEnvironmentValue(value)}`)
    .join("\n");
}

export function renderQuadletContainerUnit(
  payload: ContainerReconcilePayload,
  envFilePath?: string
): string {
  const publishPorts = payload.publishPorts ?? [];
  const volumes = payload.volumes ?? [];

  return [
    "[Unit]",
    `Description=${payload.description ?? `Managed container ${payload.serviceName}`}`,
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Container]",
    `ContainerName=${payload.containerName}`,
    `Image=${payload.image}`,
    ...(payload.exec ? [`Exec=${payload.exec}`] : []),
    ...(payload.network ? [`Network=${payload.network}`] : []),
    ...publishPorts.map((publishPort) => `PublishPort=${publishPort}`),
    ...(envFilePath ? [`EnvironmentFile=${envFilePath}`] : []),
    ...volumes.map((volume) => `Volume=${volume}`),
    "",
    "[Service]",
    `Restart=${payload.restart ?? "always"}`,
    `RestartSec=${payload.restartSec ?? 5}`,
    "TimeoutStartSec=900",
    "",
    "[Install]",
    `WantedBy=${payload.wantedBy ?? "multi-user.target"}`
  ].join("\n");
}

export function renderMailDesiredState(payload: MailSyncPayload): string {
  return JSON.stringify(
    {
      domains: payload.domains.map((domain) => ({
        ...domain,
        mailboxes: domain.mailboxes.map(({ desiredPassword, ...mailbox }) => ({
          ...mailbox,
          credentialState: desiredPassword ? "configured" : "reset_required"
        }))
      }))
    },
    null,
    2
  );
}

function escapePhpString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function renderRoundcubeConfig(options: {
  databasePath: string;
  tempDir: string;
  logDir: string;
  productName: string;
  desKey: string;
}): string {
  return [
    "<?php",
    "",
    "$config = [];",
    `$config['db_dsnw'] = 'sqlite:${escapePhpString(options.databasePath)}';`,
    `$config['default_host'] = 'ssl://127.0.0.1';`,
    "$config['default_port'] = 993;",
    `$config['smtp_server'] = 'tls://127.0.0.1';`,
    "$config['smtp_port'] = 587;",
    "$config['smtp_user'] = '%u';",
    "$config['smtp_pass'] = '%p';",
    "$config['support_url'] = '';",
    `$config['product_name'] = '${escapePhpString(options.productName)}';`,
    `$config['des_key'] = '${escapePhpString(options.desKey)}';`,
    "$config['plugins'] = ['archive', 'zipdownload'];",
    "$config['skin'] = 'elastic';",
    `$config['temp_dir'] = '${escapePhpString(options.tempDir)}';`,
    `$config['log_dir'] = '${escapePhpString(options.logDir)}';`,
    "$config['enable_installer'] = false;",
    ""
  ].join("\n");
}

export function renderMailFirewalldService(serviceName: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<service>",
    `  <short>${serviceName}</short>`,
    "  <description>SimpleHostMan mail ingress</description>",
    '  <port protocol="tcp" port="25"/>',
    '  <port protocol="tcp" port="465"/>',
    '  <port protocol="tcp" port="587"/>',
    '  <port protocol="tcp" port="993"/>',
    '  <port protocol="tcp" port="995"/>',
    "</service>"
  ].join("\n");
}

interface MailboxPasswordEntry {
  address: string;
  passwordHash: string;
  homePath: string;
  maildirPath: string;
  quotaBytes?: number;
}

export function renderPostfixVirtualDomains(payload: MailSyncPayload): string {
  return payload.domains
    .map((domain) => domain.domainName)
    .filter((value, index, items) => items.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right))
    .map((domainName) => `${domainName} ok`)
    .join("\n");
}

export function renderPostfixVirtualMailboxes(
  payload: MailSyncPayload,
  vmailRoot: string
): string {
  return payload.domains
    .flatMap((domain) =>
      domain.mailboxes.map((mailbox) => ({
        address: mailbox.address,
        maildirPath: `${vmailRoot}/${domain.domainName}/${mailbox.localPart}/Maildir`
      }))
    )
    .sort((left, right) => left.address.localeCompare(right.address))
    .map((mailbox) => `${mailbox.address} ${mailbox.maildirPath}`)
    .join("\n");
}

export function renderPostfixVirtualAliases(payload: MailSyncPayload): string {
  return payload.domains
    .flatMap((domain) => domain.aliases)
    .sort((left, right) => left.address.localeCompare(right.address))
    .map((alias) => `${alias.address} ${alias.destinations.join(",")}`)
    .join("\n");
}

export function renderPostfixMainCf(
  configRoot: string,
  postmasterAddress: string
): string {
  const postfixRoot = `${configRoot}/postfix`;

  return [
    "# SimpleHost generated postfix mail snippet",
    "inet_interfaces = all",
    `virtual_mailbox_domains = texthash:${postfixRoot}/vmail_domains`,
    `virtual_mailbox_maps = texthash:${postfixRoot}/vmail_mailboxes`,
    `virtual_alias_maps = texthash:${postfixRoot}/vmail_aliases`,
    "virtual_transport = lmtp:unix:private/dovecot-lmtp",
    "smtpd_sasl_type = dovecot",
    "smtpd_sasl_path = private/auth",
    "smtpd_sasl_auth_enable = yes",
    "smtpd_tls_auth_only = yes",
    "smtpd_milters = inet:127.0.0.1:11332",
    "non_smtpd_milters = inet:127.0.0.1:11332",
    "milter_default_action = accept",
    "milter_protocol = 6",
    "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination",
    `smtpd_banner = $myhostname ESMTP ${postmasterAddress}`,
    `mydestination = localhost, localhost.localdomain`
  ].join("\n");
}

export function renderPostfixMasterCf(): string {
  return [
    "# SimpleHost generated postfix submission services",
    "submission inet n       -       n       -       -       smtpd",
    "  -o syslog_name=postfix/submission",
    "  -o smtpd_tls_security_level=encrypt",
    "  -o smtpd_sasl_auth_enable=yes",
    "  -o smtpd_tls_auth_only=yes",
    "  -o local_header_rewrite_clients=static:all",
    "  -o smtpd_reject_unlisted_recipient=no",
    "  -o smtpd_client_restrictions=",
    "  -o smtpd_helo_restrictions=",
    "  -o smtpd_sender_restrictions=",
    "  -o smtpd_relay_restrictions=",
    "  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject",
    "  -o milter_macro_daemon_name=ORIGINATING",
    "submissions inet n      -       n       -       -       smtpd",
    "  -o syslog_name=postfix/submissions",
    "  -o smtpd_tls_wrappermode=yes",
    "  -o smtpd_sasl_auth_enable=yes",
    "  -o local_header_rewrite_clients=static:all",
    "  -o smtpd_reject_unlisted_recipient=no",
    "  -o smtpd_client_restrictions=",
    "  -o smtpd_helo_restrictions=",
    "  -o smtpd_sender_restrictions=",
    "  -o smtpd_relay_restrictions=",
    "  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject",
    "  -o milter_macro_daemon_name=ORIGINATING"
  ].join("\n");
}

export function renderDovecotPasswd(entries: MailboxPasswordEntry[]): string {
  return entries
    .sort((left, right) => left.address.localeCompare(right.address))
    .map((entry) => {
      const extraFields = [
        `userdb_home=${entry.homePath}`,
        `userdb_mail=maildir:${entry.maildirPath}`,
        "userdb_uid=vmail",
        "userdb_gid=vmail",
        ...(entry.quotaBytes ? [`userdb_quota_rule=*:storage=${entry.quotaBytes}B`] : [])
      ];

      return `${entry.address}:${entry.passwordHash}::::::${extraFields.join(" ")}`;
    })
    .join("\n");
}

export function renderDovecotMailConf(passwdPath: string, postmasterAddress: string): string {
  return [
    "# SimpleHost generated dovecot mail snippet",
    "protocols = imap pop3 lmtp",
    "auth_mechanisms = plain login",
    "disable_plaintext_auth = yes",
    "mail_privileged_group = mail",
    "first_valid_uid = 1",
    "last_valid_uid = 0",
    "passdb {",
    "  driver = passwd-file",
    `  args = scheme=SHA512-CRYPT username_format=%u ${passwdPath}`,
    "}",
    "userdb {",
    "  driver = passwd-file",
    `  args = username_format=%u ${passwdPath}`,
    "}",
    "service imap-login {",
    "  inet_listener imap {",
    "    port = 0",
    "  }",
    "  inet_listener imaps {",
    "    port = 993",
    "    ssl = yes",
    "  }",
    "}",
    "service pop3-login {",
    "  inet_listener pop3 {",
    "    port = 0",
    "  }",
    "  inet_listener pop3s {",
    "    port = 995",
    "    ssl = yes",
    "  }",
    "}",
    "service submission-login {",
    "  inet_listener submission {",
    "    port = 0",
    "  }",
    "  inet_listener submissions {",
    "    port = 0",
    "  }",
    "}",
    "service auth {",
    "  unix_listener /var/spool/postfix/private/auth {",
    "    mode = 0660",
    "    user = postfix",
    "    group = postfix",
    "  }",
    "}",
    "service lmtp {",
    "  unix_listener /var/spool/postfix/private/dovecot-lmtp {",
    "    mode = 0600",
    "    user = postfix",
    "    group = postfix",
    "  }",
    "}",
    "protocol lda {",
    `  postmaster_address = ${postmasterAddress}`,
    "}",
    "protocol lmtp {",
    `  postmaster_address = ${postmasterAddress}`,
    "  mail_plugins = $mail_plugins quota",
    "}",
    "protocol imap {",
    "  mail_plugins = $mail_plugins quota imap_quota",
    "}",
    "plugin {",
    "  quota = maildir:User quota",
    "}",
    "namespace inbox {",
    "  inbox = yes",
    "}"
  ].join("\n");
}

export function renderRspamdRedisConf(): string {
  return [
    "# SimpleHost generated rspamd redis snippet",
    'servers = "127.0.0.1";'
  ].join("\n");
}

export function renderRspamdActionsConf(): string {
  return [
    "# SimpleHost generated rspamd actions snippet",
    "reject = 15;",
    "add_header = 6;",
    "greylist = 4;"
  ].join("\n");
}

export function renderRspamdMilterHeadersConf(): string {
  return [
    "# SimpleHost generated rspamd milter_headers snippet",
    'use = ["authentication-results", "x-spam-status", "x-spam-level", "x-spamd-bar"];'
  ].join("\n");
}

export function renderRspamdSelectorsMap(payload: MailSyncPayload): string {
  return payload.domains
    .map((domain) => `${domain.domainName} ${domain.dkimSelector}`)
    .filter((value, index, items) => items.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
}

export function renderRspamdDkimSigningConf(
  configRoot: string,
  dkimRoot: string,
  enabled: boolean
): string {
  return [
    "# SimpleHost generated rspamd dkim_signing snippet",
    `enabled = ${enabled ? "true" : "false"};`,
    'sign_authenticated = true;',
    'use_domain = "header";',
    'allow_envfrom_empty = true;',
    `selector_map = "${configRoot}/rspamd/dkim_selectors.map";`,
    `path = "${dkimRoot}/$domain/$selector.key";`
  ].join("\n");
}

export function renderMtaStsPolicy(domain: Pick<MailSyncPayload["domains"][number], "mailHost" | "mtaStsMode" | "mtaStsMaxAgeSeconds">): string {
  return [
    "version: STSv1",
    `mode: ${domain.mtaStsMode}`,
    `mx: ${domain.mailHost}`,
    `max_age: ${domain.mtaStsMaxAgeSeconds}`
  ].join("\n");
}

export function renderWebmailPlaceholder(
  domainName: string,
  webmailHostname: string
): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${domainName} webmail scaffold</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    :root { color-scheme: light; font-family: system-ui, sans-serif; }",
    "    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f7fb; color: #10233d; }",
    "    main { width: min(42rem, calc(100vw - 3rem)); padding: 1.5rem; border: 1px solid #cfdae7; border-radius: 0.75rem; background: rgba(255,255,255,0.92); box-shadow: 0 1rem 2.5rem rgba(16,35,61,0.08); }",
    "    h1 { margin: 0 0 0.5rem; font-size: 1.4rem; }",
    "    p { margin: 0.5rem 0 0; line-height: 1.5; }",
    "    code { padding: 0.15rem 0.35rem; border-radius: 0.35rem; background: #eaf1f8; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    `    <h1>${domainName} webmail scaffold</h1>`,
    `    <p>The Apache vhost for <code>${webmailHostname}</code> is ready.</p>`,
    "    <p>Roundcube content has not been deployed yet, so this placeholder confirms the document root exists and is under SimpleHost Agent control.</p>",
    "  </main>",
    "</body>",
    "</html>"
  ].join("\n");
}
