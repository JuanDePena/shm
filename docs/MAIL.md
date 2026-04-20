# Mail Service Architecture

Date drafted: 2026-04-11
Last updated: 2026-04-20
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

This document now describes the implemented phase-1 mail runtime baseline plus the intended
operational boundaries for later refinement.

Related references:

- [`/opt/simplehostman/src/docs/ARQUITECTURE.md`](/opt/simplehostman/src/docs/ARQUITECTURE.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md)
- [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md)
- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [`/opt/simplehostman/src/apps/control/README.md`](/opt/simplehostman/src/apps/control/README.md)

## Status on 2026-04-20

- `SimpleHost Control` now implements desired-state objects and operator CRUD for mail domains, mailboxes, aliases, quotas, and mailbox credential reset.
- `SimpleHost Control` reconciliation derives baseline mail DNS and `webmail.<domain>` proxy scaffolding.
- `SimpleHost Agent` now executes `mail.sync` end-to-end: it installs and restarts `Postfix`, `Dovecot`, `Roundcube`, `Redis`-compatible cache (`valkey` by default), creates the `vmail` runtime user, generates DKIM material, writes node-local runtime artifacts, deploys `Roundcube`, and applies a generated `firewalld` service policy.
- Mail desired state persisted on the nodes is sanitized: mailbox plaintext passwords are not written to `/srv/mail/config/desired-state.json`.
- Node runtime reporting now includes service installation state, firewall state, `Roundcube` deployment state, and configured vs reset-required mailbox counts.
- The chosen direction remains self-hosted mail on the two VPS nodes, not a third-party hosted mail backend.
- The selected persistence model remains filesystem-backed mailbox storage, not message storage inside `PostgreSQL`.
- `adudoc.com` remains the first pilot mail domain, with `webmaster@adudoc.com` and `notificaciones@adudoc.com` as the initial mailbox set.

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

Implemented phase-1 baseline:

- node-local `SQLite`
- shared state root under `/srv/www/roundcube/_shared`
- database path `/srv/www/roundcube/_shared/roundcube.sqlite`

That database stores only webmail metadata such as:

- preferences
- address books
- identities
- session-like or cache-like webmail state as required by the application

It must not be treated as the authoritative message store.

If the platform later needs higher `Roundcube` metadata scale or shared-node access, move this
metadata to a dedicated `PostgreSQL` database on `postgresql-apps`. That is a scale-up path, not
the phase-1 execution baseline.

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

- `SimpleHost Control` derives `proxy.render` jobs for `webmail.<domain>`
- `SimpleHost Agent` prepares the corresponding document roots under `/srv/www/roundcube`
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
- `/srv/mail/config/rspamd/local.d/dkim_signing.conf`
- `/srv/mail/config/desired-state.json`
- `/srv/mail/dkim/<domain>/<selector>.key`
- `/srv/mail/dkim/<domain>/<selector>.dns.txt`
- `/etc/roundcubemail/config.inc.php`
- `/srv/www/roundcube/_shared/roundcube.sqlite`
- `/etc/firewalld/services/simplehost-mail.xml`

Current credential behavior:

- when a mailbox is created or edited with a desired password, `SimpleHost Control` stores an encrypted desired secret and `SimpleHost Agent` renders a local `Dovecot` auth hash
- when a mailbox is created without a desired password or an operator explicitly resets it, `SimpleHost Agent` renders it locally in locked `reset_required` form
- the current pilot intentionally supports both paths so first credential establishment and later credential recovery remain operator-driven

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
- `A` or `AAAA` for `webmail.<domain>`
- `TXT` SPF
- `TXT` `_dmarc`

Optional later:

- `autoconfig.<domain>`
- `autodiscover.<domain>`
- `TXT` DKIM selector records once key generation is wired end-to-end
- SRV records if a chosen client profile needs them
- `MTA-STS`, `TLS-RPT`, or `DANE` once the rest of the stack is mature enough

Current scaffolding state:

- `SimpleHost Control` now derives `MX`, `mail.<domain>`, `webmail.<domain>`, SPF, and `_dmarc` for the active mail node
- operator-managed explicit zone records remain authoritative when they intentionally override those derived records
- `SimpleHost Agent` now generates DKIM private/public material and a DNS TXT payload per domain selector under `/srv/mail/dkim/<domain>/`

### DKIM

DKIM signing should be handled by `Rspamd`.

Recommended key path model:

- `/etc/rspamd/dkim/<domain>/<selector>.key`

The public key must be surfaced into the zone through desired state and DNS sync.

## Firewall and exposure policy

Recommended public ports on the active mail node:

- `25/tcp` inbound SMTP
- `465/tcp` implicit TLS submission
- `587/tcp` submission
- `993/tcp` IMAPS
- `995/tcp` POP3S

Implemented phase-1 policy:

- `SimpleHost Agent` writes a generated `simplehost-mail` firewalld service definition
- the service is installed to `/etc/firewalld/services/simplehost-mail.xml`
- the service is added permanently to the active public zone and reloaded through `firewall-cmd`

Optional later:

- `4190/tcp` for `ManageSieve`

Do not expose publicly unless there is a clear reason:

- `143/tcp`
- `110/tcp`
- `110/tcp`
- `995/tcp`
- admin protocols on public addresses

Webmail remains on the existing Apache public plane:

- `443/tcp` via `webmail.<domain>`

## Availability model

Mail should follow the same baseline as the rest of the platform:

- active on the primary node
- warm standby on the secondary node
- manual failover only

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
4. repoint `mail.<domain>` to the promoted node
5. keep `MX` pointing to `mail.<domain>` so clients do not need a record change
6. confirm `IMAP`, submission, and SMTP ingress on the promoted node

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
- `mail.sync` job details include deployed file paths, DKIM material paths, package installation actions, service restart state, firewall status, and `Roundcube` deployment paths

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

Follow-on product work now belongs to broader diagnostics, deliverability, audit, and backup improvements rather than the core mail execution backend.

## Non-goals for the first mail execution phase

- storing email messages in `PostgreSQL`
- active/active shared-write mailbox delivery across both nodes
- automatic two-node mail failover
- public `POP3` support
