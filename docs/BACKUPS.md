# Backup Runbook

Date drafted: 2026-04-27

## Scope

This runbook records the SimpleHostMan backup policy conventions for customer
apps, tenant databases, mail domains, and the local control-plane PostgreSQL
database.

The passive secondary is not a backup replacement. Backups must eventually be
copied to a separate failure domain.

## Policy model

Backup policies are declared in SimpleHostMan desired state with:

- policy slug
- tenant slug
- target node
- cron schedule
- retention in days
- storage location
- resource selectors

The root-owned `simplehost-backup-runner.timer` wakes every five minutes and
only executes policies whose cron expression matches that minute on the local
target node. Backup policy schedules should therefore use minutes aligned to the
five-minute cadence unless the timer is intentionally moved back to minute-level
polling.

Backup storage directories are kept at `0700` and generated artifacts at `0600`
because database dumps and globals files can contain sensitive application data,
role metadata, or password hashes.

## Selector conventions

Supported selectors:

- `mail-stack`
- `mail-domain:<domain>`
- `app:<slug>` for application database coverage
- `database:<app-slug>` or `database:<database-name>` for database coverage
- `app-files:<slug>` for the app bind mount at `/srv/containers/apps/<slug>`
- `storage-root:<slug>` as an alias for app bind mount coverage
- `postgresql-cluster:control` for a logical dump of `postgresql@control`
- `code-server` for the host-level root `code-server` config, user data,
  profiles, and extensions
- `iam:authentik` or `host-service:authentik` for Authentik IAM files,
  root-only secrets, recovery codes, and the `app_authentik` PostgreSQL
  database

Use explicit selectors for file backups. Existing mail policies may include
`tenant:<slug>` for traceability, but `tenant:<slug>` does not by itself trigger
application file archives.

## Pilot policies

### `adudoc`

Database:

- `db-adudoc-daily`
- schedule: `0 1 * * *`
- retention: `14` days
- storage: `/srv/backups/databases/adudoc`
- selectors: `app:adudoc`, `database:app_adudoc`

Application files:

- `files-adudoc-daily`
- schedule: `10 2 * * *`
- retention: `14` days
- storage: `/srv/backups/apps/adudoc`
- selectors: `app-files:adudoc`

Mail:

- `mail-adudoc-daily`
- schedule: `0 3 * * *`
- retention: `14` days
- storage: `/srv/backups/mail-adudoc`
- selectors: `mail-stack`, `mail-domain:adudoc.com`, `tenant:adudoc`

### `gomezrosado`

Application files:

- `files-gomezrosado-daily`
- schedule: `20 2 * * *`
- retention: `14` days
- storage: `/srv/backups/apps/gomezrosado`
- selectors: `app-files:gomezrosado`

Mail:

- `mail-gomezrosado-daily`
- schedule: `30 3 * * *`
- retention: `14` days
- storage: `/srv/backups/mail-gomezrosado`
- selectors: `mail-stack`, `mail-domain:gomezrosado.com.do`, `tenant:gomezrosado`

Phase 4 retention review on `2026-05-01`:

- `/srv/backups/mail-gomezrosado` used about `7.7G`.
- The oldest observed retained run was from `2026-04-25`, so the `14` day
  retention window had not started expiring this backup set yet.
- Keep the policy at `14` days unless a restore requirement explicitly needs a
  longer mail-history window.

`gomezrosado` is currently treated as a static website workload. If a live
application database is added again, declare a separate database policy rather
than folding it into the file policy.

### Control Plane

Logical control database:

- `control-postgresql-logical-daily`
- schedule: `40 2 * * *`
- retention: `14` days
- storage: `/srv/backups/postgresql-control/logical`
- selectors: `postgresql-cluster:control`

This produces a custom-format dump of `simplehost_control` and a globals-only
dump for roles. It does not replace the required physical backup plus WAL
archive posture for the `postgresql@control` cluster.

### Host code-server

Primary:

- `code-server-primary-daily`
- schedule: `20 4 * * *`
- retention: `14` days
- storage: `/srv/backups/code-server/primary`
- selectors: `code-server`

Secondary:

- `code-server-secondary-daily`
- schedule: `25 4 * * *`
- retention: `14` days
- storage: `/srv/backups/code-server/secondary`
- selectors: `code-server`

The archive includes:

- `/root/.config/code-server`
- `/root/.local/share/code-server/User`
- `/root/.local/share/code-server/Machine`
- `/root/.local/share/code-server/CachedProfilesData`
- `/root/.local/share/code-server/extensions`
- `/root/.local/share/code-server/coder.json`
- `/root/.local/share/code-server/machineid`

The archive intentionally excludes transient sockets, logs, heartbeat files and
extension cache directories.

### Authentik IAM

Primary:

- `iam-authentik-primary-daily`
- schedule: `35 4 * * *`
- retention: `14` days
- storage: `/srv/backups/iam/authentik/primary`
- selectors: `iam:authentik`, `host-service:authentik`

The backup includes:

- `/etc/simplehost/iam/authentik`
- `/srv/containers/iam/authentik`
- a custom-format logical dump of `app_authentik`
- a globals-only dump from the PostgreSQL apps cluster

The root-only config archive includes Authentik runtime secrets and recovery
codes, so this policy must remain on root-owned storage with artifact mode
`0600`.

## Restore validation

Minimum restore checks:

- restore one recent app file archive into a scratch path and compare expected
  files
- restore one `app_adudoc` dump into a scratch database
- restore one `simplehost_control` dump into a scratch database on a non-live
  port
- record the backup run id, artifact paths, restore target, and validation time

## Restore-Test Calendar

Phase 5 resilience review on `2026-05-02` set the restore-test cadence below.
Record each execution with the backup run id, artifact path, scratch target,
validation result, and cleanup evidence.

Monthly:

- restore `simplehost_control` logical dump into a scratch database
- restore one PostgreSQL app database dump or pgBackRest clone into scratch
  storage
- restore one MariaDB logical dump into a scratch MariaDB instance or container
- restore one app file archive into a scratch path and compare expected files
- restore Authentik files plus `app_authentik` into scratch targets
- restore one mail-domain backup sample, including Maildir and DKIM/runtime
  config metadata
- restore code-server config, user data and extensions into a scratch path:
  - `/root/.config/code-server`
  - `/root/.local/share/code-server/User`
  - `/root/.local/share/code-server/extensions`

Quarterly:

- rehearse PostgreSQL apps and control restore from pgBackRest into non-live
  targets
- rehearse MariaDB replica seed or promotion on non-production data
- rehearse a full app recovery path for one MariaDB-backed app and one
  PostgreSQL-backed app

Annual or after material infrastructure changes:

- rehearse cross-node recovery using the off-host pgBackRest mirror
- review whether the interim off-host mirror should move to object storage in a
  separate provider or region

### Execution record: 2026-05-02

Restore-test id: `20260502T031956Z`.

Operational notes:

- PostgreSQL custom dumps generated by PostgreSQL `18` require
  `/usr/pgsql-18/bin/pg_restore`. The system `/usr/bin/pg_restore` is
  PostgreSQL `16.13` and cannot read the current dump format.
- Database dumps are stored below root-only backup directories. For restore
  tests, copy the selected dump to a temporary `postgres:postgres` staging path
  such as `/var/lib/pgsql/restore-tests/<run-id>/`, then delete that staging
  path after validation.

Validated artifacts:

- `simplehost_control` logical dump:
  `/srv/backups/postgresql-control/logical/control-postgresql-logical-daily-2026-05-02T02-40-07-916Z/simplehost_control.dump`
  - scratch database: `restoretest_control_20260502t031956z`
  - restored tables: `34`
  - restored apps: `21`
  - restored databases: `11`
  - restored mail domains: `8`
  - cleanup: scratch database dropped
