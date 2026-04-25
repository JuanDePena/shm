# Mail Service Architecture

Date drafted: 2026-04-11
Last updated: 2026-04-25
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target mail architecture for the two-node SimpleHost platform.

It defines the intended split of responsibilities for:

- SMTP ingress and submission
- IMAP mailbox access
- mailbox storage and quota handling
- per-tenant webmail through `Roundcube`
- spam filtering and DKIM signing
- mailbox failover boundaries
- the future control-plane split between `SimpleHost Control` and `SimpleHost Agent`

This document now describes the implemented phase-7 mail product baseline plus the current
operational boundaries of the two-node SimpleHost mail stack.

Related references:

- [`/opt/simplehostman/src/docs/ARQUITECTURE.md`](/opt/simplehostman/src/docs/ARQUITECTURE.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md)
- [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md)
- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [`/opt/simplehostman/src/apps/control/README.md`](/opt/simplehostman/src/apps/control/README.md)

## Status on 2026-04-25

- `SimpleHost Control` now implements desired-state objects and operator CRUD for mail domains, mailboxes, aliases, quotas, plus mailbox credential generate / rotate / reset flows.
- `SimpleHost Control` reconciliation derives baseline mail DNS, `webmail.<domain>`, and `mta-sts.<domain>` proxy scaffolding.
- `SimpleHost Agent` now executes `mail.sync` end-to-end: it installs and restarts `Postfix`, `Dovecot`, `Roundcube`, `Redis`-compatible cache (`valkey` by default), creates the `vmail` runtime user, generates DKIM material, writes node-local runtime artifacts, deploys `Roundcube`, and applies a generated `firewalld` service policy.
- Phase-2 deliverability scaffolding is now wired end-to-end: `SimpleHost Control` derives `MTA-STS`, `TLS-RPT`, strict `SPF`, strengthened `DMARC`, and node-reported `DKIM` TXT records; `SimpleHost Agent` publishes the `mta-sts.txt` policy document and injects `Rspamd` into the live `Postfix` path through milters.
- Phase-3 anti-spam policy is now explicit end-to-end: `SimpleHost Control` persists `Rspamd` thresholds plus sender allowlists, denylists, optional greylisting, and authenticated-sender rate limits, while `SimpleHost Agent` renders those policies into node-local `Rspamd` config and `SimpleHostMan` surfaces the current posture in the operator UI.
- Phase-4 mail HA semantics are now explicit end-to-end: `SimpleHost Control` keeps per-domain primary and standby roles, `SimpleHost Agent` pre-seeds both nodes with mail runtime artifacts, and `SimpleHostMan` reports whether a standby is actually promotable or still blocked.
- Phase-5 product validations are now explicit end-to-end: `SimpleHost Control` rejects unsafe mail desired-state shapes such as alias loops, conflicting `MX` intent, unsupported `mailHost` placement, divergent standby topology, and nonsensical quotas, while `SimpleHostMan` surfaces pre-dispatch warnings when published DNS or runtime posture drifts away from the expected model.
- Phase-6 backup and restore visibility is now explicit end-to-end: backup runs can report structured mail coverage plus restore rehearsals, and `SimpleHostMan` now shows per-domain coverage for `Maildir`, DKIM, runtime config, and webmail state together with restore readiness for mailbox, domain, and full-stack recovery.
- Phase-7 reliability checks are now explicit end-to-end: `mail.sync` redispatch stability has regression coverage, long TXT records are rendered as segmented DNS TXT safely, `SimpleHost Agent` reports intended public ports plus firewall and `Rspamd` milter alignment, and combined release checks now run a repeatable mail baseline before publish.
- Mail desired state persisted on the nodes is sanitized: mailbox plaintext passwords are not written to `/srv/mail/config/desired-state.json`.
- Node runtime reporting now includes service installation state, firewall state, `Roundcube` deployment state, and configured vs reset-required mailbox counts.
- `SimpleHostMan` now exposes mail observability directly from control-plane and node snapshots: queue depth, recent delivery failures, defer reasons, per-domain deliverability checks, direct tracing from mail resources into recent jobs and audit history, per-domain standby promotion readiness and blockers, and explicit warnings for port, firewall, or milter drift on the primary mail node.
- The chosen direction remains self-hosted mail on the two VPS nodes, not a third-party hosted mail backend.
- The selected persistence model remains filesystem-backed mailbox storage, not message storage inside `PostgreSQL`.
- `adudoc.com` is now the first mail domain migrated end-to-end into the live `SimpleHostMan` mail runtime, with `webmaster@adudoc.com` and `notificaciones@adudoc.com` as the current mailbox set.

