# Operational Inspection And Tuning Plan

Inspection date: `2026-05-01`

## Scope

This document records the post-migration operational inspection of the
SimpleHostMan production pair and the phased plan for implementing the
recommended adjustments.

Nodes inspected:

- primary: `vps-3dbbfb0b.vps.ovh.ca`
- secondary: `vps-16535090.vps.ovh.ca`

No runtime configuration changes were applied during the inspection. The
commands were read-only except for status collection.

## Executive Summary

The platform has enough CPU, memory, and disk for the current workload. The
running application containers are stable and use low resources. PostgreSQL
application databases are small and healthy. The control-plane PostgreSQL
cluster is healthy but needs better query observability because cumulative
statistics show heavy temporary-file usage. MariaDB is performing well, but its
buffer pool and temporary-table settings are still conservative for the current
node size.

There is no urgent capacity upgrade recommendation. The next work should focus
on cleanup, observability, small database tuning changes, and a later MariaDB
high-availability plan.

## Capacity Findings

### Primary

Observed primary capacity:

- CPU: `12` vCPU
- load average: about `0.84`, `1.13`, `1.08`
- memory: `45 GiB` total, about `29 GiB` available
- swap: none
- root filesystem: `80G` used out of `299G`, `27%`
- inode usage: about `6%`

Largest storage areas:

- `/opt/simplehostman`: about `38G`
- `/srv/containers`: about `19G`
- `/srv/backups`: about `16G`
- `/srv/containers/mariadb/data`: about `8.8G`
- `/srv/containers/apps/pyrosa-helpers`: about `6.4G`
- `/srv/backups/mail-gomezrosado`: about `7.7G`
- `/opt/simplehostman/release/releases`: `50` releases, most old releases about `908M` each

Podman storage:

- images: `46`
- reclaimable image data: about `2.2G`
- active containers: `26`

### Secondary

Observed secondary capacity:

- CPU: `8` vCPU
- load average: about `0.16`, `0.25`, `0.25`
- memory: `22 GiB` total, about `15 GiB` available
- swap: none
- root filesystem: `34G` used out of `199G`, `17%`
- inode usage: about `2%`

Largest storage areas:

- `/srv/containers`: about `9.3G`
- `/srv/backups`: about `3.4G`
- `/opt/simplehostman`: about `3.2G`
- `/var/log`: about `587M`

Podman storage:

- images: `23`
- reclaimable image data: about `648M`
- active containers: `25`

## Service Findings

### Healthy Services

The main platform services were active:

- `simplehost-control.service`
- `simplehost-worker.service`
- `simplehost-agent.service`
- `httpd.service`
- `pdns.service`
- `postgresql@apps.service`
- `postgresql@control.service`
- `mariadb-primary.service` on primary
- `slapd.service`

Application containers were running on both nodes. Primary also runs the
production `pyrosa-sync` workers:

- `app-pyrosa-sync-worker@scheduler.service`
- `app-pyrosa-sync-worker@workflow-checker.service`
- `app-pyrosa-sync-worker@workflow-resolver.service`
- `app-pyrosa-sync-worker@workflow-runner.service`

### Failed Or Noisy Units

Primary:

- `server-healthcheck.service` was failed because the check exits non-zero when
  the `fail2ban` `sshd` jail has more than `10` currently banned IPs.
- The health report itself had no critical items; it reported a warning for
  about `20` currently banned IPs.

Secondary:

- `postgresql@shp.service` was still present as a failed historical unit from
  before the current `postgresql@apps` and `postgresql@control` split.
- `postgresql@apps.service` and `postgresql@control.service` were active, so
  this is cleanup debt rather than an active database outage.

### Log Findings

Observed log patterns:

- repeated public web scans looking for generic PHP and WordPress files
- repeated SMTP/submission probes and failed SASL attempts, already caught by
  `fail2ban`
- `app-tatokka.service` logged `39` Apache internal redirect recursion errors
  in the prior six-hour window
- `app-pyrosa-pgadmin` logged a small number of `404` requests, consistent with
  manual or scanner access to unknown routes
- secondary `httpd.service` logs repeatedly mention an unset optional `OPTIONS`
  environment variable; this is noisy but not service-breaking

## PostgreSQL Findings

### `postgresql@apps`

Observed state:

- version: PostgreSQL `18.3`
- primary port: `5432`
- physical standby: active over WireGuard
- primary-reported replay lag: `0 bytes`
- databases are small
- cache hit ratios for active app databases: about `99.6%` to `99.98%`
- no deadlocks observed
- no meaningful temporary-file activity observed

Largest application PostgreSQL databases:

- `app_pyrosa_demoerp`: about `28 MB`
- `roundcube_mail`: about `9 MB`
- `app_pyrosa_helpers_dfr`: about `9 MB`

Configuration posture:

- `shared_buffers`: `128 MB`
- `effective_cache_size`: `4 GB`
- `work_mem`: `4 MB`
- `maintenance_work_mem`: `64 MB`
- `max_connections`: `200`
- `track_io_timing`: `off`
- `log_temp_files`: `off`
- `log_min_duration_statement`: `off`

The current values are sufficient for the small app database footprint, but the
cluster is under-tuned relative to the available RAM.

### `postgresql@control`

Observed state:

- version: PostgreSQL `18.3`
- primary port: `5433`
- physical standby: active over WireGuard
- primary-reported replay lag: `0 bytes`
- secondary replay delay was about `5s`
- no deadlocks observed
- cache hit ratio: effectively `100%`

Largest control-plane relations:

- `shp_audit_events`: about `904 MB`
- `shp_reconciliation_runs`: about `254 MB`
- `control_plane_jobs`: about `168 MB`
- `control_plane_job_results`: about `153 MB`
- `shp_sessions`: about `7.5 MB`

Notable statistics:

- `simplehost_control` has about `1.5 GB` of data.
- cumulative temporary file usage reported about `997,694` temp files and
  about `25 TB` temp bytes.
- `pg_stat_statements` is not installed.
- `track_io_timing`, `log_temp_files`, and `log_min_duration_statement` are not
  enabled.

Configuration posture:

- `shared_buffers`: `2 GB`
- `effective_cache_size`: `6 GB`
- `work_mem`: `8 MB`
- `maintenance_work_mem`: `512 MB`
- `max_wal_size`: `4 GB`
- `min_wal_size`: `1 GB`
- `max_connections`: `100`

The control cluster is generally healthy. The main recommendation is to add
query observability before changing indexes or query shapes.

## MariaDB Findings

Observed state:

- version: MariaDB `11.8.6`
- primary-only container: `mariadb-primary`
- listener: `127.0.0.1:3306` and `10.89.0.1:3306`
- no MariaDB standby container was found on secondary
- secondary app containers can reach primary MariaDB over WireGuard

Workload summary:

- `Max_used_connections`: `14`
- `max_connections`: `151`
- `Slow_queries`: `0`
- `Threads_connected`: `6`
- `Threads_running`: `2`
- `Innodb_row_lock_time`: `33 ms`
- `Innodb_row_lock_waits`: `93`
- approximate InnoDB buffer pool hit ratio: `99.96%`

Largest MariaDB databases:

- `app_pyrosa_sync`: about `1.83 GB`
- `app_pyrosa_demosync`: about `58 MB`
- `app_pyrosa_wp`: about `27 MB`
- `app_zcrmt_wp`: about `6 MB`

Configuration posture:

- `innodb_buffer_pool_size`: `128 MB`
- `tmp_table_size`: `16 MB`
- `max_heap_table_size`: `16 MB`
- `innodb_flush_log_at_trx_commit`: `1`
- `sync_binlog`: `1`
- `innodb_flush_method`: `O_DIRECT`
- `slow_query_log`: `off`
- `performance_schema`: `off`
- binary log expiration: `10` days

The current MariaDB performance is acceptable, but `128 MB` buffer pool is too
small for the available primary memory and current `app_pyrosa_sync` size.

## Backup Findings

`pgBackRest` status:

- stanza `control`: `ok`
- stanza `apps`: `ok`
- local repository: `/srv/backups/pgbackrest`
- repository size: about `2.3G`
- latest observed incremental backups completed on `2026-05-01`

The physical PostgreSQL backup posture is functioning.

At inspection time, the generic `simplehost-backup-runner.timer` woke every
minute. A recent run reported:

- no policies executed on primary
- `14` policies skipped
- memory peak between roughly `480M` and `750M`
- CPU time around `13s`

The timer behavior is correct if minute-level scheduling is required, but it is
expensive for idle checks. Phase 1 changed the primary timer to a five-minute
cadence after confirming all live policy schedules align to five-minute
boundaries.

## Documentation Review Findings

The active work surface should remain consolidated in `TODO.md`, with this
document as the linked implementation plan. Migration runbooks under
`docs/MIGRATIONS` may keep historical execution records and conditional
operator notes, but those notes should not read as separate active TODO lists.

Documentation items consolidated into this plan:

- normalize historical migration runbooks so closed cutover notes are titled as
  closure or audit notes instead of open follow-ups
- document the source of truth for apps with more than one database resource,
  especially the Pyrosa DIS/QBO pairings currently represented in live desired
  state
- define an explicit SimpleHostMan package publishing workflow for
  `repos.pyrosa.com.do` if Proyecto Iohana RPM releases resume
- keep historical domain-specific audit checks out of `TODO.md` unless a new
  incident, user report, or operational audit reopens them
- keep older hardening notes as historical references, with active security and
  resilience follow-up tracked here instead of in separate document-local lists

