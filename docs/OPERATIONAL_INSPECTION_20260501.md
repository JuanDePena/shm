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

- `control_plane_audit_events`: about `904 MB`
- `control_plane_reconciliation_runs`: about `254 MB`
- `control_plane_jobs`: about `168 MB`
- `control_plane_job_results`: about `153 MB`
- `control_plane_sessions`: about `7.5 MB`

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

Schema naming note:

- On `2026-05-01`, control database table names were standardized from
  `shp_*` to `control_plane_*`.
- Agent registration state uses `control_plane_agent_nodes` and
  `control_plane_agent_node_credentials`.
- Desired inventory nodes use `control_plane_nodes`.

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

Status: completed on `2026-05-01`.

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

Completion evidence:

- PostgreSQL settings were applied on both `primary` and `secondary` with
  `ALTER SYSTEM`; source-controlled PostgreSQL baseline configs were also
  updated so future rebuilds keep the same conservative sizing.
- `postgresql@control` now has:
  - `shared_preload_libraries = pg_stat_statements`
  - `track_io_timing = on`
  - `track_activity_query_size = 4096`
  - `log_temp_files = 65536`
  - `log_min_duration_statement = 1000`
  - `log_parameter_max_length = 0`
- `postgresql@apps` now has:
  - `shared_preload_libraries = pg_stat_statements`
  - `track_io_timing = on`
  - `track_activity_query_size = 4096`
  - `log_parameter_max_length = 0`
- `pg_stat_statements` extension version `1.12` is available on the control
  database and app database cluster.
- PostgreSQL slow-query logging for `postgresql@control` writes to the service
  journal through `stderr`; live control-plane queries over `1s` were observed.
- Parameter logging was capped with `log_parameter_max_length = 0` so bind
  values are not copied into the journal.
- `postgresql@control.service`, `postgresql@apps.service`,
  `simplehost-control.service`, and `simplehost-worker.service` were active
  after the restart.
- Streaming replication resumed for both PostgreSQL clusters with primary-side
  replay lag reported as `0` bytes.
- MariaDB slow query logging was enabled live and persisted in
  `/srv/containers/mariadb/conf/primary.cnf` and source-controlled
  `platform/mariadb/conf/primary.cnf`.
- MariaDB global values now report:
  - `slow_query_log = ON`
  - `long_query_time = 1`
  - `log_output = FILE`
  - `slow_query_log_file = mariadb-slow.log`
- A controlled `SELECT SLEEP(1.2)` wrote an entry to the MariaDB slow log.
- `performance_schema` remains `OFF`; it is deferred because enabling it
  requires a MariaDB container restart and should be grouped with the phase 3
  tuning window if still needed.
- `systemctl --failed` reported no failed units after the database restarts.

### Phase 3: Conservative Database Tuning

Status: completed on `2026-05-01`.

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

Completion evidence:

- PostgreSQL settings were applied on both `primary` and `secondary` with
  `ALTER SYSTEM`.
- `postgresql@apps` now reports on both nodes:
  - `shared_buffers = 512MB`
  - `effective_cache_size = 8GB`
  - `maintenance_work_mem = 256MB`
  - `work_mem = 4MB`
  - no pending restart
- `postgresql@control` now reports on both nodes:
  - `shared_buffers = 2GB`
  - `effective_cache_size = 16GB`
  - `maintenance_work_mem = 512MB`
  - `work_mem = 8MB`
  - no pending restart
- `postgresql@apps` was restarted on the standby first and then on the primary
  because `shared_buffers` is a postmaster setting. `postgresql@control` only
  required a reload for `effective_cache_size`.
- Streaming replication remained healthy for both PostgreSQL clusters with
  primary-side replay lag reported as `0` bytes.
- MariaDB tuning was persisted in `/srv/containers/mariadb/conf/primary.cnf`
  and source-controlled `platform/mariadb/conf/primary.cnf`.
- `tmp_table_size` and `max_heap_table_size` accepted live changes to `64M`.
  `innodb_buffer_pool_size` required a controlled `mariadb-primary` restart and
  now reports `1073741824` bytes.
- MariaDB durability settings remain unchanged:
  - `innodb_flush_log_at_trx_commit = 1`
  - `sync_binlog = 1`
- `performance_schema` remains `OFF`; the slow query log and PostgreSQL
  `pg_stat_statements` provide the current low-risk evidence surface.
- Primary and secondary HTTPS smoke checks returned `200 OK` for:
  - `https://pyrosa.com.do/`
  - `https://pyrosa.com.do/wp-login.php`
  - `https://demoportal.pyrosa.com.do/login`
  - `https://sync.pyrosa.com.do/dis/public/login`
  - `https://demosync.pyrosa.com.do/dis/public/login`
  - `https://zcrmt.com/`
- `app-pyrosa-sync`, `app-pyrosa-demosync`, and `app-pyrosa-newsync` worker
  families remained active after the MariaDB restart.
- `systemctl --failed` reported no failed units after tuning.
- Memory validation after tuning showed about `28 GiB` available, no swap, and
  `vmstat` reported `0%` IO wait during the post-change sample.

### Phase 4: Data Growth And Retention Controls

Status: completed on `2026-05-01`.

