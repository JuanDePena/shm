# Adudoc Database Migration

This document tracks the closure of the `adudoc` database migration inside `SHP`.

## Repo-declared state

As of `2026-04-12`, the repository declares `adudoc` on `postgresql` and does not mark it as pending migration in bootstrap inventory:

- [`bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml:78)

That means the repo currently reflects `adudoc` as already cut over in desired topology, but it does **not** yet prove the live platform finished every operational step.

## Runtime verification

Use the migration audit script against a live control plane:

```bash
export SHP_API_BASE_URL=http://127.0.0.1:3100
export SHP_API_TOKEN=replace-with-session-token
pnpm audit:migration -- --app adudoc
```

If you do not have a token, the script can also log in with:

```bash
export SHP_BOOTSTRAP_ADMIN_EMAIL=webmaster@example.com
export SHP_BOOTSTRAP_ADMIN_PASSWORD=replace-with-password
pnpm audit:migration -- --app adudoc
```

Expected checkpoints:

- `Desired engine` and `Inventory engine` both report `postgresql`
- `Classification` is either `completed` or `model-complete-without-metadata`
- `Desired/inventory match` is `yes`
- `Drift clear` is `yes`
- `Latest reconcile applied` is `yes`
- `Backup coverage present` is `yes`

## Remaining closure work

1. Run the audit script against production and paste the output into the migration ticket.
2. If the script returns `model-complete-without-metadata`, backfill explicit completion metadata in desired state or bootstrap inventory using:

```yaml
database:
  engine: postgresql
  name: app_adudoc
  user: app_adudoc
  migration_completed_from: mariadb
  migration_completed_at: 2026-04-12T00:00:00Z
```

3. Confirm there is no remaining `database:adudoc` drift and that the last relevant reconcile job applied cleanly.
4. Confirm backup policy coverage and at least one successful recent backup run for selectors covering `app:adudoc` or `database:adudoc`.
5. Retire any legacy MariaDB leftovers outside `SHP`: database, user, backup jobs, scripts, secrets, or manual runbooks still pointing at the old engine.

## Notes

- `SHP` now models two different migration states for databases:
  - `pendingMigrationTo`: migration planned but not completed
  - `migrationCompletedFrom` plus `migrationCompletedAt`: migration completed and explicitly recorded
- If neither field is set but desired and inventory both match the target engine, the audit script reports `model-complete-without-metadata` so we can backfill history instead of guessing.
