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
- `pnpm test:control:preflight`
- `pnpm test:control:release-candidate`
- `pnpm test:control:bundle-parity`
- `pnpm test:control:release-sandbox`
- `pnpm test:control:candidate`
- `pnpm test:control:runtime-parity`
- `pnpm test:control:combined-smoke`
- `pnpm test:control:combined:e2e`
- `pnpm test:control:parity`
- `pnpm check:control:candidate`
- `pnpm check:control:release-candidate`
- `pnpm check:control:preflight`
- `pnpm check:control:bundle-parity`
- `pnpm check:control:release-sandbox`
- `pnpm pack:control:release-sandbox`
- `pnpm start:control:release-sandbox`

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
- `pnpm test:preflight`
- `pnpm test:release-candidate`
- `pnpm test:release-sandbox:bundle-parity`
- `pnpm test:release-sandbox`
- `pnpm test:candidate`
- `pnpm test:runtime-parity`
- `pnpm test:combined-smoke`
- `pnpm test:combined:e2e`
- `pnpm test:parity`
- `pnpm check:candidate`
- `pnpm check:preflight`
- `pnpm check:release-candidate`
- `pnpm check:release-sandbox:bundle-parity`
- `pnpm check:release-sandbox`
- `pnpm pack:release-sandbox`
- `pnpm start:release-sandbox`

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
- `apps/control/src/runtime-surface.ts` now formalizes the combined candidate as a reusable runtime surface instead of leaving that shape implicit in server/bootstrap wiring.
- `apps/control/src/test-harness.ts` now centralizes split/combined fixtures, stubbed API surfaces, and request-handler wiring for candidate validation.
- `apps/control/src/runtime-parity-harness.ts` now boots split and combined candidate servers behind one reusable HTTP comparison harness.
- `apps/control/src/preflight-surface.ts` now defines the source-level preflight surface for the combined candidate.
- `apps/control/src/preflight-runner.ts` now executes a human-readable pre-promotion check sequence over a real ephemeral combined candidate server.
- `apps/control/src/preflight-runner.test.ts` now validates both passing and degraded preflight outcomes.
- `apps/control/src/release-candidate-config.ts`, `startup-manifest.ts`, and `release-candidate-surface.ts` now define a release-like config and startup manifest for the combined candidate without touching deploy/runtime.
- `apps/control/src/release-candidate-runner.ts` and `release-candidate-cli.ts` now execute a more release-like combined candidate smoke pass with a structured startup manifest and human-readable report.
- `apps/control/src/release-candidate-runner.test.ts` now validates passing and degraded release-candidate scenarios, including mutation and proxy-preview failures.
- `apps/control/src/release-sandbox-layout.ts` now defines a workspace-local sandbox layout that simulates a release-shaped filesystem tree without touching `/opt/simplehostman/release`.
- `apps/control/src/release-sandbox-bundle.ts` now defines the persistent bundle contract and human-readable bundle summary for that sandbox.
- `apps/control/src/release-sandbox-pack.ts`, `release-sandbox-pack-cli.ts`, `release-sandbox-entrypoint.ts`, `release-sandbox-runner.ts`, and `release-sandbox-start-cli.ts` now materialize and boot the combined candidate from that sandbox using copied artifacts plus workspace `node_modules` links.
- `apps/control/src/release-sandbox-smoke.test.ts` and `release-sandbox-parity.test.ts` now validate both HTTP behavior and parity between the direct combined candidate and the sandbox-started candidate.
- `apps/control/src/release-sandbox-bundle-parity.test.ts` now validates that the packed sandbox bundle stays aligned with the direct combined candidate metadata.
- the release-sandbox now simulates a more realistic layout with `releases/<version>`, `current` as a symlink, and `shared/{tmp,logs,run}` while remaining fully workspace-local.
- `apps/control/src/request-context.test.ts` now locks the per-request caching behavior for session resolution, authenticated dashboard bootstrap, and health snapshot reuse.
- the combined request handler now routes over `PanelApiSurface` and `PanelWebSurface` directly instead of wiring raw request listeners by hand.
- `apps/control/src/router.test.ts` now locks parity for key split-vs-combined routes such as `/`, `/login`, `/v1/auth/me`, and `/v1/resources/spec`.
- `apps/control/src/request-context.ts` now defines a combined per-request context with shared session resolution and authenticated dashboard loading.
- `apps/control/src/runtime-parity.test.ts` now compares split and combined candidates over real HTTP servers for protected routes such as packages, desired-state mutations, mail mutations, proxy preview, and logout.
- `apps/control/src/combined-smoke.test.ts` now exercises the combined candidate against real `PanelWebSurface` routing with a stubbed in-process API boundary.
- `apps/control/src/combined-server.test.ts` now starts the combined candidate on a real ephemeral HTTP port and validates an authenticated flow end-to-end.
- `apps/control/src/auth-gate.ts` now provides a cached combined auth/bootstrap gate, so the candidate can reuse resolved session and authenticated dashboard state inside one request.
- `apps/control/src/request-context.ts` now exposes an explicit per-request cache object for auth/bootstrap memoization and health snapshot reuse.
- `apps/control/src/route-surface.ts` now gives the combined candidate a more semantic routing surface over health, API, and web requests.
- `apps/control/src/runtime-contract.ts` now makes the one-process candidate explicit as a source-level runtime contract before any deploy/runtime promotion.
- `apps/control/src/preflight-cli.ts` now prints a legible preflight report and exits non-zero on failure.
- `control-web` now routes semantic mail/domain/mailbox/quota mutations through `PanelWebApi`, further shrinking direct transport-shaped coupling.
- The remaining work is runtime unification and release normalization, not source ownership.

## Combined pre-promotion checklist

Before `combined` can move beyond source-only validation, all of these still need to hold:

- `pnpm test:runtime-parity` passes for representative protected routes
- `pnpm test:combined-smoke` passes against the real web surface and stubbed in-process API boundary
- `pnpm test:combined:e2e` passes against a real ephemeral combined candidate server
- `pnpm test:preflight` passes for both successful and degraded source-level preflight scenarios
- `pnpm preflight` prints a passing human-readable report for the current candidate
- `pnpm test:release-candidate` passes for both successful and degraded release-like candidate scenarios
- `pnpm release-candidate` prints a passing startup manifest plus release-like smoke report for the current candidate
- `pnpm check:release-candidate` stays green from `apps/control`
- `pnpm test:release-sandbox` passes for the workspace-local release-sandbox smoke and parity scenarios
- `pnpm test:release-sandbox:bundle-parity` passes for the persistent bundle contract and sandbox metadata
- `pnpm pack:release-sandbox` materializes a release-shaped sandbox bundle without touching `/opt/simplehostman/release`
- `pnpm start:release-sandbox` boots the sandboxed candidate successfully from copied artifacts and linked dependencies
- `pnpm check:release-sandbox:bundle-parity` stays green from `apps/control`
- `pnpm check:release-sandbox` stays green from `apps/control`
- `pnpm check:candidate` stays green from `apps/control`
- source-level `release-sandbox` is now the highest promoted state of `combined`
- the release-sandbox now models `current -> releases/<version>` and shared writable roots closely enough to support a future dry-run against a real release layout
- split mode remains the documented and packaged runtime default under `scripts/` and `packaging/`
