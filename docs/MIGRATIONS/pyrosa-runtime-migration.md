# pyrosa.com.do Runtime Migration Plan

Updated on `2026-05-01`.

This document records the read-only inspection of `pyrosa.com.do` on
`root@vps-old.pyrosa.com.do` and the proposed execution plan for migrating selected web runtimes
into SimpleHostMan.

Public mail is hosted on Microsoft 365. No legacy cPanel mailboxes should be migrated and no
SimpleHostMan mail domain should be created for `pyrosa.com.do`.

## Guardrails

- `sync.pyrosa.com.do` was cut over after period close and now runs from SimpleHostMan.
- `helpers.pyrosa.com.do` was cut over after period close and now runs from SimpleHostMan.
- `www.helpers.pyrosa.com.do` remains on `vps-old` because second-level aliases are not required
  unless separately requested.
- Treat `repos.pyrosa.com.do` as package distribution infrastructure for SLES/RPM consumers of the
  Proyecto Iohana packages, not as a simple static site.
- Preserve Microsoft 365 MX, SPF, DKIM, Autodiscover, and DMARC records.
- Cut over one hostname at a time after local `--resolve` validation.
- Do not publish secrets from copied configs into this repository.

## Current SimpleHostMan Desired State

Live desired state currently includes:

| App | Hostnames | Backend | Database | Status |
| --- | --- | ---: | --- | --- |
| `pyrosa-wp` | `pyrosa.com.do`, `www.pyrosa.com.do` | `10101` | MariaDB `app_pyrosa_wp` | phase 1 runtime active on primary and secondary |
| `pyrosa-demoportal` | `demoportal.pyrosa.com.do` | `10103` | MariaDB `app_pyrosa_demoportal` | phase 2 runtime active on primary and secondary |
| `pyrosa-repos` | `repos.pyrosa.com.do` | `10104` | none | phase 3 RPM repository runtime active on primary and secondary |
| `pyrosa-demoerp` | `demoerp.pyrosa.com.do` | `10105` | PostgreSQL `app_pyrosa_demoerp` | phase 4 Dolibarr runtime active on primary and secondary |
| `pyrosa-api` | `api.pyrosa.com.do`, `www.api.pyrosa.com.do` | `10106` | none | phase 5 PHP API runtime active on primary and secondary; `www` alias cut over in phase 8 |
| `pyrosa-demosync` | `demosync.pyrosa.com.do`, `www.demosync.pyrosa.com.do` | `10107` | MariaDB `app_pyrosa_demosync`, `app_pyrosa_demosync_qbo` | phase 6 DIS/QBO demo runtime active on primary and secondary; `www` alias cut over in phase 8 |
| `pyrosa-erp` | `erp.pyrosa.com.do`, `www.erp.pyrosa.com.do` | `10108` | none | phase 7 empty placeholder runtime active on primary and secondary; `www` alias cut over in phase 8 |
| `pyrosa-portal` | `portal.pyrosa.com.do`, `www.portal.pyrosa.com.do` | `10109` | none | phase 7 empty placeholder runtime active on primary and secondary; `www` alias cut over in phase 8 |
| `pyrosa-ldap` | `ldap.pyrosa.com.do` | `10110` | none | phase 9 LDAP Account Manager UI active on primary and secondary; OpenLDAP migrated to SimpleHostMan and disabled on `vps-old` |
| `pyrosa-pgadmin` | `pgadmin.pyrosa.com.do` | `10111` | pgAdmin SQLite config store | phase 10 pgAdmin 4 runtime active on primary and secondary |
| `pyrosa-sync` | `sync.pyrosa.com.do` | `10102` | MariaDB `app_pyrosa_sync`, `app_pyrosa_sync_qbo`; PostgreSQL conversion deferred | phase 13 DIS/QBO production runtime active; workers active on primary only |
| `pyrosa-helpers` | `helpers.pyrosa.com.do` | `10112`; DFR `10113`; QR render `10114` | PostgreSQL `app_pyrosa_helpers_dfr` imported for preservation; DFR runtime remains JSON-store backed | phase 14 helper runtime active on primary and secondary |

`pyrosa-wp`, `pyrosa-demoportal`, and `pyrosa-sync` are also present in
`bootstrap/apps.bootstrap.yaml`. `pyrosa-repos`, `pyrosa-demoerp`, `pyrosa-api`, and
`pyrosa-demosync`, `pyrosa-erp`, `pyrosa-portal`, `pyrosa-ldap`, `pyrosa-pgadmin`, and
`pyrosa-helpers` are represented only in live desired state until the bootstrap inventory is
refreshed. `pyrosa-repos`, `pyrosa-api`, `pyrosa-erp`, `pyrosa-portal`, and `pyrosa-ldap`
intentionally have no database resource.

`code.pyrosa.com.do` is a host-service cutover rather than a `shp_apps` app resource. It fronts the
existing code-server service on `127.0.0.1:8080` on the SimpleHostMan nodes and is tracked in the
phase 11 execution record below.

The target node public IP for migrated web hostnames is `51.222.204.86`.

As of the phase 14 execution record, every primary hostname approved for this wave is cut over to
the target node. Second-level `www.*` aliases remain out of scope unless separately requested.

## Legacy Inventory

Legacy public IP: `51.161.11.249`.

| Hostname | Source path / role | Size | Runtime or service | Data dependencies | Proposed posture |
| --- | --- | ---: | --- | --- | --- |
| `pyrosa.com.do` / `www` | `/home/wmpyrosa/public_html` | WordPress root about `556M`; full account tree includes `_sites` | WordPress `6.9.4`, PHP 8.4 | MySQL `wmpyrosa_2024`, about `29M` | migrate first as `pyrosa-wp`; keep WordPress on MariaDB |
| `api.pyrosa.com.do` | `_sites/api.pyrosa.com.do` | `346M` | PHP plus Node helper tree | external MongoDB URI and external HANA/SAP endpoint | migrated in phase 5 as `pyrosa-api`; external secrets preserved local-only |
| `code.pyrosa.com.do` | proxy, not document root content | empty docroot | `code-server` on `:8080` | host developer tooling service | migrated in phase 11 as an Apache host-service proxy to the existing SimpleHostMan code-server |
| `demoerp.pyrosa.com.do` | `_sites/demoerp.pyrosa.com.do/htdocs` | `267M` htdocs; about `2.0G` tree | Dolibarr-style PHP app | PostgreSQL `dolibarr_demoerp` on PostgreSQL 18 | migrated in phase 4 as `pyrosa-demoerp`, kept on PostgreSQL |
| `demoportal.pyrosa.com.do` | `_sites/demoportal.pyrosa.com.do` | `194M` source; `79M` staged without `node_modules`/logs | Laravel 12 app | MySQL `wmpyrosa_synct`, Redis/local mail settings observed in legacy env | migrated in phase 2 as `pyrosa-demoportal`, kept on MariaDB |
| `demosync.pyrosa.com.do` | `_sites/demosync.pyrosa.com.do` | `88M` source; `255M` staged after local Tabler asset copy | DIS/QBO demo app | MySQL `wmpyrosa_disdemo` and shared `wmpyrosa_qbo` | migrated in phase 6 as `pyrosa-demosync`, kept on MariaDB |
| `erp.pyrosa.com.do` | `_sites/erp.pyrosa.com.do` | empty | placeholder | none observed | migrated in phase 7 as an empty `pyrosa-erp` placeholder, preserving `403` |
| `helpers.pyrosa.com.do` | `_sites/helpers.pyrosa.com.do` | `6.6G` | helper tools; Apache proxy path to `localhost:3333` configured | PostgreSQL `do_fiscal_reports`; JSON-store DFR data | migrated in phase 14 as `pyrosa-helpers`; old `/dfr/` proxy disabled on `vps-old` after cutover |
| `ldap.pyrosa.com.do` | `_sites/ldap.pyrosa.com.do` | `91M` | LDAP Account Manager 9.3 UI | OpenLDAP on `389`/`636` | migrated in phase 9 as `pyrosa-ldap`; OpenLDAP service later imported to SimpleHostMan and retired on `vps-old` |
| `pgadmin.pyrosa.com.do` | proxy, not document root content | empty docroot; pgAdmin data about `2M` | pgAdmin 4.9.10 | SQLite pgAdmin config store with one user and two saved servers | migrated in phase 10 as `pyrosa-pgadmin` |
| `portal.pyrosa.com.do` | `_sites/portal.pyrosa.com.do` | empty | placeholder | none observed | migrated in phase 7 as an empty `pyrosa-portal` placeholder, preserving `403` |
| `repos.pyrosa.com.do` | `_sites/repos.pyrosa.com.do` | `574M` | SLES/Yum RPM repository | `sbotools` repo metadata and signed package metadata | migrated in phase 3 as `pyrosa-repos` |
| `sync.pyrosa.com.do` | `_sites/sync.pyrosa.com.do` | `4.1G`; `639M` staged after excluding backup, Git, logs, and full Tabler source trees | DIS/QBO production app and PHP workers | MySQL `wmpyrosa_dis`, `wmpyrosa_qbo`; Redis disabled in target config | migrated in phase 13 as `pyrosa-sync`, kept on MariaDB for compatibility |