Goal: prevent control-plane history from becoming the next capacity problem.

Actions:

- define retention policy for `control_plane_audit_events`
- define retention policy for `control_plane_reconciliation_runs`
- define retention policy for `control_plane_jobs` and
  `control_plane_job_results`
- evaluate partitioning for high-volume history tables if retention must remain
  long
- review large low-scan indexes after `pg_stat_statements` and normal workload
  evidence are available
- document retention for `/srv/backups/mail-gomezrosado` because that path is
  currently a large backup consumer
- document how PostgreSQL desired-state exports represent apps with multiple
  managed databases, including the Pyrosa DIS/QBO secondary databases
- define a managed publication workflow for `repos.pyrosa.com.do` before new
  Proyecto Iohana RPM packages are published through SimpleHostMan

Validation:

- retained history still satisfies audit and support requirements
- table sizes stop growing unbounded
- dashboard and audit views still load correctly
- restore tests still pass after backup retention changes
- desired-state export and recovery documentation has an explicit rule for
  multi-database apps
- repository publishing has an owner, trigger, validation checklist, and rollback
  path before it is reactivated

Rollback:

- pause pruning jobs
- restore from pgBackRest or logical backup if pruning is accidentally too
  aggressive

Completion evidence:

- Operational history retention is standardized on
  `SIMPLEHOST_HISTORY_RETENTION_DAYS = 90`.
- The purge implementation now covers:
  - `control_plane_audit_events`
  - `control_plane_reconciliation_runs`
  - completed `control_plane_jobs`
  - matching `control_plane_job_results`
- The purge still preserves:
  - the latest job per resource
  - the latest inventory export audit event
  - the latest reconciliation run
- The live parameter description in `control_plane_environment_parameters` now states
  that audit events, reconciliation runs, and completed job history rows share
  the same retention window.
- A live cutoff check for the current 90-day window reported `0` purgeable
  audit, reconciliation, job, and job-result rows because the oldest current
  operational rows are from `2026-03-12`.
- Partitioning is not needed yet. The 90-day retention window bounds the
  current high-volume tables before they justify partition maintenance.
- Large index review found the largest current candidates:
  - `control_plane_audit_events_entity_idx`: about `154 MB`, `0` scans in the current
    stats window
  - `control_plane_reconciliation_runs_pkey`: about `55 MB`, `0` scans in the current
    stats window
  No index was dropped in this phase; these should be rechecked after a longer
  `pg_stat_statements` and retention window.
- `/srv/backups/mail-gomezrosado` retention is documented in
  [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md). The policy remains
  `14` days; the path currently uses about `7.7G`, with the oldest observed
  retained run from `2026-04-25`.
- The Pyrosa DIS/QBO pairings are represented in PostgreSQL desired state with
  explicit managed database entries:
  - `database-pyrosa-sync`
  - `database-pyrosa-sync-qbo`
  - `database-pyrosa-demosync`
  - `database-pyrosa-demosync-qbo`
- The retired bootstrap parser and desired-state builder were previously
  validated against the transitional YAML catalog before PostgreSQL became the
  sole source of truth.
- `pyrosa-helpers-dfr` no longer carries same-engine migration metadata in the
  live desired state.
- `repos.pyrosa.com.do` publication workflow is documented in
  [`REPOSITORY_PUBLISHING.md`](/opt/simplehostman/src/docs/REPOSITORY_PUBLISHING.md).
  It remains a static repository until an explicit audited publishing workflow
  is activated.
- Validation commands passed:
  - `pnpm --filter @simplehost/control-database test`
  - `pnpm --filter @simplehost/control-contracts typecheck`
  - `pnpm --filter @simplehost/worker typecheck`
  - `pnpm --dir apps/control typecheck:web`
  - `pnpm build:control-runtime`
  - `pnpm build:agent-runtime`
  - `pgbackrest --stanza=control check`
  - `pgbackrest --stanza=apps check`
- Release `2604.28.18` was rebuilt and redeployed for control, worker, and
  agent runtime on the primary. The secondary was updated with the same bundle;
  `simplehost-control` and `simplehost-worker` remain inactive there, and
  `simplehost-agent` is active.
- Post-deploy validation showed:
  - primary `simplehost-control`, `simplehost-worker`, and `simplehost-agent`
    active
  - secondary `simplehost-agent` active
  - `systemctl --failed` reporting no failed units on both nodes
  - the worker history-retention log includes
    `deletedReconciliationRunCount`
  - `https://vps-prd.pyrosa.com.do/` returned `200 OK`

### Phase 5: Resilience And Failover Improvements

Status: in progress; phases 5A through 5L completed on `2026-05-02`.

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
- retire legacy secondary `spanel` runtime and align the public control-plane
  vhost with the primary SimpleHost release
- remove stale release directories, legacy runtime archives, and transient
  root-only cleanup backups after validation
- configure conservative OS security-update automation with documented
  hold/rollback procedures
- add scheduled SimpleHostMan backup policy coverage for root `code-server`
  config, user data, profiles and extensions
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

Phase 5A completion evidence on `2026-05-02`:

- A `4G` emergency swapfile was added on both nodes:
  - primary: `/swapfile`, active priority `10`, `0B` used after activation
  - secondary: `/swapfile`, active priority `10`, `0B` used after activation
