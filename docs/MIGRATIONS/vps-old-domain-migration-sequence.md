# vps-old Domain Migration Sequence

Updated on `2026-05-01`.

This runbook tracks the migration plan and closure status for domains discovered on
`root@vps-old.pyrosa.com.do`, plus the earlier `adudoc.com` and `gomezrosado.com.do`
pilot migrations that established the current SimpleHostMan pattern.

## Consolidated Status

| Domain | Web/app posture | Mail posture | Database posture | Current status |
| --- | --- | --- | --- | --- |
| `adudoc.com` | migrated custom PHP app on `app-adudoc` | SimpleHostMan mail live | PostgreSQL migrated to `app_adudoc` | closed |
| `gomezrosado.com.do` | migrated static runtime on `app-gomezrosado` | SimpleHostMan mail live | none | closed |
| `ppdpr.us` | migrated static runtime on `app-ppdpr` | SimpleHostMan mail live | none | closed |
| `bitfay.org` | migrated static runtime on `app-bitfay` | SimpleHostMan mail live | none | closed |
| `kynasoft.com` | migrated blank static runtime on `app-kynasoft` | SimpleHostMan mail live | none | closed |
| `sipoel.com` | migrated static runtime on `app-sipoel` | SimpleHostMan mail live | none | closed |
| `tatokka.com` | migrated app runtime on `app-tatokka` | SimpleHostMan mail live | MySQL source converted to PostgreSQL `app_tatokka` | closed |
| `zcrmt.com` | migrated WordPress runtime on `app-zcrmt` | Zoho preserved | WordPress kept on MariaDB `app_zcrmt_wp` | closed |
| `merlelaw.com` | migrated blank static runtime on `app-merlelaw` | SimpleHostMan mail live | none | closed |
| `engilum.com` | external web targets preserved | Zoho preserved | none | DNS-only staged |
| `pyrosa.com.do` | `pyrosa-wp`, `pyrosa-demoportal`, `pyrosa-repos`, and `pyrosa-demoerp` runtimes active; `sync`/`helpers` still on `vps-old` | Microsoft 365 preserved, no legacy mail migration planned | WordPress and demoportal migrated to MariaDB; demoerp migrated to PostgreSQL; `repos` has no database | phase 4 complete |
| `solucionesmercantilnr.com` | not migrated | retired | none | out of scope: expired, not renewing |
| `pyrosa.net` | not migrated | retired | none | out of scope: expired, not renewing |

Credential files kept under `src/docs/MIGRATIONS`:

- [`adudoc-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-credentials.md)
- [`gomezrosado-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-mail-credentials.md)
- [`merlelaw-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/merlelaw-mail-credentials.md)
- [`vps-old-temporary-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md)

Related references:

- [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md)
- [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-runtime-migration.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-runtime-migration.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/pyrosa-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/pyrosa-runtime-migration.md)

## Execution model

Run phases sequentially. Do not begin a later phase for a domain until the previous phase has a
recorded outcome.

1. Discovery and inventory from `vps-old`.
2. SimpleHostMan staging.
3. Initial copy without public cutover.
4. Pre-cutover validation.
5. DNS and SMTP cutover.
6. Stabilization and closure.

The preferred cutover model is still one domain at a time for the first domain in this set, then
small batches only after the first closure is clean.

## Phase 0 discovery snapshot

Discovery was performed read-only on `2026-04-30` against `root@vps-old.pyrosa.com.do`.

Legacy host:

- hostname: `vps-1926167b.vps.ovh.ca`
- cPanel detected: yes
- legacy public IP observed in cPanel userdata and zones: `51.161.11.249`

| Domain | cPanel user | Web shape | Mailboxes | Mail size | Database inventory | Public DNS note |
| --- | --- | --- | ---: | --- | --- | --- |
| `bitfay.org` | `wmbitfay` | small static HTML | 4 | `664K` | none | public `A` and `MX` still point to legacy apex |
| `kynasoft.com` | `wmkynasoft` | empty docroot | 3 | `564K` | none | public `A` and `MX` still point to legacy apex |
| `ppdpr.us` | `wmppdpr` | small static HTML | 1 | `172K` | none | public `A` and `MX` still point to legacy apex |
| `sipoel.com` | `wmsipoel` | small static HTML | 1 | `23M` | none | public `A` and `MX` still point to legacy apex |
| `zcrmt.com` | `wmzcrmt` | WordPress | 2 | `45M` | MySQL `wmzcrmt_wp_main` | public web points to legacy; MX points to Zoho |
| `tatokka.com` | `wmtatokka` | small static HTML | 1 | `172K` | MySQL `wmtatokka_dev_2025a` | public `A` and `MX` still point to legacy apex |
| `merlelaw.com` | `wmmerlelaw` | blank static HTML | 4 | `2.1M` | none | public `A` and `MX` still pointed to legacy apex before cutover |
| `engilum.com` | `wmengilum` | empty docroot | 4 local legacy mailboxes | `608K` | none | public web points to external A records; MX points to Zoho |
| `solucionesmercantilnr.com` | `wmsolucionesmnr` | small static HTML | 5 | `27M` | none | expired; not renewing; migration retired |
| `pyrosa.net` | `wmpyrosanet` | small static HTML | 0 | `0` | none | expired; not renewing; migration retired |

