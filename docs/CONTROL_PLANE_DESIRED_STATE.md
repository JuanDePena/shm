# Control Plane Desired State

Updated on `2026-05-02`.

This document is the live runbook for retiring YAML-based SimpleHostMan catalog
inputs and making PostgreSQL the only source of truth for the control-plane
desired state.

This is separate from
[`POSTGRESQL_UPGRADE.md`](/opt/simplehostman/src/docs/POSTGRESQL_UPGRADE.md),
which remains the major-version upgrade runbook for the PostgreSQL database
engine itself.

## Scope

The target state is:

- the SimpleHostMan catalog lives in PostgreSQL tables named `control_plane_*`
- runtime reconciliation reads desired state from PostgreSQL
- operator edits happen through the control-plane API/UI or explicit database
  migrations
- generated exports may still exist for audit and disaster recovery, but they
  are not imported as a live source of truth

Files being retired as live inputs:

- `bootstrap/apps.bootstrap.yaml`
- `/etc/simplehost/inventory.apps.yaml`
- `SIMPLEHOST_INVENTORY_PATH`

## Non-Goals

This transition does not migrate application database engines.

Operator decisions recorded on `2026-05-02`:

- WordPress apps that use MySQL/MariaDB stay on MySQL/MariaDB.
- `pyrosa-wp` remains on MariaDB database `app_pyrosa_wp`.
- `zcrmt` remains on MariaDB database `app_zcrmt_wp`.
- `pyrosa-newsync` stays outside PostgreSQL for now because another agent is
  working it as a manual/out-of-band runtime.
- `app_gomezrosado` is ignored because it is not being used; its stale YAML
  database entry is not a model gap.

## Current Baseline

Sensitive phase-0 artifacts were generated outside the repository under:

- `/root/simplehost-control-backups/phase0-20260501/`

That transient `/root` backup directory was removed during the operational
cleanup on `2026-05-02`; the hashes below remain as the audit record for what
was generated before the PostgreSQL-only desired-state cutover.

Files:

- `simplehost_control-20260501-phase0.dump`
  - format: `pg_dump --format=custom`
  - size: `94M`
  - SHA-256: `ad57041d12a94c69c6ca6adb4a28a1b174c0d56da9216391f6b239af1e5f1d17`
- `simplehost_control-schema-20260501-phase0.sql`
  - format: schema-only SQL
  - SHA-256: `ff24e2ea53a6928fab59acc975c496b456c35abaedb98642fbe1a654033df20a`
- `simplehost-desired-state-20260501-phase0.json`
  - source: `GET /v1/resources/spec`
  - SHA-256: `d9f12cc83c217f62d3157208d8289283f095ce2f7b7e9db3d77d5d1a09102695`
- `simplehost-desired-state-20260501-phase0.yaml`
  - source: `GET /v1/inventory/export`
  - SHA-256: `ce6f8da0eb2942ea7d1c9cd5615bc60a6fc093e662b5dc4b504ca416bad07104`

The retained dump was generated with `/usr/pgsql-18/bin/pg_dump`. A first
attempt with the system PostgreSQL 16 client was discarded because the control
database is PostgreSQL 18.

PostgreSQL desired-state export summary:

| Resource | Count |
| --- | ---: |
| tenants | 11 |
| nodes | 2 |
| zones | 11 |
| DNS records | 96 |
| apps | 21 |
| sites | 21 |
| databases | 11 |
| backup policies | 14 |
| mail domains | 8 |
| mailboxes | 23 |
| mail aliases | 20 |
| mailbox quotas | 23 |

At the phase-0 baseline, runtime config still referenced the transitional YAML
path on both nodes:

- `primary`: `/etc/simplehost/control.env`
- `secondary`: `/etc/simplehost/control.env`

Both contained `SIMPLEHOST_INVENTORY_PATH=/etc/simplehost/inventory.apps.yaml`.
Phase 1 removed this variable from active runtime env files on both nodes.

## YAML Audit

### `bootstrap/apps.bootstrap.yaml`

The repo bootstrap file contains `14` apps and `10` databases. PostgreSQL
contains `21` apps and `11` databases.

Findings:

- every app in `bootstrap/apps.bootstrap.yaml` already exists in PostgreSQL
- PostgreSQL has seven additional apps not present in the repo YAML:
  `bitfay`, `kynasoft`, `merlelaw`, `ppdpr`, `sipoel`, `tatokka`, and `zcrmt`
- no backend-port drift was found for apps that exist in both places
- YAML has `gomezrosado:app_gomezrosado:postgresql`, but PostgreSQL does not
  have a `control_plane_databases` row for it