## Database Inventory

MySQL:

| Database | Approx size | Observed consumers |
| --- | ---: | --- |
| `wmpyrosa_dis` | `3.8G` | `sync.pyrosa.com.do` |
| `wmpyrosa_disdemo` | `57M` | migrated to MariaDB `app_pyrosa_demosync` for `demosync.pyrosa.com.do` |
| `wmpyrosa_2024` | `29M` | WordPress apex |
| `wmpyrosa_synct` | `0.5M` | `demoportal.pyrosa.com.do` |
| `wmpyrosa_qbo` | `0.2M` | production `sync`; copied to MariaDB `app_pyrosa_demosync_qbo` for `demosync` |

PostgreSQL 18:

| Database | Observed consumer |
| --- | --- |
| `dolibarr_demoerp` | migrated to PostgreSQL `app_pyrosa_demoerp` for `demoerp.pyrosa.com.do` |
| `do_fiscal_reports` | migrated to PostgreSQL `app_pyrosa_helpers_dfr` for preservation/future compatibility; current DFR runtime remains JSON-store backed |
| `adudoc_db` / `add_xp8hnrqxr3` | legacy Adudoc leftovers |

## Active Services Observed On vps-old

- Apache/cPanel HTTPD.
- MySQL on `*:3306`.
- PostgreSQL 18 on `127.0.0.1:5432`.
- Redis on `127.0.0.1:6379`.
- OpenLDAP on `389` and `636`.
- `code-server` on `0.0.0.0:8080`.
- pgAdmin4 on `127.0.0.1:5050`.
- PHP workers for the production `sync.pyrosa.com.do` DIS runtime.

Before phase 14, `helpers.pyrosa.com.do` had cron-driven jobs and a configured `/dfr/` proxy on
`vps-old`. No listener on `:3333` was observed during the spot check. After period close, the helper
runtime was migrated and the old `/dfr/` proxy was disabled in favor of a temporary reverse proxy to
the new primary.

## DNS Posture To Preserve

The legacy zone points the apex and subdomains at `51.161.11.249`.

Mail posture to preserve:

- MX `0 pyrosa-com-do.mail.protection.outlook.com.`
- SPF includes `spf.protection.outlook.com`.
- `autodiscover` CNAME to Microsoft 365.
- Microsoft 365 DKIM selector CNAMEs.
- DMARC policy `p=reject`.

Before any hostname cutover, seed the SimpleHostMan `pyrosa.com.do` zone with a preservation set:
all non-migrated hostnames should keep `A -> 51.161.11.249`, while Microsoft 365 mail records remain
unchanged.

## Execution Plan

### Phase 0: Preservation and Freeze

1. Freeze migration scope: only move hostnames explicitly selected for this wave.
2. Original freeze list was `sync`, `helpers`, `repos`, `code`, `pgadmin`, and `ldap`; those
   endpoints were later migrated in approved follow-up phases where applicable.
3. Seed target DNS for `pyrosa.com.do` with current Microsoft 365 records and old-host A records.
4. Lower TTLs ahead of individual hostname cutovers where the authoritative provider permits it.

### Phase 1: Migrate WordPress Apex

1. Copy `/home/wmpyrosa/public_html` excluding `_sites`.
2. Dump and import MySQL `wmpyrosa_2024` into MariaDB `app_pyrosa_wp`.
3. Configure `wp-config.php` to read DB credentials from container environment variables and honor
   `X-Forwarded-Proto`.
4. Start `app-pyrosa-wp.service` on primary and secondary.
5. Validate backend and HTTPS with `--resolve` for `pyrosa.com.do` and `www.pyrosa.com.do`.
6. Cut over only apex and `www` to `51.222.204.86`.
7. Re-run a small delta sync for uploads and re-check WordPress login/static assets.

WordPress should remain on MariaDB for this phase because stock WordPress does not support
PostgreSQL natively.

### Phase 2: Choose The Next Low-Risk App

Recommended order after WordPress:

1. `demoportal.pyrosa.com.do`: completed as `pyrosa-demoportal`.
2. `api.pyrosa.com.do`: containerized app after secrets are moved to environment files and external
   MongoDB/HANA connectivity is tested from the target host.
3. `demoerp.pyrosa.com.do`: Dolibarr app with PostgreSQL dump/restore to target PostgreSQL.

For Laravel, keep the initial database on MariaDB unless a separate schema compatibility test proves
the app is clean on PostgreSQL. For Dolibarr, preserve PostgreSQL because the source is already
PostgreSQL.

### Phase 3: Package Repository Decision

`repos.pyrosa.com.do` can be migrated as a static app, but it should be handled like infrastructure:

1. Copy the repository tree with checksums preserved.
2. Preserve `.repo`, `RPM-GPG-KEY-sbotools`, `repodata/repomd.xml`, `repomd.xml.asc`, and all RPMs.
3. Validate `https://repos.pyrosa.com.do/sbotools/sbotools.repo` and
   `https://repos.pyrosa.com.do/sbotools/repodata/repomd.xml` on the target with `--resolve`.
4. From a SLES-compatible client, run repository refresh/install checks before DNS cutover.
5. Cut over `repos.pyrosa.com.do` only when package consumers are idle or prepared for a short retry
   window.

If the repo is actively used by release publishing jobs, leave it on `vps-old` until the publishing
workflow is identified and reproduced on the target.

### Phase 4: Deferred Systems

These systems were deferred until after period close and later resumed:

- `sync.pyrosa.com.do` and its production DIS/QBO database/worker set, completed in phase 13.
- `helpers.pyrosa.com.do` and `do_fiscal_reports`, completed in phase 14.
- Production workers for the sync family. `demosync.pyrosa.com.do` was migrated in phase 6
  after validation showed no active cron or worker process on `vps-old`.

These systems were separately approved and migrated:

- `code.pyrosa.com.do`, completed in phase 11.
- `pgadmin.pyrosa.com.do`, completed in phase 10.
- `ldap.pyrosa.com.do`, completed in phase 9.

## Open Checks Before Execution

- Capture a fresh final DB dump timestamp immediately before each cutover that includes a database.

## Commit And Push Blocks

Each block should be independently reviewable, documented, validated, committed, and pushed before
the next block begins. Runtime secrets and generated credentials remain local-only and should not be
committed.

| Block | Scope | Documentation update | Validation gate | Commit message |
| --- | --- | --- | --- | --- |
| A | Inspection, freeze rules, and phased plan | This runbook plus the consolidated sequence | no service or DNS changes; docs contain no secrets | `docs: plan pyrosa phased migration` |
| B | DNS preservation baseline | record imported Microsoft 365 records and old-host A records | target PowerDNS answers match current public posture | `chore: preserve pyrosa dns baseline` |
| C | WordPress staging | record copy path, DB dump timestamp, target DB, backend port | `pyrosa-wp` backend returns expected content through `--resolve` | `feat: stage pyrosa wordpress runtime` |
| D | WordPress cutover | record DNS, TLS, delta sync, and post-cutover checks | public apex and `www` return expected HTTPS responses | `chore: cut over pyrosa wordpress` |
| E | `demoportal` app | record Laravel env handling, DB import, workers/queues status | app responds through target vhost and DB checks pass | `feat: migrate pyrosa demoportal` |
| F | `api` app | record external service reachability and secret placement | target can reach external MongoDB/HANA dependencies and app smoke checks pass | `feat: migrate pyrosa api runtime` |
| G | `demoerp` app | record PostgreSQL dump/restore, role/database mapping, Dolibarr checks | target PostgreSQL import and app smoke checks pass | `feat: migrate pyrosa demoerp runtime` |
| H | `repos` RPM repository, if approved | record repo copy, checksums, metadata, and SLES client result | `.repo`, `repomd.xml`, signatures, and zypper/yum refresh pass | `feat: migrate pyrosa rpm repository` |

Deferred systems get their own later block after period close:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `demosync.pyrosa.com.do` if it stays coupled to the sync stack
- `code.pyrosa.com.do`, `pgadmin.pyrosa.com.do`, and `ldap.pyrosa.com.do` if they are rebuilt on
  SimpleHostMan

Suggested block workflow:

1. Update the runbook with the intended action and pre-check evidence.
2. Apply only the files/configuration for that block.
3. Run the validation gate.
4. Update the runbook with outcomes, timestamps, and rollback notes.
5. Commit only that block's files.
6. Push immediately after the block is green.

## Phase 1 Execution Record

Started on `2026-04-30` and scoped only to the WordPress apex:

- `pyrosa.com.do`
- `www.pyrosa.com.do`

The following hostnames were intentionally kept on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `repos.pyrosa.com.do`
- `api.pyrosa.com.do`
- `demoportal.pyrosa.com.do`
- `demoerp.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-wp`
- source path copied from `root@51.161.11.249:/home/wmpyrosa/public_html/`
- `_sites/` excluded from the copy because subdomains are separate apps
- copied file count: `24,607`
- copied regular file count: `21,031`
- copied payload size: about `598M`
- backend port `10101`
- runtime image tag `registry.example.com/pyrosa-wordpress:stable`
- storage root `/srv/containers/apps/pyrosa-wp`
- `app-pyrosa-wp.service` active on `primary`
- `app-pyrosa-wp.service` active on `secondary`

