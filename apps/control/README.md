# Control App

`apps/control` is the canonical source boundary for the SimpleHost control plane.

Current root:

- `/opt/simplehostman/src/apps/control`

## Transitional layout

The source tree still keeps internal subtrees while ownership is unified:

- `shared/`: common runtime and process helpers for the control-plane boundary
- `api/`: transitional `control-api` entrypoint
- `web/`: transitional `control-web` entrypoint
- `src/`: transitional combined entrypoint candidate for future runtime unification

Subtree docs:

- `/opt/simplehostman/src/apps/control/shared/README.md`
- `/opt/simplehostman/src/apps/control/api/README.md`
- `/opt/simplehostman/src/apps/control/web/README.md`
- `/opt/simplehostman/src/apps/control/src/README.md`

The composite build boundary is:

- `/opt/simplehostman/src/apps/control/tsconfig.json`

This separation is temporary. The migration target is one control-plane app that serves UI and `/v1/*` from one process and one port.

## Current responsibilities

- operator and tenant-facing UI
- control-plane HTTP API
- authentication and sessions
- desired-state CRUD
- jobs, audit, drift, backups, packages, and operational views

## Commands

From `/opt/simplehostman/src`:

- `pnpm build:control`
- `pnpm typecheck:control`
- `pnpm start:control`
- `pnpm start:control:combined`
- `pnpm start:control:split`
- `pnpm start:control:api`
- `pnpm start:control:web`
- `pnpm test:control`

From this directory:

- `pnpm build`
- `pnpm typecheck:local`
- `pnpm start:combined`
- `pnpm start:api`
- `pnpm start:web`
- `pnpm build:shared`
- `pnpm build:api`
- `pnpm build:web`
- `pnpm build:entrypoint`
- `pnpm typecheck:shared`
- `pnpm typecheck:api`
- `pnpm typecheck:web`
- `pnpm typecheck:entrypoint`
- `pnpm start:split`
- `pnpm start:split:foreground`
- `pnpm test`

## Migration notes

- `apps/control` is already the canonical source location for control-plane UI and API code.
- `apps/control/tsconfig.json` is the current ownership boundary for the transitional `control-shared`, `control-api`, `control-web`, and combined entrypoint candidate.
- `apps/control/src/index.ts` now represents a real one-process candidate that can serve UI and `/v1/*` on one request surface without changing the live runtime.
- `apps/control/src/index.ts` also supports explicit runtime mode selection through `SIMPLEHOST_CONTROL_RUNTIME_MODE=combined|split`.
- the web layer can now consume the API boundary either through HTTP or through an in-process `PanelWebApi` implementation.
- `apps/control/src/router.test.ts` now locks in the combined routing split between control health, `/v1/*`, and UI routes.
- `control-web` now mirrors the API boundary pattern with `WebRouteContext` plus route slices for core pages, session routes, and action routes.
- `control-web` now also exposes `createPanelWebSurface`, which plays the same role for UI routing that `PanelApiSurface` already plays for the API boundary.
- The remaining work is runtime unification and release normalization, not source ownership.
