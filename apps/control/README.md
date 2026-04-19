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
- `pnpm test:control:promotion-ready`
- `pnpm test:control:bundle-parity`
- `pnpm test:control:release-sandbox`
- `pnpm test:control:release-shadow`
- `pnpm test:control:release-root-staging`
- `pnpm test:control:release-root-promotion`
- `pnpm test:control:release-root-promotion:activation`
- `pnpm test:control:release-root-promotion:promotion`
- `pnpm test:control:release-root-promotion:ready`
- `pnpm test:control:release-root-cutover`
- `pnpm test:control:release-root-cutover:handoff`
- `pnpm test:control:release-root-cutover:rehearsal`
- `pnpm test:control:release-root-cutover-target`
- `pnpm test:control:release-root-cutover-target:rollback`
- `pnpm test:control:release-target`
- `pnpm test:control:release-handoff`
- `pnpm test:control:release-shadow:promotion-ready`
- `pnpm test:control:release-rehearsal`
- `pnpm test:control:candidate`
- `pnpm test:control:runtime-parity`
- `pnpm test:control:combined-smoke`
- `pnpm test:control:combined:e2e`
- `pnpm test:control:parity`
- `pnpm check:control:candidate`
- `pnpm check:control:release-candidate`
- `pnpm check:control:preflight`
- `pnpm check:control:promotion-ready`
- `pnpm check:control:bundle-parity`
- `pnpm check:control:release-sandbox`
- `pnpm check:control:release-shadow`
- `pnpm check:control:release-root-staging`
- `pnpm check:control:release-root-promotion`
- `pnpm check:control:release-root-cutover`
- `pnpm check:control:release-root-cutover-target`
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
- `pnpm apply:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm rollback:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm inspect:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm start:control:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm start:control:release-target`
- `pnpm handoff:control:release-shadow -- [sandboxId] [version]`
- `pnpm rehearse:control:release-shadow -- [sandboxId] [version]`
- `pnpm pack:control:release-sandbox`
- `pnpm pack:control:release-shadow`
- `pnpm activate:control:release-sandbox -- <version> [sandboxId]`
- `pnpm promote:control:release-sandbox -- <version> [sandboxId]`
- `pnpm promotion-ready:control:release-sandbox`
- `pnpm inspect:control:release-sandbox -- [sandboxId]`
- `pnpm start:control:release-sandbox`
- `pnpm start:control:release-shadow`
- `pnpm inspect:control:release-shadow -- [sandboxId]`

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
- `pnpm test:release-sandbox:promotion-ready`
- `pnpm test:release-sandbox:bundle-parity`
- `pnpm test:release-sandbox`
- `pnpm test:release-shadow`
- `pnpm test:release-root-staging`
- `pnpm test:release-root-promotion`
- `pnpm test:release-root-promotion:activation`
- `pnpm test:release-root-promotion:promotion`
- `pnpm test:release-root-promotion:ready`
- `pnpm test:release-root-cutover`
- `pnpm test:release-root-cutover:handoff`
- `pnpm test:release-root-cutover:rehearsal`
- `pnpm test:release-root-cutover-target`
- `pnpm test:release-root-cutover-target:rollback`
- `pnpm test:release-target`
- `pnpm test:release-handoff`
- `pnpm test:release-shadow:promotion-ready`
- `pnpm test:release-rehearsal`
- `pnpm test:candidate`
- `pnpm test:runtime-parity`
- `pnpm test:combined-smoke`
- `pnpm test:combined:e2e`
- `pnpm test:parity`
- `pnpm check:candidate`
- `pnpm check:preflight`
- `pnpm check:release-candidate`
- `pnpm check:release-sandbox:promotion-ready`
- `pnpm check:release-sandbox:bundle-parity`
- `pnpm check:release-sandbox`
- `pnpm check:release-shadow`
- `pnpm check:release-root-staging`
- `pnpm check:release-root-promotion`
- `pnpm check:release-root-cutover`
- `pnpm check:release-root-cutover-target`
- `pnpm promote:release-root-promotion -- <version> [targetId]`
- `pnpm promotion-ready:release-root-promotion`
- `pnpm check:release-target`
- `pnpm check:release-handoff`
- `pnpm check:release-rehearsal`
- `pnpm inspect:release-shadow -- [sandboxId]`
- `pnpm promotion-ready:release-shadow`
- `pnpm apply:release-target -- [sandboxId] [version]`
- `pnpm plan:release-root-staging -- [workspaceRoot] [version]`
- `pnpm diff:release-root-staging -- [workspaceRoot] [version]`
- `pnpm apply:release-root-staging -- [workspaceRoot] [version]`
- `pnpm inspect:release-root-staging -- [workspaceRoot] [version]`
- `pnpm start:release-root-staging -- [workspaceRoot] [version]`
- `pnpm plan:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm diff:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm apply:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm inspect:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm activate:release-root-promotion -- <version> [targetId]`
- `pnpm promote:release-root-promotion -- <version> [targetId]`
- `pnpm start:release-root-promotion -- [workspaceRoot] [targetId] [version]`
- `pnpm plan:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm inspect:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm cutover-ready:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot]`
- `pnpm handoff:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm rehearse:release-root-cutover -- [workspaceRoot] [targetId] [version] [actualReleaseRoot] [previousVersion]`
- `pnpm apply:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm cutover-ready:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm rehearse:release-root-cutover-target -- [workspaceRoot] [targetId] [version] [previousVersion]`
- `pnpm parity:release-root-cutover-target -- [workspaceRoot] [targetId] [version] [previousVersion] [actualReleaseRoot]`
- `pnpm rollback:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm inspect:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm start:release-root-cutover-target -- [workspaceRoot] [targetId] [version]`
- `pnpm start:release-target`
- `pnpm release-handoff -- [sandboxId] [version]`
- `pnpm release-rehearsal -- [sandboxId] [version]`
- `pnpm pack:release-sandbox`
- `pnpm pack:release-shadow`
- `pnpm activate:release-sandbox -- <version> [sandboxId]`
- `pnpm promote:release-sandbox -- <version> [sandboxId]`
- `pnpm promotion-ready`
- `pnpm inspect:release-sandbox -- [sandboxId]`
- `pnpm start:release-sandbox`
- `pnpm start:release-shadow`
- `pnpm inspect:release-shadow -- [sandboxId]`

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
- `apps/control/src/release-sandbox-activation.ts`, `release-sandbox-activate-cli.ts`, and `release-sandbox-inspect-cli.ts` now expose release inventory plus version switching inside that sandbox.
- `apps/control/src/release-sandbox-promotion.ts` and `release-sandbox-promote-cli.ts` now expose promotion metadata and history inside that sandbox.
- `apps/control/src/release-sandbox-deployment.ts` and `release-sandbox-promotion-ready.ts` now expose deploy/rollback manifests plus a promotion-ready report for the promoted sandbox state.
- `apps/control/src/release-sandbox-pack.ts`, `release-sandbox-pack-cli.ts`, `release-sandbox-entrypoint.ts`, `release-sandbox-runner.ts`, and `release-sandbox-start-cli.ts` now materialize and boot the combined candidate from that sandbox using copied artifacts plus workspace `node_modules` links.
- `apps/control/src/release-sandbox-smoke.test.ts` and `release-sandbox-parity.test.ts` now validate both HTTP behavior and parity between the direct combined candidate and the sandbox-started candidate.
- `apps/control/src/release-sandbox-bundle-parity.test.ts` now validates that the packed sandbox bundle stays aligned with the direct combined candidate metadata.
- `apps/control/src/release-sandbox-activation.test.ts` now validates switching and rollback between packed versions within one sandbox.
- `apps/control/src/release-sandbox-promotion.test.ts` now validates promotion metadata and rollback history for those sandboxed releases.
- `apps/control/src/release-sandbox-promotion-ready.test.ts` now validates deploy/rollback manifests and the promotion-ready report for the promoted sandbox candidate.
- the release-sandbox now simulates a more realistic layout with `releases/<version>`, `current` as a symlink, persistent promotion metadata in `shared/meta`, and `shared/{tmp,logs,run}` while remaining fully workspace-local.
- the release-sandbox now also materializes `deploy.json`, `deploy-summary.txt`, `rollback.json`, and `rollback-summary.txt` inside `shared/meta`, making sandbox promotion closer to a future release rehearsal.
- `apps/control/src/release-shadow-activation.ts`, `release-shadow-promotion.ts`, `release-shadow-deployment.ts`, `release-shadow-inspect-cli.ts`, and `release-shadow-promotion-ready.ts` now give the release-root shadow its own inventory, activation/promote metadata, deploy/rollback manifests, inspection output, and promotion-ready report.
- `apps/control/src/release-shadow-handoff.ts`, `release-shadow-handoff-runner.ts`, `release-shadow-handoff-cli.ts`, and `release-shadow-handoff.test.ts` now define and validate a dry-run handoff plan from the promoted `release-shadow` toward `/opt/simplehostman/release`, without touching the real release root.
- `apps/control/src/release-target-layout.ts`, `release-target-apply.ts`, `release-target-runner.ts`, `release-target-apply-cli.ts`, `release-target-start-cli.ts`, and `release-target.test.ts` now apply that handoff into a separate workspace-local emulated release root and validate that the resulting runtime still matches the promoted shadow.
- `apps/control/src/release-root-staging-layout.ts`, `release-root-staging.ts`, `release-root-staging-runner.ts`, `release-root-staging-plan-cli.ts`, `release-root-staging-diff-cli.ts`, `release-root-staging-apply-cli.ts`, `release-root-staging-inspect-cli.ts`, `release-root-staging-start-cli.ts`, and `release-root-staging.test.ts` now materialize that handoff under `/opt/simplehostman/release/.staging/control`, validate drift and startup there, and prove parity against the workspace-local `release-target` without touching the real `current`.
- `apps/control/src/release-root-cutover-layout.ts`, `release-root-cutover.ts`, `release-root-cutover-ready.ts`, `release-root-cutover-plan-cli.ts`, `release-root-cutover-ready-cli.ts`, `release-root-cutover-inspect-cli.ts`, and `release-root-cutover.test.ts` now define a plan-only cutover layer toward the actual release root, including rollback-candidate detection from the real `current` symlink shape without mutating it.
- `apps/control/src/release-root-cutover-handoff.ts`, `release-root-cutover-handoff-cli.ts`, and `release-root-cutover-handoff.test.ts` now consolidate that actual cutover plan/ready layer with the emulated target handoff, producing one auditable artifact before any move toward the real `current`.
- `apps/control/src/release-root-cutover-target-layout.ts`, `release-root-cutover-target.ts`, `release-root-cutover-target-runner.ts`, `release-root-cutover-target-apply-cli.ts`, `release-root-cutover-target-start-cli.ts`, `release-root-cutover-target-inspect-cli.ts`, and `release-root-cutover-target.test.ts` now apply that cutover plan into a separate workspace-local emulated actual release root and prove that the cutover result still matches `release-root promotion`.
- `apps/control/src/release-root-cutover-target-rollback.ts`, `release-root-cutover-target-rollback-cli.ts`, and `release-root-cutover-target-rollback.test.ts` now add rollback rehearsal plus cutover history on top of that emulated actual release root.
- `apps/control/src/release-root-cutover-target-ready.ts`, `release-root-cutover-target-ready-cli.ts`, and `release-root-cutover-target-ready.test.ts` now add a `cutover-ready` report for that emulated actual release root, validating manifests, history, `current`, `healthz`, and login without touching the real release root.
- `apps/control/src/release-root-cutover-target-rehearsal.ts`, `release-root-cutover-target-rehearsal-cli.ts`, and `release-root-cutover-target-rehearsal.test.ts` now add an end-to-end cutover rehearsal that seeds a previous `current`, validates `ready`, executes rollback, and persists a rehearsal report over the emulated actual release root.
- `apps/control/src/release-root-cutover-target-parity.ts`, `release-root-cutover-target-parity-cli.ts`, and `release-root-cutover-target-parity.test.ts` now bridge the actual cutover plan/ready layer with the emulated target rehearsal, proving that what was rehearsed matches what the real cutover plan would do.
- `apps/control/src/release-root-cutover-target-handoff.ts`, `release-root-cutover-target-handoff-cli.ts`, and `release-root-cutover-target-handoff.test.ts` now consolidate `target ready`, actual cutover `ready`, rehearsal, and parity into one auditable handoff artifact before any move toward the real `current`.
- the release-shadow now keeps multi-version inventory plus `shared/meta` activation/promotion/deploy state of its own, making it behave more like a real release root rehearsal instead of a single packed copy.
- `apps/control/src/release-rehearsal.ts`, `release-rehearsal-cli.ts`, and `release-rehearsal.test.ts` now validate that the promoted release-shadow stays aligned with the release-sandbox it came from, both in metadata and in representative HTTP behavior.
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
- `pnpm test:release-sandbox:promotion-ready` passes for the deploy/rollback manifest contract and the promotion-ready report
- `pnpm pack:release-sandbox` materializes a release-shaped sandbox bundle without touching `/opt/simplehostman/release`
- `pnpm activate:release-sandbox -- <version> [sandboxId]` switches `current` between packed versions inside the workspace-local sandbox
- `pnpm promote:release-sandbox -- <version> [sandboxId]` records a release-like promotion manifest and promotion history for the active sandboxed version
- `pnpm promotion-ready` now prints a release-like promotion-ready report after validating promotion, deploy/rollback manifests, health, login, and active version state inside the sandbox
- `pnpm inspect:release-sandbox -- [sandboxId]` prints the inventory plus active release metadata for that sandbox
- `pnpm start:release-sandbox` boots the sandboxed candidate successfully from copied artifacts and linked dependencies
- `pnpm check:release-sandbox:promotion-ready` stays green from `apps/control`
- `pnpm check:release-sandbox:bundle-parity` stays green from `apps/control`
- `pnpm check:release-sandbox` stays green from `apps/control`
- `pnpm check:release-shadow` stays green from `apps/control`
- `pnpm check:release-handoff` stays green from `apps/control`
- `pnpm check:release-target` stays green from `apps/control`
- `pnpm check:release-root-staging` stays green from `apps/control`
- `pnpm check:release-rehearsal` stays green from `apps/control`
- `pnpm check:candidate` stays green from `apps/control`
- source-level `release-root staging` is now the highest promoted state of `combined`
- the release rehearsal now reaches `/opt/simplehostman/release/.staging/control` while keeping `/opt/simplehostman/release/current` untouched
- split mode remains the documented and packaged runtime default under `scripts/` and `packaging/`
