# Adudoc Mail Migration

This document records the closure state of the `adudoc.com` mail migration into `SimpleHostMan`.

## Scope

This closure covers:

- mail domain `adudoc.com`
- active mail host `mail.adudoc.com`
- webmail host `webmail.adudoc.com`
- current mailboxes:
  - `webmaster@adudoc.com`
  - `notificaciones@adudoc.com`

## Closure status

As of `2026-04-25`, `adudoc.com` is considered migrated successfully into the live `SimpleHostMan`
mail runtime.

Validated outcomes from the live platform:

- authenticated `IMAPS` login succeeds for both mailboxes
- authenticated SMTP submission succeeds for both mailboxes
- cross-mailbox send and receive succeeds inside the new runtime
- inbound local delivery on `25/tcp` succeeds for both mailboxes
- `http://webmail.adudoc.com/` loads and `Roundcube` login succeeds
- `SimpleHostMan` reports deliverability posture as `ready` for `SPF`, `DKIM`, `DMARC`, `MTA-STS`, and `TLS-RPT`
- `SimpleHostMan` reports the standby mail node as promotable after `mail.sync` reconciliation

## Runtime notes

- `Roundcube` metadata now lives on a dedicated PostgreSQL database on `postgresql-apps` (`5432/tcp`).
- Mail runtime state, DKIM material, policy documents, and per-domain webmail roots continue to live on the mail nodes under `/srv/mail` and `/srv/www`.
- The primary and standby nodes are both pre-seeded for the current manual DNS-cutover HA model.

## DNS posture

The published mail DNS model for `adudoc.com` now includes:

- `MX -> mail.adudoc.com`
- `mail.adudoc.com`
- `webmail.adudoc.com`
- `mta-sts.adudoc.com`
- strict `SPF`
- `_dmarc`
- `_mta-sts`
- `_smtp._tls`
- DKIM selector TXT

## Backup posture

`SimpleHost Control` now carries a declared daily backup policy for the domain mail stack:

- `policySlug`: `mail-adudoc-daily`
- schedule: `0 3 * * *`
- retention: `14` days
- selectors:
  - `mail-stack`
  - `mail-domain:adudoc.com`
  - `tenant:adudoc`

Current caveat:

- the policy is declared in `SimpleHostMan`, but backup-run evidence is still pending a live backup executor on this platform, so migration closure here reflects successful mail cutover rather than completed backup rehearsal evidence

## Related references

- [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)
- [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-runtime-migration.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-database-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-database-migration.md)
