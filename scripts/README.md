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
For now, source validation of the candidate combined mode should happen through workspace commands such as `pnpm start:control:combined:dev`, `pnpm dev:control:combined`, `pnpm test:control:parity`, `pnpm test:control:runtime-parity`, `pnpm test:control:combined-smoke`, `pnpm test:control:combined:e2e`, `pnpm check:control:preflight`, `pnpm check:control:release-candidate`, `pnpm check:control:bundle-parity`, `pnpm check:control:promotion-ready`, `pnpm check:control:release-sandbox`, `pnpm check:control:release-shadow`, `pnpm check:control:release-handoff`, `pnpm check:control:release-target`, `pnpm check:control:release-root-staging`, `pnpm check:control:release-root-promotion`, `pnpm check:control:release-root-cutover`, `pnpm check:control:release-root-cutover-target`, `pnpm check:control:release-rehearsal`, `pnpm activate:control:release-sandbox -- <version> [sandboxId]`, `pnpm promote:control:release-sandbox -- <version> [sandboxId]`, `pnpm promotion-ready:control:release-sandbox`, `pnpm promotion-ready:control:release-shadow`, `pnpm promotion-ready:control:release-root-promotion`, `pnpm inspect:control:release-shadow -- [sandboxId]`, `pnpm handoff:control:release-shadow -- [sandboxId] [version]`, `pnpm apply:control:release-target -- [sandboxId] [version]`, `pnpm plan:control:release-root-staging -- [workspaceRoot] [version]`, `pnpm diff:control:release-root-staging -- [workspaceRoot] [version]`, `pnpm apply:control:release-root-staging -- [workspaceRoot] [version]`, `pnpm inspect:control:release-root-staging -- [workspaceRoot] [version]`, `pnpm start:control:release-root-staging -- [workspaceRoot] [version]`, `pnpm plan:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`, `pnpm diff:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`, `pnpm apply:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`, `pnpm inspect:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`, `pnpm activate:control:release-root-promotion -- <version> [targetId]`, `pnpm promote:control:release-root-promotion -- <version> [targetId]`, `pnpm start:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`, `pnpm plan:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`, `pnpm inspect:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`, `pnpm cutover-ready:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`, `pnpm apply:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`, `pnpm rollback:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`, `pnpm inspect:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`, `pnpm start:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`, `pnpm start:control:release-target`, `pnpm rehearse:control:release-shadow -- [sandboxId] [version]`, `pnpm pack:control:release-shadow`, and `pnpm start:control:release-shadow`, not through production deploy scripts.
`pnpm check:control:candidate` is now the shortest canonical command for validating the combined candidate boundary from source.

Current language:

- `split current`: operational runtime shape used by deploy scripts and current packaging
- `combined candidate`: source-level one-process candidate validated by unit/parity/smoke/e2e tests
- `combined preflight`: source-level candidate plus a human-readable pre-promotion check sequence, still fully workspace-local
- `combined release-candidate`: source-level candidate plus a release-like startup manifest and smoke runner, still below deploy/release promotion
- `combined bundle-parity`: source-level guarantee that the packed sandbox bundle still mirrors the direct combined candidate metadata
- `combined release-sandbox`: source-level candidate packed into a workspace-local release-shaped filesystem sandbox, still below deploy/release promotion
- `combined release-switch`: source-level release-sandbox candidate with inventory-backed version switching and rollback, still below deploy/release promotion
- `combined release-promotion`: source-level release-sandbox candidate with promotion manifests and history, still below deploy/release promotion
- `combined promotion-ready`: source-level release-sandbox candidate with deploy/rollback manifests plus a human-readable promotion-ready report, still below deploy/release promotion
- `combined release-shadow`: source-level candidate booted from a workspace-local shadow of `/opt/simplehostman/release`, with its own inventory, activation, deploy/rollback, and promotion-ready checks, still below deploy/release promotion
- `combined release-handoff`: source-level dry-run handoff plan that describes how the promoted release-shadow would be translated into `/opt/simplehostman/release`, still below deploy/release promotion
- `combined release-target`: source-level application of that handoff into a separate workspace-local emulated release root, still below deploy/release promotion
- `combined release-root staging`: source-level materialization of that handoff under `/opt/simplehostman/release/.staging/control`, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root promotion`: source-level promotion of that staged bundle into an emulated live release root sourced from `.staging/control`, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root promotion lifecycle`: inventory, activation, rollback, and promotion-ready checks for that emulated live release root, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root promotion cutover`: promotion history plus explicit cutover/rollback semantics for that emulated live release root, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root cutover`: plan-only cutover analysis against the actual release root, including rollback-candidate detection from the real `current` symlink shape, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root cutover target`: source-level application of that cutover plan into a separate workspace-local emulated actual release root, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-root cutover rollback`: source-level rollback rehearsal and cutover history on top of that emulated actual release root, still below deploy/release promotion because the real `current` root remains untouched
- `combined release-rehearsal`: source-level proof that the promoted release-shadow remains aligned with the release-sandbox it came from, still below deploy/release promotion

The current sandbox shape now mirrors a future release layout more closely by using:

- `releases/<version>`
- `current` symlink
- `shared/meta`
- `shared/{tmp,logs,run}`
- deploy/rollback manifests and summaries in `shared/meta`

## Shared helpers

- `lib/workspace-paths.sh`: canonical resolver for the workspace root, normalized release root, workspace version, and transitional runtime entrypoint paths
- `audit-legacy-roots.mjs`: workspace guard that fails if code or scripts reintroduce legacy-root references outside docs and ignored build output