- PostgreSQL app database dump:
  `/srv/backups/databases/adudoc/db-adudoc-daily-2026-05-02T01-00-14-851Z/app_adudoc.dump`
  - scratch database: `restoretest_adudoc_20260502t031956z`
  - restored tables: `14`
  - cleanup: scratch database dropped
- Roundcube/webmail database dump:
  `/srv/backups/mail-adudoc/mail-adudoc-daily-2026-05-02T03-00-09-675Z/roundcube_mail.dump`
  - scratch database: `restoretest_roundcube_20260502t031956z`
  - restored tables: `19`
  - cleanup: scratch database dropped
- MariaDB logical dump:
  `/srv/backups/databases/pyrosa-wp/db-pyrosa-wp-daily-2026-05-02T01-45-18-312Z/app_pyrosa_wp.sql`
  - scratch target: transient `mariadb:11.8.6` container
  - restored tables: `55`
  - restored `wppy_options` rows: `523`
  - cleanup: transient container and scratch datadir removed
- App file archive:
  `/srv/backups/apps/gomezrosado/files-gomezrosado-daily-2026-05-02T02-20-09-014Z/gomezrosado-files.tar.gz`
  - scratch target: `/srv/restore-tests/20260502T031956Z/app-files-gomezrosado`
  - expected files validated: `index.html`, `assets/site.css`,
    `migration-source.txt`
  - restored file count: `48`
  - cleanup: scratch path removed
- Mail runtime archive:
  `/srv/backups/mail-adudoc/mail-adudoc-daily-2026-05-02T03-00-09-675Z/mail-runtime.tar.gz`
  - scratch target: `/srv/restore-tests/20260502T031956Z/mail-adudoc`
  - validated Maildirs: `webmaster`, `notificaciones`
  - validated DKIM files: `mail.key`, `mail.dns.txt`
  - validated runtime config: Postfix domains and Dovecot simplehost config
  - restored file count: `67`
  - restored message count: `9`
  - cleanup: scratch path removed
- Code-server config and user settings:
  `/srv/backups/code-server/manual-restore-test-20260502T031956Z/code-server-root-config.tar.gz`
  - no scheduled code-server backup artifact existed at test time
  - manual root-only artifact mode: `0600`
  - restored and byte-compared:
    `/root/.config/code-server/config.yaml` and
    `/root/.local/share/code-server/User/settings.json`
  - cleanup: scratch path removed
  - later cleanup: the manual artifact was removed after scheduled
    `code-server` backup policies were implemented and validated on
    `2026-05-02`

### Execution record: 2026-05-02 code-server scheduled policies

The `code-server` selector was added to the SimpleHostMan backup runner and
validated with forced runs on both nodes.

Validated artifacts:

- Primary:
  `/srv/backups/code-server/primary/code-server-primary-daily-2026-05-02T04-52-03-421Z/code-server-root.tar.gz`
  - archive size: about `100M`
  - manifest:
    `/srv/backups/code-server/primary/code-server-primary-daily-2026-05-02T04-52-03-421Z/manifest.json`
- Secondary:
  `/srv/backups/code-server/secondary/code-server-secondary-daily-2026-05-02T04-53-15-551Z/code-server-root.tar.gz`
  - archive size: about `64M`
  - manifest:
    `/srv/backups/code-server/secondary/code-server-secondary-daily-2026-05-02T04-53-15-551Z/manifest.json`

Control-plane backup run records for `code-server-primary-daily` and
`code-server-secondary-daily` both completed with `succeeded`.

### Execution record: 2026-05-02 Authentik IAM policy

The `iam:authentik` selector was added to the SimpleHostMan backup runner and
validated with a forced run on the primary.

Backup policy:

- `iam-authentik-primary-daily`
- schedule: `35 4 * * *`
- retention: `14` days
- storage: `/srv/backups/iam/authentik/primary`
- selectors: `iam:authentik`, `host-service:authentik`

