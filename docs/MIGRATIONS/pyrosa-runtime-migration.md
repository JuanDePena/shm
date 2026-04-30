# pyrosa.com.do Runtime Migration Plan

Updated on `2026-04-30`.

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
| `pyrosa-wp` | `pyrosa.com.do`, `www.pyrosa.com.do` | `10101` | MariaDB `app_pyrosa_wp` | desired only; not active |
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
| `demoportal.pyrosa.com.do` | `_sites/demoportal.pyrosa.com.do` | `194M` | Laravel app | MySQL `wmpyrosa_synct`, Redis, local mail relay config | candidate after WordPress, likely keep on MariaDB first |
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

1. `demoportal.pyrosa.com.do`: containerized Laravel app, small DB, no large data volume.
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
