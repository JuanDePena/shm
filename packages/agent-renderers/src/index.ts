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
  const extraProxyRoutes = payload.extraProxyRoutes ?? [];
  const documentRoot = payload.documentRoot ?? "/var/www/html";
  const proxyPassUrl = payload.proxyPassUrl
    ? `${payload.proxyPassUrl.replace(/\/+$/, "")}/`
    : undefined;
  const shouldRenderDocumentRoot = Boolean(payload.documentRoot && !proxyPassUrl);
  const tlsCertificateFile =
    payload.tlsCertificateFile ??
    `/etc/letsencrypt/live/${payload.serverName}/fullchain.pem`;
  const tlsCertificateKeyFile =
    payload.tlsCertificateKeyFile ??
    `/etc/letsencrypt/live/${payload.serverName}/privkey.pem`;
  const normalizeRouteTarget = (targetUrl: string) => `${targetUrl.replace(/\/+$/, "")}/`;
  const renderExtraProxyRoutes = (indent = "  ") =>
    extraProxyRoutes.flatMap((route) => {
      const targetUrl = normalizeRouteTarget(route.targetUrl);
      const pathPrefix = route.pathPrefix.endsWith("/")
        ? route.pathPrefix
        : `${route.pathPrefix}/`;
      const timeout = route.timeoutSeconds ?? 120;
      const flags = `${route.noCanon ? " nocanon" : ""} retry=0 timeout=${timeout}`;

      return [
        `${indent}ProxyPass ${pathPrefix} ${targetUrl}${flags}`,
        `${indent}ProxyPassReverse ${pathPrefix} ${targetUrl}`
      ];
    });
  const renderExtraWebsocketRoutes = (indent = "  ") =>
    extraProxyRoutes
      .filter((route) => route.websocket)
      .flatMap((route) => {
        const pathPrefix = route.pathPrefix.endsWith("/")
          ? route.pathPrefix
          : `${route.pathPrefix}/`;
        const targetUrl = normalizeRouteTarget(route.targetUrl)
          .replace(/^http:/, "ws:")
          .replace(/^https:/, "wss:");

        return [
          `${indent}RewriteCond %{HTTP:Upgrade} websocket [NC]`,
          `${indent}RewriteCond %{HTTP:Connection} upgrade [NC]`,
          `${indent}RewriteRule ^${pathPrefix}(.*) ${targetUrl}$1 [P,L]`
        ];
      });
  const renderDocumentRoot = (indent = "  ") => [
    ...(shouldRenderDocumentRoot
      ? [
          `${indent}DocumentRoot ${documentRoot}`,
          `${indent}<Directory ${payload.documentRoot}>`,
          `${indent}  AllowOverride All`,
          `${indent}  Require all granted`,
          `${indent}</Directory>`
        ]
      : [])
  ];
  const renderProxy = (indent = "  ") =>
    proxyPassUrl
      ? [
          `${indent}ProxyPreserveHost ${payload.proxyPreserveHost === false ? "Off" : "On"}`,
          `${indent}ProxyRequests Off`,
          ...renderExtraProxyRoutes(indent),
          ...(extraProxyRoutes.some((route) => route.websocket)
            ? [`${indent}RewriteEngine On`, ...renderExtraWebsocketRoutes(indent)]
            : []),
          `${indent}ProxyPass / ${proxyPassUrl} retry=0 timeout=120`,
          `${indent}ProxyPassReverse / ${proxyPassUrl}`
        ]
      : [];

  if (!payload.tls) {
    return [
      "<VirtualHost *:80>",
      `  ServerName ${payload.serverName}`,
      ...aliases.map((alias) => `  ServerAlias ${alias}`),
      ...renderDocumentRoot(),
      ...renderProxy(),
      "  # Plain HTTP bootstrap vhost.",
      "</VirtualHost>"
    ].join("\n");
  }

  return [
    "<VirtualHost *:80>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    "",
    "  RewriteEngine On",
    "  RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/",
    "  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L,NE]",
    "</VirtualHost>",
    "",
    "<IfModule mod_ssl.c>",
    "<VirtualHost *:443>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    "",
    "  SSLEngine on",
    `  SSLCertificateFile ${tlsCertificateFile}`,
    `  SSLCertificateKeyFile ${tlsCertificateKeyFile}`,
    "",
    '  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    '  Header always set X-Content-Type-Options "nosniff"',
    '  Header always set X-Frame-Options "SAMEORIGIN"',
    '  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    "",
    ...renderDocumentRoot(),
    ...(proxyPassUrl
      ? [
          "  RequestHeader set X-Forwarded-Proto \"https\"",
          "  RequestHeader set X-Forwarded-Port \"443\"",
          ...renderProxy()
        ]
      : []),
    "",
    `  ErrorLog /var/log/httpd/${payload.vhostName}_ssl_error.log`,
    `  CustomLog /var/log/httpd/${payload.vhostName}_ssl_access.log combined`,
    "</VirtualHost>",
    "</IfModule>"
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
      policy: payload.policy,
      domains: payload.domains.map((domain) => ({
        ...domain,
        mailboxes: domain.mailboxes.map(({ desiredPassword, credentialState, ...mailbox }) => ({
          ...mailbox,
          credentialState:
            credentialState ?? (desiredPassword ? "configured" : "missing")
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

function formatRoundcubeSqliteDsn(databasePath: string): string {
  const normalizedPath = databasePath.startsWith("/")
    ? `/${databasePath.replace(/^\/+/, "")}`
    : databasePath;

  return `sqlite:///${normalizedPath}`;
}

function formatRoundcubeDatabaseDsn(
  databasePath: string,
  databaseDsn?: string | null
): string {
  if (!databaseDsn || databaseDsn.trim().length === 0) {
    return formatRoundcubeSqliteDsn(databasePath);
  }

  return databaseDsn.replace(/^postgres(?:ql)?:\/\//i, "pgsql://");
}

export function renderRoundcubeConfig(options: {
  databasePath: string;
  databaseDsn?: string | null;
  tempDir: string;
  logDir: string;
  productName: string;
  desKey: string;
}): string {
  return [
    "<?php",
    "",
    "$config = [];",
    `$config['db_dsnw'] = '${escapePhpString(
      formatRoundcubeDatabaseDsn(options.databasePath, options.databaseDsn)
    )}';`,
    `$config['default_host'] = 'ssl://127.0.0.1';`,
    "$config['default_port'] = 993;",
    `$config['smtp_server'] = 'tls://127.0.0.1';`,
    "$config['smtp_port'] = 587;",
    "$config['smtp_user'] = '%u';",
    "$config['smtp_pass'] = '%p';",
    "$config['imap_conn_options'] = [",
    "  'ssl' => [",
    "    'verify_peer' => false,",
    "    'verify_peer_name' => false,",
    "    'allow_self_signed' => true,",
    "  ],",
    "];",
    "$config['smtp_conn_options'] = [",
    "  'ssl' => [",
    "    'verify_peer' => false,",
    "    'verify_peer_name' => false,",
    "    'allow_self_signed' => true,",
    "  ],",
    "];",
    "$config['support_url'] = '';",
    `$config['product_name'] = '${escapePhpString(options.productName)}';`,
    `$config['des_key'] = '${escapePhpString(options.desKey)}';`,
    "$config['plugins'] = ['archive', 'zipdownload', 'http_authentication'];",
    "$config['skin'] = 'elastic';",
    `$config['temp_dir'] = '${escapePhpString(options.tempDir)}';`,
    `$config['log_dir'] = '${escapePhpString(options.logDir)}';`,
    "$config['enable_installer'] = false;",
    ""
  ].join("\n");
}

export function renderRoundcubeAutologinScript(secretPath: string): string {
  return [
    "<?php",
    "declare(strict_types=1);",
    "",
    "function simplehost_fail(int $status, string $message): void",
    "{",
    "    http_response_code($status);",
    "    header('Content-Type: text/plain; charset=UTF-8');",
    "    echo $message, \"\\n\";",
    "    exit;",
    "}",
    "",
    "function simplehost_base64url_decode(string $value)",
    "{",
    "    $remainder = strlen($value) % 4;",
    "    if ($remainder > 0) {",
    "        $value .= str_repeat('=', 4 - $remainder);",
    "    }",
    "",
    "    return base64_decode(strtr($value, '-_', '+/'), true);",
    "}",
    "",
    "$token = isset($_GET['token']) && is_string($_GET['token']) ? trim($_GET['token']) : '';",
    "if ($token === '' || substr_count($token, '.') !== 1) {",
    "    simplehost_fail(400, 'Missing or invalid autologin token.');",
    "}",
    "",
    "[$payload_encoded, $signature] = explode('.', $token, 2);",
    `$secret = @file_get_contents('${escapePhpString(secretPath)}');`,
    "if (!is_string($secret) || trim($secret) === '') {",
    "    simplehost_fail(500, 'Autologin secret is unavailable.');",
    "}",
    "",
    "if ($signature === '') {",
    "    simplehost_fail(400, 'Autologin token signature is missing.');",
    "}",
    "",
    "$expected_signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $payload_encoded, trim($secret), true)), '+/', '-_'), '=');",
    "if (!hash_equals($expected_signature, $signature)) {",
    "    simplehost_fail(403, 'Autologin token signature mismatch.');",
    "}",
    "",
    "$payload_json = simplehost_base64url_decode($payload_encoded);",
    "if (!is_string($payload_json) || $payload_json === '') {",
    "    simplehost_fail(400, 'Autologin token payload is invalid.');",
    "}",
    "",
    "$payload = json_decode($payload_json, true);",
    "if (!is_array($payload)) {",
    "    simplehost_fail(400, 'Autologin token JSON is invalid.');",
    "}",
    "",
    "$address = isset($payload['address']) && is_string($payload['address']) ? trim($payload['address']) : '';",
    "$credential = isset($payload['credential']) && is_string($payload['credential']) ? $payload['credential'] : '';",
    "$expires_at = isset($payload['exp']) && is_string($payload['exp']) ? strtotime($payload['exp']) : false;",
    "",
    "if ($address === '' || $credential === '' || $expires_at === false) {",
    "    simplehost_fail(400, 'Autologin token is incomplete.');",
    "}",
    "",
    "if ($expires_at < time()) {",
    "    simplehost_fail(410, 'Autologin token expired.');",
    "}",
    "",
    "$_SERVER['PHP_AUTH_USER'] = $address;",
    "$_SERVER['PHP_AUTH_PW'] = $credential;",
    "$_GET = ['_task' => 'mail'];",
    "$_REQUEST = array_merge($_REQUEST, $_GET);",
    "$_SERVER['QUERY_STRING'] = http_build_query($_GET);",
    "",
    "require __DIR__ . '/index.php';",
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

export function renderHostPublicFirewalldZone(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<zone>",
    "  <short>Public</short>",
    "  <description>Public operator-facing zone for Apache TLS ingress, code-server proxy access, and WireGuard.</description>",
    '  <interface name="eth0"/>',
    '  <service name="ssh"/>',
    '  <service name="http"/>',
    '  <service name="https"/>',
    '  <service name="dhcpv6-client"/>',
    '  <port protocol="udp" port="51820"/>',
    '  <port protocol="tcp" port="3200"/>',
    '  <port protocol="tcp" port="8080"/>',
    "</zone>"
  ].join("\n");
}

export function renderHostWireGuardFirewalldZone(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<zone>",
    "  <short>WireGuard</short>",
    "  <description>Private inter-node zone on wg0 for replication and restricted control-plane traffic.</description>",
    '  <interface name="wg0"/>',
    '  <port protocol="tcp" port="5432"/>',
    '  <port protocol="tcp" port="5433"/>',
    '  <port protocol="tcp" port="3306"/>',
    '  <port protocol="tcp" port="3100"/>',
    '  <port protocol="tcp" port="8081"/>',
    "</zone>"
  ].join("\n");
}

export function renderFail2BanSshdJail(): string {
  return [
    "[DEFAULT]",
    "bantime = 1h",
    "findtime = 10m",
    "maxretry = 5",
    "banaction = firewallcmd-rich-rules",
    "banaction_allports = firewallcmd-rich-rules",
    "",
    "[sshd]",
    "enabled = true",
    "backend = systemd",
    "mode = normal",
    "port = ssh",
    ""
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

function splitRspamdSenderPolicyEntries(entries: string[]): {
  addresses: string[];
  domains: string[];
} {
  const addresses = new Set<string>();
  const domains = new Set<string>();

  for (const entry of entries) {
    const normalized = entry.trim().toLowerCase();

    if (!normalized) {
      continue;
    }

    if (normalized.startsWith("@")) {
      domains.add(normalized.slice(1));
      continue;
    }

    addresses.add(normalized);
  }

  return {
    addresses: [...addresses].sort((left, right) => left.localeCompare(right)),
    domains: [...domains].sort((left, right) => left.localeCompare(right))
  };
}

export function renderRspamdActionsConf(policy: MailSyncPayload["policy"]): string {
  return [
    "# SimpleHost generated rspamd actions snippet",
    `reject = ${policy.rejectThreshold};`,
    `add_header = ${policy.addHeaderThreshold};`,
    policy.greylistThreshold !== undefined
      ? `greylist = ${policy.greylistThreshold};`
      : "greylist = null;"
  ].join("\n");
}

export function renderRspamdMilterHeadersConf(): string {
  return [
    "# SimpleHost generated rspamd milter_headers snippet",
    'use = ["authentication-results", "x-spam-status", "x-spam-level", "x-spamd-bar"];'
  ].join("\n");
}

export function renderRspamdSenderMap(entries: string[]): string {
  return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
}

export function renderRspamdMultimapConf(
  configRoot: string,
  policy: MailSyncPayload["policy"]
): string {
  const allowlist = splitRspamdSenderPolicyEntries(policy.senderAllowlist);
  const denylist = splitRspamdSenderPolicyEntries(policy.senderDenylist);
  const rules: string[] = ["# SimpleHost generated rspamd multimap snippet"];

  if (allowlist.addresses.length > 0) {
    rules.push(
      "SIMPLEHOST_ALLOWLIST_FROM_ADDRESS {",
      '  type = "selector";',
      '  selector = "from:addr.lower";',
      `  map = "${configRoot}/rspamd/sender_allowlist_addresses.map";`,
      "  prefilter = true;",
      '  action = "accept";',
      '  description = "SimpleHost sender allowlist by exact address";',
      "}"
    );
  }

  if (allowlist.domains.length > 0) {
    rules.push(
      "SIMPLEHOST_ALLOWLIST_FROM_DOMAIN {",
      '  type = "selector";',
      '  selector = "from:domain.lower";',
      `  map = "${configRoot}/rspamd/sender_allowlist_domains.map";`,
      "  prefilter = true;",
      '  action = "accept";',
      '  description = "SimpleHost sender allowlist by domain";',
      "}"
    );
  }

  if (denylist.addresses.length > 0) {
    rules.push(
      "SIMPLEHOST_DENYLIST_FROM_ADDRESS {",
      '  type = "selector";',
      '  selector = "from:addr.lower";',
      `  map = "${configRoot}/rspamd/sender_denylist_addresses.map";`,
      "  prefilter = true;",
      '  action = "reject";',
      '  message = "SimpleHost sender denylist policy matched";',
      '  description = "SimpleHost sender denylist by exact address";',
      "}"
    );
  }

  if (denylist.domains.length > 0) {
    rules.push(
      "SIMPLEHOST_DENYLIST_FROM_DOMAIN {",
      '  type = "selector";',
      '  selector = "from:domain.lower";',
      `  map = "${configRoot}/rspamd/sender_denylist_domains.map";`,
      "  prefilter = true;",
      '  action = "reject";',
      '  message = "SimpleHost sender denylist policy matched";',
      '  description = "SimpleHost sender denylist by domain";',
      "}"
    );
  }

  if (rules.length === 1) {
    rules.push("# No sender allowlist or denylist entries are configured.");
  }

  return rules.join("\n");
}

export function renderRspamdRatelimitConf(policy: MailSyncPayload["policy"]): string {
  if (!policy.rateLimit) {
    return [
      "# SimpleHost generated rspamd ratelimit snippet",
      "# Authenticated sender rate limit is disabled."
    ].join("\n");
  }

  const ratePerSecond = policy.rateLimit.burst / policy.rateLimit.periodSeconds;

  return [
    "# SimpleHost generated rspamd ratelimit snippet",
    "rates = {",
    "  user = {",
    "    bucket = {",
    `      burst = ${policy.rateLimit.burst};`,
    `      rate = ${ratePerSecond};`,
    '      message = "SimpleHost authenticated sender rate limit exceeded";',
    "    }",
    "  }",
    "}"
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