`wp-config.php` was changed on disk so DB settings are read from the container environment and
WordPress honors `X-Forwarded-Proto: https`.

### Database

Applied database state:

- source database `wmpyrosa_2024`
- target database `app_pyrosa_wp`
- target database user `app_pyrosa_wp`
- engine kept on MariaDB
- imported table count: `55`
- imported `wppy_options` rows: `807`
- imported `wppy_posts` rows: `695`

The WordPress table prefix remains `wppy_`.

### TLS

The existing Let's Encrypt wildcard certificate from `vps-old` was installed temporarily under
`/etc/ssl/simplehostman/pyrosa.com.do/` on both nodes so HTTPS serves the correct virtual host before
new certificate issuance is attempted from SimpleHostMan.

Certificate summary:

- subject `CN=*.pyrosa.com.do`
- issuer `Let's Encrypt R13`
- valid from `2026-04-24`
- valid until `2026-07-23`

### DNS

SimpleHostMan PowerDNS now serves the `pyrosa.com.do` zone with:

- `pyrosa.com.do A -> 51.222.204.86`
- `www.pyrosa.com.do A -> 51.222.204.86`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`
- `repos.pyrosa.com.do A -> 51.161.11.249`
- Microsoft 365 `MX`, SPF, Autodiscover, selector DKIM CNAMEs, and DMARC preserved

The same PowerDNS answers were confirmed on:

- `51.222.204.86`
- `51.222.206.196`

The legacy cPanel zone file on `vps-old` was also updated for apex and `www`, but `named.service`
on `vps-old` was not active because an unrelated missing `bonanza.com.do` zone blocks BIND startup.
The intended authoritative path is therefore the registrar delegation to the SimpleHostMan
nameservers.

As of `2026-04-30 22:51 UTC`, the `.do` parent servers still returned the old delegation:

- `vps-1926167b.vps.ovh.ca`
- `sdns2.ovh.ca`

The registrar change to the new nameservers had been submitted by the operator and was still pending
at the parent:

- `vps-16535090.vps.ovh.ca`
- `vps-3dbbfb0b.vps.ovh.ca`

The parent delegation was later confirmed during phase 2 on `2026-05-01`.

### Validation

Backend and vhost validation:

- `http://127.0.0.1:10101/` redirects to HTTPS on both nodes
- `https://pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `200 OK` and title `PYROSA`
- `https://pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `200 OK` and title `PYROSA`
- `https://pyrosa.com.do/wp-login.php` returns `200 OK` on both nodes through HTTPS
- `https://www.pyrosa.com.do/` redirects to `https://pyrosa.com.do/`

Public resolver spot checks after runtime cutover:

- `1.1.1.1` returned `pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `www.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `sync.pyrosa.com.do A -> 51.161.11.249`
- `1.1.1.1` returned Microsoft 365 MX for `pyrosa.com.do`
- `8.8.8.8` returned `pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `www.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `sync.pyrosa.com.do A -> 51.161.11.249`
- `8.8.8.8` returned Microsoft 365 MX for `pyrosa.com.do`

### Follow-Up

- Parent delegation follow-up was completed during phase 2.
- Issue a native SimpleHostMan/Let's Encrypt certificate for `pyrosa.com.do` and `www.pyrosa.com.do`
  after delegation has fully moved.
- Run a final WordPress file delta sync if there is evidence that uploads changed on `vps-old`
  during propagation.

## Phase 2 Execution Record

Completed on `2026-05-01` and scoped only to:

- `demoportal.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `repos.pyrosa.com.do`
- `api.pyrosa.com.do`
- `demoerp.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-demoportal`
- source path copied from `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/demoportal.pyrosa.com.do/`
- excluded `node_modules/`, root `error_log`, and `public/error_log`
- staged file count: `8,801`
- staged payload size: about `79M`
- backend port `10103`
- runtime image tag `registry.example.com/pyrosa-demoportal:stable`
- storage root `/srv/containers/apps/pyrosa-demoportal`
- `app-pyrosa-demoportal.service` active on `primary`
- `app-pyrosa-demoportal.service` active on `secondary`

The shared PHP/Apache runtime definition was updated to include `pdo_mysql`, which Laravel needs for
MariaDB/MySQL through PDO. The app container also mounts an Apache site config with
`DocumentRoot /var/www/html/public` so the Laravel project root and `.env` are not web roots.

### Database

Applied database state:

- source database `wmpyrosa_synct`
- target database `app_pyrosa_demoportal`
- target database user `app_pyrosa_demoportal`
- engine kept on MariaDB
- imported table count: `20`
- imported Laravel migrations marked as ran: `14`
- imported row checks: `2` `users`, `2` `organizations`, and `14` `sessions`

The app was kept on MariaDB for this phase because the source is MySQL/MariaDB and no separate
schema compatibility pass for PostgreSQL has been performed.

### TLS And Proxying

The existing Pyrosa wildcard certificate under `/etc/ssl/simplehostman/pyrosa.com.do/` is used by
the `demoportal.pyrosa.com.do` HTTPS vhost on both nodes.

Proxy behavior:

- HTTP redirects to HTTPS.
- HTTPS proxies to `127.0.0.1:10103`.
- `X-Forwarded-Proto: https` and `X-Forwarded-Port: 443` are sent to Laravel.

### DNS

SimpleHostMan PowerDNS now serves:

- `demoportal.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`
- `repos.pyrosa.com.do A -> 51.161.11.249`

The `.do` parent delegation was confirmed on `2026-05-01` as:

- `vps-16535090.vps.ovh.ca`
- `vps-3dbbfb0b.vps.ovh.ca`

The legacy PowerDNS zone on `vps-old` was also updated so cached old delegations answer
`demoportal.pyrosa.com.do A -> 51.222.204.86`. `www.demoportal.pyrosa.com.do` remains pointed at
`51.161.11.249` because it was not part of this cutover.

### Validation

Backend and vhost validation:

- `http://127.0.0.1:10103/` returns `200 OK` on both nodes with the expected Laravel response.
- `https://demoportal.pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `200 OK`.
- `https://demoportal.pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `200 OK`.
- `https://demoportal.pyrosa.com.do/login` returns `200 OK` on both nodes and title
  `pyrosa-demoportal`.
- `php artisan migrate:status` reports all `14` migrations as `Ran` on both nodes.

Public resolver spot checks after cutover:

- `1.1.1.1` returned `demoportal.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `demoportal.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `sync.pyrosa.com.do A -> 51.161.11.249`
- `1.1.1.1` returned `helpers.pyrosa.com.do A -> 51.161.11.249`
- `1.1.1.1` returned `repos.pyrosa.com.do A -> 51.161.11.249`
- `1.1.1.1` returned Microsoft 365 MX for `pyrosa.com.do`

Some recursive resolvers may still cache the old `demoportal.pyrosa.com.do` answer until the legacy
TTL expires.

## Phase 3 Execution Record

Completed on `2026-05-01` and scoped only to:

- `repos.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-repos`
- source path copied from `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/repos.pyrosa.com.do/`
- copied file count: `208`
- copied payload size: about `574M`
- backend port `10104`
- runtime image tag `registry.example.com/pyrosa-repos:stable`
- storage root `/srv/containers/apps/pyrosa-repos`
- `app-pyrosa-repos.service` active on `primary`
- `app-pyrosa-repos.service` active on `secondary`

The app is a static Apache container. The container vhost sets package-friendly MIME types for
`.repo`, `.xml`, `.asc`, and `.rpm`, forces `RPM-GPG-KEY-sbotools` to `text/plain`, and preserves
the legacy `Cache-Control: no-store` behavior.

### Repository Contents

Preserved package repository artifacts:

- `/sbotools/sbotools.repo`
- `/sbotools/RPM-GPG-KEY-sbotools`
- `/sbotools/repodata/repomd.xml`
- `/sbotools/repodata/repomd.xml.asc`
- `/sbotools/x86_64/*.rpm`

Checksum spot checks matched `vps-old`, `primary`, and `secondary`:

- `sbotools.repo`: `736b61dd181490f5b9d27b2e32dd35de05cae234564399c885a14514149f0d11`
- `repomd.xml`: `64f31bce198806e57930b042fa5bf3f95646c7fa1a3ac9b64ffde56d9eab2b63`
- `repomd.xml.asc`: `bc61655cc595f6eff0ce19da415450ff5eba103dc76dcb39777a029cb33916eb`
- `RPM-GPG-KEY-sbotools`: `290037dc151ad19d795720b1cd19d4c47064999b0e163a2fd23d8285f45a7a28`

The `repomd.xml` metadata was parsed and all `6` referenced metadata files passed SHA-256
verification on both nodes. A local `dnf makecache --refresh` check against
`http://127.0.0.1:10104/sbotools` completed successfully on the target.

### Publishing Check