## Legacy mailboxes

### bitfay.org

- `admin@bitfay.org`: `160K`, `1` message
- `info@bitfay.org`: `160K`, `1` message
- `support@bitfay.org`: `160K`, `1` message
- `webmaster@bitfay.org`: `184K`, `4` messages
- legacy catch-all: `*: wmbitfay`

### kynasoft.com

- `contact@kynasoft.com`: `352K`, `10` messages
- `j.depena@kynasoft.com`: `140K`, `3` messages
- `webmaster@kynasoft.com`: `72K`, `0` messages
- legacy catch-all: `*: wmkynasoft`

### ppdpr.us

- `it@ppdpr.us`: `172K`, `1` message
- legacy catch-all: `*: wmppdpr`

### sipoel.com

- `zoho@sipoel.com`: `23M`, `508` messages
- legacy catch-all: `*: wmsipoel`

### zcrmt.com

- `j.depena@zcrmt.com`: `22M`, `20` messages
- `n.herrera@zcrmt.com`: `23M`, `620` messages
- aliases:
  - `zoho@zcrmt.com -> j.depena@zcrmt.com,n.herrera@zcrmt.com`
  - catch-all `* -> j.depena@zcrmt.com`

### tatokka.com

- `webmaster@tatokka.com`: `172K`, `1` message
- legacy catch-all: `*: wmtatokka`

### merlelaw.com

- `it@merlelaw.com`: `1.2M`, `71` files
- `lind@merlelaw.com`: `212K`, `23` files
- `secretaria@merlelaw.com`: `212K`, `23` files
- `zoho@merlelaw.com`: `512K`, `38` files
- legacy catch-all: `*: wmmerlelaw`

### engilum.com

Local cPanel mailboxes were discovered but intentionally not migrated because public mail is hosted
by Zoho and the target posture preserves Zoho.

- `accounting@engilum.com`: `152K`, `22` files
- `contact@engilum.com`: `152K`, `22` files
- `sales@engilum.com`: `152K`, `22` files
- `zoho@engilum.com`: `152K`, `22` files
- legacy catch-all: `*: wmengilum`

### solucionesmercantilnr.com

- `contabilidad@solucionesmercantilnr.com`: `228K`, `2` messages
- `info@solucionesmercantilnr.com`: `268K`, `7` messages
- `t.nunez@solucionesmercantilnr.com`: `3.8M`, `12` messages
- `y.nunez@solucionesmercantilnr.com`: `22M`, `63` messages
- `zoho@solucionesmercantilnr.com`: `840K`, `18` messages
- legacy catch-all: `*: wmsolucionesmnr`

### pyrosa.net

- no mailbox directories discovered
- legacy catch-all: `*: wmpyrosanet`

## Recommended order

### Wave 1: lowest-risk live pilot

Start with `ppdpr.us`.

Reason:

- only one mailbox
- tiny mailbox size
- no database
- small static site
- public DNS is currently live on the legacy host, so it exercises the real cutover path

Do not batch another domain into this first cutover window.

### Wave 2: simple low-volume domains

Run after `ppdpr.us` has stable inbound and outbound mail.

- `bitfay.org`
- `kynasoft.com`
- `tatokka.com`

Notes:

- `tatokka.com` has a MySQL database named `wmtatokka_dev_2025a`; confirm whether it is active before
  treating the site as static-only.
- Preserve or explicitly replace the legacy catch-all behavior before cutover.

### Wave 3: medium mail domain

- `sipoel.com`

Notes:

- `sipoel.com` has the largest non-WordPress mailbox count by volume in this set.

### Out of active scope

- `solucionesmercantilnr.com`
- `pyrosa.net`

Both domains are expired and will not be renewed, so they should not receive mail validation, final
Maildir delta, backup evidence, DNS cutover work, or web migration work.

### Wave 4: special-case domain

Handle `zcrmt.com` separately.

Reasons:

- WordPress site under `/home/wmzcrmt/public_html`
- MySQL database `wmzcrmt_wp_main`
- public mail exchange currently uses Zoho, not cPanel local delivery
- cPanel still contains local mailbox data and aliases that need an explicit keep/drop decision

Do not repoint `MX` away from Zoho unless that is an intentional product decision.

## Sequential gates

### Gate 0: discovery complete

Required before staging a domain:

- cPanel account identified
- document root and app type identified
- database inventory captured
- mailbox inventory captured
- aliases and catch-all behavior captured
- legacy zone captured
- registrar/public DNS posture understood

### Gate 1: SimpleHostMan staging ready

Required before first copy:

- DNS zone created or confirmed
- Mail Domain created or intentionally skipped
- mailboxes and aliases modeled
- catch-all decision recorded
- backup policy created when mail or app content is in scope
- reconciliation complete
- Mail view reports no blocking warning for the domain

### Gate 2: first copy complete

Required before validation:

- web files copied if in scope
- database dump/import completed if in scope
- Maildir or IMAP copy completed
- copied mailbox counts recorded
- target standby seeded or blocking reason recorded

### Gate 3: pre-cutover validation complete

Required before DNS changes:

- IMAPS login works for each mailbox
- SMTP submission works for each mailbox or selected representative accounts
- local inbound delivery works
- Roundcube login works when webmail is in scope
- DKIM, SPF, DMARC, MTA-STS, and TLS-RPT posture is ready
- backup evidence exists or a backup exception is explicitly accepted

### Gate 4: cutover complete

Required before stabilization:

- `mail.<domain>` points to the new active node when mail is hosted by SimpleHostMan
- `MX` points to `mail.<domain>` when mail is hosted by SimpleHostMan
- web `A` and `www` records point to the target proxy when web is migrated
- final mailbox delta copy completed
- old host retained for the overlap window

### Gate 5: closure complete

Required before decommissioning legacy state:

- no new inbound mail is landing on `vps-old`
- users confirm login
- queues and recent failures are clean
- backup run evidence is present
- migration closure document is updated per domain

## Execution log

### 2026-04-30: ppdpr.us phase 1 staging

The legacy catch-all `*: wmppdpr` is intentionally not preserved.

Replacement aliases:

- `postmaster@ppdpr.us -> it@ppdpr.us`
- `abuse@ppdpr.us -> it@ppdpr.us`
- `webmaster@ppdpr.us -> it@ppdpr.us`

Applied in `SimpleHostMan`:

- tenant `ppdpr`
- zone `ppdpr.us`
- mail domain `ppdpr.us`
- mailbox `it@ppdpr.us` with `5 GiB` quota and `reset_required` credentials
- backup policy `mail-ppdpr-daily`

Reconciliation generated `dns.sync`, `mail.sync`, and mail policy proxy render jobs for both nodes.
The first secondary `dns.sync` attempt failed while verifying the initial transferred zone, then a
targeted `ppdpr.us` zone sync completed successfully on both primary and secondary.

Verified after the retry:

- `mail.sync` applied on `primary`
- `mail.sync` applied on `secondary`
- `zone:ppdpr.us` synchronized on `primary`
- `zone:ppdpr.us` synchronized on `secondary`
- `webmail.ppdpr.us` and `mta-sts.ppdpr.us` Apache vhosts installed on both nodes
- Maildir, DKIM, Roundcube, and MTA-STS artifacts exist on both nodes

### 2026-04-30: temporary credentials generated

Temporary migration credentials were generated from SimpleHostMan for all discovered legacy
mailboxes in the target domain set.

Credential inventory:

- `bitfay.org`: `4` mailbox credential(s)
- `kynasoft.com`: `3` mailbox credential(s)
- `ppdpr.us`: `1` mailbox credential
- `sipoel.com`: `1` mailbox credential
- `zcrmt.com`: `2` mailbox credential(s)
- `tatokka.com`: `1` mailbox credential
- `solucionesmercantilnr.com`: `5` mailbox credential(s), now retired because the domain is expired
- `pyrosa.net`: none generated because no legacy mailbox directories were discovered; domain retired

The credentials were captured in:

- [`/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md)

That file is intentionally local and sensitive. Do not publish it without an explicit decision.

To generate the credentials, the mail-plane desired state was staged for all domains with discovered
mailboxes. Reconciliation then rendered `dns.sync`, `mail.sync`, `webmail`, and `mta-sts` jobs for
the new mail domains. The main reconciliation completed with one transient secondary `dns.sync`
verification failure for `sipoel.com`; a targeted retry completed successfully on both nodes.

After reconciliation, SimpleHostMan reported:

- all `17` discovered target mailboxes as `configured`
- `0` reset-required mailboxes across these newly staged domains
- `pyrosa.net` with no mailbox state because no legacy mailbox was discovered

The `solucionesmercantilnr.com` credentials are no longer active migration credentials after the
domain was removed from scope.

### 2026-04-30: registrar NS cutover mitigation

After the registrar-side nameserver update in ResellerClub, public resolvers were checked against
`1.1.1.1`.

Observed with new SimpleHostMan nameservers:

- `bitfay.org`
- `kynasoft.com`
- `ppdpr.us`
- `sipoel.com`
- `zcrmt.com`
- `tatokka.com`

Still without public answers at the time of validation:

- `solucionesmercantilnr.com`
- `pyrosa.net`

Because the NS change can make the new SimpleHostMan zones authoritative before web migration is
closed, explicit `@` and `www` records were added to preserve legacy web traffic:

- `@ A 51.161.11.249`
- `www A 51.161.11.249`

For `pyrosa.net`, a minimal preservation zone was created because the target nameservers had no zone
for it yet and no legacy mailbox directories had been discovered.

DNS reconciliation after this mitigation generated `22` jobs and all applied successfully.

Important mail note:

- `zcrmt.com` discovery showed public `MX` on Zoho before the NS move.
- Do not treat `zcrmt.com` as a SimpleHostMan-hosted mail domain unless that becomes an explicit
  product decision.

### 2026-04-30: zcrmt.com restored to vps-old mail posture

After the registrar nameserver cutover, `zcrmt.com` briefly had SimpleHostMan mail records staged in
the target zone. The operator decision is to leave `zcrmt.com` as it was on `vps-old` for now because
mail is publicly hosted by Zoho and the WordPress/MySQL runtime is not migrated.

Desired-state changes applied:

- removed `zcrmt.com` from SimpleHostMan mail domains
- removed `j.depena@zcrmt.com` and `n.herrera@zcrmt.com` from SimpleHostMan mailbox state
- removed the `zcrmt.com` mail aliases, quotas, and `mail-zcrmt-daily` backup policy
- kept the `zcrmt.com` DNS zone so the new nameservers can preserve the legacy posture

Authoritative `zcrmt.com` DNS now mirrors the legacy mail posture:

- `@ A 51.161.11.249`
- `www CNAME zcrmt.com.`
- `mail CNAME zcrmt.com.`
- `webmail A 51.161.11.249`
- `MX 10 mx.zoho.com.`
- `MX 20 mx2.zoho.com.`
- `MX 50 mx3.zoho.com.`
- Zoho verification TXT
- Zoho SPF TXT
- `zmail._domainkey` Zoho DKIM TXT

Cleanup and verification:

- removed stale SimpleHostMan-derived mail DNS artifacts from both nodes
- `zone:zcrmt.com` latest targeted sync applied on `primary` and `secondary`
- `zcrmt.com` no longer appears in SimpleHostMan Mail overview
- Cloudflare resolver validation returned Zoho `MX`, legacy `A`, and legacy `mail`/`www` CNAMEs

The two temporary `zcrmt.com` credentials generated earlier are retired because those mailboxes are
no longer active in SimpleHostMan desired state.

The previously copied `zcrmt.com` Maildir content remains staged on disk as a non-destructive copy,
but it is not part of active SimpleHostMan mail delivery.

### 2026-04-30: expired domains removed from migration scope

`solucionesmercantilnr.com` and `pyrosa.net` were confirmed expired and not planned for renewal.
They are excluded from the active migration sequence.

Operational decision:

- do not validate mail for either domain
- do not run final Maildir deltas for either domain
- do not collect backup evidence for either domain
- do not migrate web/DNS runtime for either domain
- retire any temporary credentials generated for `solucionesmercantilnr.com`

The earlier non-destructive Maildir copy for `solucionesmercantilnr.com` can remain on disk as
staged historical material, but it is not part of active mail delivery.

### 2026-04-30: bulk Maildir copy

To avoid split-mail risk after the registrar NS change, legacy Maildir content was copied
non-destructively from `vps-old` into SimpleHostMan for every discovered mailbox.

Copy mode:

- `rsync --ignore-existing`
- no `--delete`
- ownership normalized to `vmail:vmail`
- replicated from primary to secondary without deleting target files

Copied mailbox counts:

- `bitfay.org`: `7` messages across `4` mailboxes
- `kynasoft.com`: `13` messages across `3` mailboxes
- `ppdpr.us`: `1` message across `1` mailbox
- `sipoel.com`: `508` messages across `1` mailbox
- `zcrmt.com`: `643` messages across `2` mailboxes
- `tatokka.com`: `1` message across `1` mailbox
- `solucionesmercantilnr.com`: `102` messages across `5` mailboxes

All copied mailbox trees were also replicated to the secondary node.

## Current Next Action

The migration batch through `merlelaw.com` is closed. The remaining active `vps-old` follow-up is
`pyrosa.com.do`, which is now documented as a multi-app migration in
[`pyrosa-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/pyrosa-runtime-migration.md).
Public mail is on Microsoft 365, so legacy cPanel mail should not be migrated.

### 2026-04-30: pyrosa.com.do WordPress phase 1

The WordPress apex for `pyrosa.com.do` was copied from `vps-old`, imported into MariaDB, and started
as `app-pyrosa-wp` on both SimpleHostMan nodes.

Applied app:

- app slug `pyrosa-wp`
- source `/home/wmpyrosa/public_html/`, excluding `_sites/`
- backend port `10101`
- runtime image tag `registry.example.com/pyrosa-wordpress:stable`
- storage root `/srv/containers/apps/pyrosa-wp`
- `app-pyrosa-wp.service` active on `primary` and `secondary`

Database outcome:

- source database `wmpyrosa_2024`
- target MariaDB database `app_pyrosa_wp`
- target MariaDB user `app_pyrosa_wp`
- imported `55` WordPress tables
- imported row checks: `807` `wppy_options` rows and `695` `wppy_posts` rows
- WordPress was kept on MariaDB because stock WordPress does not support PostgreSQL natively

DNS and TLS outcome:

- SimpleHostMan PowerDNS serves `pyrosa.com.do A -> 51.222.204.86`
- SimpleHostMan PowerDNS serves `www.pyrosa.com.do A -> 51.222.204.86`
- `sync.pyrosa.com.do`, `helpers.pyrosa.com.do`, and `repos.pyrosa.com.do` remain pointed at
  `51.161.11.249`
- Microsoft 365 MX/SPF/DKIM/Autodiscover/DMARC records are preserved
- existing Let's Encrypt wildcard certificate from `vps-old` installed temporarily on both nodes

Validation:

- `https://pyrosa.com.do/` returns `200 OK` with title `PYROSA` on both nodes using `--resolve`
- `https://pyrosa.com.do/wp-login.php` returns `200 OK` on both nodes using `--resolve`
- public checks from `1.1.1.1` and `8.8.8.8` returned the new apex/`www` A records, the old
  `sync` A record, and the Microsoft 365 MX record

Remaining propagation item:

- as of `2026-04-30 22:51 UTC`, the `.do` parent still returned the old nameserver delegation
  (`vps-1926167b.vps.ovh.ca` and `sdns2.ovh.ca`) even though the registrar change to
  `vps-16535090.vps.ovh.ca` and `vps-3dbbfb0b.vps.ovh.ca` had been submitted

### 2026-05-01: pyrosa.com.do demoportal phase 2

`demoportal.pyrosa.com.do` was copied from `vps-old`, imported into MariaDB, and started as
`app-pyrosa-demoportal` on both SimpleHostMan nodes.

Applied app:

- app slug `pyrosa-demoportal`
- source `/home/wmpyrosa/public_html/_sites/demoportal.pyrosa.com.do/`
- excluded `node_modules/`, root `error_log`, and `public/error_log`
- staged file count `8,801`, staged size about `79M`
- backend port `10103`
- runtime image tag `registry.example.com/pyrosa-demoportal:stable`
- storage root `/srv/containers/apps/pyrosa-demoportal`
- `app-pyrosa-demoportal.service` active on `primary` and `secondary`

Database outcome:

- source database `wmpyrosa_synct`
- target MariaDB database `app_pyrosa_demoportal`
- target MariaDB user `app_pyrosa_demoportal`
- imported `20` Laravel tables
- `php artisan migrate:status` reports all `14` migrations as `Ran`
- imported row checks: `2` `users`, `2` `organizations`, and `14` `sessions`
- kept on MariaDB because the source is MySQL/MariaDB and PostgreSQL compatibility was not tested

Runtime image outcome:

- PHP/Apache runtime definition now includes `pdo_mysql`
- build script path was corrected so the runtime image build context resolves from `scripts/agent`

DNS and TLS outcome:

- `.do` parent now delegates `pyrosa.com.do` to `vps-16535090.vps.ovh.ca` and
  `vps-3dbbfb0b.vps.ovh.ca`
- SimpleHostMan PowerDNS serves `demoportal.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `sync.pyrosa.com.do`, `helpers.pyrosa.com.do`, and `repos.pyrosa.com.do` remain pointed at
  `51.161.11.249`
- Microsoft 365 MX/SPF/DKIM/Autodiscover/DMARC records remain preserved
- existing Pyrosa wildcard certificate is used for the `demoportal.pyrosa.com.do` HTTPS vhost

Validation:

- `https://demoportal.pyrosa.com.do/` returns `200 OK` on both nodes using `--resolve`
- `https://demoportal.pyrosa.com.do/login` returns `200 OK` on both nodes using `--resolve`
- public checks from `1.1.1.1` and `8.8.8.8` returned the new `demoportal` A record
- `sync`, `helpers`, and `repos` still returned the old-host A record from public resolver checks

### 2026-05-01: pyrosa.com.do repos phase 3

`repos.pyrosa.com.do` was copied from `vps-old` and started as `app-pyrosa-repos` on both
SimpleHostMan nodes. This is the SLES/Yum RPM repository for Proyecto Iohana packages.

Applied app:

- app slug `pyrosa-repos`
- source `/home/wmpyrosa/public_html/_sites/repos.pyrosa.com.do/`
- copied file count `208`, staged size about `574M`
- backend port `10104`
- runtime image tag `registry.example.com/pyrosa-repos:stable`
- storage root `/srv/containers/apps/pyrosa-repos`
- no database resource
- `app-pyrosa-repos.service` active on `primary` and `secondary`

Repository validation:

- preserved `sbotools.repo`, `RPM-GPG-KEY-sbotools`, `repomd.xml`, `repomd.xml.asc`, and RPMs
- checksums for the repo file, metadata, signature, and GPG key matched `vps-old` on both nodes
- all `6` `repomd.xml` metadata entries passed SHA-256 verification on both nodes
- a local `dnf makecache --refresh` check against the target backend completed successfully