- PostgreSQL has `tatokka:app_tatokka:postgresql` and
  `zcrmt:app_zcrmt_wp:mariadb`, but the repo YAML does not

Physical database check:

- `app_gomezrosado` was not found in the current PostgreSQL apps cluster on
  `primary` or `secondary`
- `app_adudoc`, `app_tatokka`, and `app_pyrosa_helpers_dfr` were found in the
  PostgreSQL apps cluster on both nodes

### `/etc/simplehost/inventory.apps.yaml`

The local file exists on `primary` only. It is absent on `secondary`.

The primary local file contains `5` apps and `5` databases. PostgreSQL contains
`21` apps and `11` databases.

Findings:

- `pyrosa-newsync` exists in the local YAML but does not exist in
  `control_plane_apps`
- `pyrosa-sync` is stale in the local YAML with backend port `10102`; PostgreSQL
  has the current port `10121`
- the local YAML lacks most current Pyrosa apps and all non-bootstrap domains
  such as `bitfay`, `kynasoft`, `merlelaw`, `ppdpr`, `sipoel`, `tatokka`, and
  `zcrmt`
- the local YAML also lacks the PostgreSQL-catalogued secondary databases for
  `pyrosa-demosync`, `pyrosa-sync`, `pyrosa-helpers`, `tatokka`, and `zcrmt`

Physical database check:

- `app_pyrosa_newsync` exists in the primary MariaDB container
- `pyrosa-newsync` runtime and worker units are active on `primary`
- no `/etc/simplehost/inventory.apps.yaml` was found on `secondary`

## Retirement Plan

### Phase 1: Runtime Decoupling

Goal: remove active runtime dependence on YAML without deleting the files yet.

Status: completed on `2026-05-02`.

Tasks:

- remove `SIMPLEHOST_INVENTORY_PATH` from live control-plane config handling
- stop exposing `/etc/simplehost/inventory.apps.yaml` as the default runtime
  source
- keep PostgreSQL export/apply as the active desired-state flow
- confirm a fresh reconciliation run generates `0` unexpected jobs

Exit criteria:

- `simplehost-control` and `simplehost-worker` start without
  `SIMPLEHOST_INVENTORY_PATH`
- `GET /v1/resources/spec` exports the complete desired-state catalog from
  PostgreSQL
- no live code path requires `/etc/simplehost/inventory.apps.yaml`

Implementation notes:

- control runtime config now treats `SIMPLEHOST_INVENTORY_PATH` as optional and
  no longer defaults it to `/etc/simplehost/inventory.apps.yaml`
- Phase 1 temporarily kept YAML import available only with an explicit source
  path; Phase 2 later removed the normal import surface
- packaging examples no longer include `SIMPLEHOST_INVENTORY_PATH`
- `/etc/simplehost/control.env` on `primary` and `secondary` no longer contains
  `SIMPLEHOST_INVENTORY_PATH`
- active control-plane export from `GET /v1/resources/spec` returned the full
  PostgreSQL catalog: `11` tenants, `2` nodes, `11` zones, `21` apps, `11`
  databases, and mail/backup desired state
- the post-deploy reconciliation run generated `0` jobs and left `0` pending
  jobs
- old `control.env` copies with the retired variable were moved under
  `/root/simplehost-control-backups/phase0-20260501/env/` during phase 1, then
  removed with the rest of the transient `/root` backup directory during the
  `2026-05-02` operational cleanup
- `systemctl --failed` on `primary` still reports out-of-band
  `pyrosa-newsync` worker units; they were intentionally not changed by this
  phase because `pyrosa-newsync` is being handled outside the control-plane
  desired-state transition

### Phase 2: Remove YAML Import Surface

Goal: remove operator-facing YAML import as a normal workflow.

Status: completed on `2026-05-02`.

Tasks:

- remove or disable `POST /v1/inventory/import`
- remove the UI action that imports bootstrap YAML into PostgreSQL
- keep PostgreSQL export for audit/disaster recovery
- adjust tests that currently assert YAML import behavior

Exit criteria:

- operators can edit desired state without YAML import
- exported catalog remains available from PostgreSQL
- API/UI tests pass without exposing a YAML import route or action

Implementation notes:

- API route `POST /v1/inventory/import` was removed
- web action `/actions/inventory-import` and the corresponding UI form were
  removed
- runtime config, worker startup, release manifests and sandbox env generation
  no longer carry an inventory import path
- PostgreSQL catalog export remains available through `GET /v1/resources/spec`
  and `GET /v1/inventory/export`
- historical latest-import metadata remains visible read-only for audit context
- legacy inventory converter helpers remain covered by unit tests as historical
  rollback support until a separate final cleanup removes them

