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
For now, source validation of the candidate combined mode should happen through workspace commands such as `pnpm start:control:combined:dev`, `pnpm dev:control:combined`, `pnpm test:control:parity`, `pnpm test:control:runtime-parity`, `pnpm test:control:combined-smoke`, `pnpm test:control:combined:e2e`, `pnpm check:control:preflight`, `pnpm check:control:release-candidate`, and `pnpm check:control:release-sandbox`, not through production deploy scripts.
`pnpm check:control:candidate` is now the shortest canonical command for validating the combined candidate boundary from source.

Current language:

- `split current`: operational runtime shape used by deploy scripts and current packaging
- `combined candidate`: source-level one-process candidate validated by unit/parity/smoke/e2e tests
- `combined preflight`: source-level candidate plus a human-readable pre-promotion check sequence, still fully workspace-local
- `combined release-candidate`: source-level candidate plus a release-like startup manifest and smoke runner, still below deploy/release promotion
- `combined release-sandbox`: source-level candidate packed into a workspace-local release-shaped filesystem sandbox, still below deploy/release promotion

## Shared helpers

- `lib/workspace-paths.sh`: canonical resolver for the workspace root, normalized release root, workspace version, and transitional runtime entrypoint paths
- `audit-legacy-roots.mjs`: workspace guard that fails if code or scripts reintroduce legacy-root references outside docs and ignored build output