Publishing/DNS outcome:

- stale root cron entries on `vps-old` still reference a missing `repos.pyrosa.com.do/dis/` tree
- no active `sbotools` publishing workflow was found during inspection
- latest observed `sbotools` RPM/metadata timestamp was `2026-04-10 16:03 UTC`
- SimpleHostMan PowerDNS serves `repos.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.repos.pyrosa.com.do` remains on `51.161.11.249` because the target wildcard certificate does
  not cover that two-label hostname
- `sync.pyrosa.com.do` and `helpers.pyrosa.com.do` remain pointed at `51.161.11.249`

Validation:

- `https://repos.pyrosa.com.do/` returns `200 OK` on both nodes using `--resolve`
- `/sbotools/sbotools.repo` returns `200 OK`, `213` bytes, and `text/plain` on both nodes
- `/sbotools/repodata/repomd.xml` returns `200 OK`, `3,089` bytes, and `application/xml` on both
  nodes
- authoritative checks from `51.222.204.86` and `51.222.206.196` returned the new `repos` A record
- at `2026-05-01 01:39 UTC`, `8.8.8.8` returned the new record while `1.1.1.1` still had the old
  answer cached

### 2026-05-01: pyrosa.com.do demoerp phase 4

`demoerp.pyrosa.com.do` was copied from `vps-old`, imported into PostgreSQL, and started as
`app-pyrosa-demoerp` on both SimpleHostMan nodes.

Applied app:

- app slug `pyrosa-demoerp`
- source `/home/wmpyrosa/public_html/_sites/demoerp.pyrosa.com.do/`
- copied `htdocs` file count `14,596`
- copied `documents` file count `40`
- staged size about `267M` for `htdocs` and `1.9M` for `documents`
- backend port `10105`
- runtime image tag `registry.example.com/pyrosa-demoerp:stable`
- storage root `/srv/containers/apps/pyrosa-demoerp`
- `app-pyrosa-demoerp.service` active on `primary` and `secondary`

Database outcome:

- source PostgreSQL database `dolibarr_demoerp`
- target PostgreSQL database `app_pyrosa_demoerp`
- target PostgreSQL user `app_pyrosa_demoerp`
- imported `336` public tables
- target database size about `28M`
- Dolibarr `conf.php` now reads database settings from container environment variables

Runtime and database access outcome:

- `documents` is mounted at `/var/www/documents` and denied from direct HTTP access
- PostgreSQL `pg_hba.conf` now allows SCRAM-authenticated app container traffic from
  `10.88.0.0/16` on both nodes
- PostgreSQL connectivity from `app-pyrosa-demoerp` passed on both nodes

DNS and TLS outcome:

- SimpleHostMan PowerDNS serves `demoerp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.demoerp.pyrosa.com.do` remains on `51.161.11.249` because the target wildcard certificate
  does not cover that two-label hostname
- `sync.pyrosa.com.do` and `helpers.pyrosa.com.do` remain pointed at `51.161.11.249`
- the legacy DNS zone on `vps-old` also serves `demoerp.pyrosa.com.do A -> 51.222.204.86` with
  TTL `300` for resolvers that still have old nameserver delegation cached

Validation:

- `https://demoerp.pyrosa.com.do/` returns `200 OK` on both nodes using `--resolve`
- public `https://demoerp.pyrosa.com.do/` returns `200 OK` and the Dolibarr `23.0.0-beta` login
  page
- authoritative checks from `51.222.204.86` and `51.222.206.196` returned the new `demoerp` A record
- legacy authoritative check from `51.161.11.249` returned the new `demoerp` A record
- public checks from `1.1.1.1` and `8.8.8.8` returned the new `demoerp` A record

### 2026-04-30: ppdpr.us web runtime cutover

The staged `ppdpr.us` static web content was promoted into SimpleHostMan app desired state.

Applied state:

- app slug `ppdpr`
- backend port `10401`
- runtime image `registry.example.com/ppdpr-app:stable`
- storage root `/srv/containers/apps/ppdpr`
- no database resource, because discovery found no source database
- `app-ppdpr.service` active on both nodes
- `ppdpr.us` and `www.ppdpr.us` now point at `51.222.204.86`
- `http://ppdpr.us/` redirects to HTTPS
- Let's Encrypt certificate `ppdpr.us` issued for `ppdpr.us` and `www.ppdpr.us`
- HTTPS vhost and certificate material replicated to the secondary node

Validation:

- backend `127.0.0.1:10401` returns `200 OK` on both nodes
- public `https://ppdpr.us/` returns `200 OK` with the migrated static placeholder content

### 2026-04-30: phase 2 static web runtime cutover

The simple static sites from wave 2 were copied from `vps-old`, promoted into SimpleHostMan app
desired state, and cut over at DNS.