## Recommended Phased Plan

### Phase 0: Baseline And Documentation

Status: completed on `2026-05-01`.

Completion evidence:

- inspection findings and recommendations preserved in this runbook
- `TODO.md` points to this document as the only active operational plan
- historical migration and hardening notes were normalized so they no longer
  read as separate open TODO lists
- documentation-only commit pushed to `origin/main`:
  `e2a7b40 docs: consolidate operational follow-ups`

Actions:

- preserve the inspection evidence and recommendations
- keep this document linked from the active TODO tracker
- keep migration-specific historical notes out of the active TODO list unless
  they are intentionally re-opened here
- do not apply tuning until the current migration burn-in period is stable

Validation:

- worktree contains documentation only
- no secrets included
- `TODO.md` links only to this active operational plan

Rollback:

- revert documentation commit only

### Phase 1: Low-Risk Operational Cleanup

Status: completed on `2026-05-01`.

Goal: remove stale failure signals and reduce obvious operational noise.

Actions:

- remove or disable the obsolete `postgresql@shp.service` unit on secondary
- adjust `server-healthcheck` behavior so a high `fail2ban` ban count remains a
  warning but does not leave the systemd unit failed, or raise
  `FAIL2BAN_WARN_BANNED`
- review `app-tatokka` Apache and app rewrite rules for the redirect recursion
  errors
- reduce `simplehost-backup-runner.timer` frequency to `5` or `15` minutes if
  minute-level backup policy matching is not required
- define release retention for `/opt/simplehostman/release/releases`, keeping
  the active release plus the latest `5` to `10` releases
- perform a dry-run cleanup inventory for old Podman images before pruning

Validation:

- `systemctl --failed` has no stale PostgreSQL unit on secondary
- `server-healthcheck --report` shows no critical findings
- `journalctl -u app-tatokka.service --since '6 hours ago'` no longer shows
  recurring redirect-loop errors after the fix
- `simplehost-backup-runner.timer` still runs and executes matching policies
- active release symlink still points to `/opt/simplehostman/release/releases/2604.28.18`

Rollback:

- re-enable the previous timer frequency
- restore the prior healthcheck threshold or unit behavior
- leave old release directories untouched until rollback confidence is high

Completion evidence:

- `postgresql@shp.service` on `secondary` was disabled and reset; it now reports
  `disabled` and `inactive`.
- `server-healthcheck.service` now has `SuccessExitStatus=1`, so warning-only
  runs no longer leave the unit failed.
- The healthcheck script now checks `valkey` instead of the absent `redis`
  service name, matching the installed Redis-compatible service.
- Primary healthcheck report has no critical findings; the only observed issue
  was the `fail2ban` banned-count warning.
- Secondary healthcheck report exits `0` with no critical findings.
- `systemctl --failed` reports `0` loaded failed units on both nodes after the
  cleanup.
- `simplehost-backup-runner.timer` now wakes every `5` minutes on the primary.
  All `14` live backup policy schedules use minute values aligned to that
  cadence.
- Secondary keeps `simplehost-backup-runner.timer` disabled/inactive, matching
  the current standby posture.
- Tatokka rewrite rules were adjusted on both nodes so missing scanner paths
  return `404` instead of recursing through `public/public/...`.
- Tatokka validation on both nodes:
  - `/` returns `200`
  - `/dev/?page=login` returns `200`
  - `/robots.txt` returns `404`
  - `/.env` returns `404`
  - no `AH00124` recursion log was emitted by the validation requests
- Release retention dry-run:
  - primary has `50` release directories; keeping the latest `10` leaves `40`
    candidates, approximately `29G`
  - secondary has `4` release directories; no candidates under the latest-`10`
    policy
  - no release directory was deleted in this phase
- Podman image cleanup dry-run:
  - primary reports `46` images, `9` active, about `2.2G` reclaimable, and `3`
    inactive image IDs
  - secondary reports `23` images, `8` active, about `648M` reclaimable, and `0`
    inactive image IDs
  - no Podman image prune was run in this phase

### Phase 2: Database Observability

Goal: collect real query and temporary-file evidence before deeper tuning.

PostgreSQL actions:

- enable `pg_stat_statements` on `postgresql@control`
- consider enabling `pg_stat_statements` on `postgresql@apps`
- set `track_io_timing=on`
- set `log_temp_files=65536` on `postgresql@control` initially
- set `log_min_duration_statement=1000` on `postgresql@control`
- increase `track_activity_query_size` from `1024` bytes to at least `4096`

MariaDB actions:

- enable `slow_query_log`
- set `long_query_time=1` or `2`
- enable `performance_schema` for an observation window, if acceptable

Validation:

- PostgreSQL restarts or reloads cleanly as required
- `pg_stat_statements` appears in `pg_extension`
- slow PostgreSQL and MariaDB logs are written to the expected log path
- no sensitive query payload is copied into Git

