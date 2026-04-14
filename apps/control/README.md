# Control App

`apps/control` is the canonical source boundary for the SimpleHost control plane.

Current root:

- `/opt/simplehostman/src/apps/control`

## Transitional layout

The source tree still keeps two internal entrypoints while ownership is unified:

- `api/`: transitional `control-api` entrypoint
- `web/`: transitional `control-web` entrypoint

Sub-entrypoint docs:

- `/opt/simplehostman/src/apps/control/api/README.md`
- `/opt/simplehostman/src/apps/control/web/README.md`

This separation is temporary. The migration target is one control-plane app that serves UI and `/v1/*` from one process and one port.

## Current responsibilities

- operator and tenant-facing UI
- control-plane HTTP API
- authentication and sessions
- desired-state CRUD
- jobs, audit, drift, backups, packages, and operational views

## Commands

From `/opt/simplehostman/src`:

- `pnpm start:control:api`
- `pnpm start:control:web`

From this directory:

- `pnpm start:api`
- `pnpm start:web`
- `pnpm build:api`
- `pnpm build:web`
- `pnpm typecheck:api`
- `pnpm typecheck:web`

## Migration notes

- `apps/control` is already the canonical source location for control-plane UI and API code.
- The remaining work is runtime unification and release normalization, not source ownership.