- `vm.swappiness` was reduced from `30` to `10` on both nodes and persisted in
  `/etc/sysctl.d/90-simplehost-memory.conf`.
- Source baseline for the memory setting is tracked in
  [`platform/host/sysctl/90-simplehost-memory.conf`](/opt/simplehostman/src/platform/host/sysctl/90-simplehost-memory.conf).
- `zram-generator` is not installed on either node, so a swapfile was chosen to
  avoid introducing package changes during the resilience pass.
- MariaDB primary readiness was confirmed:
  - `mariadb-primary` is active on `primary`
  - MariaDB version is `11.8.6`
  - `server_id = 1`
  - binary logging is enabled
  - `gtid_strict_mode = ON`
  - current primary binlog at inspection time:
    `mariadb-bin.000010:207086900`
- At the phase 5A checkpoint, no `mariadb-replica` container was active on the
  secondary yet. Replica activation was intentionally left for a maintenance
  window with backup preflight and rollback.
- Administrative access review found:
  - `PermitRootLogin yes`
  - `PasswordAuthentication yes`
  - user `almalinux` exists on both nodes but is not in `wheel`
  - `code-server@root` is active and bound locally, with Apache proxy exposure
    on `8080`
- Security update review found `dnf-automatic` is not installed and both nodes
  have security updates available, including kernel, OpenSSH, sudo, Node.js,
  rsync, grub and library packages. Automation should not be enabled until a
  rollback/hold procedure is documented.
- MariaDB replication, promotion, restore-test cadence, and administrative
  hardening follow-up are now documented in the active runbooks:
  - [`DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md)
  - [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md)
  - [`HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md)

Phase 5B completion evidence on `2026-05-02`:

- `mariadb-replica` was seeded on the secondary from a prepared
  `mariadb-backup` physical backup.
- Seed id: `20260502T025409Z`.
- Seed backup GTID: `0-1-61870`.
- Source backup position: `mariadb-bin.000010:209333327`.
- Replication account scope:
  - user: `replicator`
  - host: `10.89.0.2`
  - grants: `REPLICATION SLAVE`, `BINLOG MONITOR`
  - secret storage: root-only files under `/etc/simplehost/mariadb-replica/`
    after phase 5I cleanup
- `mariadb-replica` is active on the secondary and published only on
  `127.0.0.1:3306` and `10.89.0.2:3306`.
- Validation after a controlled create/insert/drop probe showed:
  - primary GTID: `0-1-62106`
  - replica GTID: `0-1-62106`
  - `Slave_IO_Running: Yes`
  - `Slave_SQL_Running: Yes`
  - `Seconds_Behind_Master: 0`
  - `read_only = ON`
  - `server_id = 2`
- `super_read_only` was removed from the MariaDB replica config because MariaDB
  `11.8.6` rejects it as an unknown server option in this image.

Phase 5C completion evidence on `2026-05-02`:

- MariaDB promotion was rehearsed against an isolated scratch datadir on the
  secondary. The live `mariadb-replica` service and production apps were not
  promoted or repointed.
- Rehearsal id: `20260502T030524Z`.
- The scratch datadir was created with `mariadb-backup` from the live replica,
  prepared, copied to a temporary path, and started as
  `mariadb-promotion-rehearsal-20260502T030524Z` on
  `127.0.0.1:13306`.
- The scratch server started with `skip-slave-start`, then the promotion
  sequence was executed:
  - `STOP REPLICA`
  - `RESET REPLICA ALL`
  - `SET GLOBAL read_only = OFF`
- The promoted scratch server accepted a controlled write:
  - `server_id = 102`
  - `read_only = 0`
  - local write GTID: `0-102-62376`
  - validation row:
    `20260502T030524Z / isolated MariaDB promotion rehearsal`
- A connection smoke test through the repoint rehearsal port
  `127.0.0.1:13306` returned the validation row.
- Temporary scratch container, datadir, and backup copy were removed after the
  test; `13306` no longer listens.
- The live replica remained healthy after cleanup:
  - `Slave_IO_Running: Yes`
  - `Slave_SQL_Running: Yes`
  - `Seconds_Behind_Master: 0`
  - `Gtid_IO_Pos: 0-1-62433`
- Note: transient `podman run` sidecars launched from SSH on the secondary
  required `--cgroups=disabled` because the host rejected the default eBPF
  device-filter setup. The systemd-managed `mariadb-replica` unit was
  unaffected.

Phase 5D completion evidence on `2026-05-02`:

- Monthly restore-test calendar was executed with restore-test id
  `20260502T031956Z`.
- PostgreSQL control logical restore succeeded from
  `control-postgresql-logical-daily-2026-05-02T02-40-07-916Z`:
  - scratch database: `restoretest_control_20260502t031956z`
  - restored tables: `34`
  - restored apps/databases/mail domains: `21` / `11` / `8`
- PostgreSQL app restore succeeded from `app_adudoc.dump`:
  - scratch database: `restoretest_adudoc_20260502t031956z`
  - restored tables: `14`