## Design goals

- Keep `SimpleHost Control` as the authoritative source of truth for mail domains, mailboxes, aliases, quotas, policies, and audit intent.
- Keep runtime mail delivery on the nodes simple, explicit, and recoverable.
- Support initial low-volume migrations such as `adudoc.com` without painting the platform into a corner for larger domains later.
- Avoid storing message bodies in `PostgreSQL`.
- Keep mailbox storage compatible with standard `IMAP` tooling and standard migration tools.
- Fit the platform's existing active/passive failover model.
- Keep webmail separate from mailbox storage so it can be replaced later without moving messages.

## Selected platform

Target mail stack:

- `Postfix` for inbound and outbound SMTP
- `Dovecot` for `IMAP`, `LMTP`, auth, quota, and mailbox access
- `Maildir` on the filesystem for mailbox persistence
- `Rspamd` for spam filtering, reputation, and DKIM signing
- `Redis` as supporting state for `Rspamd` when filtering features require it
- `Roundcube` as a per-tenant webmail surface published on `webmail.<domain>`

Why this stack was selected:

- It uses standard, well-understood mail components.
- It keeps message persistence in files instead of inventing a custom SQL mail store.
- It scales better operationally than a `PostgreSQL`-backed message design for large message volume.
- It preserves compatibility with `IMAP` migration tools and standard mailbox inspection workflows.
- It lets `SimpleHost Control` own the desired-state model without forcing mail daemons to query `SimpleHost Control` directly at runtime.

## Persistence model

### Source of truth

`SimpleHost Control PostgreSQL` should store the desired-state model for mail:

- `MailDomain`
- `Mailbox`
- `MailAlias`
- `MailboxQuota`
- credential references or managed password-hash metadata
- policy toggles such as suspend or unsuspend, catch-all policy, and deliverability posture
- audit events for mailbox lifecycle changes

`SimpleHost Control PostgreSQL` should not store:

- message bodies
- MIME attachments
- live `IMAP` indexes
- live SMTP spool state

### Mailbox storage

Mailbox persistence should use `Maildir` under host-managed storage.

Recommended host path:

- `/srv/mail/vmail/<domain>/<mailbox>/Maildir`

Recommended companion paths:

- `/srv/mail/indexes/` only if a later index separation is justified
- `/srv/mail/sieve/<domain>/<mailbox>/` for future user rules if `Pigeonhole` is enabled

Why `Maildir` is the selected baseline:

- Standard format for `Dovecot`
- Easy to inspect and back up
- Safe for concurrent delivery and read workloads
- Good fit for targeted mailbox restore
- Compatible with `doveadm backup`, `dsync`, and common migration tooling

Accepted `Maildir` tradeoffs:

- Many small files
- Higher inode pressure than a packed single-file store
- Metadata-heavy behavior on very large folders

These tradeoffs are acceptable for the current platform.
If future very large tenants show pathological `Maildir` behavior, evaluate `mdbox` explicitly as a later architecture revision.
Do not switch to a SQL message store to solve that problem.

### Roundcube persistence

`Roundcube` should keep its own metadata store, separate from `SimpleHost Control`.

Implemented live baseline:

- dedicated `Roundcube` metadata database on `postgresql-apps` over `5432/tcp`
- generated DSN rendered into `/etc/roundcubemail/config.inc.php`
- shared state root under `/srv/www/roundcube/_shared` for logs, temp files, and auxiliary state

That database stores only webmail metadata such as:

- preferences
- address books
- identities
- session-like or cache-like webmail state as required by the application

It must not be treated as the authoritative message store.