Rollback:

- disable query logging if log volume becomes excessive
- remove `pg_stat_statements` from `shared_preload_libraries` and restart
  during a maintenance window if needed

### Phase 3: Conservative Database Tuning

Goal: use available memory more effectively while staying safely below system
capacity.

PostgreSQL `apps` actions:

- raise `shared_buffers` from `128 MB` to `512 MB`
- raise `effective_cache_size` from `4 GB` to `8 GB`
- raise `maintenance_work_mem` from `64 MB` to `256 MB`
- keep `work_mem` conservative until query evidence exists

PostgreSQL `control` actions:

- keep `shared_buffers=2GB` and `maintenance_work_mem=512MB`
- consider raising `effective_cache_size` from `6GB` to `16GB` on primary after
  observation
- tune specific indexes or queries only after `pg_stat_statements` evidence

MariaDB actions:

- raise `innodb_buffer_pool_size` from `128 MB` to `1 GB`
- raise `tmp_table_size` and `max_heap_table_size` from `16 MB` to `64 MB`
- keep `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1`

Validation:

- PostgreSQL replication remains streaming
- MariaDB starts cleanly and reports the new buffer pool size
- application smoke checks pass for WordPress, demoportal, sync, demosync, and
  any other MariaDB-backed apps
- no increase in OOM, swap pressure, or IO wait

Rollback:

- restore previous config files
- restart the affected engine
- re-run app smoke checks

### Phase 4: Data Growth And Retention Controls

Goal: prevent control-plane history from becoming the next capacity problem.

Actions:

- define retention policy for `shp_audit_events`
- define retention policy for `shp_reconciliation_runs`
- define retention policy for `control_plane_jobs` and
  `control_plane_job_results`
- evaluate partitioning for high-volume history tables if retention must remain
  long
- review large low-scan indexes after `pg_stat_statements` and normal workload
  evidence are available
- document retention for `/srv/backups/mail-gomezrosado` because that path is
  currently a large backup consumer
- decide how `apps.bootstrap.yaml` should represent apps with multiple managed
  databases, including the Pyrosa DIS/QBO secondary databases
- define a managed publication workflow for `repos.pyrosa.com.do` before new
  Proyecto Iohana RPM packages are published through SimpleHostMan

Validation:

- retained history still satisfies audit and support requirements
- table sizes stop growing unbounded
- dashboard and audit views still load correctly
- restore tests still pass after backup retention changes
- bootstrap inventory regeneration has an explicit rule for multi-database apps
- repository publishing has an owner, trigger, validation checklist, and rollback
  path before it is reactivated

Rollback:

- pause pruning jobs
- restore from pgBackRest or logical backup if pruning is accidentally too
  aggressive

### Phase 5: Resilience And Failover Improvements

Goal: reduce single points of failure that remain after the vps-old retirement.

Actions:

- add a small swap or `zram` layer on both nodes
- design MariaDB replication from primary to secondary
- define MariaDB promotion and app repoint procedure
- add a restore-test calendar for PostgreSQL, MariaDB, app files, and mail
  backups
- document expected failover posture for MariaDB-backed apps because secondary
  currently reaches primary MariaDB over WireGuard
- review administrative access hardening: non-root sudo administration,
  break-glass-only root usage, the code-server SSH tunnel exception, and any
  source-IP SSH restriction that is practical for the operator workflow
- confirm the OS security-update cadence and whether it should be automated
- add code-server data and server configuration to the restore-test calendar
- revisit mail-related `fail2ban` packaging cleanup only after the current
  healthcheck threshold behavior is settled

Validation:

- MariaDB replica catches up after controlled writes
- documented promotion can be rehearsed on a non-production dataset
- restore tests produce usable application data
- failover documentation clearly identifies manual steps and expected RPO/RTO
- administrative access changes preserve a documented break-glass path
- security-update automation has a rollback or hold procedure before it is
  enabled

Rollback:

- stop replica services and return applications to primary MariaDB
- remove swap/zram only after confirming no memory pressure exists

## Recommended Implementation Order

1. Phase 1 cleanup, because it removes false alarms and low-risk noise.
2. Phase 2 observability, because it turns later tuning into measured work.
3. Phase 3 conservative tuning, starting with MariaDB buffer pool and temporary
   table limits.
4. Phase 4 retention, once control-plane history requirements are confirmed.
5. Phase 5 resilience, because MariaDB high availability is the largest design
   change and deserves its own maintenance window.

## Do Not Do Yet

- Do not increase VPS size; current capacity is sufficient.
- Do not drop large control-plane indexes only because `idx_scan` is low in the
  current stats snapshot.
- Do not prune audit or job history until a retention requirement is approved.
- Do not enable automatic database failover in the current two-node topology
  without a quorum design.