- Roundcube/webmail restore succeeded from the `adudoc` mail backup:
  - scratch database: `restoretest_roundcube_20260502t031956z`
  - restored tables: `19`
- MariaDB logical restore succeeded from the `pyrosa-wp` dump:
  - transient MariaDB `11.8.6` container
  - restored tables: `55`
  - restored `wppy_options` rows: `523`
- App file restore succeeded from the `gomezrosado` file archive:
  - expected files validated: `index.html`, `assets/site.css`,
    `migration-source.txt`
  - restored file count: `48`
- Mail runtime restore succeeded from the `adudoc` mail archive:
  - `webmaster` and `notificaciones` Maildirs validated
  - DKIM and runtime Postfix/Dovecot config files validated
  - restored file count: `67`
  - restored message count: `9`
- Code-server config restore was validated from a manual root-only artifact
  because no scheduled code-server backup artifact existed:
  - artifact:
    `/srv/backups/code-server/manual-restore-test-20260502T031956Z/code-server-root-config.tar.gz`
  - files byte-compared after restore:
    `/root/.config/code-server/config.yaml` and
    `/root/.local/share/code-server/User/settings.json`
- Cleanup validation:
  - no `restoretest_*` PostgreSQL databases remained on ports `5432` or `5433`
  - no restore-test MariaDB containers remained
  - `/srv/restore-tests/20260502T031956Z` was removed
- Restore-test operational notes:
  - PostgreSQL custom dumps must be restored with
    `/usr/pgsql-18/bin/pg_restore`, not `/usr/bin/pg_restore`
  - root-only backup artifacts must be copied into a temporary
    `postgres:postgres` staging path before `pg_restore`

Phase 5E completion evidence on `2026-05-02`:

- Routine administration was moved to a tested non-root sudo path:
  - user: `almalinux`
  - sudo: passwordless sudo through `/etc/sudoers.d/90-cloud-init-users`
  - SSH validation: `almalinux` key login plus `sudo -n true` succeeded on
    both nodes
- `almalinux` now has the operator key and both node-operation keys installed
  on both nodes. Tracked fingerprints:
  - `SHA256:8r2X/jTbPpmPmXFvXrAxvUH+6BNKL0pjOMbgPIFNPY8`
    (`vps-root-ed25519-2026`)
  - `SHA256:tpARyU16T3kbPoxFNI3VfXg3RvK5BMOxdVdlxMA7Qrg`
    (`root@vps-3dbbfb0b.vps.ovh.ca`)
  - `SHA256:O3ZhT25KzejEOyTewO6MbAcxhTcOPCmfseBnLOmOoUQ`
    (`root@vps-16535090.vps.ovh.ca`)
- `/etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf` was deployed on
  primary and secondary.
- The temporary primary root-password drop-in
  `/etc/ssh/sshd_config.d/01-vps-prd-root-password.conf` was backed up and
  removed.
- Effective SSH posture after reload:
  - `PermitRootLogin without-password`
  - `PasswordAuthentication no`
  - `KbdInteractiveAuthentication no`
  - `PubkeyAuthentication yes`
  - `X11Forwarding no`
  - `AllowAgentForwarding no`
  - `AllowTcpForwarding no` globally
- Primary root keeps only the local `code-server` tunnel exception:
  - `AllowTcpForwarding local`
  - `PermitOpen 127.0.0.1:8080 localhost:8080`
- Root key break-glass validation succeeded in both directions:
  - primary to secondary
  - secondary to primary
- Password-only SSH attempts were rejected with server methods limited to
  `publickey,gssapi-keyex,gssapi-with-mic`.
- Source-IP SSH restriction remains deferred because the operator source range
  is not documented as stable enough.

Phase 5F completion evidence on `2026-05-02`:

- The legacy node-name code-server reverse proxies were removed:
  - `https://vps-prd.pyrosa.com.do:8080/`
  - `https://vps-des.pyrosa.com.do:8080/`
- The canonical code-server browser endpoint is now
  `https://code.pyrosa.com.do/` on `443`.
- Apache no longer listens publicly on `51.222.204.86:8080` or
  `51.222.206.196:8080`; only the local code-server backends remain on
  `127.0.0.1:8080`.
- `8080/tcp` was removed from the `public` firewalld zone on both nodes.
- Validation after Apache reload:
  - `https://code.pyrosa.com.do/` with `--resolve` to primary redirected to
    `/login`
  - `https://code.pyrosa.com.do/login` with `--resolve` to primary returned
    `200 OK`
  - `https://code.pyrosa.com.do/` with `--resolve` to secondary redirected to
    `/login`
  - `https://code.pyrosa.com.do/login` with `--resolve` to secondary returned
    `200 OK`
  - `https://vps-prd.pyrosa.com.do:8080/` and
    `https://vps-des.pyrosa.com.do:8080/` refused connection
- The source templates, renderer, and firewall desired state were updated so
  reconciliation does not reintroduce public `8080/tcp`.
- The active release on both nodes was hot-patched with the same renderer and
  driver changes, then `simplehost-agent` was restarted and verified active, so
  a `firewall.apply` job cannot re-add `8080/tcp` while this source commit waits
  for the next full release promotion.

Phase 5G completion evidence on `2026-05-02`:

- The 5F hotpatch was formalized as release `2605.02.04`.
- Source version was updated from `2604.28.18` to `2605.02.04` across the
  workspace package manifests and SimpleHost env examples.
- Build validation passed before deployment:
  - `pnpm build:control-runtime`
  - `pnpm build:agent-runtime`
- Primary deployment:
  - `/opt/simplehostman/release/current` points to
    `/opt/simplehostman/release/releases/2605.02.04`
  - `/etc/simplehost/control.env`, `/etc/simplehost/worker.env`, and
    `/etc/simplehost/agent.env` report `SIMPLEHOST_VERSION=2605.02.04`
  - `simplehost-control`, `simplehost-worker`, and `simplehost-agent` are
    active
  - scheduled backup and pgBackRest timers are active
- Secondary deployment:
  - `/opt/simplehostman/release/current` points to
    `/opt/simplehostman/release/releases/2605.02.04`
  - `/etc/simplehost/control.env`, `/etc/simplehost/worker.env`, and
    `/etc/simplehost/agent.env` report `SIMPLEHOST_VERSION=2605.02.04`
  - `simplehost-agent` is active
  - `simplehost-control` and `simplehost-worker` remained inactive by design at
    this checkpoint; the legacy `spanel-web.service` was still serving public
    `:3200`
- Post-release validation:
  - `systemctl --failed` reported no failed units on both nodes
  - active release artifacts no longer contain public `8080/tcp` or
    `VirtualHost *:8080` desired state
  - firewalld public ports remain `3200/tcp 51820/udp` on both nodes
  - Apache remains public on `443` and `3200`; code-server remains local on
    `127.0.0.1:8080`
  - `https://code.pyrosa.com.do/login` returned `200 OK` against primary and
    secondary with `--resolve`
  - `https://vps-prd.pyrosa.com.do:8080/` and
    `https://vps-des.pyrosa.com.do:8080/` refused connection

Phase 5H completion evidence on `2026-05-02`:

- The secondary public control-plane vhost was aligned with the primary naming:
  - `00-spanel-ssl-listen.conf` was replaced by
    `00-simplehost-ssl-listen.conf`
  - `spanel-web.conf` was replaced by `simplehost-control.conf`
  - `simplehost-src-docs-deny.conf` was installed so `/opt/simplehostman/src/docs`
    remains denied through Apache
- Legacy secondary runtime and service units were archived, not deleted:
  - backup created during execution:
    `/root/simplehost-secondary-legacy-cleanup-20260502T041540Z`
    (removed during phase 5I cleanup)
  - `/opt/simplehost` moved to
    `/opt/simplehost.legacy-20260502T041540Z` before final removal in phase 5I
  - `/etc/spanel` moved to `/etc/spanel.legacy-20260502T041540Z` before final
    removal in phase 5I
  - `spanel-web`, `spanel-api`, `spanel-worker`, and `shm-agent` units were
    disabled and moved out of the active systemd unit namespace
- The secondary service account was aligned with the primary unit files:
  - legacy `spanel` user/group was renamed to `simplehost`
  - backup created during execution:
    `/root/simplehost-secondary-user-rename-20260502T041636Z` (removed during
    phase 5I cleanup)
- Secondary `simplehost-control` is now active from
  `/opt/simplehostman/release/current/apps/control/dist/index.js`.
- Secondary `simplehost-control` uses the primary PostgreSQL control database
  through WireGuard at `10.89.0.1:5433`; validation returned
  `simplehost_control|10.89.0.1|f`, confirming it is not connected to the
  standby PostgreSQL instance.
- Secondary `simplehost-worker` remains disabled/inactive intentionally to
  avoid duplicate background execution in the active-passive topology.
- Secondary `simplehost-agent` remains active.
- Validation after Apache reload and service restart:
  - `apachectl -t` returned `Syntax OK`
  - `systemctl --failed` reported no failed units
  - `127.0.0.1:3200` is now served by `simplehost-control`, not by
    `/opt/simplehost/spanel/current`
  - `https://vps-des.pyrosa.com.do:3200/` returned `200 OK`
  - `https://code.pyrosa.com.do/login` with `--resolve` to secondary returned
    `200 OK`
  - `https://vps-des.pyrosa.com.do:8080/` refused connection

Phase 5I completion evidence on `2026-05-02`:

- Release retention was normalized on both nodes:
  - deleted old release directories matching `2604.19.*` and `2604.20.*`
  - retained releases on both nodes: `2604.28.18` and active `2605.02.04`
  - `/opt/simplehostman/release/current` still points to
    `/opt/simplehostman/release/releases/2605.02.04`
- Transient root-only cleanup and migration backup directories were removed
  from `/root` on both nodes.
- MariaDB replication metadata was preserved, but moved out of `/root` to
  `/etc/simplehost/mariadb-replica/` on both nodes:
  - `replication.env`
  - `current-seed-id`
  - `20260502T025409Z.binlog-info`
- Legacy `spanel` and archived SimpleHost paths were removed:
  - no `/opt/simplehost.legacy-*`
  - no `/etc/spanel.legacy-*`
  - no `/etc/.legacy-spanel-*`
  - no `/var/lib/spanel` or `/var/log/spanel`
  - no `spanel`/`shm-agent` disabled unit or vhost leftovers on secondary
  - no disabled or backup vhost leftovers in secondary `/etc/httpd/conf.d`
