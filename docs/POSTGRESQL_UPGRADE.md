# PostgreSQL Major Upgrade Runbook

Updated on `2026-04-19`.

## Scope

This runbook records and standardizes the PostgreSQL major upgrade path from
PostgreSQL `16.13` to the PostgreSQL `18.x` policy track for both live
host-native clusters:

- `postgresql@control` on port `5433`
- `postgresql@apps` on port `5432`

It covers:

- preparation
- backup and rollback
- failover implications
- validation
- recommended execution order

This document is a major-version runbook. It does not replace the regular
database topology and failover guidance in:

- [DATABASES.md](/opt/simplehostman/src/docs/DATABASES.md)
- [FAILOVER.md](/opt/simplehostman/src/docs/FAILOVER.md)

## Current runtime baseline

As of `2026-04-19`:

- both PostgreSQL clusters are running `18.3`
- both clusters are host-native `systemd` units
- both clusters use primary/standby physical replication over WireGuard
- failover remains manual by design
- `SimpleHost Control` runs against `postgresql@control`
- tenant and workload PostgreSQL databases run on `postgresql@apps`

Execution result recorded on `2026-04-19`:

- `postgresql@control` was upgraded on the primary with `pg_upgrade`
- the `postgresql@control` standby was rebuilt with `pg_basebackup`
- `postgresql@apps` was upgraded on the primary with `pg_upgrade`
- the `postgresql@apps` standby was rebuilt with `pg_basebackup`
- both standbys returned to `streaming`
- `simplehost-control`, `simplehost-worker`, `simplehost-agent`, and the pilot app workload were brought back successfully

## Target policy

Target state:

- PostgreSQL `18.x` on both nodes
- primary/standby replication rebuilt under the new major
- no mixed-major replication left in service

Recommended execution order for future major upgrades:

1. upgrade `postgresql@control`
2. validate `SimpleHost Control`, `simplehost-worker`, and `simplehost-agent`
3. in a separate maintenance window, upgrade `postgresql@apps`

Rationale:

- `postgresql@control` is the smaller and more controlled cluster
- it gives a lower-risk rehearsal of the packaging, upgrade, and rebuild path
- `postgresql@apps` carries tenant workload data and should be upgraded only after
  the control-plane path is proven clean

For production-like environments, do not upgrade both PostgreSQL clusters in the same maintenance window.
The `2026-04-19` execution did upgrade both in one development window after
`postgresql@control` validated cleanly.

## Hard constraints

These constraints must be treated as operational truth:

- physical streaming replication does not remain valid across PostgreSQL major versions
- once the primary is upgraded to `18`, the `16` standby is no longer a failover target
- there is a temporary loss of HA until the standby is rebuilt under `18`
- rollback is easy only before opening writes on the upgraded primary
- rollback after new writes on `18` requires an explicit recovery decision and may
  mean restoring from backup

This means every major upgrade window temporarily becomes a controlled single-node
window until standby rebuild is finished.

## Upgrade strategy

Use `pg_upgrade` for the major jump, not dump-and-restore as the default path.

Chosen strategy:

1. keep PostgreSQL `16` installed and intact
2. install PostgreSQL `18` packages side-by-side from PGDG
3. stop writers and stop the target cluster cleanly
4. run `pg_upgrade` on the primary
5. validate the upgraded primary locally
6. reopen writes only after validation
7. rebuild the standby from the upgraded primary with `pg_basebackup`
8. restore replication and re-enable normal failover posture

Why this path:

- fastest safe path for the current cluster sizes
- preserves old `16` data directories for immediate pre-write rollback
- avoids full logical import time for the default case
- matches the existing physical replication model

## Preconditions for every window

Before touching either cluster:

1. confirm package source and binaries

   - PGDG `18` packages are available on both nodes
   - `pg_upgrade`, `pg_dumpall`, `pg_basebackup`, `psql`, and `pg_checksums`
     from both `16` and `18` are installed

2. confirm replication health

   Primary:

   ```bash
   sudo -u postgres psql -p <port> -Atqc 'select pg_is_in_recovery();'
   sudo -u postgres psql -p <port> -Atqc 'select application_name || ":" || state from pg_stat_replication;'
   ```

   Standby:

   ```bash
   sudo -u postgres psql -p <port> -Atqc 'select pg_is_in_recovery();'
   sudo -u postgres psql -p <port> -Atqc 'select status from pg_stat_wal_receiver;'
   ```

3. confirm disk headroom

   - enough free space for the new PostgreSQL `18` data directory or the
     `pg_upgrade --link` working set
   - enough free space for WAL growth during the upgrade window
   - enough free space for fresh physical backups if they are taken locally