Applied apps:

| Domain | App slug | Source | Backend | Runtime image | Notes |
| --- | --- | --- | ---: | --- | --- |
| `bitfay.org` | `bitfay` | `/home/wmbitfay/public_html/` | `10501` | `registry.example.com/bitfay-app:stable` | source had `3` files |
| `kynasoft.com` | `kynasoft` | `/home/wmkynasoft/public_html/` | `10601` | `registry.example.com/kynasoft-app:stable` | source document root was empty; a minimal blank `index.html` was added to avoid publishing a directory `403` |
| `sipoel.com` | `sipoel` | `/home/wmsipoel/public_html/` | `10701` | `registry.example.com/sipoel-app:stable` | source had `2` files |

Database outcome:

- no database resource was created for any phase 2 domain
- discovery found no source database for `bitfay.org`, `kynasoft.com`, or `sipoel.com`

Reconciliation outcome:

- `app-bitfay.service` active on `primary` and `secondary`
- `app-kynasoft.service` active on `primary` and `secondary`
- `app-sipoel.service` active on `primary` and `secondary`
- backend health checks returned `200 OK` on both nodes for all three apps
- Apache vhosts were installed on both nodes for all three apps

DNS cutover:

- `bitfay.org A -> 51.222.204.86`
- `www.bitfay.org A -> 51.222.204.86`
- `kynasoft.com A -> 51.222.204.86`
- `www.kynasoft.com A -> 51.222.204.86`
- `sipoel.com A -> 51.222.204.86`
- `www.sipoel.com A -> 51.222.204.86`
- latest targeted zone sync applied on both nodes for `bitfay.org`, `kynasoft.com`, and `sipoel.com`

TLS:

- Let's Encrypt certificates were issued for each apex plus `www`
- all three certificates expire on `2026-07-29`
- certificate material and HTTPS vhosts were replicated to the secondary node

Validation:

- `https://bitfay.org/` and `https://www.bitfay.org/` return `200 OK`
- `https://kynasoft.com/` and `https://www.kynasoft.com/` return `200 OK`
- `https://sipoel.com/` and `https://www.sipoel.com/` return `200 OK`

### 2026-04-30: phase 3 tatokka.com PostgreSQL web runtime cutover

`tatokka.com` was copied from `vps-old`, converted from the legacy MySQL app configuration to
PostgreSQL, and cut over at DNS.

Applied app:

- app slug `tatokka`
- source `/home/wmtatokka/public_html/`
- backend port `10801`
- runtime image `registry.example.com/tatokka-app:stable`
- storage root `/srv/containers/apps/tatokka`
- `app-tatokka.service` active on `primary` and `secondary`
- Apache vhost installed on both nodes

Database outcome:

- source database `wmtatokka_dev_2025a`
- target PostgreSQL database `app_tatokka`
- target PostgreSQL role `app_tatokka`
- imported `7` users and `15` sessions
- `profiles` was empty in the source and remains empty after migration
- app config now reads database settings from container environment variables
- legacy MySQL DSNs were replaced with PostgreSQL DSNs
- the login session insert was updated from MariaDB `DATE_ADD` syntax to PostgreSQL interval syntax

DNS cutover:

- `tatokka.com A -> 51.222.204.86`
- `www.tatokka.com A -> 51.222.204.86`
- latest targeted `tatokka.com` zone sync applied on both nodes

TLS:

- Let's Encrypt certificate `tatokka.com` issued for `tatokka.com` and `www.tatokka.com`
- certificate expires on `2026-07-29`
- certificate material and HTTPS vhost were replicated to the secondary node

Validation:

- backend `127.0.0.1:10801` returns `200 OK` on both nodes
- `https://tatokka.com/` and `https://www.tatokka.com/` return `200 OK`
- `https://tatokka.com/dev/?page=login` returns `200 OK`
- secondary local HTTPS validation with `--resolve` returns `200 OK` for apex and `www`

### 2026-04-30: phase 4 zcrmt.com WordPress runtime cutover

`zcrmt.com` was copied from `vps-old`, promoted into SimpleHostMan app desired state, and cut over
for web traffic while preserving the existing Zoho mail posture.

Applied app:

- app slug `zcrmt`
- source `/home/wmzcrmt/public_html/`
- backend port `10901`
- runtime image `registry.example.com/zcrmt-app:stable`
- storage root `/srv/containers/apps/zcrmt`
- `app-zcrmt.service` active on `primary` and `secondary`
- Apache vhost installed on both nodes

Database outcome:

- source database `wmzcrmt_wp_main`
- target MariaDB database `app_zcrmt_wp`
- target MariaDB user `app_zcrmt_wp`
- imported `18` WordPress tables
- imported WordPress row checks: `207` options and `94` posts
- WordPress was kept on MariaDB because stock WordPress does not support PostgreSQL natively
- `wp-config.php` now reads database settings from container environment variables
- `wp-config.php` now honors `X-Forwarded-Proto: https` so HTTPS proxying does not cause a redirect loop

