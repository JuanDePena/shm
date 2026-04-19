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
It also now includes a source-level preflight report (`pnpm check:control:preflight`), a release-like source smoke runner (`pnpm check:control:release-candidate`), a bundle-contract check (`pnpm check:control:bundle-parity`), a promotion-ready sandbox check (`pnpm check:control:promotion-ready`), a workspace-local release-sandbox check (`pnpm check:control:release-sandbox`), a workspace-local release-shadow check (`pnpm check:control:release-shadow`), a dry-run handoff check (`pnpm check:control:release-handoff`) that describes how the promoted shadow would map into `/opt/simplehostman/release`, a release-target check (`pnpm check:control:release-target`) that applies that handoff into a separate emulated release root, a release-root staging check (`pnpm check:control:release-root-staging`) that materializes it under `/opt/simplehostman/release/.staging/control` without touching the real `current`, a release-root promotion check (`pnpm check:control:release-root-promotion`) that promotes the staged bundle into an emulated live release root and now exercises inventory, activation, cutover history, rollback manifests, and promotion-ready behavior there, a release-root cutover check (`pnpm check:control:release-root-cutover`) that plans the eventual cutover against the actual release root and now emits a consolidated actual-root handoff artifact too, a release-root cutover target check (`pnpm check:control:release-root-cutover-target`) that applies that plan into a separate workspace-local emulated actual release root and now rehearses `ready`, rollback, a full cutover cycle, parity back to the real cutover plan, and a consolidated handoff artifact too, and a rehearsal check (`pnpm check:control:release-rehearsal`) that proves the promoted shadow still matches the sandbox it came from, but all of them still remain below any packaging or release promotion threshold.
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
- `combined promotion-ready`: source-level release-sandbox candidate with deploy/rollback manifests plus a human-readable promotion-ready report, still not packaging-ready
- `combined release-shadow`: source-level candidate booted from a workspace-local shadow of `/opt/simplehostman/release`, with its own inventory, activation, deploy/rollback, and promotion-ready checks, still not packaging-ready
- `combined release-handoff`: source-level dry-run handoff plan from the promoted release-shadow toward `/opt/simplehostman/release`, still not packaging-ready
- `combined release-target`: source-level application of that handoff into a separate workspace-local emulated release root, still not packaging-ready
- `combined release-root staging`: source-level materialization of that handoff under `/opt/simplehostman/release/.staging/control`, still not packaging-ready
- `combined release-root promotion`: source-level promotion of that staged bundle into an emulated live release root sourced from `.staging/control`, still not packaging-ready
- `combined release-root promotion lifecycle`: inventory, activation, rollback, and promotion-ready checks for that emulated live release root, still not packaging-ready
- `combined release-root promotion cutover`: promotion history plus explicit cutover/rollback semantics for that emulated live release root, still not packaging-ready
- `combined release-root cutover`: plan-only cutover analysis against the actual release root, still not packaging-ready
- `combined release-root cutover handoff`: source-level consolidated handoff artifact over the actual release-root cutover layer, still not packaging-ready
- `combined release-root cutover target`: source-level application of that cutover plan into a separate workspace-local emulated actual release root, still not packaging-ready
- `combined release-root cutover rollback`: source-level rollback rehearsal and cutover history on top of that emulated actual release root, still not packaging-ready
- `combined release-root cutover ready`: source-level readiness report for that emulated actual release root, still not packaging-ready
- `combined release-root cutover rehearsal`: source-level end-to-end cutover -> ready -> rollback rehearsal on that emulated actual release root, still not packaging-ready
- `combined release-root cutover parity`: source-level proof that the actual cutover plan and the emulated target rehearsal stay aligned, still not packaging-ready
- `combined release-root cutover handoff`: source-level consolidated handoff artifact over that emulated actual release root, still not packaging-ready
- `combined release-rehearsal`: source-level proof that the promoted release-shadow remains aligned with the release-sandbox it came from, still not packaging-ready

That sandbox now models a more realistic release layout with:

- `releases/<version>`
- `current` symlink
- `shared/meta`
- `shared/{tmp,logs,run}`
- deploy/rollback manifests and summaries in `shared/meta`

The current runtime normalization target is:

- `/opt/simplehostman/release`