Validated artifacts:

- run id:
  `backup-run-f1cd328b-92db-4959-8721-d15565922056`
- run directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-23-15-154Z`
- artifacts:
  - `authentik-files.tar.gz`
  - `app_authentik.dump`
  - `postgresql-apps-globals.sql`
  - `manifest.json`
- artifact modes: `0600`
- run status: `succeeded`

Restore-test id: `20260502T062345Z`.

- scratch database: `restoretest_authentik_20260502t062345z`
- restored tables: `212`
- restored users: `3`
- confirmed TOTP devices: `1`
- confirmed static/recovery-code devices: `1`
- remaining static/recovery-code tokens: `10`
- scratch file target:
  `/srv/restore-tests/20260502T062345Z/authentik-files`
- validated restored paths:
  - `/etc/simplehost/iam/authentik/authentik.env`
  - `/etc/simplehost/iam/authentik/recovery-codes-webmaster-pyrosa-20260502.txt`
  - `/srv/containers/iam/authentik/data`
  - `/srv/containers/iam/authentik/certs`
  - `/srv/containers/iam/authentik/custom-templates`
- cleanup: scratch database, staging directory, and scratch file target removed

Final cleanup evidence:

- no `restoretest_*` PostgreSQL databases remained on ports `5432` or `5433`
- no restore-test MariaDB containers remained
- `/srv/restore-tests/20260502T031956Z` was removed
- `/srv/restore-tests/20260502T062345Z` was removed
- `/var/lib/pgsql/restore-tests/20260502T062345Z` was removed

Post-enforcement Authentik backup on `2026-05-02`:

- run id:
  `backup-run-3db0fd3e-7651-402a-b7d4-deb894c7195e`
- run directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-43-23-095Z`
- run status: `succeeded`
- artifacts remained mode `0600`
- scratch database `restoretest_authentik_phase4_20260502t0643z` validated:
  - `1` `code-pyrosa` application
  - `1` `https://code.pyrosa.com.do` proxy provider
  - `1` embedded-outpost/provider link
  - `1` MFA-required validation stage
- scratch database and temporary dump copy were removed.

## Physical PostgreSQL Backups

`pgBackRest` is the physical backup and WAL archive layer for both host-native
PostgreSQL clusters:

- stanza `control`: `/var/lib/pgsql/control/data`, port `5433`
- stanza `apps`: `/var/lib/pgsql/apps/data`, port `5432`
- local repository: `/srv/backups/pgbackrest`

The active primary uses `archive_command` with `pgbackrest archive-push`.
Standby configs use `pgbackrest archive-get` so archive recovery can use the
same repository format when a repository copy is present on the standby.

Systemd schedule:

- `simplehost-pgbackrest-control-full.timer`: Sundays at `04:05 UTC`
- `simplehost-pgbackrest-control-incr.timer`: Mondays through Saturdays at `04:05 UTC`
- `simplehost-pgbackrest-apps-full.timer`: Sundays at `04:35 UTC`
- `simplehost-pgbackrest-apps-incr.timer`: Mondays through Saturdays at `04:35 UTC`
- `simplehost-pgbackrest-offhost-sync.timer`: daily at `05:30 UTC`

Retention:

- keep `2` full backups per stanza
- let pgBackRest expire archive according to the full-backup retention window

Useful checks:

```bash
sudo -u postgres pgbackrest --stanza=control check
sudo -u postgres pgbackrest --stanza=apps check
sudo -u postgres pgbackrest info
```

## Off-Host Repository Copy

The off-host sync mirrors `/srv/backups/pgbackrest` with `rsync --delete`.
Configure the target in:

```bash
/etc/simplehost/pgbackrest-offhost.env
```

Current interim target:

```bash
root@51.222.206.196:/srv/backups/offhost/vps-prd/pgbackrest
```

This is useful because it is a different host, but it is not a final offsite
backup posture. A later S3/B2/object-storage repository should be added for a
separate provider or region.