- Space after cleanup:
  - primary `/`: `88G` used, `211G` available
  - secondary `/`: `37G` used, `163G` available
- Validation after cleanup:
  - primary services active: `simplehost-control`, `simplehost-worker`,
    `simplehost-agent`
  - secondary services active: `simplehost-control`, `simplehost-agent`
  - secondary `simplehost-worker` remains intentionally inactive/disabled
  - `systemctl --failed` reported no failed units on both nodes
  - `https://vps-des.pyrosa.com.do:3200/` returned `200 OK`

Phase 5J completion evidence on `2026-05-02`:

- Conservative OS security-update automation was enabled on both nodes:
  - installed `dnf-automatic`
  - installed `python3-dnf-plugin-versionlock`
  - deployed `/etc/dnf/automatic.conf` from
    [`platform/host/dnf/automatic.conf`](/opt/simplehostman/src/platform/host/dnf/automatic.conf)
  - configured `upgrade_type = security`
  - configured `download_updates = yes`
  - configured `apply_updates = no`
  - configured `reboot = never`
  - enabled and started `dnf-automatic.timer`
- Manual validation ran `dnf-automatic` with download/no-install flags on both
  nodes. Packages were downloaded into cache, but no update transaction was
  applied.
- Package hold and rollback procedures were documented in
  [`HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md).
- `code-server@root` remains the intentional administrative posture:
  - backend remains local on `127.0.0.1:8080`
  - browser endpoint remains `https://code.pyrosa.com.do/`
  - recommended next step is an MFA authentication gateway in front of the
    Apache proxy
- Scheduled `code-server` backup coverage was added to SimpleHostMan:
  - release `2605.02.05` added the `code-server` backup selector
  - primary policy: `code-server-primary-daily`
  - secondary policy: `code-server-secondary-daily`
  - secondary `simplehost-backup-runner.timer` was enabled while
    `simplehost-worker` remains disabled
  - forced validation runs succeeded on both nodes
  - primary archive:
    `/srv/backups/code-server/primary/code-server-primary-daily-2026-05-02T04-52-03-421Z/code-server-root.tar.gz`
  - secondary archive:
    `/srv/backups/code-server/secondary/code-server-secondary-daily-2026-05-02T04-53-15-551Z/code-server-root.tar.gz`
- Deployment posture after release `2605.02.05`:
  - primary: `simplehost-control`, `simplehost-worker`, `simplehost-agent`,
    and `simplehost-backup-runner.timer` active
  - secondary: `simplehost-control`, `simplehost-agent`, and
    `simplehost-backup-runner.timer` active
  - secondary `simplehost-worker` intentionally inactive
- The secondary backup runner was aligned with the primary control-plane job
  secret so it can read encrypted desired-state values from the primary
  PostgreSQL control database. Secret values were not printed or committed.

Phase 5K completion evidence on `2026-05-02`:

- Authentik was selected as the IAM/SSO product for browser-based
  administrative surfaces.
- SSH was explicitly excluded from the Authentik scope and remains governed by
  the existing public-key hardening posture.
- The first protected target remains `https://code.pyrosa.com.do/`.
- The IAM/SSO rollout plan was documented in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md).
- Authentik was classified as a dedicated IAM stack rather than a generic
  `control_plane_apps` record because it needs server, worker, PostgreSQL,
  persistent file storage, and outpost behavior.
- The plan reserves `auth.pyrosa.com.do` and local backend ports
  `10170-10179`, but no live DNS, vhost, database, container, or
  `code-server` proxy change was applied in this design phase.
- The rollout keeps the previous direct `code.pyrosa.com.do` vhost as the
  rollback target and keeps `code-server` own password as a second layer during
  first enforcement.

Remaining Phase 5 maintenance-window items:

- protect `https://code.pyrosa.com.do/` with Authentik and documented
  rollback

Phase 5L completion evidence on `2026-05-02`:

- IAM/SSO phase 1 from
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md) was completed on the
  primary without protecting any existing app.
- Authentik image:
  `ghcr.io/goauthentik/server:2026.2.2`.
- Source-controlled runtime artifacts were added:
  - [`platform/containers/quadlet/authentik-server.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-server.container)
  - [`platform/containers/quadlet/authentik-worker.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-worker.container)
  - [`platform/containers/env/authentik.env.example`](/opt/simplehostman/src/platform/containers/env/authentik.env.example)
- Live runtime files and paths:
  - `/etc/containers/systemd/authentik-server.container`
  - `/etc/containers/systemd/authentik-worker.container`
  - `/etc/simplehost/iam/authentik/authentik.env` with mode `0600`
  - `/srv/containers/iam/authentik`
- PostgreSQL app-cluster state:
  - role: `app_authentik`
  - database: `app_authentik`
  - owner: `app_authentik`
  - public tables after initial migrations: `212`
- Runtime validation:
  - `authentik-server.service` active
  - `authentik-worker.service` active
  - `http://127.0.0.1:10170/` returned `302`
  - `http://127.0.0.1:10170/if/flow/initial-setup/` returned `200`
  - `10170/tcp` listened only on `127.0.0.1`
  - `https://code.pyrosa.com.do/login` still returned `200` through the
    existing direct vhost
  - `systemctl --failed` reported no failed units