### Phase 3: Retire Repo Bootstrap File

Goal: remove `bootstrap/apps.bootstrap.yaml` as a source-controlled catalog.

Status: completed on `2026-05-02`.

Tasks:

- delete `bootstrap/apps.bootstrap.yaml`
- update `bootstrap/README.md`
- update live docs that still point operators at the bootstrap YAML
- preserve historical migration records as history, not active guidance

Exit criteria:

- `rg "apps.bootstrap.yaml|inventory.apps.yaml|SIMPLEHOST_INVENTORY_PATH"` has
  no active runtime guidance outside historical runbooks and this transition
  document
- docs point operators to PostgreSQL desired state and the control-plane API/UI

Implementation notes:

- `bootstrap/apps.bootstrap.yaml` was deleted from source control
- the now-empty `bootstrap/` directory and its tombstone README were removed
  from the active source layout
- active architecture, DNS, multi-domain, failover, repo layout and agent docs
  now point operators to PostgreSQL desired state and control-plane exports
- historical migration records were left intact as evidence of prior migration
  work

### Phase 4: Final Validation

Goal: prove the platform can operate and recover without YAML inputs.

Status: completed on `2026-05-02`.

Validation:

- `pnpm --filter @simplehost/control-database test`
- `pnpm build:control-runtime`
- `pnpm build:agent-runtime`
- `git diff --check`
- fresh reconciliation run with `0` unexpected jobs
- forced export from `GET /v1/resources/spec`
- restore rehearsal from the phase-0 control-plane dump into a temporary
  database, if a recovery rehearsal is required before closing the transition

Implementation notes:

- `pnpm --filter @simplehost/control-database test` passed with `27/27` tests
- `pnpm build:control-runtime`, `pnpm build:agent-runtime`, and
  `git diff --check` passed
- active code, env, release and packaging paths on both nodes have no
  `SIMPLEHOST_INVENTORY_PATH` references
- removed import surfaces still return `404`:
  - `POST /v1/inventory/import`
  - `POST /actions/inventory-import`
- `GET /v1/inventory/export` returned `200`, `35466` bytes, SHA-256
  `ce6f8da0eb2942ea7d1c9cd5615bc60a6fc093e662b5dc4b504ca416bad07104`
- `GET /v1/resources/spec` returned the expected PostgreSQL catalog:
  `11` tenants, `2` nodes, `11` zones, `96` DNS records, `21` apps, `11`
  databases, `14` backup policies, `8` mail domains, `23` mailboxes, `20`
  aliases, and `23` quotas
- fresh reconciliation run
  `reconcile-d1a38983-1ed2-4306-a6fd-020cfdf6d31c` generated `0` jobs,
  skipped `131`, and left `0` pending jobs
- phase-0 dump restore rehearsal succeeded in temporary database
  `simplehost_control_phase4_20260502023052`; restored counts were `21` apps,
  `11` databases, `11` zones, `96` DNS records, `8` mail domains, and `23`
  mailboxes; the temporary database and dump copy were removed afterward

Final state:

- PostgreSQL `control_plane_*` tables are the only live desired-state source
- YAML imports are not exposed through normal API/UI/runtime flows
- YAML exports remain available for audit, review, and disaster recovery
- historical migration runbooks remain as evidence only

## Rollback

Rollback should use the phase-0 artifacts:

- restore the `simplehost_control` dump if PostgreSQL desired state is damaged
- reintroduce the YAML import path only through an explicit incident decision

## Change Log

- `2026-05-02`: phase-0 backup and audit completed.
- `2026-05-02`: operator decided to omit `pyrosa-newsync` from PostgreSQL while
  it is being worked by another agent.
- `2026-05-02`: operator decided to ignore unused `app_gomezrosado`.
- `2026-05-02`: operator confirmed WordPress apps using MySQL/MariaDB should
  remain on MySQL/MariaDB; this effort is limited to retiring YAML catalog
  sources.
- `2026-05-02`: phase 1 completed; runtime config no longer requires
  `SIMPLEHOST_INVENTORY_PATH`, active env files no longer define it, and a fresh
  reconciliation generated `0` jobs.
- `2026-05-02`: phase 2 completed; YAML import route/UI were removed while
  PostgreSQL desired-state export remains available.
- `2026-05-02`: phase 3 completed; source-controlled bootstrap inventory was
  deleted and active docs now point to PostgreSQL desired state.
- `2026-05-02`: phase 4 completed; tests, builds, live export, reconcile, and
  phase-0 restore rehearsal all passed without YAML inputs.
- `2026-05-02`: empty source `bootstrap/` directory removed after the desired
  state transition closed.