`vps-old` still has root cron entries for `/home/wmpyrosa/public_html/_sites/repos.pyrosa.com.do/dis/`,
but that `dis/` directory no longer exists in the repository tree. No active `sbotools` publishing
script was found during the inspection. The latest RPM and repo metadata timestamps observed in
`sbotools` were `2026-04-10 16:03 UTC`.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `repos.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.repos.pyrosa.com.do A -> 51.161.11.249`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`

`www.repos.pyrosa.com.do` was intentionally left on `vps-old` because the current target certificate
is `*.pyrosa.com.do`; that wildcard covers `repos.pyrosa.com.do` but not the two-label
`www.repos.pyrosa.com.do` name.

The existing Pyrosa wildcard certificate under `/etc/ssl/simplehostman/pyrosa.com.do/` is used by
the `repos.pyrosa.com.do` HTTPS vhost on both nodes.

Follow-up on `2026-05-01`: `proxy.render` had rewritten the Pyrosa subdomain vhosts as HTTP-only
proxy files, which made HTTPS requests fall through to the default SSL vhost. The live
`demoportal`, `repos`, and `demoerp` Apache vhosts were restored with explicit `:443` blocks on both
nodes, and the agent renderer was fixed so future TLS proxy jobs emit HTTP redirect plus HTTPS
vhosts.

### Validation

Backend and vhost validation:

- `https://repos.pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `200 OK`.
- `https://repos.pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `200 OK`.
- `/sbotools/sbotools.repo` returns `200 OK`, `213` bytes, and `text/plain` on both nodes.
- `/sbotools/repodata/repomd.xml` returns `200 OK`, `3,089` bytes, and `application/xml` on both
  nodes.
- `/sbotools/repodata/repomd.xml.asc` returns `200 OK` and `application/pgp-signature` on both
  nodes.
- `/sbotools/RPM-GPG-KEY-sbotools` returns `200 OK`, `1,761` bytes, and `text/plain` on both nodes.

DNS validation at `2026-05-01 01:39 UTC`:

- authoritative `51.222.204.86` returned `repos.pyrosa.com.do A -> 51.222.204.86`
- authoritative `51.222.206.196` returned `repos.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `repos.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` still returned the old `51.161.11.249` answer, consistent with legacy TTL caching

Public HTTP checks may therefore hit either old or new runtime until recursive resolver caches
expire. Both runtimes served the same `sbotools.repo` content during the cutover window.

## Phase 4 Execution Record

Completed on `2026-05-01` and scoped only to:

- `demoerp.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `api.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-demoerp`
- source path copied from
  `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/demoerp.pyrosa.com.do/`
- copied `htdocs` file count: `14,596`
- copied `documents` file count: `40`
- staged payload size: about `267M` for `htdocs` and `1.9M` for `documents`
- backend port `10105`
- runtime image tag `registry.example.com/pyrosa-demoerp:stable`
- storage root `/srv/containers/apps/pyrosa-demoerp`
- `app-pyrosa-demoerp.service` active on `primary`
- `app-pyrosa-demoerp.service` active on `secondary`

The Dolibarr `conf.php` now reads runtime URL and PostgreSQL settings from the container
environment. The target Apache vhost maps `/var/www/html/htdocs` as the document root and keeps
`/var/www/documents` denied from direct HTTP access.

### Database

Applied database state:

- source database `dolibarr_demoerp`
- source PostgreSQL version `18.3`
- target database `app_pyrosa_demoerp`
- target database user `app_pyrosa_demoerp`
- target engine `postgresql`
- imported `336` public tables
- target database size after restore: about `28M`

The target PostgreSQL cluster now allows SCRAM-authenticated connections from the Podman application
network `10.88.0.0/16` on both nodes. This was required because web containers run on the Podman
default network while the app database listener is reached through the node-local gateway address.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `demoerp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.demoerp.pyrosa.com.do A -> 51.161.11.249`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`

`www.demoerp.pyrosa.com.do` was intentionally left on `vps-old` because the current target
certificate is `*.pyrosa.com.do`; that wildcard covers `demoerp.pyrosa.com.do` but not the
two-label `www.demoerp.pyrosa.com.do` name.

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer
`demoerp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`.

The Pyrosa subdomain HTTPS vhosts were checked after a `proxy.render` renderer issue was found:
`demoportal.pyrosa.com.do`, `repos.pyrosa.com.do`, and `demoerp.pyrosa.com.do` now all have explicit
Apache `:443` vhosts on both nodes and use the existing `*.pyrosa.com.do` certificate.

### Validation

Backend and vhost validation:

- `https://demoerp.pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `200 OK`.
- `https://demoerp.pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `200 OK`.
- public `https://demoerp.pyrosa.com.do/` returns `200 OK` and the Dolibarr `23.0.0-beta` login
  page.
- PostgreSQL connectivity from `app-pyrosa-demoerp` passed on both nodes.

DNS validation at `2026-05-01 01:54 UTC`:

- authoritative `51.222.204.86` returned `demoerp.pyrosa.com.do A -> 51.222.204.86`
- authoritative `51.222.206.196` returned `demoerp.pyrosa.com.do A -> 51.222.204.86`
- legacy authoritative `51.161.11.249` returned `demoerp.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `demoerp.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `demoerp.pyrosa.com.do A -> 51.222.204.86`

## Phase 5 Execution Record

Completed on `2026-05-01` and scoped only to:

- `api.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- `www.api.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-api`
- source path copied from
  `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/api.pyrosa.com.do/`
- copied file count after target smoke checks: `84,223`
- copied payload size: about `343M`
- Node exporter state logs preserved: `82,788` files under `node.js/export_to_zoho/log`
- backend port `10106`
- runtime image tag `registry.example.com/pyrosa-api:stable`
- storage root `/srv/containers/apps/pyrosa-api`
- `app-pyrosa-api.service` active on `primary`
- `app-pyrosa-api.service` active on `secondary`

The runtime is a PHP/Apache app with no local database resource. The Node `export_to_zoho` tree was
copied with `.env`, OAuth token files, and its per-record log state because those logs prevent
re-exporting already processed MongoDB records. No cron or active process for the exporter was found
on `vps-old`, so no Node worker service was started on SimpleHostMan.

Target `.htaccess` policy denies direct HTTP access to:

- `node.js/`
- `oauth2/.domains/`
- `oauth2/.tokens/`
- dotfiles, `.env`, `error_log`, `.log`, and `package*.json` files

The deny rules live in `.htaccess` rather than only in the generated Apache vhost because
SimpleHostMan's generic `proxy.render` and container reconciliation jobs may rewrite vhost and
quadlet files for inventory-managed apps.

A compatibility symlink was added at `lib/phpqrcode -> ../phpqrcode` so the legacy
`v1/qrcode-create/index.php` include path resolves. The legacy host returned a PHP fatal error for a
QR generation request because that include path was missing; the target now generates PNG/JSON QR
responses successfully.

The same `.htaccess` deny guard and `lib/phpqrcode` compatibility symlink were also applied on the
legacy `vps-old` source path after cutover validation showed some recursive caches could still reach
`51.161.11.249`. This keeps sensitive files blocked and QR generation working while stale DNS caches
drain.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `api.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.api.pyrosa.com.do A -> 51.161.11.249`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`

`www.api.pyrosa.com.do` was intentionally left on `vps-old` because the current target certificate is
`*.pyrosa.com.do`; that wildcard covers `api.pyrosa.com.do` but not the two-label
`www.api.pyrosa.com.do` name.

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer
`api.pyrosa.com.do A -> 51.222.204.86` with TTL `300`.

### Validation

Backend and vhost validation:

- `https://api.pyrosa.com.do/oauth2/` with `--resolve` to `51.222.204.86` returns `200 OK` and the
  expected missing-parameter response.
- `https://api.pyrosa.com.do/oauth2/` with `--resolve` to `51.222.206.196` returns `200 OK` and the
  expected missing-parameter response.
- `https://api.pyrosa.com.do/v1/qrcode-create/?data=hello` returns `200 OK`, `image/png`, and a
  `274` byte PNG on both nodes.
- `https://api.pyrosa.com.do/node.js/export_to_zoho/.env` returns `403 Forbidden` on both nodes.
- `https://api.pyrosa.com.do/oauth2/.tokens/` returns `403 Forbidden` on both nodes.
- `https://api.pyrosa.com.do/v1/qrcode-create/?data=hello` with `--resolve` to legacy
  `51.161.11.249` returns `200 OK`, `image/png`, and a `274` byte PNG during cache drain.
- `https://api.pyrosa.com.do/node.js/export_to_zoho/.env` with `--resolve` to legacy
  `51.161.11.249` returns `403 Forbidden`.
- public `https://api.pyrosa.com.do/oauth2/` returns `200 OK` and the expected missing-parameter
  response.

DNS validation at `2026-05-01 02:22 UTC`:

- authoritative `51.222.204.86` returned `api.pyrosa.com.do A -> 51.222.204.86`
- authoritative `51.222.206.196` returned `api.pyrosa.com.do A -> 51.222.204.86`
- legacy authoritative `51.161.11.249` returned `api.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `api.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `api.pyrosa.com.do A -> 51.222.204.86`
- public `www.api.pyrosa.com.do` remained on `51.161.11.249`

