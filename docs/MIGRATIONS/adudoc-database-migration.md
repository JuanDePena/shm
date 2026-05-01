# Adudoc Database Migration

This document tracks the closure of the `adudoc` database migration inside `SimpleHost Control`.

## Repo-declared state

As of `2026-04-12`, the repository declares `adudoc` on `postgresql` and does not mark it as pending migration in bootstrap inventory:

- [`bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml:78)

That means the repo currently reflects `adudoc` as already cut over in desired topology, but it does **not** yet prove the live platform finished every operational step.

## Runtime verification

Use the migration audit script against a live control plane:

```bash
export SIMPLEHOST_API_BASE_URL=http://127.0.0.1:3200
export SIMPLEHOST_API_TOKEN=replace-with-session-token
node scripts/control/check-database-migration.mjs --app adudoc
```

Older workspaces may also expose this as `pnpm audit:migration -- --app adudoc`.

If you do not have a token, the script can also log in with:

```bash
export SIMPLEHOST_BOOTSTRAP_ADMIN_EMAIL=webmaster@example.com
export SIMPLEHOST_BOOTSTRAP_ADMIN_PASSWORD=replace-with-password
node scripts/control/check-database-migration.mjs --app adudoc
```

Expected checkpoints:

- `Desired engine` and `Inventory engine` both report `postgresql`
- `Classification` is either `completed` or `model-complete-without-metadata`
- `Desired/inventory match` is `yes`
- `Drift clear` is `yes`
- `Latest reconcile applied` is `yes`
- `Backup coverage present` is `yes`

## Historical Closure Audit Notes

This section is retained as audit guidance for the earlier Adudoc database
migration. It is not an active migration TODO unless `TODO.md` reopens it.

If this migration is audited again, run the script against production and keep
the result with the migration evidence. If the script returns
`model-complete-without-metadata`, backfill explicit completion metadata in
desired state or bootstrap inventory using:

```yaml
database:
  engine: postgresql
  name: app_adudoc
  user: app_adudoc
  migration_completed_from: mariadb
  migration_completed_at: 2026-04-12T00:00:00Z
```

For a future audit, also confirm there is no `database:adudoc` drift, the latest
relevant reconcile job applied cleanly, backup policy coverage exists, and no
legacy MariaDB leftovers outside `SimpleHost Control` are still in use.

## Notes

- `SimpleHost Control` now models two different migration states for databases:
  - `pendingMigrationTo`: migration planned but not completed
  - `migrationCompletedFrom` plus `migrationCompletedAt`: migration completed and explicitly recorded
- If neither field is set but desired and inventory both match the target engine, the audit script reports `model-complete-without-metadata` so we can backfill history instead of guessing.
