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
The new combined runtime contract, combined surface/server candidate, and candidate checks are meant to reduce packaging risk before any service/unit changes happen.

The current runtime normalization target is:

- `/opt/simplehostman/release`
