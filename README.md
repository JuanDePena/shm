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
- `pnpm start:control:combined`
- `pnpm start:control:split`
- `pnpm start:control:api`
- `pnpm start:control:web`
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
