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

## Restore validation

Minimum restore checks:

- restore one recent app file archive into a scratch path and compare expected
  files
- restore one `app_adudoc` dump into a scratch database
- restore one `simplehost_control` dump into a scratch database on a non-live
  port
- record the backup run id, artifact paths, restore target, and validation time

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
