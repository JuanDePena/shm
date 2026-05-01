# Gomezrosado Runtime Migration

This document captures the live discovery and staging work for `gomezrosado.com.do` into `SimpleHostMan`.

## Discovery Summary

Discovery was performed on `2026-04-25` over SSH against `root@vps-old.pyrosa.com.do`.

- legacy host: `vps-1926167b.vps.ovh.ca`
- cPanel account: `wmgomezrosado`
- primary domain: `gomezrosado.com.do`
- legacy document root: `/home/wmgomezrosado/public_html`
- legacy web content: static placeholder only
- legacy database engines: none
- legacy database count: `0` MySQL, `0` PostgreSQL
- legacy mailboxes: `7`
- legacy mailbox quota: `5 GiB` each
- legacy mail storage total: about `1.4 GiB`

## Legacy App Shape

`gomezrosado.com.do` is not currently a dynamic application on the legacy host.

Observed content:

- `public_html/index.html`: blank static page
- `public_html/.htaccess`: cPanel PHP handler only
- `public_html/.well-known/`: ACME challenge tree

There is no Composer project, no PHP application tree, and no database backing the site at discovery time.

## Legacy Mail Shape

Mail is the operationally relevant workload for this domain on the legacy host.

Discovered mailboxes:

- `alfrygomez@gomezrosado.com.do`
- `asistente.legal@gomezrosado.com.do`
- `contacto@gomezrosado.com.do`
- `francheska.abreu@gomezrosado.com.do`
- `legal@gomezrosado.com.do`
- `maria.abreu@gomezrosado.com.do`
- `tecnologia@gomezrosado.com.do`

Legacy mailbox sizes and message counts at discovery:

- `alfrygomez`: `1.1G`, `3043` messages
- `contacto`: `237M`, `798` messages
- `legal`: `46M`, `50` messages
- `tecnologia`: `34M`, `832` messages
- `maria.abreu`: `14M`, `256` messages
- `asistente.legal`: `8.6M`, `158` messages
- `francheska.abreu`: `1.1M`, `17` messages

Legacy cPanel also declares a catch-all in `/etc/valiases/gomezrosado.com.do`:

- `*: wmgomezrosado`

That catch-all was intentionally **not** modeled yet in `SimpleHostMan`, because the target mailbox semantics still need an explicit destination decision before public cutover.

## Legacy DNS Shape

The legacy zone file on `vps-old` contained:

- `@ A 51.161.11.249`
- `@ MX 0 gomezrosado.com.do.`
- `mail CNAME gomezrosado.com.do.`
- `www CNAME gomezrosado.com.do.`
- `webmail A 51.161.11.249`
- legacy cPanel support records (`cpanel`, `cpcontacts`, `cpcalendars`, `autoconfig`, `autodiscover`, etc.)
- legacy `default._domainkey` DKIM
- SPF pointing at the old host

At discovery time, public DNS for `gomezrosado.com.do`, `www`, `mail`, and `webmail` still resolved to `51.161.11.249`.

## SimpleHostMan Staging Applied

The following staging changes were applied on `2026-04-25`:

- removed the `gomezrosado` database resource from desired state because no source database exists
- removed `db-gomezrosado-daily`
- added `mail-gomezrosado-daily`
- added the mail domain `gomezrosado.com.do`
- added the `7` discovered mailboxes
- added `5 GiB` quotas for those `7` mailboxes
- set the target zone records for:
  - `@ A 51.222.204.86`
  - `www A 51.222.204.86`
- let `mail.sync` derive and apply:
  - `mail.gomezrosado.com.do`
  - `webmail.gomezrosado.com.do`
  - `mta-sts.gomezrosado.com.do`
  - `MX`, `SPF`, `DMARC`, `TLS-RPT`, and target DKIM selector records for the new stack

## Runtime Staging Applied

The static site was staged on both nodes under:

- `/srv/containers/apps/gomezrosado/app`
- `/srv/containers/apps/gomezrosado/uploads`

Runtime result:

- `app-gomezrosado.service` active on `primary`
- `app-gomezrosado.service` active on `secondary`
- `Host: gomezrosado.com.do` returns `200 OK` on the new stack
- backend `127.0.0.1:10201` returns `200 OK` on both nodes

The migrated site content matches the source:

- blank static `index.html`
- `.htaccess`
- `.well-known`
- local `healthz` probe file added for the managed runtime

## Maildir Staging Applied

The new Maildir trees were created by `mail.sync` and then seeded from the legacy host.

Target root:

- `/srv/mail/vmail/gomezrosado.com.do`

Initial Maildir sync outcome:

- source and target message counts match for all `7` mailboxes on `primary`
- the same Maildir tree was replicated to `secondary`
- mailbox passwords were later assigned and validated on the new stack

## Mail Credential Activation

On `2026-04-25`, the staged `gomezrosado.com.do` mailboxes moved from `reset_required` into configured credentials.

The active credential inventory is recorded in:

- [`/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-mail-credentials.md)

Operational decisions applied:

- legacy cPanel catch-all was intentionally **not** preserved
- explicit aliases were created instead:
  - `postmaster@gomezrosado.com.do -> contacto@gomezrosado.com.do`
  - `abuse@gomezrosado.com.do -> contacto@gomezrosado.com.do`
  - `webmaster@gomezrosado.com.do -> contacto@gomezrosado.com.do`

Validated on the new stack:

- `doveadm auth test` for all `7` mailboxes
- `IMAPS 993` login for all `7` mailboxes
- `SMTP submission 587` authentication for all `7` mailboxes
- `Roundcube` login for `contacto@gomezrosado.com.do`
- `RCPT TO` acceptance for `postmaster`, `abuse`, and `webmaster`

## Backup Evidence

`mail-gomezrosado-daily` now has successful live backup evidence.

Successful runs recorded on `2026-04-25`:

- `backup-run-9dc295c7-0120-47c7-8958-f2dbdd808d5b`
- `backup-run-f401e36e-8e1f-47a0-a679-e6b599f6ed38`

Latest successful summary:

- `Backed up 1 mail domain(s) into /srv/backups/mail-gomezrosado.`

Backup artifacts were written under:

- `/srv/backups/mail-gomezrosado/`

One earlier forced run failed because Maildir content changed while `tar` was reading it. The succeeding runs were taken after quiescing the local mail services on the new primary.

## Public DNS Cutover Status

The public cutover was initiated on `2026-04-25`.

Applied state:

- the authoritative primary on `vps-old.pyrosa.com.do` now serves:
  - `@ -> 51.222.204.86`
  - `www -> 51.222.204.86`
  - `mail -> 51.222.204.86`
  - `webmail -> 51.222.204.86`
  - `mta-sts -> 51.222.204.86`
  - `MX -> mail.gomezrosado.com.do`
  - strict `SPF`, `DMARC`, `TLS-RPT`, and `mail._domainkey`
- direct authoritative queries against `vps-1926167b.vps.ovh.ca` already answer with the new values

Propagation note from `2026-04-25`:

- some recursive resolvers may still return the old `51.161.11.249` answers until the previous `14400` second TTL window fully expires
- local validation from the new platform already resolves the public names to `51.222.204.86`

Follow-up observed on `2026-04-29`:

- the local resolver on the primary resolves `gomezrosado.com.do`, `mail.gomezrosado.com.do`, and `webmail.gomezrosado.com.do` to `51.222.204.86`
- `http://gomezrosado.com.do/` redirects to HTTPS from the new Apache stack
- `http://webmail.gomezrosado.com.do/` returns the Roundcube login surface from the new stack

## Closure Notes

The consolidated migration sequence marks `gomezrosado.com.do` as closed. The
notes below are conditional operational responses, not active migration TODOs:

- spot-check external recursive DNS only if a user reports stale answers
- run another Maildir delta only if logs show late mail still landing on
  `vps-old`
- rotate mailbox credentials through SimpleHostMan if a mailbox owner requests a
  post-migration credential change