For lower environments or break-glass fallback, `SimpleHost Agent` still accepts a node-local
`SQLite` path through `SIMPLEHOST_MAIL_ROUNDCUBE_DATABASE_PATH`. That fallback is no longer the
preferred live baseline.

## Runtime split between `SimpleHost Control` and `SimpleHost Agent`

### `SimpleHost Control`

`SimpleHost Control` owns:

- mail-domain and mailbox desired-state objects
- mailbox aliases and quota policy
- credential lifecycle workflows
- operator API and UI
- audit trail
- delivery and trace visibility when that feature is added

`SimpleHost Control` should not be queried directly by `Postfix` or `Dovecot` for each live auth or lookup.

### `SimpleHost Agent`

`SimpleHost Agent` owns:

- rendering runtime config files for `Postfix`, `Dovecot`, `Rspamd`, and related helpers
- placing local keys, maps, and passwd files on the node
- installing or restarting mail services
- creating the `vmail` runtime account and local `Maildir` ownership
- deploying `Roundcube` package content and runtime config
- applying the node-local mail firewall service definition
- collecting local runtime health and exposing it back to `SimpleHost Control`

Preferred runtime pattern:

- `SimpleHost Control` desired state
- `SimpleHost Agent` renders node-local artifacts
- mail daemons read local generated files

Avoid:

- direct runtime coupling from mail daemons to `SimpleHost Control PostgreSQL`

## Runtime service placement

### Host-native services

Keep these host-native:

- `Postfix`
- `Dovecot`
- `Rspamd`
- `Redis` when required by `Rspamd`

Reasons:

- simpler boot ordering
- simpler privileged port handling
- simpler queue and mailbox path ownership
- less complexity around TLS and host identity

### Containerized webmail

`Roundcube` should be deployed behind host-native Apache, but published per tenant domain.

Recommended placement:

- one logical `Roundcube` deployment per active node, with separate per-tenant document roots
- proxied by Apache like other platform web workloads
- backed by its own `PostgreSQL` database

Recommended host path:

- `/srv/www/roundcube/<tenant>/<domain>/public`

Recommended public hostname model:

- `webmail.<domain>`

Current scaffolding direction:

- `SimpleHost Control` derives `proxy.render` jobs for `webmail.<domain>` and `mta-sts.<domain>`
- `SimpleHost Agent` prepares the corresponding document roots under `/srv/www/roundcube` and `/srv/www/mail-policies`
- until real `Roundcube` content is deployed, those roots may contain a placeholder page proving that the vhost path exists

Current rendered runtime artifacts:

- `/srv/mail/config/postfix/vmail_domains`
- `/srv/mail/config/postfix/vmail_mailboxes`
- `/srv/mail/config/postfix/vmail_aliases`
- `/srv/mail/config/postfix/main.cf.generated`
- `/srv/mail/config/dovecot/passwd`
- `/srv/mail/config/dovecot/conf.d/90-simplehost-mail.conf`
- `/srv/mail/config/rspamd/dkim_selectors.map`
- `/srv/mail/config/rspamd/local.d/redis.conf`
- `/srv/mail/config/rspamd/local.d/actions.conf`
- `/srv/mail/config/rspamd/local.d/milter_headers.conf`
- `/srv/mail/config/rspamd/local.d/dkim_signing.conf`
- `/srv/mail/config/rspamd/local.d/multimap.conf`
- `/srv/mail/config/rspamd/local.d/ratelimit.conf`
- `/srv/mail/config/rspamd/sender_allowlist_addresses.map`
- `/srv/mail/config/rspamd/sender_allowlist_domains.map`
- `/srv/mail/config/rspamd/sender_denylist_addresses.map`
- `/srv/mail/config/rspamd/sender_denylist_domains.map`
- `/srv/mail/config/desired-state.json`
- `/srv/mail/dkim/<domain>/<selector>.key`
- `/srv/mail/dkim/<domain>/<selector>.dns.txt`
- `/srv/www/mail-policies/<tenant>/<domain>/public/.well-known/mta-sts.txt`
- `/etc/roundcubemail/config.inc.php`
- `/srv/www/roundcube/_shared/`
- dedicated `Roundcube` metadata database on `postgresql-apps`
- `/etc/firewalld/services/simplehost-mail.xml`