- `custom-templates` and `certs` were left traversable by the container user
  because the Authentik server process runs as UID `1000` in the image.
- No DNS record, public Apache vhost, `auth.pyrosa.com.do` publication, or
  `code.pyrosa.com.do` proxy enforcement was applied in this phase.

Phase 5M completion evidence on `2026-05-02`:

- IAM/SSO phase 2 from
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md) published the
  Authentik browser surface on the primary as `https://auth.pyrosa.com.do/`.
- DNS desired state includes `auth.pyrosa.com.do A 51.222.204.86` with
  TTL `300`.
- Primary and secondary DNS sync jobs completed for `pyrosa.com.do`, and both
  authoritative nodes answer `auth.pyrosa.com.do` as `51.222.204.86`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-authentik.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-authentik.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-authentik.conf`
- Runtime validation:
  - `apachectl -t` returned `Syntax OK`
  - `authentik-server.service` active
  - `authentik-worker.service` active
  - `httpd` active
  - `https://auth.pyrosa.com.do/` returned `302` to the default Authentik
    authentication flow
  - certificate verification for `auth.pyrosa.com.do` returned `0`
  - `https://auth.pyrosa.com.do/if/flow/initial-setup/` returned `403`
  - `10170/tcp` listened only on `127.0.0.1`
  - `systemctl --failed` reported no failed units
- The bootstrap admin account uses username/email `webmaster@pyrosa.com.do`,
  is active, is a superuser, and has a usable password. After operator password
  rotation, the temporary initial-password file
  `/etc/simplehost/iam/authentik/akadmin-initial-password` was removed.
- Live Authentik bootstrap password/email values were removed from
  `/etc/simplehost/iam/authentik/authentik.env`, which remains mode `0600`.
- `code.pyrosa.com.do` was not changed in this phase.
- Hold point at phase 5M completion: an operator still had to log in to
  `https://auth.pyrosa.com.do/` as `webmaster@pyrosa.com.do`, enroll admin MFA,
  and create recovery codes before app protection could be enabled.

Phase 5N completion evidence on `2026-05-02`:

- Admin TOTP MFA was enrolled for `webmaster@pyrosa.com.do`.
- Console validation showed:
  - confirmed TOTP devices: `1`
  - total TOTP devices: `1`
  - confirmed static/recovery-code devices: `0`
  - total static/recovery-code devices: `0`
- `authentik-server.service`, `authentik-worker.service`, and `httpd` remained
  active.
- `https://auth.pyrosa.com.do/` continued to return `302` to the default
  Authentik authentication flow.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` remained blocked with
  `403`.
- Remaining hold point at phase 5N completion: create Authentik recovery codes
  for `webmaster@pyrosa.com.do`.

Phase 5O completion evidence on `2026-05-02`:

- Authentik recovery codes were created for `webmaster@pyrosa.com.do`.
- The codes are stored only in the root-only file
  `/etc/simplehost/iam/authentik/recovery-codes-webmaster-pyrosa-20260502.txt`
  with mode `0600`.
- Console validation showed:
  - confirmed TOTP devices: `1`
  - confirmed static/recovery-code devices: `1`
  - remaining static/recovery-code tokens: `10`
- `authentik-server.service`, `authentik-worker.service`, and `httpd` remained
  active.
- `https://auth.pyrosa.com.do/` continued to return `302` to the default
  Authentik authentication flow.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` remained blocked with
  `403`.
- `code.pyrosa.com.do` was not changed in this phase.

Phase 5P completion evidence on `2026-05-02`:

- IAM/SSO phase 3 from
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md) was completed through
  a SimpleHostMan backup policy, not a standalone cron/script.
- The SimpleHostMan backup runner now supports dedicated Authentik selectors:
  `iam:authentik` and `host-service:authentik`.
- Live worker runtime was hot-patched with the updated backup runner and
  `simplehost-worker.service` remained active.
- Backup policy:
  - slug: `iam-authentik-primary-daily`
  - target node: `primary`
  - schedule: `35 4 * * *`
  - retention: `14` days
  - storage: `/srv/backups/iam/authentik/primary`
  - selectors: `iam:authentik`, `host-service:authentik`
- Forced backup run:
  `backup-run-f1cd328b-92db-4959-8721-d15565922056`
- Backup artifacts:
  - `authentik-files.tar.gz`
  - `app_authentik.dump`
  - `postgresql-apps-globals.sql`
  - `manifest.json`
- Artifact mode: `0600`.
- Restore-test id: `20260502T062345Z`.
- Scratch database validation:
  - database: `restoretest_authentik_20260502t062345z`
  - restored tables: `212`
  - restored users: `3`
  - confirmed TOTP devices: `1`
  - confirmed static/recovery-code devices: `1`
  - remaining static/recovery-code tokens: `10`
- Scratch file validation restored expected Authentik config, recovery-code,
  data, certificate, and template paths.
- Scratch database, staging directory, and scratch file target were removed.
- `authentik-server.service`, `authentik-worker.service`,
  `simplehost-worker.service`, `simplehost-backup-runner.timer`, and `httpd`
  remained active.
- No secret values were printed or committed.
- `code.pyrosa.com.do` was not changed in this phase.

Phase 5Q completion evidence on `2026-05-02`:

- IAM/SSO phase 4 from
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md) protected
  `https://code.pyrosa.com.do/` through Authentik on the primary.