## Phase 6 Execution Record

Completed on `2026-05-01` and scoped only to:

- `demosync.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- `erp.pyrosa.com.do`
- `portal.pyrosa.com.do`
- `www.api.pyrosa.com.do`
- `www.demosync.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-demosync`
- source path copied from
  `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/demosync.pyrosa.com.do/`
- copied source excludes legacy `error_log` and `dis/.git`
- copied file count after target smoke checks: `5,528`
- copied payload size: about `255M`
- backend port `10107`
- runtime image tag `registry.example.com/pyrosa-demosync:stable`
- storage root `/srv/containers/apps/pyrosa-demosync`
- `app-pyrosa-demosync.service` active on `primary`
- `app-pyrosa-demosync.service` active on `secondary`

The app is a PHP DIS/QBO demo runtime. No cron or active process for the demo tree was found on
`vps-old`, so no worker service was started on SimpleHostMan.

The legacy source used symlinks from `demosync` into the production `sync` tree for Tabler UI assets:

- `assets/tabler`
- `assets/tabler-preview`

Those symlinks were replaced on the target with real copied assets from the old `sync` tree so the
`demosync` container is self-contained and does not depend on the deferred production `sync` runtime.

The PHP config files copied from cPanel were adjusted on the target to read database connection
values from the container environment instead of hardcoded local socket credentials. Runtime secrets
remain local-only in `/etc/containers/systemd/env/app-pyrosa-demosync.env` and were not committed.

Direct HTTP access to copied config and private runtime paths is denied by the container image Apache
policy plus existing `.htaccess` files:

- `dis/inc/config.php`
- `qbo/includes/config.php`
- `dis/etc/`
- `dis/storage/`
- `dis/tmp/`
- dotfiles, logs, `.ini`, `.sql`, backup files, `composer.*`, and `package*.json`

The `pyrosa-demosync` image carries the Apache `AllowOverride All` and deny policy directly so future
generic container reconciliation does not depend on an external vhost mount for basic routing and
config protection.

### Databases

Imported MariaDB snapshots:

- `wmpyrosa_disdemo` -> `app_pyrosa_demosync`
- `wmpyrosa_qbo` -> `app_pyrosa_demosync_qbo`

Post-import validation:

- `app_pyrosa_demosync`: `31` tables, about `11.92M` allocated on target
- `app_pyrosa_demosync_qbo`: `2` tables, about `0.16M` allocated on target
- DIS app database smoke check returned `62` `dis_params` rows from both app nodes
- QBO database smoke check returned `1` client row from both app nodes

The production `sync.pyrosa.com.do` database `wmpyrosa_dis` and production use of `wmpyrosa_qbo`
remain on `vps-old`.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `demosync.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.demosync.pyrosa.com.do A -> 51.161.11.249`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`

`www.demosync.pyrosa.com.do` was intentionally left on `vps-old` because the current target
certificate is `*.pyrosa.com.do`; that wildcard covers `demosync.pyrosa.com.do` but not the
two-label `www.demosync.pyrosa.com.do` name.

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer
`demosync.pyrosa.com.do A -> 51.222.204.86` with TTL `300`.

### Validation

Backend and vhost validation:

- `https://demosync.pyrosa.com.do/dis/public/login` with `--resolve` to `51.222.204.86` returns
  `200 OK`.
- `https://demosync.pyrosa.com.do/dis/public/login` with `--resolve` to `51.222.206.196` returns
  `200 OK`.
- `https://demosync.pyrosa.com.do/qbo/oauth2/` returns `200 OK` with the expected missing-parameter
  response on both nodes.
- `https://demosync.pyrosa.com.do/dis/inc/config.php` returns `403 Forbidden` on both nodes.
- `https://demosync.pyrosa.com.do/qbo/includes/config.php` returns `403 Forbidden` on both nodes.
- `https://demosync.pyrosa.com.do/assets/tabler/css/tabler.min.css` returns `200 OK` on both nodes.
- stale-cache checks against legacy `51.161.11.249` return `200 OK` for the login and QBO OAuth
  missing-parameter pages, and `403 Forbidden` for copied config paths.

DNS validation at `2026-05-01 02:48 UTC`:

- authoritative `51.222.204.86` returned `demosync.pyrosa.com.do A -> 51.222.204.86`
- authoritative `51.222.206.196` returned `demosync.pyrosa.com.do A -> 51.222.204.86`
- legacy authoritative `51.161.11.249` returned `demosync.pyrosa.com.do A -> 51.222.204.86`
- `8.8.8.8` returned `demosync.pyrosa.com.do A -> 51.222.204.86`
- `1.1.1.1` returned `demosync.pyrosa.com.do A -> 51.222.204.86`
- public `www.demosync.pyrosa.com.do` remained on `51.161.11.249`

## Phase 7 Execution Record

Completed on `2026-05-01` and scoped only to the empty placeholder hostnames:

- `erp.pyrosa.com.do`
- `portal.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- `www.api.pyrosa.com.do`
- `www.demosync.pyrosa.com.do`
- `www.erp.pyrosa.com.do`
- `www.portal.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-erp`
- app slug `pyrosa-portal`
- source paths on `vps-old` were empty docroots with only `cgi-bin/` and ACME challenge directories
- copied payload size: empty placeholder roots
- backend ports `10108` and `10109`
- runtime image tag `registry.example.com/pyrosa-placeholder:stable`
- storage roots `/srv/containers/apps/pyrosa-erp` and `/srv/containers/apps/pyrosa-portal`
- `app-pyrosa-erp.service` active on `primary`
- `app-pyrosa-erp.service` active on `secondary`
- `app-pyrosa-portal.service` active on `primary`
- `app-pyrosa-portal.service` active on `secondary`

These are intentionally blank apps with no database resource. The migrated behavior preserves the
legacy `403 Forbidden` response for `/` because the source docroots had no index content and
directory listing was not available.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `erp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `portal.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.erp.pyrosa.com.do A -> 51.161.11.249`
- `www.portal.pyrosa.com.do A -> 51.161.11.249`
- `sync.pyrosa.com.do A -> 51.161.11.249`
- `helpers.pyrosa.com.do A -> 51.161.11.249`

`www.erp.pyrosa.com.do` and `www.portal.pyrosa.com.do` were intentionally left on `vps-old` because
the current target certificate is `*.pyrosa.com.do`; that wildcard covers `erp.pyrosa.com.do` and
`portal.pyrosa.com.do` but not the two-label `www.*` names.

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer:

- `erp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `portal.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

### Validation

Backend and vhost validation:

- `https://erp.pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `403 Forbidden`.
- `https://erp.pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `403 Forbidden`.
- `https://portal.pyrosa.com.do/` with `--resolve` to `51.222.204.86` returns `403 Forbidden`.
- `https://portal.pyrosa.com.do/` with `--resolve` to `51.222.206.196` returns `403 Forbidden`.
- `https://erp.pyrosa.com.do/.env` returns `403 Forbidden`.
- `https://portal.pyrosa.com.do/.env` returns `403 Forbidden`.
- stale-cache checks against legacy `51.161.11.249` return the same `403 Forbidden` response for
  both placeholder roots.

DNS validation at `2026-05-01 03:21 UTC`:

- authoritative `51.222.204.86` returned both placeholder A records pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned both placeholder A records pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned both placeholder A records pointing to `51.222.204.86`
- `8.8.8.8` returned both placeholder A records pointing to `51.222.204.86`
- `1.1.1.1` returned both placeholder A records pointing to `51.222.204.86`
- public `www.erp.pyrosa.com.do` and `www.portal.pyrosa.com.do` remained on `51.161.11.249`

## Phase 8 Execution Record

Completed on `2026-05-01` and scoped only to the four `www` aliases that had been deferred because
`*.pyrosa.com.do` does not cover two-label names:

- `www.api.pyrosa.com.do`
- `www.demosync.pyrosa.com.do`
- `www.erp.pyrosa.com.do`
- `www.portal.pyrosa.com.do`

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`
- `code.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`

### TLS And Runtime

Issued a dedicated Let's Encrypt ECDSA certificate:

- cert name `pyrosa-www-subdomains`
- names `www.api.pyrosa.com.do`, `www.demosync.pyrosa.com.do`, `www.erp.pyrosa.com.do`,
  `www.portal.pyrosa.com.do`
- expires `2026-07-30 02:31:52 UTC`

Apache vhosts were installed on `primary` and `secondary` to serve the aliases over HTTPS and proxy
them to the already-migrated app backends:

- `www.api.pyrosa.com.do` -> `127.0.0.1:10106`
- `www.demosync.pyrosa.com.do` -> `127.0.0.1:10107`
- `www.erp.pyrosa.com.do` -> `127.0.0.1:10108`
- `www.portal.pyrosa.com.do` -> `127.0.0.1:10109`

The certificate archive and live lineage were replicated to `secondary`. A deploy hook at
`/etc/letsencrypt/renewal-hooks/deploy/simplehost-pyrosa-www-sync.sh` now copies renewed certificate
material and the vhost file to `secondary`, then reloads Apache on both nodes.

### DNS

SimpleHostMan PowerDNS now serves:

- `www.api.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.demosync.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.erp.pyrosa.com.do A -> 51.222.204.86` with TTL `300`
- `www.portal.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer the same target
A records with TTL `300`.