Current credential behavior:

- mailbox credential state is explicit in the control plane as `configured`, `missing`, or `reset_required`
- when a mailbox is created with generated credentials, `SimpleHost Control` stores the encrypted desired secret, emits a one-time reveal token, and `SimpleHost Agent` renders a local `Dovecot` auth hash
- when an operator rotates a credential manually or through generation, the previous runtime secret is replaced and the action is audited
- when a mailbox is created without a credential or an operator explicitly resets it, `SimpleHost Agent` renders it locally in locked `reset_required` form
- generated credentials are intentionally visible only once; later recovery always happens through reset or rotation, never by reading an existing secret back out of the control plane
- operator-facing desired-state exports preserve mailbox `credentialState` but omit `desiredPassword`, so audit and UI views do not re-expose mailbox secrets

Current anti-spam policy behavior:

- `SimpleHost Control` persists a singleton mail policy with explicit `Rspamd` `add_header` and `reject` thresholds instead of relying on package defaults
- greylisting is disabled by default and becomes active only when an operator sets a `greylist` threshold below `add_header`
- sender allowlists and denylists accept either full mailbox addresses or `@domain` entries and are rendered into dedicated `Rspamd` selector maps
- authenticated-sender rate limiting is optional and currently applies as a global `Rspamd` policy for authenticated traffic on the active mail node
- `SimpleHostMan` shows the current anti-spam posture so operators can see why mail is accepted, tagged, greylisted, or rejected

Current product-validation behavior:

- mail domains must currently match the managed zone apex and use a dedicated `mail.<domain>` host under that same domain
- explicit apex `MX` overrides that disagree with the configured `mailHost` are rejected before desired state is persisted
- mailboxes must follow the same primary and standby topology as their parent mail domain so the current failover model stays coherent
- alias chains are validated server-side and rejected when they loop back into another managed alias instead of terminating in a mailbox or external address
- mailbox quotas below `64 MiB` or above `10 TiB` are rejected as outside the supported operating envelope for the current mail stack
- `SimpleHostMan` now derives per-domain pre-dispatch warnings for missing applied `dns.sync` payloads, `MX` drift, missing `mailHost` records, missing primary runtime snapshots, missing primary DKIM or runtime artifacts, primary port/firewall/milter drift, and standby promotion blockers
- mail CRUD failures now return to the dashboard as operator-facing notices instead of falling through to the generic web error page

Current release-check behavior:

- combined `preflight` and `release-candidate` runs now include the authenticated mail workspace plus a repeatable mail baseline fixture
- that baseline asserts segmented deliverability TXT verification together with ready primary-node runtime posture for services, intended public ports, firewall alignment, and `Rspamd` milter wiring

## Mail routing model

### Inbound mail

Recommended flow:

1. public SMTP on `25/tcp` hits `Postfix`
2. `Postfix` hands mail through `Rspamd`
3. accepted mail is delivered to `Dovecot LMTP`
4. `Dovecot` writes to `Maildir`

### Outbound mail

Recommended flow:

1. authenticated client or `Roundcube` submits through `587/tcp` or `465/tcp`
2. `Postfix` authenticates through `Dovecot`
3. `Rspamd` signs mail with DKIM and applies outbound policy
4. `Postfix` delivers outward

### Mailbox access

Recommended access:

- `IMAPS` on `993/tcp`
- `POP3S` on `995/tcp`
- submission on `587/tcp`
- implicit TLS submission on `465/tcp`
- optional `ManageSieve` on `4190/tcp` only after sieve support is added

Do not prioritize:

- plaintext `IMAP` on `143/tcp`
- plaintext `POP3` on `110/tcp`
- legacy unauthenticated submission patterns

## Credential model

Mailbox credentials should be managed by `SimpleHost Control`, but runtime auth should use rendered local artifacts.

Recommended pattern:

- `SimpleHost Control` stores password-hash metadata or secret references
- `SimpleHost Agent` renders a local `Dovecot` passwd file or equivalent auth map
- `Postfix` uses local lookup tables for domains, aliases, and mailbox routing

Hard rules:

- do not keep plaintext mailbox passwords in git
- do not expose mailbox passwords back through the UI after creation or reset
- avoid making `Dovecot` depend on live database queries to `SimpleHost Control`

## Recommended generated runtime artifacts

Examples of node-local generated artifacts:

- `/etc/postfix/vmail_domains`
- `/etc/postfix/vmail_mailboxes`
- `/etc/postfix/vmail_aliases`
- `/etc/dovecot/passwd`
- `/etc/dovecot/conf.d/`
- `/etc/rspamd/local.d/`

These files are machine-generated, node-local, and recoverable from desired state.
They are not authoritative data stores.

## DNS model

### Service identity

Do not keep mail tied to the apex record.

Preferred mail identity per customer domain:

- `mail.<domain>` as the stable mail host
- `MX` records point to `mail.<domain>`

Example:

```dns
adudoc.com.      300 MX   10 mail.adudoc.com.
mail.adudoc.com. 300 A    <active-node-ip>
```

This avoids coupling web cutovers and mail cutovers to the same apex `A` record.

### Minimum DNS records

Per domain, the baseline should include:

- `MX`
- `A` or `AAAA` for `mail.<domain>`
- `A` or `AAAA` for `mta-sts.<domain>`
- `A` or `AAAA` for `webmail.<domain>`
- `TXT` SPF
- `TXT` `_dmarc`
- `TXT` `_mta-sts`
- `TXT` `_smtp._tls`
- `TXT` DKIM selector records

Optional later:

- `autoconfig.<domain>`
- `autodiscover.<domain>`
- SRV records if a chosen client profile needs them
- `DANE` once DNSSEC and operator workflows are mature enough

Current scaffolding state:

- `SimpleHost Control` now derives `MX`, `mail.<domain>`, `mta-sts.<domain>`, `webmail.<domain>`, strict `SPF`, `_dmarc`, `_mta-sts`, `_smtp._tls`, and DKIM selector TXT records for the active mail node
- operator-managed explicit zone records remain authoritative when they intentionally override those derived records
- `SimpleHost Agent` now generates DKIM private/public material and a DNS TXT payload per domain selector under `/srv/mail/dkim/<domain>/`
- `SimpleHost Agent` now publishes `/.well-known/mta-sts.txt` under a dedicated `mta-sts.<domain>` Apache docroot on both active and standby mail nodes

### DKIM

DKIM signing should be handled by `Rspamd`.

Recommended key path model:

- `/etc/rspamd/dkim/<domain>/<selector>.key`

The public key must be surfaced into the zone through desired state and DNS sync.

### MTA-STS and TLS-RPT

Phase-2 baseline:

- `_mta-sts.<domain>` TXT publishes the current policy id
- `mta-sts.<domain>` serves `/.well-known/mta-sts.txt` over HTTPS
- `_smtp._tls.<domain>` TXT publishes the TLS report mailbox

Initial baseline policy:

- `mode: enforce`
- `mx: mail.<domain>`
- `max_age: 86400`

Report addresses currently default to `postmaster@<domain>`. Operators should ensure that
address exists as a mailbox or alias if they want delivery and report loops to stay clean.

## Firewall and exposure policy

Recommended public ports on the active mail node:

- `25/tcp` inbound SMTP
- `465/tcp` implicit TLS submission
- `587/tcp` submission
- `993/tcp` IMAPS
- `995/tcp` POP3S

Implemented public-port policy:

- `SimpleHost Agent` writes a generated `simplehost-mail` firewalld service definition
- the service is installed to `/etc/firewalld/services/simplehost-mail.xml`
- the service is added permanently to the active public zone and reloaded through `firewall-cmd`

Optional later:

- `4190/tcp` for `ManageSieve`

Do not expose publicly unless there is a clear reason:

- `143/tcp`
- `110/tcp`
- admin protocols on public addresses

Webmail remains on the existing Apache public plane:

- `443/tcp` via `webmail.<domain>`