4. confirm backup freshness

   - a successful physical backup exists for the target cluster
   - WAL archive health is confirmed
   - a restore test exists and is recent enough for the platform’s tolerance

5. confirm maintenance isolation

   - no OS upgrade in the same window
   - no MariaDB engine changes in the same window
   - no DNS, proxy, mail, or container maintenance in the same window

## Required backup posture

Minimum backup posture before every PostgreSQL major upgrade:

- fresh physical backup of the target cluster
- verified WAL archive continuity
- metadata snapshot of:
  - `pg_replication_slots`
  - `pg_settings`
  - installed extensions
  - roles
  - databases

Recommended capture:

```bash
sudo -u postgres psql -p <port> -Atqc 'select version();'
sudo -u postgres psql -p <port> -c '\du+'
sudo -u postgres psql -p <port> -c '\l+'
sudo -u postgres psql -p <port> -Atqc 'select name, setting from pg_settings order by name;'
sudo -u postgres psql -p <port> -Atqc 'select extname, extversion from pg_extension order by extname;'
sudo -u postgres psql -p <port> -Atqc 'select slot_name, slot_type, active from pg_replication_slots order by slot_name;'
sudo -u postgres pg_dumpall -p <port> --globals-only > /root/pg-globals-<cluster>-pre18.sql
```

Keep that metadata alongside the change record for the window.

## Rollback model

There are two rollback phases and they are not equivalent.

### Phase A: rollback before opening writes on PostgreSQL 18

This is the preferred rollback window.

If validation fails before application writes are reopened:

1. stop the PostgreSQL `18` cluster
2. restore the original PostgreSQL `16` service configuration
3. point the unit back to the preserved `16` data directory
4. start the PostgreSQL `16` primary
5. keep the old `16` standby unchanged
6. validate replication and reopen traffic

This rollback should be considered low-risk if no writes were accepted on `18`.

### Phase B: rollback after opening writes on PostgreSQL 18

After writes are accepted on the upgraded primary, rollback is no longer a simple
service flip.

At that point, rollback means one of:

- accept data loss and revert to the preserved `16` primary snapshot
- restore from the pre-upgrade backup
- treat the `18` primary as canonical and fix forward

Default rule:

- after writes reopen on `18`, prefer fix-forward over reverting to `16`
- use Phase B rollback only through an explicit incident decision

## Failover implications

During the upgrade window:

- do not rely on the standby as a failover target after the primary major changes
- do not run the regular failover playbook until the standby is rebuilt under `18`
- treat the cluster as temporarily single-primary with no HA

Operational rule:

- major upgrade and failover must not be mixed in the same live decision path

If the primary fails after upgrade but before standby rebuild:

- recover the upgraded primary if possible
- otherwise recover from preserved pre-upgrade state or backup
- do not attempt to promote the old `16` standby as if it were still current

## Cluster-specific execution plan

### A. `postgresql@control` first

This is the recommended first window.

#### Control cluster pre-window checklist

- `simplehost-control` and `simplehost-worker` are healthy on the active node
- `simplehost-agent` is healthy
- `curl http://127.0.0.1:3200/healthz` is healthy
- `pg_is_in_recovery()` is `false` on the primary and `true` on the standby
- `pg_stat_wal_receiver.status = streaming` on the standby

#### Control cluster maintenance sequence

1. stop application writers on the primary

   ```bash
   systemctl stop simplehost-worker.service simplehost-control.service
   ```

2. stop PostgreSQL on the primary

   ```bash
   systemctl stop postgresql@control.service
   ```

3. run `pg_upgrade` from `16` to `18` on the primary

   Use the exact PGDG binary paths and the preserved `PGDATA` / new `PGDATA`
   layout chosen for the window. Keep the old data directory untouched until
   post-upgrade validation is accepted.

4. start PostgreSQL `18` on the primary

   ```bash
   systemctl start postgresql@control.service
   ```

5. validate the upgraded primary before opening writes

   ```bash
   sudo -u postgres psql -p 5433 -Atqc 'select version();'
   sudo -u postgres psql -p 5433 -Atqc 'select current_database(), current_user;'
   sudo -u postgres psql -p 5433 -Atqc 'select extname, extversion from pg_extension order by extname;'
   ```

6. start the control-plane services again

   ```bash
   systemctl start simplehost-control.service simplehost-worker.service
   ```

7. validate application behavior

   ```bash
   curl -fsS http://127.0.0.1:3200/healthz
   journalctl -u simplehost-control.service -n 50 --no-pager
   journalctl -u simplehost-worker.service -n 50 --no-pager
   journalctl -u simplehost-agent.service -n 50 --no-pager
   ```