DNS cutover:

- `zcrmt.com A -> 51.222.204.86`
- `www.zcrmt.com CNAME -> zcrmt.com.`
- Zoho MX records preserved:
  - `MX 10 mx.zoho.com.`
  - `MX 20 mx2.zoho.com.`
  - `MX 50 mx3.zoho.com.`
- Zoho SPF, verification TXT, and `zmail._domainkey` DKIM records preserved
- latest targeted `zcrmt.com` zone sync applied on both nodes

TLS:

- Let's Encrypt certificate `zcrmt.com` issued for `zcrmt.com` and `www.zcrmt.com`
- certificate expires on `2026-07-29`
- certificate material and HTTPS vhost were replicated to the secondary node

Validation:

- backend `127.0.0.1:10901` returns `200 OK` on both nodes
- `https://zcrmt.com/` returns `200 OK`
- `https://www.zcrmt.com/` returns a WordPress canonical redirect to `https://zcrmt.com/`
- `https://zcrmt.com/wp-login.php` returns `200 OK`
- secondary local HTTPS validation with `--resolve` returns `200 OK` for apex and canonical redirect for `www`
- database migration classified as `completed`, desired/inventory match is `yes`, drift is clear

### 2026-04-30: follow-up merlelaw.com runtime and mail cutover

`merlelaw.com` was copied from `vps-old`, promoted into SimpleHostMan app desired state, and cut over
for web and local mail delivery.

Applied app:

- app slug `merlelaw`
- source `/home/wmmerlelaw/public_html/`
- backend port `11001`
- runtime image `registry.example.com/merlelaw-app:stable`
- storage root `/srv/containers/apps/merlelaw`
- `app-merlelaw.service` active on `primary` and `secondary`
- source web content is the legacy blank static site

Mail outcome:

- managed mail domain `merlelaw.com`
- mail host `mail.merlelaw.com`
- DKIM selector `mail`
- migrated Maildir mailboxes: `it`, `lind`, `secretaria`, and `zoho`
- migrated Maildir counts match the source: `71`, `23`, `23`, and `38` files respectively
- a post-cutover non-destructive Maildir delta sync was run after the MX update
- generated mailbox credentials are stored root-only at `src/docs/MIGRATIONS/merlelaw-mail-credentials.md`
- aliases `abuse`, `postmaster`, and `webmaster` route to `it@merlelaw.com`
- mailbox quotas are set to `5 GiB`
- catch-all delivery from the cPanel source was not preserved

DNS cutover:

- `merlelaw.com A -> 51.222.204.86`
- `www.merlelaw.com A -> 51.222.204.86`
- `mail.merlelaw.com A -> 51.222.204.86`
- `webmail.merlelaw.com A -> 51.222.204.86`
- `mta-sts.merlelaw.com A -> 51.222.204.86`
- strict SPF, DMARC, TLS-RPT, MTA-STS, and `mail._domainkey` DKIM records published
- latest targeted `merlelaw.com` zone sync applied on both nodes
- legacy `vps-old` authoritative zone was updated to the same cutover records

TLS:

- Let's Encrypt certificate `merlelaw.com` issued for `merlelaw.com` and `www.merlelaw.com`
- certificate expires on `2026-07-29`
- certificate material and HTTPS vhost were replicated to the secondary node

Validation:

- backend `127.0.0.1:11001` returns `200 OK` on both nodes
- `https://merlelaw.com/` and `https://www.merlelaw.com/` return `200 OK`
- `http://merlelaw.com/` redirects to HTTPS
- Dovecot resolves `it@merlelaw.com` on both nodes with the expected Maildir and quota
- public DNS resolves apex, `www`, `mail`, `webmail`, and `mta-sts` to `51.222.204.86`

### 2026-04-30: follow-up engilum.com DNS staging

`engilum.com` was added to SimpleHostMan as a DNS-only tenant/zone while preserving the active
external website targets and Zoho mail posture. No SimpleHostMan app or local mail domain was
created because the legacy web root is empty and public web traffic already points to external
services.

Preserved DNS posture:

- `engilum.com A -> 82.25.83.155`
- `engilum.com A -> 34.174.124.238`
- `www.engilum.com CNAME -> engilum.com.`
- Zoho MX records:
  - `MX 10 mx.zoho.com.`
  - `MX 20 mx2.zoho.com.`
  - `MX 50 mx3.zoho.com.`
- Zoho SPF, verification TXT, and `zmail._domainkey` DKIM records preserved
- existing DMARC, Apple verification, ownercheck, and `engilum.engilum.com` records preserved
- latest targeted `engilum.com` zone sync applied on both nodes

Validation:

- SimpleHostMan desired state contains tenant `engilum` and zone `engilum.com`
- both PowerDNS nodes list the preserved external A records and Zoho MX/TXT records
- no local SimpleHostMan mailboxes were created for `engilum.com`
