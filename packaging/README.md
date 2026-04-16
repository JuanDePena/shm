# Packaging

This directory contains imported packaging material for the unified source workspace.

Path:

- `/opt/simplehostman/src/packaging`

## Current transitional split

- `panel/`: packaging imported from the former `SHP` repository
- `manager/`: packaging imported from the former `SHM` repository

This split is transitional and exists to avoid mixing source migration with runtime/release convergence.
For now, packaging should keep assuming the deployed control plane remains in split mode even though `apps/control` already has a validated combined candidate in source.
Source-level combined-mode validation currently lives in workspace scripts and tests only; packaging should not yet promote that candidate to the default runtime.
That validation now explicitly includes runtime parity checks (`pnpm test:control:runtime-parity`) in addition to handler-level parity and combined-server smoke coverage.
It also now includes a source-level preflight report (`pnpm check:control:preflight`), a release-like source smoke runner (`pnpm check:control:release-candidate`), a bundle-contract check (`pnpm check:control:bundle-parity`), and a workspace-local release-sandbox check (`pnpm check:control:release-sandbox`), but all of them still remain below any packaging or release promotion threshold.
The new combined runtime contract, combined surface/server candidate, and candidate checks are meant to reduce packaging risk before any service/unit changes happen.

Current language:

- `split current`: packaged and deployed runtime model
- `combined candidate`: source-level one-process candidate
- `combined preflight`: source-level candidate with a human-readable pre-promotion check, still not packaging-ready
- `combined release-candidate`: source-level candidate with a release-like startup manifest and smoke runner, still not packaging-ready
- `combined bundle-parity`: source-level candidate whose packed sandbox bundle still matches direct candidate metadata, still not packaging-ready
- `combined release-sandbox`: source-level candidate packed and booted from a workspace-local release-shaped sandbox, still not packaging-ready
- `combined release-switch`: source-level release-sandbox candidate with inventory-backed version switching and rollback, still not packaging-ready
- `combined release-promotion`: source-level release-sandbox candidate with promotion manifests and history, still not packaging-ready

That sandbox now models a more realistic release layout with:

- `releases/<version>`
- `current` symlink
- `shared/meta`
- `shared/{tmp,logs,run}`

The current runtime normalization target is:

- `/opt/simplehostman/release`
