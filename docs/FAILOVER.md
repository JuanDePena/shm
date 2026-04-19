# SHP Failover Runbook

This runbook documents the current manual failover path for `SHP` in the
two-node layout.

## Current runtime model

- Primary host: `vps-3dbbfb0b.vps.ovh.ca`
- Secondary host: `vps-16535090.vps.ovh.ca`
- `postgresql-control` replicates over WireGuard on `10.89.0.0/24`
- `simplehost-control` and `simplehost-worker` are installed on both nodes
- On the secondary node, both services stay disabled until promotion
- `simplehost-control` and `simplehost-worker` must stay stopped on the standby while
  PostgreSQL is read-only, because the combined control runtime still performs
  startup writes such as migrations and control-plane bootstrap work

## Preconditions

Before promoting the secondary:

- confirm the secondary reports `pg_is_in_recovery() = true`
- confirm `pg_stat_wal_receiver.status = streaming`
- confirm `wg0` is active on both nodes
- confirm `/opt/simplehostman/release/current` exists on the secondary and points to
  a populated release tree

## Passive runtime refresh

Keep the standby node updated with the same installed `SHP` release as the
primary, but leave `simplehost-control` and `simplehost-worker` disabled until
promotion.

If the standby does not have the build toolchain available, refresh it from the
installed runtime on the primary while keeping the combined runtime disabled:

```bash
release_version="$(basename "$(readlink -f /opt/simplehostman/release/current)")"

ssh root@vps-16535090.vps.ovh.ca \
  'install -d /opt/simplehostman/release/releases /opt/simplehostman/release/shared /etc/simplehost /var/log/simplehost'

rsync -a --delete "/opt/simplehostman/release/releases/${release_version}/" \
  "root@vps-16535090.vps.ovh.ca:/opt/simplehostman/release/releases/${release_version}/"

rsync -a \
  /etc/systemd/system/simplehost-control.service \
  /etc/systemd/system/simplehost-worker.service \
  root@vps-16535090.vps.ovh.ca:/etc/systemd/system/

rsync -a \
  /etc/simplehost/control.env \
  /etc/simplehost/worker.env \
  /etc/simplehost/control.env.example \
  /etc/simplehost/worker.env.example \
  /etc/simplehost/inventory.apps.yaml \
  root@vps-16535090.vps.ovh.ca:/etc/simplehost/

ssh root@vps-16535090.vps.ovh.ca \
  "ln -sfn /opt/simplehostman/release/releases/${release_version} /opt/simplehostman/release/current && \
   chown root:simplehost /etc/simplehost/control.env /etc/simplehost/worker.env && \
   chmod 0640 /etc/simplehost/control.env /etc/simplehost/worker.env && \
   systemctl daemon-reload && \
   systemctl disable simplehost-control.service simplehost-worker.service && \
   systemctl stop simplehost-control.service simplehost-worker.service"
```

While `postgresql-control` is still in recovery mode, `simplehost-control` and
`simplehost-worker` are expected to stay down on the standby.

## Manual promotion sequence

1. On the secondary, promote `postgresql-control`:

   ```bash
   sudo -u postgres psql -p 5433 -c 'select pg_promote();'
   ```

2. Wait until the secondary reports:

   ```bash
   sudo -u postgres psql -p 5433 -Atqc 'select pg_is_in_recovery();'
   ```

   Expected result:

   ```text
   f
   ```

3. If the old primary is still reachable, stop `SimpleHost` control services there to avoid
   split-brain at the application layer:

   ```bash
   systemctl stop simplehost-worker.service simplehost-control.service
   ```

4. Enable and start `SHP` on the promoted secondary:

   ```bash
   systemctl enable --now simplehost-control.service simplehost-worker.service
   ```

5. Validate local service health on the promoted secondary:

   ```bash
   curl -fsS http://127.0.0.1:3200/healthz
   curl -fsS http://127.0.0.1:3200/
   ```

6. Repoint any front-facing proxy or traffic entrypoint to the promoted node as
   required by the surrounding platform.

## Rebuild after failover

After a failover, do not try to reconnect the old primary as if nothing
happened.

Rebuild the old primary as a fresh standby:

1. re-bootstrap `postgresql-control` from the new primary
2. verify streaming replication is back
3. keep `simplehost-control` and `simplehost-worker` disabled on the rebuilt standby unless you are failing back

## Manual failback checklist

Use this checklist only after the failed node has been rebuilt cleanly as a
standby from the currently active primary.

- Confirm the current primary is healthy and serving `SHP` traffic correctly.
- Confirm the node you want to fail back to reports `pg_is_in_recovery() = true`.
- Confirm `pg_stat_wal_receiver.status = streaming` on that standby.
- Confirm `/opt/simplehostman/release/current` on the standby points to the same
  installed release generation you expect to promote.
- Confirm `simplehost-control` and `simplehost-worker` are still disabled on the standby
  before promotion.
- Stop `simplehost-worker` and `simplehost-control` on the current primary.
- Promote the standby that will become the new primary:

  ```bash
  sudo -u postgres psql -p 5433 -c 'select pg_promote();'
  ```

- Wait until `pg_is_in_recovery()` returns `f` on the promoted node.
- Enable and start `simplehost-control` and `simplehost-worker` on the
  promoted node.
- Validate `http://127.0.0.1:3200/healthz` and `http://127.0.0.1:3200/` on the
  promoted node.
- Repoint any front-facing proxy or traffic entrypoint back to the promoted
  node.
- Rebuild the old primary as a fresh standby from the new primary.
- Keep `simplehost-control` and `simplehost-worker` disabled on the rebuilt standby after
  failback.

## Notes

- This is a manual failover design by intent.
- Do not run `simplehost-worker` active on both nodes at the same time.
- Keep `SHP` write traffic pointed only at the promoted PostgreSQL primary.
