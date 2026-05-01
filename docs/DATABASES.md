# Database Platform Runbook

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target database platform for the two-node design:

- PostgreSQL as the default application database
- PostgreSQL as the dedicated control-plane database for `SimpleHost Control`
- MariaDB as the optional compatibility database for workloads that require MySQL or MariaDB semantics
- PostgreSQL deployed host-native through packaged `systemd` units
- MariaDB deployed as a dedicated Podman service managed by Quadlet only when required

For the multi-domain platform, the default isolation unit is one database plus one role or user per application slug inside a shared engine cluster.

Primary node: `vps-3dbbfb0b.vps.ovh.ca`
Secondary node: `vps-16535090.vps.ovh.ca`

## Status on 2026-04-19

- Public operator aliases are `vps-prd.pyrosa.com.do` for the primary and `vps-des.pyrosa.com.do` for the secondary.
- The currently deployed host-native PostgreSQL runtime on these nodes is `18.3`.
- The PostgreSQL major upgrade from `16.13` to `18.3` has already been executed on both nodes, including standby rebuilds for `postgresql@control` and `postgresql@apps`.
- `postgresql-apps` and `postgresql-control` are already live over WireGuard.
- `SimpleHost Control` API and workers use `127.0.0.1:5433` locally on the active node.
- `SimpleHost Agent` already executes real `postgres.reconcile` and `mariadb.reconcile` jobs against the live engines.

## Observability Status On 2026-05-01

Phase 2 of the post-migration operational plan enabled database observability
without changing memory sizing yet.

PostgreSQL `postgresql@control` on both nodes:

- `shared_preload_libraries = 'pg_stat_statements'`
- `track_io_timing = on`
- `track_activity_query_size = 4096`
- `log_temp_files = 65536`
- `log_min_duration_statement = 1000`
- `log_parameter_max_length = 0`
- `pg_stat_statements` extension installed in `postgres` and `simplehost_control`

PostgreSQL `postgresql@apps` on both nodes:

- `shared_preload_libraries = 'pg_stat_statements'`
- `track_io_timing = on`
- `track_activity_query_size = 4096`
- `log_parameter_max_length = 0`
- `pg_stat_statements` extension installed in `postgres`, `app_adudoc`,
  `app_pyrosa_demoerp`, `app_pyrosa_helpers_dfr`, `app_tatokka`, and
  `roundcube_mail`

MariaDB primary:

- `slow_query_log = ON`
- `long_query_time = 1`
- `log_output = FILE`
- `slow_query_log_file = mariadb-slow.log`
- `performance_schema = OFF`; enabling it is deferred to a restart window

The PostgreSQL values were applied with `ALTER SYSTEM` in each data directory.
The MariaDB slow-log values are persisted in
[`/opt/simplehostman/src/platform/mariadb/conf/primary.cnf`](/opt/simplehostman/src/platform/mariadb/conf/primary.cnf)
and applied live on the primary container.

## Version policy

Major-version execution planning now lives in:

- [POSTGRESQL_UPGRADE.md](/opt/simplehostman/src/docs/POSTGRESQL_UPGRADE.md)

### PostgreSQL

Verified on `2026-04-29` against the official PostgreSQL release notes, the current supported major release is PostgreSQL `18`, and the current supported minor release is `18.3`.

Target version:

- PostgreSQL `18.3`

Current deployed runtime snapshot:

- host-native PostgreSQL `18.3` is what is currently installed and operating on the two nodes
- the deployed runtime now matches the current PostgreSQL target policy

Source policy:

- Use the current PGDG repository for AlmaLinux-compatible builds
- Track minor releases promptly
- Treat all major version changes as planned upgrade projects

### MariaDB

Verified on `2026-04-29` against the official MariaDB release listings:

- Latest stable rolling release: MariaDB `12.2.2`
- Latest LTS series release: MariaDB `11.8.6`

Reference pages:

- https://www.postgresql.org/docs/current/release.html
- https://mariadb.org/mariadb/all-releases/
- https://mariadb.org/about/maintenance-policy/

Target version policy:

- Default production recommendation: MariaDB `11.8.6` LTS
- Latest possible stable option when explicitly required: MariaDB `12.2.2`

Rationale:

- `11.8` is the latest LTS branch and is the safer default for infrastructure stability.
- `12.2` is newer but follows the rolling release model and has a shorter public community maintenance window.

## Placement rules

- Do not expose `5432/tcp` or `3306/tcp` publicly.
- Do not expose `5433/tcp` publicly.
- Bind database listeners only to loopback and WireGuard addresses as required.
- Do not use the same database engine for unrelated control-plane duties unless there is a clear reason.
- Do not use the application PostgreSQL cluster as the backend for PowerDNS.
- Do not use the application PostgreSQL cluster as the backend for `SimpleHost Control`.
- Only run both PostgreSQL and MariaDB at the same time when workloads actually require both.
- Do not deploy one database engine instance per application unless a tenant isolation requirement justifies the extra operational cost.

Source-controlled database artifacts:

- [`/opt/simplehostman/src/platform/postgresql/apps/conf/postgresql.apps.primary.conf`](/opt/simplehostman/src/platform/postgresql/apps/conf/postgresql.apps.primary.conf)
- [`/opt/simplehostman/src/platform/postgresql/apps/conf/postgresql.apps.standby.conf`](/opt/simplehostman/src/platform/postgresql/apps/conf/postgresql.apps.standby.conf)
- [`/opt/simplehostman/src/platform/postgresql/apps/conf/pg_hba.apps.conf`](/opt/simplehostman/src/platform/postgresql/apps/conf/pg_hba.apps.conf)
- [`/opt/simplehostman/src/scripts/agent/bootstrap-apps-standby.sh`](/opt/simplehostman/src/scripts/agent/bootstrap-apps-standby.sh)
- [`/opt/simplehostman/src/platform/postgresql/apps/sql/create-app-database.sql.template`](/opt/simplehostman/src/platform/postgresql/apps/sql/create-app-database.sql.template)
- [`/opt/simplehostman/src/platform/mariadb/conf/primary.cnf`](/opt/simplehostman/src/platform/mariadb/conf/primary.cnf)
- [`/opt/simplehostman/src/platform/mariadb/conf/replica.cnf`](/opt/simplehostman/src/platform/mariadb/conf/replica.cnf)
- [`/opt/simplehostman/src/platform/mariadb/sql/create-app-database.sql.template`](/opt/simplehostman/src/platform/mariadb/sql/create-app-database.sql.template)
- [`/opt/simplehostman/src/platform/mariadb/sql/configure-replica.sql.template`](/opt/simplehostman/src/platform/mariadb/sql/configure-replica.sql.template)
- [`/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.primary.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.primary.conf)
- [`/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.standby.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.standby.conf)
- [`/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf)
- [`/opt/simplehostman/src/scripts/control/bootstrap-control-standby.sh`](/opt/simplehostman/src/scripts/control/bootstrap-control-standby.sh)
- [`/opt/simplehostman/src/packaging/postgresql/control/sql/create-control-database.sql.template`](/opt/simplehostman/src/packaging/postgresql/control/sql/create-control-database.sql.template)

## PostgreSQL applications design

### Role

PostgreSQL is the preferred default relational database for new workloads on this platform.

### Topology

- Cluster name: `postgresql-apps`
- Primary: `vps-3dbbfb0b.vps.ovh.ca`
- Physical standby: `vps-16535090.vps.ovh.ca`
- Listener port: `5432`
- Replication transport: WireGuard
- Failover model: manual only

### Why manual failover

This is a two-node design without a third quorum member. Automatic failover is intentionally deferred until a third failure domain exists.

If automatic failover is needed later:

- Add a third VPS or equivalent witness node
- Revisit the design with a dedicated quorum mechanism

### Storage

Recommended data path for the PostgreSQL host-native cluster:

- `/var/lib/pgsql/apps/data`
- `/var/lib/pgsql/apps/wal-archive`

Recommended backup paths:

- `/srv/backups/postgresql-apps/`

### Replication

Baseline replication mode:

- Streaming replication over WireGuard
- Start with asynchronous replication

Synchronous replication can be reconsidered later if lower `RPO` is more important than write availability.

### Backups

Required:

- Physical backups
- WAL archiving
- Regular restore tests

Preferred tooling:

- `pgBackRest`

### Client connectivity

- Applications connect to the current primary only.
- Do not pretend that DNS provides safe database failover.
- Add a connection proxy later only if application connection behavior requires it.

## PostgreSQL `SimpleHost Control` design

### Role

`postgresql-control` is the dedicated control-plane PostgreSQL cluster for `SimpleHost Control`.

Do not mix tenant application databases into this cluster.

### Topology

- Cluster name: `postgresql-control`
- Primary: `vps-3dbbfb0b.vps.ovh.ca`
- Physical standby: `vps-16535090.vps.ovh.ca`
- Listener port: `5433`
- Replication transport: WireGuard
- Failover model: manual only

### Storage

Recommended data path for the PostgreSQL host-native cluster:

- `/var/lib/pgsql/control/data`
- `/var/lib/pgsql/control/wal-archive`

Recommended backup paths:

- `/srv/backups/postgresql-control/`

### Backups

Required:

- Physical backups
- WAL archiving
- Regular restore tests

Preferred tooling:

- `pgBackRest`

The SimpleHostMan worker also supports a logical safety-net policy for the
control-plane database with selector `postgresql-cluster:control`. That policy
creates a custom-format dump of `simplehost_control` plus a globals-only role
dump, but it does not replace physical backups or WAL archiving for full cluster
recovery.

### Client connectivity

- `SimpleHost Control` API and workers connect to the current `postgresql-control` primary only.
- Keep `SimpleHost Control` database credentials separate from tenant application credentials.
- Do not use this cluster for tenant application data.

### 8 GB memory profile

Recommended baseline for `postgresql-control` on nodes with `8 GB` RAM:

- `max_connections = 100`
- `shared_buffers = 2GB`
- `effective_cache_size = 6GB`
- `maintenance_work_mem = 512MB`
- `work_mem = 8MB`
- `wal_buffers = 16MB`
- `min_wal_size = 1GB`
- `max_wal_size = 4GB`
- `checkpoint_completion_target = 0.9`
- `wal_compression = on`

This profile is intentionally conservative for a control-plane database:

- enough shared memory to keep the hot control-plane working set in RAM
- planner cache sized for the remaining OS page cache
- moderate `work_mem` so query bursts do not overcommit memory
- more headroom for WAL and checkpoints than the default package profile

### Deployment checklist

Primary node bootstrap:

1. Create host paths:
   - `/var/lib/pgsql/control/data`
   - `/var/lib/pgsql/control/wal-archive`
2. Create the host-native cluster unit:
   - `postgresql-new-systemd-unit --unit postgresql@control --datadir /var/lib/pgsql/control/data`
3. Initialize the cluster:
   - `postgresql-setup --initdb --unit postgresql@control --port 5433`
4. Install the systemd drop-ins for the host-native unit:
   - [`/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf`](/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf)
   - [`/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf`](/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf)
5. Install these rendered artifacts into the cluster data directory:
   - [`/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.primary.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.primary.conf) as `postgresql.conf`
   - [`/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf) as `pg_hba.conf`
6. Ensure `5433/tcp` is labeled for PostgreSQL under SELinux:
   - `semanage port -a -t postgresql_port_t -p tcp 5433`
7. Reload SELinux policy if needed and start the service:
   - `semodule -B`
   - `systemctl enable --now postgresql@control`
8. Create the `SimpleHost Control` database and role from [`/opt/simplehostman/src/packaging/postgresql/control/sql/create-control-database.sql.template`](/opt/simplehostman/src/packaging/postgresql/control/sql/create-control-database.sql.template).

Secondary node bootstrap:

1. Create host paths:
   - `/var/lib/pgsql/control/data`
   - `/var/lib/pgsql/control/wal-archive`
2. Create the host-native cluster unit:
   - `postgresql-new-systemd-unit --unit postgresql@control --datadir /var/lib/pgsql/control/data`
3. Bootstrap the standby data directory from the primary with [`/opt/simplehostman/src/scripts/control/bootstrap-control-standby.sh`](/opt/simplehostman/src/scripts/control/bootstrap-control-standby.sh).
4. Install the systemd drop-ins for the host-native unit:
   - [`/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf`](/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf)
   - [`/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf`](/opt/simplehostman/src/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf)
5. Install these rendered artifacts into the cluster data directory:
   - [`/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.standby.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/postgresql.control.standby.conf) as `postgresql.conf`
   - [`/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf`](/opt/simplehostman/src/packaging/postgresql/control/conf/pg_hba.control.conf) as `pg_hba.conf`
