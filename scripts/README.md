# Scripts

This directory contains canonical install, deploy, rollback, bootstrap, and migration helpers for the unified source workspace.

Path:

- `/opt/simplehostman/src/scripts`

## Current transitional split

- `panel/`: scripts imported from the former `SHP` repository
- `manager/`: scripts imported from the former `SHM` repository
- `lib/`: shared shell helpers used by both sides while the release flows are still transitional

These scripts now resolve the unified source root under `/opt/simplehostman/src`, even when their operational behavior is still product-specific.
They should continue treating the split control runtime as the operational default until the combined `apps/control` candidate is promoted beyond source-level validation.
For now, source validation of the candidate combined mode should happen through workspace commands such as `pnpm start:control:combined:dev`, `pnpm start:control:combined:smoke`, `pnpm test:control:parity`, and `pnpm test:control:combined-smoke`, not through production deploy scripts.
`pnpm check:control:candidate` is now the shortest canonical command for validating the combined candidate boundary from source.

## Shared helpers

- `lib/workspace-paths.sh`: canonical resolver for the workspace root, normalized release root, workspace version, and transitional runtime entrypoint paths
- `audit-legacy-roots.mjs`: workspace guard that fails if code or scripts reintroduce legacy-root references outside docs and ignored build output