8. rebuild the standby under `18`

   - stop the standby `postgresql@control`
   - replace the standby data directory with a fresh `pg_basebackup`
   - reuse [`bootstrap-control-standby.sh`](/opt/simplehostman/src/scripts/control/bootstrap-control-standby.sh)
     semantics, but with the PostgreSQL `18` binaries and the upgraded primary as
     source
   - start the standby and confirm streaming replication again

9. only after standby rebuild:

   - restore the normal failover posture
   - close the maintenance window

### B. `postgresql@apps` second

For production-like environments, this should happen in a separate window after
`postgresql@control` is stable on `18`.

#### Apps cluster pre-window checklist

- `postgresql@control` is already stable on `18`
- the application standby is healthy on the old major version before the window starts
- workload containers or app processes that write to PostgreSQL can be drained or
  put into maintenance mode
- tenant-facing downtime is planned and communicated

#### Apps cluster maintenance sequence

1. stop or drain application writers that use `postgresql@apps`

   This includes any app containers or workload processes that issue writes on
   `5432`.

2. stop PostgreSQL on the apps primary

   ```bash
   systemctl stop postgresql@apps.service
   ```

3. run `pg_upgrade` from `16` to `18` on the primary

4. start PostgreSQL `18` on the primary

   ```bash
   systemctl start postgresql@apps.service
   ```

5. validate the upgraded primary before reopening workloads

   ```bash
   sudo -u postgres psql -p 5432 -Atqc 'select version();'
   sudo -u postgres psql -p 5432 -Atqc 'select count(*) from pg_database;'
   sudo -u postgres psql -p 5432 -Atqc 'select extname, extversion from pg_extension order by extname;'
   ```

6. reopen a minimal representative app path

   - connect using an application role
   - run a simple read/write transaction
   - validate that the app can still connect with the existing credentials

7. rebuild the standby under `18`

   - stop the old standby
   - replace the data directory using a fresh `pg_basebackup`
   - reuse [`bootstrap-apps-standby.sh`](/opt/simplehostman/src/scripts/agent/bootstrap-apps-standby.sh)
     semantics, but with PostgreSQL `18` binaries and the upgraded primary as source
   - start the standby and confirm streaming replication again

8. restore normal application traffic

## Post-upgrade validation

Run this on both clusters after each upgrade window.

### PostgreSQL engine validation

Primary:

```bash
sudo -u postgres psql -p <port> -Atqc 'select version();'
sudo -u postgres psql -p <port> -Atqc 'select pg_is_in_recovery();'
sudo -u postgres psql -p <port> -Atqc 'select application_name || ":" || state from pg_stat_replication;'
ss -tulpn | grep ":<port> "
```

Standby:

```bash
sudo -u postgres psql -p <port> -Atqc 'select version();'
sudo -u postgres psql -p <port> -Atqc 'select pg_is_in_recovery();'
sudo -u postgres psql -p <port> -Atqc 'select status from pg_stat_wal_receiver;'
```

Expected result:

- primary reports PostgreSQL `18.x`
- standby reports PostgreSQL `18.x`
- primary returns `false` for `pg_is_in_recovery()`
- standby returns `true` for `pg_is_in_recovery()`
- replication is back to streaming

### `SimpleHost Control` validation

After the `postgresql@control` upgrade:

```bash
systemctl is-active simplehost-control.service simplehost-worker.service simplehost-agent.service
curl -fsS http://127.0.0.1:3200/healthz
journalctl -u simplehost-control.service -n 100 --no-pager
journalctl -u simplehost-worker.service -n 100 --no-pager
journalctl -u simplehost-agent.service -n 100 --no-pager
```

Expected result:

- all three services are active
- `healthz` stays healthy
- no startup migration or reconcile failures appear after reconnect

### Workload validation on `postgresql@apps`

Minimum validation:

- connect as an application role
- perform one read query
- perform one write transaction
- verify the expected row or state change
- verify replication catches up on the standby

## Explicit go / no-go gates

Proceed only if all of these are true:

- backups are fresh and restorable
- replication is healthy before the change
- free disk space is sufficient
- PostgreSQL `18` packages are already available
- the old `16` data directory is preserved until validation is accepted

Stop and roll back before reopening writes if any of these happen:

- `pg_upgrade` warnings are not understood
- required extensions are missing or version-skewed
- `SimpleHost Control` cannot start cleanly after reconnect
- application roles cannot authenticate
- schema validation or representative writes fail

## Resulting policy

This runbook item is considered closed under this policy:

- the upgrade path is documented and accepted
- `postgresql@control` and `postgresql@apps` are upgraded in separate windows
- each window includes fresh backups, a defined rollback point, explicit HA loss
  during standby rebuild, and post-upgrade validation

As of the current recorded baseline, both live PostgreSQL clusters have already
been upgraded to PostgreSQL `18.3`; this runbook remains the template for the
next major-version window.