## Availability model

Mail should follow the same baseline as the rest of the platform:

- active on the primary node
- warm standby on the secondary node
- manual failover only

Implemented phase-4 semantics:

- `primary` means the current public mail node for `SMTP`, submission, `IMAP`, DKIM signing, and the DNS-facing `mail.<domain>` target
- `secondary` means a warm standby mail node that receives the same generated runtime artifacts but is not considered public or writable until a manual promotion happens
- `mail.sync` now pre-seeds both primary and standby with generated runtime config, `Maildir` scaffolds, DKIM material, `mta-sts` policy documents, and per-domain webmail roots
- `SimpleHostMan` now treats a standby as mail-ready only when core mail services, firewall policy, generated config, mailbox storage, DKIM material, policy documents, and webmail assets are all reported ready
- promotion remains manual and DNS-led rather than automatic service failover

Do not run both nodes as equal-priority public `MX` targets during the initial design.

Reasons:

- the platform is active/passive by design
- split delivery and partial mailbox replication are risky
- a passive node should not silently become an active mailbox writer without explicit promotion

### Replication

Mailbox replication should use `Dovecot dsync`, not raw file sync as the primary strategy.

Recommended direction:

- primary node as the writable source
- secondary node as the passive replica
- scheduled replication plus an explicit final sync before promotion

What should replicate:

- mailbox contents
- mailbox metadata relevant to `Dovecot`
- sieve files once enabled

What should not be treated as authoritative replicated state:

- active `Postfix` queue
- `Rspamd` reputation cache
- transient `Redis` state

### Failover boundary

In a promotion event:

1. stop inbound delivery on the failed or retiring primary if possible
2. run a final mailbox sync if the source is still reachable
3. promote the secondary mail services
4. repoint `mail.<domain>`, `webmail.<domain>`, and `mta-sts.<domain>` to the promoted node
5. keep `MX` pointing to `mail.<domain>` so clients do not need a record change
6. confirm `IMAP`, submission, SMTP ingress, and policy document hosting on the promoted node

Promotion criteria before a standby is treated as mail-ready:

- `Postfix`, `Dovecot`, `Rspamd`, and `Redis` are active on the standby and the generated firewall policy is installed
- generated `Postfix`, `Dovecot`, and `Rspamd` runtime config is present on the standby
- expected `Maildir` scaffolds exist for the current mailbox set on the standby
- DKIM material exists for every managed domain selector
- `mta-sts.txt` policy documents exist for the managed domains on the standby
- `Roundcube` and the per-domain webmail document roots are present on the standby

## Backups

Minimum backup scope:

- `/srv/mail/vmail/`
- `/etc/postfix/`
- `/etc/dovecot/`
- `/etc/rspamd/`
- DKIM keys
- `Roundcube` database
- `Roundcube` app configuration

Backups must allow:

- full-domain restore
- single-mailbox restore
- point-in-time restore of webmail metadata when feasible

The passive node is not a backup substitute.

Current product behavior:

- backup runs can now attach structured `details.mail` metadata with explicit path coverage for `Maildir`, DKIM, runtime config, and webmail state
- backup runs can also attach restore rehearsal records for `mailbox`, `domain`, and `mail-stack` scopes, each with target, status, summary, and validation timestamp
- `SimpleHostMan` now derives per-domain backup readiness from both backup policy scope and the latest successful backup evidence instead of assuming that a policy alone is enough
- the mail UI now shows the expected runtime paths for each artifact so operators can compare what should be protected against what the latest successful backup actually reported

Recommended selector conventions when a backup policy is intended to cover mail:

- `mail-stack`
- `mail-domain:<domain>`
- `tenant:<tenant-slug>`

Current restore procedures:

1. Single mailbox restore
   Restore the mailbox subtree under `/srv/mail/vmail/<domain>/<local-part>/Maildir`, confirm ownership and permissions, run a mailbox-level verification such as `doveadm force-resync` or an equivalent mailbox scan, and record the rehearsal as a `mailbox` restore check in the backup run details.
