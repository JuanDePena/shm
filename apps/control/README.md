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
- `pnpm start:control:candidate`
- `pnpm start:control:combined`
- `pnpm start:control:combined:dev`
- `pnpm start:control:combined:smoke`
- `pnpm dev:control:combined`
- `pnpm start:control:split`
- `pnpm start:control:api`
- `pnpm start:control:web`
- `pnpm test:control`
- `pnpm test:control:combined-smoke`
- `pnpm test:control:combined:e2e`
- `pnpm test:control:parity`
- `pnpm check:control:candidate`

From this directory:

- `pnpm build`
- `pnpm typecheck:local`
- `pnpm start:combined`
- `pnpm start:candidate`
- `pnpm start:combined:dev`
- `pnpm start:combined:smoke`
- `pnpm dev:combined`
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
- `pnpm test:combined-smoke`
- `pnpm test:combined:e2e`
- `pnpm test:parity`
- `pnpm check:candidate`

## Migration notes

- `apps/control` is already the canonical source location for control-plane UI and API code.
- `apps/control/tsconfig.json` is the current ownership boundary for the transitional `control-shared`, `control-api`, `control-web`, and combined entrypoint candidate.
- `apps/control/src/index.ts` now represents a real one-process candidate that can serve UI and `/v1/*` on one request surface without changing the live runtime.
- `apps/control/src/index.ts` also supports explicit runtime mode selection through `SIMPLEHOST_CONTROL_RUNTIME_MODE=combined|split`.
- the web layer can now consume the API boundary either through HTTP or through an in-process `PanelWebApi` implementation.
- `apps/control/src/router.test.ts` now locks in the combined routing split between control health, `/v1/*`, and UI routes.
- `control-web` now mirrors the API boundary pattern with `WebRouteContext` plus route slices for core pages, session routes, and action routes.
- `control-web` now also exposes `createPanelWebSurface`, which plays the same role for UI routing that `PanelApiSurface` already plays for the API boundary.
- `WebRouteContext` now carries `sessionToken`, aligning the web auth/session seam more closely with `ApiRouteContext.bearerToken`.
- web-side login redirects, unauthorized handling, and login error rendering now flow through a shared auth/session helper layer and route-context factory.
- `PanelWebApi` now exposes semantic auth methods, reducing the remaining raw `/v1/auth/*` coupling inside `control-web`.
- `PanelWebApi` now also exposes `loadDashboardBootstrap()`, making the initial authenticated dashboard load an explicit surface instead of a route-local bundle of fetches.
- `PanelWebApi` now also exposes `resolveSession()` and `loadAuthenticatedDashboard()`, so the web boundary and the combined candidate can share the same session/bootstrap seam.
- `PanelWebApi` now also exposes semantic operational methods such as inventory export/import, reconcile dispatches, package actions, and proxy-preview loading, shrinking the remaining direct dependency on raw route strings inside `control-web`.
- `control-api` now exposes an auth surface, so the combined candidate can reuse semantic `login/logout/current user` operations without routing those paths back through HTTP in-process.
- `apps/control/src/bootstrap-surface.ts` now concentrates auth, dashboard bootstrap, runtime health, and the high-level API/web surfaces used by the combined candidate.
- `apps/control/src/combined-surface.ts` now acts as the central high-level primitive for the combined candidate, tying together the bootstrap surface, route surface, request-context factory, and request handler.
- `apps/control/src/server.ts` now exposes a reusable combined server candidate that can be started on an ephemeral port for smoke/e2e validation before any deploy/runtime promotion.
- the combined request handler now routes over `PanelApiSurface` and `PanelWebSurface` directly instead of wiring raw request listeners by hand.
- `apps/control/src/router.test.ts` now locks parity for key split-vs-combined routes such as `/`, `/login`, `/v1/auth/me`, and `/v1/resources/spec`.
- `apps/control/src/request-context.ts` now defines a combined per-request context with shared session resolution and authenticated dashboard loading.
- `apps/control/src/combined-smoke.test.ts` now exercises the combined candidate against real `PanelWebSurface` routing with a stubbed in-process API boundary.
- `apps/control/src/combined-server.test.ts` now starts the combined candidate on a real ephemeral HTTP port and validates an authenticated flow end-to-end.
- `apps/control/src/auth-gate.ts` now provides a cached combined auth/bootstrap gate, so the candidate can reuse resolved session and authenticated dashboard state inside one request.
- `apps/control/src/route-surface.ts` now gives the combined candidate a more semantic routing surface over health, API, and web requests.
- `apps/control/src/runtime-contract.ts` now makes the one-process candidate explicit as a source-level runtime contract before any deploy/runtime promotion.
- The remaining work is runtime unification and release normalization, not source ownership.