- Authentik group `PYROSA Operators` was created and
  `webmaster@pyrosa.com.do` was added.
- Authentik authentication flow `pyrosa-authentication-mfa-required` was
  created with MFA validation set to deny users with no MFA device.
- Authentik Brand `pyrosa.com.do` was created for Pyrosa-owned subdomains:
  - title `PYROSA`
  - logo media `pyrosa/logo-transp-white.png`
  - favicon media `pyrosa/favicon.ico`
  - authentication flow `pyrosa-authentication-mfa-required`
  - custom CSS hides the flow footer links, including `Powered by authentik`
- The flow title was updated to `PYROSA Inicio de Sesión`.
- Authentik Proxy Provider `code.pyrosa.com.do` was created in `proxy` mode
  with external host `https://code.pyrosa.com.do` and internal host
  `http://host.containers.internal:18080`.
- An internal Apache bridge was added on `10.88.0.1:18080` for the Authentik
  container to reach host-local code-server; it proxies to
  `127.0.0.1:8080` and is limited to the Podman subnet.
- Authentik application `code-pyrosa` was created and restricted to
  `PYROSA Operators`.
- The embedded outpost now includes provider `code.pyrosa.com.do`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-code.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code.conf)
- Source-controlled internal Apache bridge:
  [`platform/httpd/vhosts/pyrosa-code-internal-bridge.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code-internal-bridge.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-code.conf`
- Rollback vhost copy:
  `/root/simplehost-rollbacks/pyrosa-code-direct-20260502T063848Z.conf`
- A first Apache attempt returned `404` because `X-Forwarded-Host` was sent as
  a duplicated comma-separated value; the vhost was corrected to let
  `ProxyAddHeaders` set that header once.
- Runtime validation:
  - `apachectl -t` returned `Syntax OK`
  - `https://code.pyrosa.com.do/` returned `302` to the Authentik outpost start
    path
  - `https://code.pyrosa.com.do/login` returned `302` to the Authentik outpost
    start path
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/start?...` returned
    `302` to `https://auth.pyrosa.com.do/application/o/authorize/...`
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/ping` returned `204`
  - `https://auth.pyrosa.com.do/` returned `302`
  - `https://auth.pyrosa.com.do/flows/-/default/authentication/?next=/`
    redirected to `/if/flow/pyrosa-authentication-mfa-required/?next=%2F`
  - `https://auth.pyrosa.com.do/if/flow/pyrosa-authentication-mfa-required/`
    rendered with `<title>PYROSA</title>`, Pyrosa media-backed logo/favicon,
    and no static `Welcome to authentik!` or `Powered by authentik` text
  - the flow executor API returned title `PYROSA Inicio de Sesión`
  - `https://auth.pyrosa.com.do/if/flow/initial-setup/` returned `403`
  - `http://127.0.0.1:8080/login` returned `200` for break-glass validation
  - `http://10.88.0.1:18080/login` returned `200`
  - `http://host.containers.internal:18080/login` returned `200` from inside
    the Authentik container
  - authenticated browser traffic returned `200` for code-server pages and
    `101` for WebSocket upgrade requests through the bridge
- `authentik-server.service`, `authentik-worker.service`,
  `simplehost-worker.service`, and `httpd` remained active.
- Post-enforcement forced backup run
  `backup-run-3db0fd3e-7651-402a-b7d4-deb894c7195e` succeeded.
- Post-bridge-correction forced backup run
  `backup-run-846c771e-a73b-48ea-9153-babc69eccbf6` succeeded.
- Post-bridge-correction backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-58-38-417Z`
- Post-branding forced backup run
  `backup-run-0cb8786b-47f7-4a80-bc56-bfa1e7de299f` succeeded.
- Post-branding backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-13-23-428Z`
- Post-enforcement backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-43-23-095Z`
- Scratch restore database `restoretest_authentik_phase4_20260502t0643z`
  validated:
  - `1` `code-pyrosa` application
  - `1` `https://code.pyrosa.com.do` proxy provider
  - `1` embedded-outpost/provider link
  - `1` MFA-required validation stage
- Scratch database and temporary dump copy were removed.
- No secret values were printed or committed.

## Current Implementation Order

Phases 1 through 4 and phase 5A/5B/5C/5D/5E/5F/5G/5H/5I/5J/5K/5L/5M/5N/5O/5P/5Q are complete.
Continue in this order:

1. Choose the next administrative web surface for IAM protection or define the
   secondary IAM/DR posture.

## Do Not Do Yet

- Do not increase VPS size; current capacity is sufficient.
- Do not drop large control-plane indexes only because `idx_scan` is low in the
  current stats snapshot.
- Do not reduce the current `90` day operational-history retention without an
  explicit support/audit requirement.
- Do not enable automatic database failover in the current two-node topology
  without a quorum design.