6. Ensure `5433/tcp` is labeled for PostgreSQL under SELinux:
   - `semanage port -a -t postgresql_port_t -p tcp 5433`
7. Reload SELinux policy if needed and start the standby service:
   - `semodule -B`
   - `systemctl enable --now postgresql@control`

Minimum validation:

```bash
ss -tulpn | grep ':5433 '
psql 'postgresql://simplehost_control:***@127.0.0.1:5433/simplehost_control' -c 'select current_database();'
psql 'postgresql://simplehost_control:***@127.0.0.1:5433/simplehost_control' -c 'select now();'
```

Expected state:

- the primary accepts local connections on `127.0.0.1:5433`
- the secondary reports `pg_is_in_recovery() = true`
- `SIMPLEHOST_DATABASE_URL` points to the current primary, for example:
  - `postgresql://simplehost_control:***@127.0.0.1:5433/simplehost_control`

## MariaDB design

### Role

MariaDB is the compatibility database for software that expects MySQL or MariaDB behavior.

MariaDB is not the default platform for new applications unless compatibility demands it.

Current known MariaDB-backed workloads on this platform:

- `pyrosa-wp` for `pyrosa.com.do`
- `pyrosa-demoportal` for `demoportal.pyrosa.com.do`
- `pyrosa-demosync` for `demosync.pyrosa.com.do`
- `pyrosa-sync` for `sync.pyrosa.com.do`