### Validation

TLS and HTTP validation:

- all four aliases validate with `ssl_verify_result 0` on `primary`
- all four aliases validate with `ssl_verify_result 0` on `secondary`
- `https://www.api.pyrosa.com.do/` returns `403 Forbidden`
- `https://www.api.pyrosa.com.do/node.js/export_to_zoho/.env` returns `403 Forbidden`
- `https://www.demosync.pyrosa.com.do/` returns the blank legacy placeholder page
- `https://www.demosync.pyrosa.com.do/dis/public/login` returns `200 OK`
- `https://www.erp.pyrosa.com.do/` returns `403 Forbidden`
- `https://www.portal.pyrosa.com.do/` returns `403 Forbidden`

DNS validation at `2026-05-01 03:31 UTC`:

- authoritative `51.222.204.86` returned all four `www` aliases pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned all four `www` aliases pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned all four `www` aliases pointing to `51.222.204.86`
- `1.1.1.1` returned all four `www` aliases pointing to `51.222.204.86`
- `8.8.8.8` was already updated for `www.api`, `www.erp`, and `www.portal`; `www.demosync` was
  still draining a short recursive cache during final validation, while target `--resolve` TLS checks
  were green on both nodes.
- The local resolver still had a stale `www.portal` answer during final validation; the stale old-host
  response also served a valid HTTPS `403 Forbidden`, and authoritative DNS already returned the
  target.

## Phase 9 Execution Record

Completed on `2026-05-01` and scoped to `ldap.pyrosa.com.do`.

This phase first moved the LDAP Account Manager web UI into SimpleHostMan. The OpenLDAP daemon and
directory data were then imported into SimpleHostMan on `2026-05-01` so `ldap.pyrosa.com.do` no
longer depends on `vps-old`.

### Runtime

Applied runtime state:

- app slug `pyrosa-ldap`
- source path copied from `root@51.161.11.249:/home/wmpyrosa/public_html/_sites/ldap.pyrosa.com.do/`
- copied payload size: about `91M`, excluding legacy session files and old PHP `error_log` files
- backend port `10110`
- runtime image tag `registry.example.com/pyrosa-ldap:stable`
- storage root `/srv/containers/apps/pyrosa-ldap`
- `app-pyrosa-ldap.service` active on `primary`
- `app-pyrosa-ldap.service` active on `secondary`

The PHP/Apache runtime now includes the LAM-required `ldap`, `gettext`, and `gmp` extensions. The
LAM profile in the migrated copy uses `ldaps://ldap.pyrosa.com.do:636`; after the OpenLDAP import,
that hostname resolves to the SimpleHostMan LDAP listener.

### OpenLDAP Service Follow-Up

Completed on `2026-05-01` after all Pyrosa web hostnames were already served from SimpleHostMan.

Applied service state:

- final `vps-old` export created from OpenLDAP `cn=config` and database `dc=pyrosa,dc=com,dc=do`
- exported `10` configuration DNs and `7` data DNs
- imported the same LDIF snapshot on `primary` and `secondary`
- reused the legacy LDAP TLS certificate files under `/etc/openldap/certs/`
- installed and enabled `openldap-servers` and `openldap-clients` on both SimpleHostMan nodes
- opened `ldap` and `ldaps` services in firewalld on both SimpleHostMan nodes
- `slapd.service` is active and enabled on `primary` and `secondary`
- `slapd.service` is inactive and disabled on `vps-old`
- `vps-old` no longer listens on TCP `389` or `636`

This is a synchronized service snapshot, not live LDAP replication. If LDAP writes are made after
this cutover, treat `primary` as the active writer and refresh `secondary` before any manual LDAP
failover.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `ldap.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer the same target
A record with TTL `300`. The existing `*.pyrosa.com.do` wildcard certificate covers
`ldap.pyrosa.com.do`, so no new certificate lineage was required.

### Validation

Runtime and target validation:

- the `pyrosa-ldap` image exposes `ldap`, `gettext`, and `gmp` PHP extensions
- LDAPS connectivity from the container to the SimpleHostMan OpenLDAP service returns successfully
- anonymous LDAPS bind/search from the LAM container reports `7` entries under
  `dc=pyrosa,dc=com,dc=do`
- host-level LDAP/LDAPS checks on `primary` and `secondary` report the same naming context and `7`
  imported data DNs
- `https://ldap.pyrosa.com.do/` with `--resolve` to `primary` returns a redirect to `/lam/`
- `https://ldap.pyrosa.com.do/lam/templates/login.php` with `--resolve` to `primary` returns `200 OK`
- `https://ldap.pyrosa.com.do/lam/templates/login.php` with `--resolve` to `secondary` returns `200 OK`
- protected LAM paths such as `/lam/config/`, `/lam/lib/`, `/lam/sess/`, and `/lam/tmp/` return
  `403 Forbidden`

DNS validation at `2026-05-01 03:56 UTC`:

- authoritative `51.222.204.86` returned `ldap.pyrosa.com.do` pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned `ldap.pyrosa.com.do` pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned `ldap.pyrosa.com.do` pointing to `51.222.204.86`
- `1.1.1.1` and `8.8.8.8` returned `ldap.pyrosa.com.do` pointing to `51.222.204.86`
- `sync.pyrosa.com.do` and `helpers.pyrosa.com.do` remained on `51.161.11.249`

## Phase 10 Execution Record

Completed on `2026-05-01` and scoped to `pgadmin.pyrosa.com.do`.

This phase moved the pgAdmin web surface into SimpleHostMan. The old cPanel document root was empty;
the active service was a pgAdmin 4.9.10 gunicorn process on `127.0.0.1:5050` with a small SQLite
configuration store under `/opt/pgadmin4/data`.

### Runtime

Applied runtime state:

- app slug `pyrosa-pgadmin`
- source data copied from `root@51.161.11.249:/opt/pgadmin4/data/`
- copied state includes `pgadmin4.db`, `storage/`, and the pgAdmin local configuration required to
  read the existing config store
- copied state excludes old rotated pgAdmin logs and runtime sessions
- backend port `10111`
- runtime image tag `registry.example.com/pyrosa-pgadmin:stable`
- storage root `/srv/containers/apps/pyrosa-pgadmin`
- `app-pyrosa-pgadmin.service` active on `primary`
- `app-pyrosa-pgadmin.service` active on `secondary`

The target image is based on `docker.io/dpage/pgadmin4:9.10` and was tagged locally as the managed
runtime image. The migrated SQLite store passed integrity checks and contains one pgAdmin user and
two saved server definitions. Stored secrets were kept only in the operational pgAdmin data/config
files and were not committed to this repository.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `pgadmin.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer the same target
A record with TTL `300`. The existing `*.pyrosa.com.do` wildcard certificate covers
`pgadmin.pyrosa.com.do`, so no new certificate lineage was required.

### Validation

Runtime and target validation:

- `https://pgadmin.pyrosa.com.do/` with `--resolve` to `primary` returns a redirect to `/login?next=/`
- `https://pgadmin.pyrosa.com.do/login` with `--resolve` to `primary` returns `200 OK`
- `https://pgadmin.pyrosa.com.do/` with `--resolve` to `secondary` returns a redirect to
  `/login?next=/`
- `https://pgadmin.pyrosa.com.do/login` with `--resolve` to `secondary` returns `200 OK`
- public `https://pgadmin.pyrosa.com.do/login` returns `200 OK` from `51.222.204.86`

DNS validation at `2026-05-01 04:11 UTC`:

- authoritative `51.222.204.86` returned `pgadmin.pyrosa.com.do` pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned `pgadmin.pyrosa.com.do` pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned `pgadmin.pyrosa.com.do` pointing to `51.222.204.86`
- `1.1.1.1` and `8.8.8.8` returned `pgadmin.pyrosa.com.do` pointing to `51.222.204.86`
- `code.pyrosa.com.do`, `sync.pyrosa.com.do`, and `helpers.pyrosa.com.do` remained on
  `51.161.11.249`

## Phase 11 Execution Record

Completed on `2026-05-01` and scoped to `code.pyrosa.com.do`.

This phase cut over the code-server web endpoint. Unlike the PHP apps and admin UIs above, this was
not promoted as a containerized `shp_apps` resource because code-server was already running as a host
developer service on both SimpleHostMan nodes. The migration installed an explicit Apache vhost on
both nodes and moved DNS for `code.pyrosa.com.do`.

The following hostnames remain intentionally on `vps-old`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`

### Runtime

Applied runtime state:

- hostname `code.pyrosa.com.do`
- backend service `code-server` on `127.0.0.1:8080`
- code-server version observed on the target nodes: Code `1.117.0`
- Apache vhost file `/etc/httpd/conf.d/pyrosa-code.conf`
- vhost installed on `primary`
- vhost installed on `secondary`

The Apache vhost preserves the important legacy proxy behavior for code-server:

- HTTPS redirect from port `80`
- `AllowEncodedSlashes NoDecode`
- proxying to `127.0.0.1:8080`
- websocket upgrade rewrite to `ws://127.0.0.1:8080/`

