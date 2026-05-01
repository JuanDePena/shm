# pyrosa.com.do Runtime Migration Plan

Updated on `2026-05-01`.

This document records the read-only inspection of `pyrosa.com.do` on
`root@vps-old.pyrosa.com.do` and the proposed execution plan for migrating selected web runtimes
into SimpleHostMan.

Public mail is hosted on Microsoft 365. No legacy cPanel mailboxes should be migrated and no
SimpleHostMan mail domain should be created for `pyrosa.com.do`.

## Guardrails

- Keep `sync.pyrosa.com.do` on `vps-old` during period close.
- Keep `helpers.pyrosa.com.do` on `vps-old` during period close.
- Treat `repos.pyrosa.com.do` as package distribution infrastructure for SLES/RPM consumers of the
  Proyecto Iohana packages, not as a simple static site.
- Preserve Microsoft 365 MX, SPF, DKIM, Autodiscover, and DMARC records.
- Cut over one hostname at a time after local `--resolve` validation.
- Do not publish secrets from copied configs into this repository.

## Current SimpleHostMan Desired State

`bootstrap/apps.bootstrap.yaml` already defines:

| App | Hostnames | Backend | Database | Status |
| --- | --- | ---: | --- | --- |
| `pyrosa-wp` | `pyrosa.com.do`, `www.pyrosa.com.do` | `10101` | MariaDB `app_pyrosa_wp` | phase 1 runtime active on primary and secondary |
| `pyrosa-demoportal` | `demoportal.pyrosa.com.do` | `10103` | MariaDB `app_pyrosa_demoportal` | phase 2 runtime active on primary and secondary |
| `pyrosa-sync` | `sync.pyrosa.com.do` | `10102` | MariaDB `app_pyrosa_sync`, pending PostgreSQL | desired only; do not migrate now |

The target node public IP for migrated web hostnames is `51.222.204.86`.

## Legacy Inventory

Legacy public IP: `51.161.11.249`.

| Hostname | Source path / role | Size | Runtime or service | Data dependencies | Proposed posture |
| --- | --- | ---: | --- | --- | --- |
| `pyrosa.com.do` / `www` | `/home/wmpyrosa/public_html` | WordPress root about `556M`; full account tree includes `_sites` | WordPress `6.9.4`, PHP 8.4 | MySQL `wmpyrosa_2024`, about `29M` | migrate first as `pyrosa-wp`; keep WordPress on MariaDB |
| `api.pyrosa.com.do` | `_sites/api.pyrosa.com.do` | `346M` | PHP plus Node helper tree | external MongoDB URI and external HANA/SAP endpoint | migrate only after external connectivity and secret handling review |
| `code.pyrosa.com.do` | proxy, not document root content | empty docroot | `code-server` on `0.0.0.0:8080` | service account/runtime on old host | keep on `vps-old` unless intentionally rebuilding developer tooling |
| `demoerp.pyrosa.com.do` | `_sites/demoerp.pyrosa.com.do/htdocs` | `267M` htdocs; about `2.0G` tree | Dolibarr-style PHP app | PostgreSQL `dolibarr_demoerp` on PostgreSQL 18 | migrate after a dedicated PostgreSQL dump/restore test |
| `demoportal.pyrosa.com.do` | `_sites/demoportal.pyrosa.com.do` | `194M` source; `79M` staged without `node_modules`/logs | Laravel 12 app | MySQL `wmpyrosa_synct`, Redis/local mail settings observed in legacy env | migrated in phase 2 as `pyrosa-demoportal`, kept on MariaDB |
| `demosync.pyrosa.com.do` | `_sites/demosync.pyrosa.com.do` | `88M` | DIS/QBO demo app | MySQL `wmpyrosa_disdemo` and shared `wmpyrosa_qbo` | defer with the sync family unless explicitly approved |
| `erp.pyrosa.com.do` | `_sites/erp.pyrosa.com.do` | empty | placeholder | none observed | leave DNS on old or create placeholder app later |
| `helpers.pyrosa.com.do` | `_sites/helpers.pyrosa.com.do` | `6.6G` | helper tools; Apache proxy path to `localhost:3333` configured | PostgreSQL `do_fiscal_reports`; active cron jobs | do not migrate now |
| `ldap.pyrosa.com.do` | `_sites/ldap.pyrosa.com.do` | `91M` | LDAP Account Manager style UI | OpenLDAP on `389`/`636` | keep on `vps-old` unless planning directory migration |
| `pgadmin.pyrosa.com.do` | proxy, not document root content | empty docroot | pgAdmin4 on `127.0.0.1:5050` | PostgreSQL admin surface | keep on `vps-old` with PostgreSQL until DB estate is moved |
| `portal.pyrosa.com.do` | `_sites/portal.pyrosa.com.do` | empty | placeholder | none observed | leave DNS on old or create placeholder app later |
| `repos.pyrosa.com.do` | `_sites/repos.pyrosa.com.do` | `574M` | SLES/Yum RPM repository | `sbotools` repo metadata and signed package metadata | migrate as a static package repo only with zypper/yum validation |
| `sync.pyrosa.com.do` | `_sites/sync.pyrosa.com.do` | `4.1G` | DIS/QBO production app and active PHP workers | MySQL `wmpyrosa_dis` about `3.8G`, `wmpyrosa_qbo`, Redis | do not migrate now |

## Database Inventory

MySQL:

| Database | Approx size | Observed consumers |
| --- | ---: | --- |
| `wmpyrosa_dis` | `3.8G` | `sync.pyrosa.com.do` |
| `wmpyrosa_disdemo` | `57M` | `demosync.pyrosa.com.do` |
| `wmpyrosa_2024` | `29M` | WordPress apex |
| `wmpyrosa_synct` | `0.5M` | `demoportal.pyrosa.com.do` |
| `wmpyrosa_qbo` | `0.2M` | `sync` and `demosync` QBO pieces |

PostgreSQL 18:

| Database | Observed consumer |
| --- | --- |
| `dolibarr_demoerp` | `demoerp.pyrosa.com.do` |
| `do_fiscal_reports` | helper tooling |
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

`helpers.pyrosa.com.do` has active cron-driven jobs and a configured `/dfr/` proxy. No listener on
`:3333` was observed during the spot check, but the helper tree should still remain untouched during
period close.

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
2. Keep `sync`, `helpers`, `repos`, `code`, `pgadmin`, and `ldap` on `vps-old` unless the operator
   explicitly widens scope.
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

Defer until after period close:

- `sync.pyrosa.com.do` and its production DIS/QBO database/worker set.
- `helpers.pyrosa.com.do` and `do_fiscal_reports`.
- `demosync.pyrosa.com.do` if it shares operational assumptions with the sync stack.

Defer until separately approved:

- `code.pyrosa.com.do`.
- `pgadmin.pyrosa.com.do`.
- `ldap.pyrosa.com.do`.

## Open Checks Before Execution

- Confirm whether `repos.pyrosa.com.do` is only read by SLES clients or also written by a publishing
  pipeline on `vps-old`.
- Confirm the next hostname after WordPress: recommended `demoportal`, then `api`, then `demoerp`.
- Decide whether placeholders `erp.pyrosa.com.do` and `portal.pyrosa.com.do` should become blank
  SimpleHostMan apps or remain old-host DNS records.
- Capture a fresh final DB dump timestamp immediately before each cutover.

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
