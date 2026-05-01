# ppdpr.us Runtime Migration

This document tracks the sequential migration of `ppdpr.us` from `vps-old` into
`SimpleHostMan`.

## Discovery summary

Discovery was performed read-only on `2026-04-30` over SSH against
`root@vps-old.pyrosa.com.do`.

- legacy host: `vps-1926167b.vps.ovh.ca`
- cPanel account: `wmppdpr`
- primary domain: `ppdpr.us`
- legacy document root: `/home/wmppdpr/public_html`
- legacy public IP: `51.161.11.249`
- legacy web content: small static HTML
- legacy database engines: none
- legacy mailbox count: `1`
- legacy mail storage total: about `172K`

## Legacy web shape

The legacy document root is small:

- path: `/home/wmppdpr/public_html`
- size: `8.0K`
- file count: `2`
- markers: `index.html`

No application framework or database dependency was discovered during the initial read-only scan.

## Legacy mail shape

Discovered mailbox:

- `it@ppdpr.us`: `172K`, `1` message

Legacy cPanel declares a catch-all:

- `*: wmppdpr`

Migration decision:

- do not preserve the catch-all
- replace it with explicit operational aliases

Target aliases:

- `postmaster@ppdpr.us -> it@ppdpr.us`
- `abuse@ppdpr.us -> it@ppdpr.us`
- `webmaster@ppdpr.us -> it@ppdpr.us`

## Legacy DNS shape

The legacy zone file on `vps-old` contained:

- `@ A 51.161.11.249`
- `@ MX 0 ppdpr.us.`
- `mail CNAME ppdpr.us.`
- `www CNAME ppdpr.us.`
- `webmail A 51.161.11.249`
- legacy SPF authorizing the old host
- legacy `default._domainkey` DKIM
- cPanel service and AutoSSL challenge records

Public DNS observed during discovery:

- `ppdpr.us A -> 51.161.11.249`
- `mail.ppdpr.us -> ppdpr.us`
- `www.ppdpr.us -> ppdpr.us`
- `MX -> ppdpr.us`
- nameservers: `vps-1926167b.vps.ovh.ca`, `cdns.ovh.net`

## SimpleHostMan staging

Phase 1 was applied on `2026-04-30`.

Desired state now includes:

- tenant `ppdpr`
- zone `ppdpr.us`
- mail domain `ppdpr.us`
- mailbox `it@ppdpr.us`
- mailbox quota `5 GiB`
- aliases:
  - `postmaster@ppdpr.us -> it@ppdpr.us`
  - `abuse@ppdpr.us -> it@ppdpr.us`
  - `webmaster@ppdpr.us -> it@ppdpr.us`
- backup policy `mail-ppdpr-daily`

The mailbox credential is intentionally left in `reset_required` state until a validation or
cutover credential decision is made.

Follow-up on `2026-04-30`:

- a temporary credential was generated from SimpleHostMan for `it@ppdpr.us`
- SimpleHostMan now reports `it@ppdpr.us` as `configured`
- the credential is recorded in the local sensitive credential inventory:
  [`/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md)

## Reconciliation evidence

Reconciliation run:

- `reconcile-37d56f03-4721-429b-b352-4451ffa445f5`

The run generated `dns.sync`, `mail.sync`, and mail policy proxy render jobs. The first secondary
`dns.sync` attempt failed on initial transferred-zone verification, then a targeted retry completed.

Latest successful `ppdpr.us` DNS jobs:

- `dispatch-1777524603008-4dd4d463-primary-dns-sync-e6bd95ef98f0`: applied
- `dispatch-1777524603008-4dd4d463-secondary-dns-sync-e6bd95ef98f0`: applied

Mail and proxy jobs:

- `mail.sync` applied on `primary`
- `mail.sync` applied on `secondary`
- `webmail.ppdpr.us` vhost installed on both nodes
- `mta-sts.ppdpr.us` vhost installed on both nodes

Artifact checks:

- `/srv/mail/vmail/ppdpr.us` exists on both nodes
- `/srv/mail/dkim/ppdpr.us` exists on both nodes
- `/srv/www/roundcube/ppdpr/ppdpr.us/public/index.php` exists on both nodes
- `/srv/www/mail-policies/ppdpr/ppdpr.us/public/.well-known/mta-sts.txt` exists on both nodes

PowerDNS now contains the target `ppdpr.us` mail records on both nodes:

- `MX -> mail.ppdpr.us`
- `mail.ppdpr.us A -> 51.222.204.86`
- `webmail.ppdpr.us A -> 51.222.204.86`
- `mta-sts.ppdpr.us A -> 51.222.204.86`
- strict SPF, DMARC, TLS-RPT, MTA-STS, and `mail._domainkey`

## Phase 2 copy evidence

Initial copy was performed on `2026-04-30`.

Mailbox copy:

- source: `root@vps-old.pyrosa.com.do:/home/wmppdpr/mail/ppdpr.us/it/`
- target primary: `/srv/mail/vmail/ppdpr.us/it/Maildir/`
- target secondary: `/srv/mail/vmail/ppdpr.us/it/Maildir/`
- copied message count on primary: `1`
- copied message count on secondary: `1`
- copied target size: `172K`

Static web staging:

- source: `root@vps-old.pyrosa.com.do:/home/wmppdpr/public_html/`
- target primary: `/srv/containers/apps/ppdpr/app/`
- target secondary: `/srv/containers/apps/ppdpr/app/`
- copied file count on primary: `2`
- copied file count on secondary: `2`
- copied target size: `8.0K`

The static web files are staged only. No public app/vhost desired-state entry has been declared yet
for `ppdpr.us`.

## Registrar NS update

After the registrar-side nameserver update in ResellerClub, public resolvers reported:

- nameservers: `vps-3dbbfb0b.vps.ovh.ca`, `vps-16535090.vps.ovh.ca`
- `ppdpr.us A -> 51.161.11.249`
- `www.ppdpr.us A -> 51.161.11.249`
- `MX -> mail.ppdpr.us`

The `@` and `www` records intentionally continue pointing at `vps-old` until the static web runtime
is closed in SimpleHostMan.

## Web runtime cutover

Applied on `2026-04-30`.

Desired-state app added:

- app slug: `ppdpr`
- tenant: `ppdpr`
- canonical domain: `ppdpr.us`
- alias: `www.ppdpr.us`
- backend port: `10401`
- runtime image: `registry.example.com/ppdpr-app:stable`
- storage root: `/srv/containers/apps/ppdpr`
- database: none discovered, so no database resource was created

Reconciliation outcome:

- `app-ppdpr.service` active on `primary`
- `app-ppdpr.service` active on `secondary`
- backend `127.0.0.1:10401` returns `200 OK` on both nodes
- Apache vhost for `ppdpr.us` installed on both nodes
- staged file ownership was normalized to `root:root` so Apache inside the container can read `.htaccess`

DNS cutover:

- `ppdpr.us A -> 51.222.204.86`
- `www.ppdpr.us A -> 51.222.204.86`
- latest `zone:ppdpr.us` sync applied on `primary`
- latest `zone:ppdpr.us` sync applied on `secondary`

TLS:

- Let's Encrypt certificate `ppdpr.us` issued for `ppdpr.us` and `www.ppdpr.us`
- certificate expires on `2026-07-29`
- certificate material and the HTTPS vhost were replicated to `secondary`
- `http://ppdpr.us/` redirects to HTTPS
- `https://ppdpr.us/` returns `200 OK` with the migrated static placeholder content

## Closure Notes

The consolidated migration sequence marks `ppdpr.us` as closed. The mail and
HTTPS checks that originally served as cutover gates are retained above as
execution evidence context. Future checks should be opened from `TODO.md` only
if a user report or operational audit reopens this domain.

Conditional responses:

- run another mailbox delta only if logs show late mail still landing on
  `vps-old`
- re-check external HTTPS only if a resolver or client reports stale answers