No code-server password or runtime secret was committed. The existing target host code-server
authentication remains in place.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `code.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy DNS zone on `vps-old` was also updated so cached old delegations answer the same target
A record with TTL `300`. The existing `*.pyrosa.com.do` wildcard certificate covers
`code.pyrosa.com.do`, so no new certificate lineage was required.

### Validation

Runtime and target validation:

- `https://code.pyrosa.com.do/` with `--resolve` to `primary` redirects to `/login`
- `https://code.pyrosa.com.do/login` with `--resolve` to `primary` returns `200 OK`
- `https://code.pyrosa.com.do/` with `--resolve` to `secondary` redirects to `/login`
- `https://code.pyrosa.com.do/login` with `--resolve` to `secondary` returns `200 OK`
- public `https://code.pyrosa.com.do/login` returns `200 OK` from `51.222.204.86`

DNS validation at `2026-05-01 04:16 UTC`:

- authoritative `51.222.204.86` returned `code.pyrosa.com.do` pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned `code.pyrosa.com.do` pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned `code.pyrosa.com.do` pointing to `51.222.204.86`
- `1.1.1.1` and `8.8.8.8` returned `code.pyrosa.com.do` pointing to `51.222.204.86`
- `sync.pyrosa.com.do` and `helpers.pyrosa.com.do` remained on `51.161.11.249`

## Phase 12 Hold Record

Recorded on `2026-05-01` and scoped to closing the current Pyrosa migration wave without touching
the period-close systems.

No runtime or DNS cutover was performed in this phase. The safe migration queue is exhausted under
the current guardrails because the only remaining primary hostnames on `vps-old` are the two systems
that must stay there for now:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`

### Current DNS Boundary

Authoritative validation at `2026-05-01 04:20 UTC` against SimpleHostMan PowerDNS showed these
primary hostnames on the new target `51.222.204.86`:

- `pyrosa.com.do`
- `www.pyrosa.com.do`
- `demoportal.pyrosa.com.do`
- `repos.pyrosa.com.do`
- `demoerp.pyrosa.com.do`
- `api.pyrosa.com.do`
- `demosync.pyrosa.com.do`
- `erp.pyrosa.com.do`
- `portal.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- `pgadmin.pyrosa.com.do`
- `code.pyrosa.com.do`

The frozen primary hostnames still resolve to `51.161.11.249`:

- `sync.pyrosa.com.do`
- `helpers.pyrosa.com.do`

Second-level `www.*` aliases are not required for import unless separately requested. The following
aliases intentionally remain on `vps-old`:

- `www.code.pyrosa.com.do`
- `www.demoerp.pyrosa.com.do`
- `www.demoportal.pyrosa.com.do`
- `www.helpers.pyrosa.com.do`
- `www.ldap.pyrosa.com.do`
- `www.pgadmin.pyrosa.com.do`
- `www.repos.pyrosa.com.do`
- `www.sync.pyrosa.com.do`

The phase 8 aliases `www.api.pyrosa.com.do`, `www.demosync.pyrosa.com.do`,
`www.erp.pyrosa.com.do`, and `www.portal.pyrosa.com.do` were already cut over and remain active on
the target node.

### Operational Hold

At the time of this hold, legacy `vps-old` services were left enabled because
`sync.pyrosa.com.do` and `helpers.pyrosa.com.do` still depended on the old host during period close,
and the migrated LAM UI continued to use the old OpenLDAP service over LDAPS.

After period close, reopen the migration with a fresh inspection of:

- active cron and worker processes for `sync.pyrosa.com.do` and `helpers.pyrosa.com.do`
- MySQL `wmpyrosa_dis` and `wmpyrosa_qbo`
- PostgreSQL `do_fiscal_reports`
- Redis usage and queue/session state
- whether `sync.pyrosa.com.do` should stay on MariaDB initially or be migrated to PostgreSQL in a
  separate compatibility phase

## Phase 13 Execution Record

Completed on `2026-05-01` and scoped to `sync.pyrosa.com.do`.

This phase resumed after period close and cut over the production DIS/QBO sync runtime. The app was
kept on MariaDB for the initial compatibility migration; PostgreSQL conversion remains a later app
compatibility project.

The following hostname remains intentionally on `vps-old`:

- `helpers.pyrosa.com.do`

### Runtime

Applied runtime state:

- app slug `pyrosa-sync`
- source `/home/wmpyrosa/public_html/_sites/sync.pyrosa.com.do/`
- backend port `10102`
- runtime image tag `registry.example.com/pyrosa-sync:stable`
- storage root `/srv/containers/apps/pyrosa-sync`
- `app-pyrosa-sync.service` active on `primary`
- `app-pyrosa-sync.service` active on `secondary`
- production workers active on `primary` only:
  - `app-pyrosa-sync-worker@workflow-resolver.service`
  - `app-pyrosa-sync-worker@workflow-runner.service`
  - `app-pyrosa-sync-worker@scheduler.service`
  - `app-pyrosa-sync-worker@workflow-checker.service`

The copied source excluded the legacy `.git` tree, full Tabler source tree, old backup archives, and
legacy runtime logs. The target uses copied Tabler distribution assets under `assets/tabler` and
`assets/tabler-preview`. Runtime database credentials live only in
`/etc/containers/systemd/env/app-pyrosa-sync.env` on the nodes.

### Database

Final import window:

- started `2026-05-01T05:11:38Z`
- finished `2026-05-01T05:13:07Z`

Imported databases:

- `wmpyrosa_dis` -> MariaDB `app_pyrosa_sync`: `38` tables, about `1751.45 MiB` after import
- `wmpyrosa_qbo` -> MariaDB `app_pyrosa_sync_qbo`: `2` tables, about `0.16 MiB` after import

The target DIS config reads database settings from environment variables. The target QBO config also
reads database settings from environment variables. Redis was disabled in the target DIS config for
this compatibility cutover.

### Old Host Quiesce

During the final import, `vps-old` served a temporary Apache maintenance response for
`sync.pyrosa.com.do`, and these legacy services were stopped and disabled:

- `dis-scheduler.service`
- `dis-workflow-checker.service`
- `dis-workflow-resolver.service`
- `dis-workflow-runner.service`

After DNS cutover, the temporary maintenance include on `vps-old` was replaced with a short-lived
reverse proxy to `http://51.222.204.86/` so clients with cached old A records can drain without
receiving `503`.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `sync.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy PowerDNS/BIND zone on `vps-old` was also reloaded so cached old delegations answer the
same target A record with TTL `300`. The existing `*.pyrosa.com.do` wildcard certificate covers
`sync.pyrosa.com.do`; no new certificate lineage was required.

Second-level aliases are not required unless separately requested. `www.sync.pyrosa.com.do` remains
on `51.161.11.249`.

### Validation

Runtime and target validation:

- `https://sync.pyrosa.com.do/dis/public/login` with `--resolve` to `primary` returns `200 OK`
- `https://sync.pyrosa.com.do/dis/public/login` with `--resolve` to `secondary` returns `200 OK`
- direct container request to `http://127.0.0.1:10102/dis/public/login` returns `200 OK`
- DIS database smoke test returned `62` rows from `dis_params`
- public `https://sync.pyrosa.com.do/dis/public/login` returns `200 OK` from `51.222.204.86`
- cached-old path through `vps-old` reverse proxy returns `200 OK`

DNS validation at `2026-05-01 05:18 UTC`:

- authoritative `51.222.204.86` returned `sync.pyrosa.com.do` pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned `sync.pyrosa.com.do` pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned `sync.pyrosa.com.do` pointing to `51.222.204.86`
- public DNS returned `sync.pyrosa.com.do` pointing to `51.222.204.86`

## Phase 14 Execution Record

Completed on `2026-05-01` and scoped to `helpers.pyrosa.com.do`.

This phase resumed after period close and cut over the helper tool collection. Public mail remains
on Microsoft 365, so no Pyrosa mailboxes were migrated.

### Runtime

Applied runtime state:

- app slug `pyrosa-helpers`
- source `/home/wmpyrosa/public_html/_sites/helpers.pyrosa.com.do/`
- PHP/static helper backend port `10112`
- DFR FastAPI backend port `10113`
- QR render microservice backend port `10114`
- runtime image tag `registry.example.com/pyrosa-helpers:stable`
- DFR image tag `registry.example.com/pyrosa-helpers-dfr:stable`
- QR render image tag `registry.example.com/pyrosa-helpers-qrcode:stable`
- storage root `/srv/containers/apps/pyrosa-helpers`
- `app-pyrosa-helpers.service` active on `primary` and `secondary`
- `app-pyrosa-helpers-dfr.service` active on `primary` and `secondary`
- `app-pyrosa-helpers-qrcode.service` active on `primary` and `secondary`

