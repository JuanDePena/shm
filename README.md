# SimpleHost Unified Source Workspace

This repository is the canonical source tree for the SimpleHost platform.

Root path:

- `/opt/simplehostman/src`

The workspace is intentionally split into source migration and runtime migration.
At this stage, source code, packaging material, scripts, bootstrap inventory, and docs are being unified here first. Runtime and release normalization under `/opt/simplehostman/release` remains a later phase.

## Current top-level layout

```text
/opt/simplehostman/src
  /apps
    /control
    /worker
    /agent
    /cli
  /packages
  /platform
  /bootstrap
  /packaging
  /scripts
  /docs
```

## App ownership

- `apps/control`: control-plane UI and API source, currently with transitional `shared/`, `web/`, `api/`, and a combined entrypoint candidate under `src/`
- `apps/worker`: background and asynchronous control-plane work
- `apps/agent`: node-local execution agent
- `apps/cli`: break-glass and operator CLI

## Package ownership

- `packages/panel-*`: contracts, config, UI, testing, and persistence originating from `SHP`
- `packages/manager-*`: contracts, client, drivers, renderers, node config, and testing originating from `SHM`

These package names are still transitional and will be normalized later if needed. The source of truth is already this workspace.

## Build and validation

Useful commands:

- `pnpm install`
- `pnpm build`
- `pnpm build:clean-room`
- `pnpm build:control`
- `pnpm typecheck`
- `pnpm typecheck:control`
- `pnpm audit:legacy-roots`
- `pnpm test`
- `pnpm start:control`
- `pnpm start:control:candidate`
- `pnpm start:control:combined`
- `pnpm start:control:combined:dev`
- `pnpm start:control:combined:smoke`
- `pnpm dev:control:combined`
- `pnpm start:control:split`
- `pnpm start:control:api`
- `pnpm start:control:web`
- `pnpm test:control`
- `pnpm test:control:preflight`
- `pnpm test:control:release-candidate`
- `pnpm test:control:promotion-ready`
- `pnpm test:control:bundle-parity`
- `pnpm test:control:release-sandbox`
- `pnpm test:control:release-shadow`
- `pnpm test:control:release-root-staging`
- `pnpm test:control:release-root-promotion`
- `pnpm test:control:release-root-cutover`
- `pnpm test:control:release-root-cutover:handoff`
- `pnpm test:control:release-root-cutover:rehearsal`
- `pnpm test:control:release-root-cutover:parity`
- `pnpm test:control:release-root-cutover:gate`
- `pnpm test:control:release-root-cutover-target`
- `pnpm test:control:release-root-cutover-target:rollback`
- `pnpm test:control:release-root-cutover-target:ready`
- `pnpm test:control:release-root-cutover-target:rehearsal`
- `pnpm test:control:release-root-cutover-target:parity`
- `pnpm test:control:release-root-cutover-target:handoff`
- `pnpm test:control:release-root-promotion:activation`
- `pnpm test:control:release-root-promotion:promotion`
- `pnpm test:control:release-root-promotion:ready`
- `pnpm test:control:release-root-cutover`
- `pnpm test:control:release-target`
- `pnpm test:control:release-handoff`
- `pnpm test:control:release-shadow:promotion-ready`
- `pnpm test:control:release-rehearsal`
- `pnpm test:control:runtime-parity`
- `pnpm test:control:combined-smoke`
- `pnpm test:control:combined:e2e`
- `pnpm test:control:parity`
- `pnpm check:control:candidate`
- `pnpm check:control:preflight`
- `pnpm check:control:release-candidate`
- `pnpm check:control:promotion-ready`
- `pnpm check:control:bundle-parity`
- `pnpm check:control:release-sandbox`
- `pnpm check:control:release-shadow`
- `pnpm check:control:release-root-staging`
- `pnpm check:control:release-root-promotion`
- `pnpm check:control:release-root-cutover`
- `pnpm promote:control:release-root-promotion -- <version> [targetId]`
- `pnpm promotion-ready:control:release-root-promotion`
- `pnpm check:control:release-target`
- `pnpm check:control:release-handoff`
- `pnpm check:control:release-rehearsal`
- `pnpm inspect:control:release-shadow -- [sandboxId]`
- `pnpm promotion-ready:control:release-shadow`
- `pnpm apply:control:release-target -- [sandboxId] [version]`
- `pnpm plan:control:release-root-staging -- [workspaceRoot] [version]`
- `pnpm diff:control:release-root-staging -- [workspaceRoot] [version]`
- `pnpm apply:control:release-root-staging -- [workspaceRoot] [version]`
- `pnpm inspect:control:release-root-staging -- [workspaceRoot] [version]`
- `pnpm start:control:release-root-staging -- [workspaceRoot] [version]`
- `pnpm plan:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm diff:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm apply:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm inspect:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm activate:control:release-root-promotion -- <version> [targetId]`
- `pnpm promote:control:release-root-promotion -- <version> [targetId]`
- `pnpm start:control:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm plan:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm inspect:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm cutover-ready:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm handoff:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm rehearse:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm parity:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm gate:control:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm cutover-ready:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm rehearse:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version] [previousVersion]`
- `pnpm parity:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version] [previousVersion] [actualReleaseRoot]`
- `pnpm handoff:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version] [previousVersion] [actualReleaseRoot]`
- `pnpm start:control:release-target`
- `pnpm handoff:control:release-shadow -- [sandboxId] [version]`
- `pnpm rehearse:control:release-shadow -- [sandboxId] [version]`
- `pnpm pack:control:release-sandbox`
- `pnpm activate:control:release-sandbox -- <version> [sandboxId]`
- `pnpm promote:control:release-sandbox -- <version> [sandboxId]`
- `pnpm promotion-ready:control:release-sandbox`
- `pnpm inspect:control:release-sandbox -- [sandboxId]`
- `pnpm start:control:release-sandbox`
- `pnpm pack:control:release-shadow`
- `pnpm start:control:release-shadow`
- `pnpm inspect:control:release-shadow -- [sandboxId]`
- `pnpm start:worker`
- `pnpm start:agent`
- `pnpm start:cli`