2. Single domain restore
   Restore the domain `Maildir` root, domain DKIM material under `/srv/mail/dkim/<domain>/`, the rendered webmail root for `webmail.<domain>`, and any affected policy documents, then verify submission, `IMAP`, and DKIM signing for that domain before recording a `domain` restore check.
3. Full mail stack restore
   Restore `/srv/mail/vmail`, `/srv/mail/config`, `/srv/mail/dkim`, the `Roundcube` metadata database, `Roundcube` shared state, and `Roundcube` config, then confirm `Postfix`, `Dovecot`, `Rspamd`, `Redis`, webmail, and policy-doc hosting before recording a `mail-stack` restore check.

Evidence model for restore readiness:

- `ready`: the latest successful backup evidence includes the artifact paths or a validated restore rehearsal for that scope
- `warning`: a policy exists, but the latest successful backup did not report the artifact explicitly or no rehearsal has been recorded yet
- `missing`: no relevant policy exists or the latest recorded rehearsal for that scope failed

## Logging, traceability, and future `SimpleHost Control` visibility

Future `SimpleHost Control` mail operations should expose:

- queue visibility
- recent delivery attempts
- authentication failures
- mailbox suspension state
- DKIM, SPF, and DMARC posture
- audit events for account lifecycle changes

Implemented baseline today:

- node runtime reporting already includes service install/enable/active state for `Postfix`, `Dovecot`, `Rspamd`, and `Redis`
- node runtime reporting now includes `Roundcube` deployment mode, shared/config/database paths, firewall policy status, and configured vs reset-required mailbox counts
- `mail.sync` job details include deployed file paths, DKIM material paths, `mta-sts` policy files, package installation actions, service restart state, firewall status, and `Roundcube` deployment paths

Recommended raw sources:

- `Postfix` logs
- `Dovecot` logs
- `Rspamd` history and metrics
- mailbox quota usage data

`SimpleHost Control` should ingest summarized operational state.
It should not become the primary raw message-log store.

## Security boundaries

- Keep mail credentials scoped per mailbox.
- Keep DKIM private keys only on the nodes that sign mail.
- Require TLS for client auth paths.
- Keep webmail isolated from direct mailbox storage except through `IMAP` and submission.
- Treat outbound relay reputation as a platform concern, not a tenant concern.

## Migration policy from cPanel mail

Preferred migration sequence per domain:

1. create the mail domain and mailboxes in `SimpleHost Control`
2. render and deploy runtime config on the active node
3. create `mail.<domain>` and move `MX` away from the apex if needed
4. copy mailbox contents from the legacy host
5. verify `IMAP` login and message visibility
6. cut SMTP delivery to the new node
7. keep the old host available until late-arriving mail risk is acceptable

For low-volume domains this can be a short maintenance window.
For larger-volume domains, keep the overlap window longer and validate queue behavior before decommissioning the old host.

Use the concrete operational runbook in [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md) for the step-by-step cutover procedure.

## Implementation status

Implemented in the current backend:

1. desired-state model for `MailDomain`, `Mailbox`, `MailAlias`, and quotas
2. operator CRUD plus mailbox credential set and reset workflows
3. `mail.sync`, node runtime reporting, baseline DNS derivation, and `webmail.<domain>` proxy scaffolding
4. `SimpleHost Agent` renderers and drivers for `Postfix`, `Dovecot`, `Rspamd` config, `Redis`-compatible cache, `Roundcube`, and mail firewall policy
5. concrete mailbox migration runbook for low-volume cutovers
6. explicit mail deliverability, queue, failure, and runtime observability in `SimpleHostMan`
7. explicit mail HA readiness reporting and manual promotion criteria for standby nodes
8. backup coverage plus restore-rehearsal visibility for mailbox, domain, and full mail-stack recovery
9. repeatable mail release checks inside combined `preflight` and `release-candidate` validation

The core mail execution, observability, validation, recovery-readiness, and release-baseline work is
now in place. Future work should build on that baseline instead of reopening the first execution
phase.

## Non-goals for the current mail product

- storing email messages in `PostgreSQL`
- active/active shared-write mailbox delivery across both nodes
- automatic two-node mail failover
- public `POP3` support