The copied tree excluded virtual environments, Git metadata, dependency directories, Playwright test
output, cache directories, and dependency folders that were rebuilt in container images. The root
app directory permission was normalized to `755` on both nodes so Apache inside the PHP container
can read `.htaccess` and serve the helper root.

The QR renderer runs as a separate Node/Chromium service. The PHP helper calls it through the Podman
network at `10.88.9.14:3000`, while Apache exposes the service locally on `127.0.0.1:10114`.

### Database

The legacy PostgreSQL database was imported for preservation and future compatibility:

- source database `do_fiscal_reports`
- target database `app_pyrosa_helpers_dfr`
- final import started `2026-05-01T05:31:48Z`
- final import finished `2026-05-01T05:31:49Z`
- imported `13` public tables, about `8814 kB`

The current DFR code path remains JSON-store backed under
`do-fiscal/reports/var/json-store`. The PostgreSQL import preserves the legacy database state but
does not imply that the current DFR runtime is using PostgreSQL yet.

DFR embedded jobs and scheduler mode are enabled on `primary` and disabled on `secondary` to avoid
duplicate background work.

### Old Host Drain

The legacy `/dfr/` userdata proxy on `vps-old` pointed to `localhost:3333`, but no active listener
was observed there during inspection. After cutover, that old include was disabled and replaced by
a temporary reverse proxy to `http://51.222.204.86/` so clients with cached old A records continue
to reach the new helper runtime.

The legacy `www.helpers.pyrosa.com.do` second-level alias remains on `51.161.11.249` because
second-level aliases are not required unless separately requested.

### DNS And TLS

SimpleHostMan PowerDNS now serves:

- `helpers.pyrosa.com.do A -> 51.222.204.86` with TTL `300`

The legacy PowerDNS/BIND zone on `vps-old` was also reloaded so cached old delegations answer the
same target A record with TTL `300`. The existing `*.pyrosa.com.do` wildcard certificate covers
`helpers.pyrosa.com.do`; no new certificate lineage was required.

### Validation

Runtime and target validation:

- `https://helpers.pyrosa.com.do/` returns `200 OK` from `51.222.204.86`
- `https://helpers.pyrosa.com.do/dfr/health` returns `200 OK` from `51.222.204.86`
- `https://helpers.pyrosa.com.do/qrcode/scanner/` returns `200 OK` from `51.222.204.86`
- `https://helpers.pyrosa.com.do/banking/tasas/` returns `200 OK` from `51.222.204.86`
- `https://helpers.pyrosa.com.do/signature/ifco/` returns `200 OK` from `51.222.204.86`
- QR render via `render.php` returns `200 OK` and JSON from `51.222.204.86`
- root, DFR health, and QR scanner checks return `200 OK` on the `secondary` node with target
  `--resolve`
- cached-old path through the `vps-old` reverse proxy returns `200 OK` for root, DFR health,
  QR scanner, QR render, banking tasas, and signature tools

DNS validation at `2026-05-01 05:48 UTC`:

- authoritative `51.222.204.86` returned `helpers.pyrosa.com.do` pointing to `51.222.204.86`
- authoritative `51.222.206.196` returned `helpers.pyrosa.com.do` pointing to `51.222.204.86`
- legacy authoritative `51.161.11.249` returned `helpers.pyrosa.com.do` pointing to `51.222.204.86`
- public DNS returned `helpers.pyrosa.com.do` pointing to `51.222.204.86`

## vps-old Apache Shutdown Drill

Completed on `2026-05-01` after the phase 14 helper cutover.

Apache on `vps-old` was stopped and disabled to monitor whether any migrated Pyrosa web runtime
still depended on the old cPanel host before the VPS cancellation window.

Operational state:

- WHM/cPanel no longer has `httpd` enabled or monitored.
- `httpd.service` on `vps-old` is `inactive` and `disabled`.
- `vps-old` no longer listens on TCP `80` or `443`.
- OpenLDAP, PowerDNS, database services, and mail services were not stopped.

The shutdown drill surfaced two issues that were corrected:

- `repos.pyrosa.com.do` was still pointing to `51.161.11.249` in the legacy `vps-old` authoritative
  zone. The legacy zone now answers `repos.pyrosa.com.do A -> 51.222.204.86` with TTL `300`.
- the target pgAdmin Quadlet had been regenerated with generic PHP app mounts. It was restored to
  the pgAdmin-specific data/config mounts and the node-local pgAdmin entrypoint variables were
  restored with a node-local password file, without committing secrets.
- generic `container.reconcile` should not be run for `pyrosa-pgadmin` until the control model
  supports app-specific mounts for pgAdmin; if it is run, reapply the pgAdmin-specific Quadlet
  layout immediately after.

Post-shutdown validation:

- all primary Pyrosa web runtimes that should be reachable returned from `51.222.204.86`
- `api.pyrosa.com.do`, `erp.pyrosa.com.do`, and `portal.pyrosa.com.do` returned their expected target
  `403` responses
- forced requests to `51.161.11.249:443` failed to connect, confirming the old Apache drain path is
  no longer serving traffic

Rollback, if a hidden dependency appears:

- run `whmapi1 configureservice service=httpd enabled=1 monitored=1` on `vps-old`
- run `systemctl enable --now httpd` on `vps-old`

## vps-old Mail Service Shutdown Drill

Completed on `2026-05-01` after the Apache shutdown drill.

The old cPanel mail-facing services on `vps-old` were stopped for burn-in monitoring. Public MX
records for the migrated domains already point to SimpleHostMan, Zoho, or Microsoft 365.

Operational state:

- `postfix` was inactive and is now masked to prevent accidental startup.
- cPanel `exim` is disabled and unmonitored; `exim.service` is inactive and disabled.
- cPanel `imap` and `pop` are disabled and unmonitored.
- `dovecot.service` is inactive and disabled.
- `/etc/dovecotdisable` is present so Dovecot's systemd condition blocks accidental startup.
- no listeners remain on TCP `25`, `110`, `143`, `465`, `587`, `993`, or `995`.

Post-shutdown validation:

- `postfix`, `dovecot`, and `exim` remained inactive after a delay check
- Pyrosa web smoke checks continued returning `200 OK` from `51.222.204.86`

Rollback, if a hidden dependency appears:

- run `rm -f /etc/dovecotdisable` on `vps-old`
- run `systemctl unmask postfix dovecot exim` on `vps-old`
- run `whmapi1 configureservice service=exim enabled=1 monitored=1` on `vps-old`
- run `whmapi1 configureservice service=imap enabled=1 monitored=1` on `vps-old`
- run `whmapi1 configureservice service=pop enabled=1 monitored=1` on `vps-old`
- run `systemctl enable --now exim dovecot` on `vps-old`

## vps-old Legacy Service Drain

Completed on `2026-05-01` after OpenLDAP was moved into SimpleHostMan and the user confirmed that
`merlelaw.com` would be transferred separately while second-level `www.*` aliases may expire.

Operational state on `vps-old`:

- `code-server.service` is inactive and disabled.
- `pgadmin4.service` is inactive and disabled.
- `pdns.service` is inactive and disabled; `vps-old` no longer answers authoritative DNS on TCP/UDP
  `53`.
- `mysqld.service`, `postgresql-18.service`, and `redis.service` are inactive and disabled.
- cPanel runtime services are inactive and disabled: `cpanel`, `cpanel_php_fpm`, `cpanellogd`,
  `cpdavd`, `cphulkd`, `dnsadmin`, `queueprocd`, `tailwatchd`, `ea-php84-php-fpm`, `sw-engine`,
  `spamd`, `wp-toolkit-background-tasks`, and `wp-toolkit-scheduled-tasks`.
- `crond.service` and `atd.service` are inactive and disabled on `vps-old` to prevent stale legacy
  publishing or cPanel jobs from running during the cancellation window.
- the remaining listeners on `vps-old` are only SSH and base system RPC administration sockets.

Post-drain validation:

- no listeners remain on old production ports `25`, `53`, `80`, `110`, `143`, `389`, `443`, `465`,
  `587`, `636`, `993`, `995`, `3306`, `5432`, `6379`, or `8080`
- querying `@51.161.11.249` for `pyrosa.com.do` and `merlelaw.com` returns connection refused,
  confirming old PowerDNS is down
- SimpleHostMan primary and secondary PowerDNS still answer all primary Pyrosa hostnames with
  `A -> 51.222.204.86`
- public resolvers `1.1.1.1` and `8.8.8.8` answer migrated Pyrosa hostnames at
  `51.222.204.86`; short-lived recursive caches that still remember the old delegation may fail
  until they expire
- forced HTTPS checks for Pyrosa apex, demoportal, repos, demoerp, demosync, LDAP, pgAdmin, code,
  sync, and helpers returned `200 OK` on both SimpleHostMan nodes
- the primary Apache service was found failed during the first smoke pass and was restarted; after
  restart it stayed active and returned `200 OK` for forced HTTPS checks

Rollback, if an unexpected dependency is reported before cancellation:

- re-enable only the affected service on `vps-old` with `systemctl enable --now <unit>`
- if authoritative DNS must be temporarily restored, start `pdns.service` and verify the relevant
  zone serial before relying on it