## Transitional notes

- `/opt/simplehostman/repos/simplehost-panel` and `/opt/simplehostman/repos/simplehost-manager` remain legacy reference trees during the migration.
- `/opt/simplehostman/release` is the runtime/release root being normalized in a later phase.
- Do not treat legacy repos as the canonical source unless a migration task explicitly requires comparing against them.

## Key references

- [`/opt/simplehostman/src/docs/AGENTS.md`](/opt/simplehostman/src/docs/AGENTS.md)
- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [`/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md`](/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md)
- [`/opt/simplehostman/src/apps/control/README.md`](/opt/simplehostman/src/apps/control/README.md)
- [`/opt/simplehostman/src/apps/control/api/README.md`](/opt/simplehostman/src/apps/control/api/README.md)
- [`/opt/simplehostman/src/apps/control/web/README.md`](/opt/simplehostman/src/apps/control/web/README.md)
- [`/opt/simplehostman/src/apps/control/shared/README.md`](/opt/simplehostman/src/apps/control/shared/README.md)
- [`/opt/simplehostman/src/apps/control/src/README.md`](/opt/simplehostman/src/apps/control/src/README.md)
- [`/opt/simplehostman/src/apps/worker/README.md`](/opt/simplehostman/src/apps/worker/README.md)
- [`/opt/simplehostman/src/apps/agent/README.md`](/opt/simplehostman/src/apps/agent/README.md)
- [`/opt/simplehostman/src/apps/cli/README.md`](/opt/simplehostman/src/apps/cli/README.md)
- [`/opt/simplehostman/src/packages/README.md`](/opt/simplehostman/src/packages/README.md)
- [`/opt/simplehostman/src/platform/README.md`](/opt/simplehostman/src/platform/README.md)
- [`/opt/simplehostman/src/bootstrap/README.md`](/opt/simplehostman/src/bootstrap/README.md)
- [`/opt/simplehostman/src/packaging/README.md`](/opt/simplehostman/src/packaging/README.md)
- [`/opt/simplehostman/src/scripts/README.md`](/opt/simplehostman/src/scripts/README.md)