Planned transition:

- `pyrosa-sync` can move to PostgreSQL later while `pyrosa-wp` remains on MariaDB

### Topology

- Primary: `vps-3dbbfb0b.vps.ovh.ca`
- Replica: `vps-16535090.vps.ovh.ca`
- Replication transport: WireGuard
- Replication style: asynchronous
- Failover model: manual only

### Version choice

Default:

- MariaDB `11.8.6` LTS

Optional newer branch:

- MariaDB `12.2.2` if a workload explicitly needs that series

### Storage

Recommended data path for the MariaDB container:

- `/srv/containers/mariadb/data`

Recommended backup paths:

- `/srv/backups/mariadb/`

### Backups

Required:

- Physical backups
- Binlog retention aligned with backup policy
- Periodic logical dumps for schema portability where needed

Preferred tooling:

- `mariadb-backup`

## Operational guardrails

- Do not upgrade PostgreSQL and MariaDB on the same maintenance window unless there is a strong reason.
- Upgrade replicas first where possible for minor engine maintenance, not for
  PostgreSQL major-version upgrades that require standby rebuilds.
- Verify backup freshness before every engine update.
- Keep database major upgrades separate from operating system upgrades.
- Keep DNS, proxy, and application maintenance independent from database maintenance wherever possible.
- For PostgreSQL major upgrades specifically, use the dedicated runbook in
  [POSTGRESQL_UPGRADE.md](/opt/simplehostman/src/docs/POSTGRESQL_UPGRADE.md),
  because physical replication does not remain valid across major versions.

## Validation

### PostgreSQL

Example checks:

```bash
ss -tulpn | grep ':5432 '
psql -c 'select version();'
psql -c 'select pg_is_in_recovery();'
```

Expected behavior:

- Primary returns `false` for `pg_is_in_recovery()`
- Standby returns `true` for `pg_is_in_recovery()`
- Listener is not exposed on a public address

`postgresql-control` follows the same validation pattern on port `5433`.

### MariaDB

Example checks:

```bash
ss -tulpn | grep ':3306 '
mariadb -e 'select version();'
mariadb -e 'show replica status\\G'
```

Expected behavior:

- Primary serves writes
- Secondary reports healthy replication state when a replica is deployed
- Listener is not exposed on a public address

## Future expansion

If a third VPS is introduced later:

- PostgreSQL can gain a real quorum-aware failover design
- MariaDB can gain a more deliberate promotion strategy
- Backups and monitoring can move into a separate operations tier
