# Unified Source Migration Plan

Date drafted: 2026-04-14
Status: in progress
Target root: `/opt/simplehostman/src`

## Purpose

This document defines the phased migration from the current split source trees:

- `/opt/simplehostman/repos/simplehost-panel`
- `/opt/simplehostman/repos/simplehost-manager`
- `/opt/simplehostman/src/docs`

into a single unified source workspace rooted at `/opt/simplehostman/src`.

This migration is intentionally separated into two tracks:

1. source layout migration
2. runtime and release migration

The source trees should be unified first. The runtime layout under `/opt/simplehostman/release` should only be finalized after the new workspace compiles and the product boundaries are stable.

Current checkpoint on 2026-04-14:

- `/opt/simplehostman/src` is now a working pnpm workspace and the canonical source tree
- `bootstrap`, `platform`, `packaging`, `scripts`, and `docs/MIGRATIONS` are imported under `src`
- `worker`, `agent`, and `cli` are imported under `src/apps/*`
- `apps/control` now owns the transitional `control-shared`, `control-api`, `control-web`, and combined-entrypoint source trees
- root and app READMEs now live inside `src` and replace the old repo-level README references for architecture work
- imported release scripts now resolve the unified source root correctly from `src/scripts/*`
- imported panel and manager service templates now point at `/opt/simplehostman/release/current` and the current app paths under `apps/control`, `apps/worker`, and `apps/agent`
- canonical README files now exist for `apps/*`, `packages`, `platform`, `bootstrap`, `packaging`, and `scripts` inside `src`
- `apps/control/tsconfig.json` now acts as the composite source boundary for the transitional `control-shared`, `control-api`, `control-web`, and combined entrypoint candidate
- root workspace build slices now exist for `panel-runtime` and `manager-runtime` through `tsconfig.panel.json`, `tsconfig.manager.json`, and matching root scripts
- imported panel and manager release scripts now share a canonical path helper in `src/scripts/lib/workspace-paths.sh`
- `apps/control/src/index.ts` now exists as a transitory one-process candidate that can serve UI routes and `/v1/*` from one combined request surface without changing the current runtime model
- the web layer now depends on an injected `PanelWebApi` interface instead of a hard-wired module-global HTTP client, and the combined candidate already uses an in-process implementation backed by the API request handler
- the combined control candidate now has a pure router layer, source-level routing tests, and explicit `combined|split` mode selection through `SIMPLEHOST_CONTROL_RUNTIME_MODE`
- `control-web` now mirrors the API route-handler style through `WebRouteContext` plus dedicated route slices for core pages, session flows, and action handlers
- `control-web` also now exposes a reusable `PanelWebSurface`, and health payload construction is shared across `api`, `web`, and `control` through `control-shared`
- `WebRouteContext` now owns the per-request `sessionToken`, so dashboard rendering, desired-state mutations, mail actions, and operational actions all reuse the same web-side auth/session seam
- web-side auth/session UX now has a shared helper layer for route-context creation, login redirects, cookie clearing, and login-error rendering, reducing duplication before full runtime convergence
- `PanelWebApi` now exposes semantic auth methods for `login`, `logout`, and `current user`, shrinking the remaining direct dependency on raw auth route strings inside `control-web`
- `PanelWebApi` now also exposes `loadDashboardBootstrap()`, making the initial authenticated dashboard load a first-class surface instead of a route-local bundle of fetches
- the combined control candidate now routes over `PanelApiSurface` and `PanelWebSurface` directly, and source tests now lock basic split-vs-combined parity for key routes (`/`, `/login`, `/v1/auth/me`, `/v1/resources/spec`)
- `control-api` now exposes a semantic auth surface, `control-shared` owns reusable auth/dashboard-bootstrap helpers, and the combined candidate now concentrates auth/bootstrap/runtime concerns in `apps/control/src/bootstrap-surface.ts`
- `control-shared` now also owns shared session resolution (`resolveControlSession`, `requireControlSession`) and authenticated dashboard bootstrap helpers that both `control-web` and the combined candidate consume
- `apps/control/src/request-context.ts` now represents the per-request combined runtime context, including session resolution and authenticated dashboard loading
- explicit source-level combined-runtime aliases now exist (`pnpm start:control:combined:dev`, `pnpm test:control:parity`) while packaging and scripts still document split mode as the operational default
- an additional smoke layer now exists for the combined candidate through `pnpm start:control:combined:smoke` and `pnpm test:control:combined-smoke`, using the real `PanelWebSurface` against a stubbed in-process API boundary
- `apps/control/src/auth-gate.ts`, `apps/control/src/route-surface.ts`, and `apps/control/src/runtime-contract.ts` now make the combined candidate more explicit: cached auth/bootstrap per request, semantic routing over health/API/web, and a named runtime contract for future one-process promotion
- `control-web` now caches `resolveSession()`, `requireSession()`, and `loadAuthenticatedDashboard()` per request, and several protected routes now consume `requireSession()` rather than the older raw session-token seam
- `control-shared` now exposes a reusable `createControlSessionSurface()` seam, and both the combined candidate and `control-web` use that direction to keep session resolution more uniform
- `PanelWebApi` now also exposes semantic operational methods for inventory export/import, reconcile dispatches, package actions, and proxy-preview loading, reducing transport-shaped coupling inside `control-web`
- `apps/control/src/combined-surface.ts` now acts as the central high-level primitive for the one-process candidate, wiring together bootstrap, route surface, request-context creation, and the combined request handler
- `apps/control/src/server.ts` now exposes a reusable combined server candidate that can be booted on an ephemeral port for workspace-level smoke validation
- `apps/control/src/combined-server.test.ts` now exercises that real HTTP candidate with an authenticated end-to-end flow, complementing the split-vs-combined parity smoke tests
- `apps/control/src/test-harness.ts` now centralizes stubbed API surfaces, shared fixtures, and split-vs-combined request-handler wiring so candidate tests reuse one canonical setup
- `apps/control/src/runtime-parity-harness.ts` now boots split and combined candidate servers behind one reusable HTTP comparison harness
- `apps/control/src/request-context.test.ts` now locks the request-level caching contract for resolved session state, authenticated dashboard bootstrap, and health snapshot memoization
- `apps/control/src/runtime-parity.test.ts` now compares split and combined candidate servers across representative protected routes such as packages, desired-state mutations, mail mutations, proxy preview, and logout
- `control-web` now routes semantic mail/domain/mailbox/quota mutations through `PanelWebApi`, shrinking another slice of direct transport-shaped coupling
- the generic `request()` primitive is now internal to `control-web`'s API-client implementation rather than part of the public `PanelWebApi` seam
- `apps/control/src/runtime-surface.ts` now formalizes the combined candidate runtime surface independently from the HTTP server wrapper
- `apps/control/src/preflight-surface.ts`, `preflight-runner.ts`, and `preflight-cli.ts` now define a source-level pre-promotion flow for the combined candidate
- `apps/control/src/preflight-runner.test.ts` now validates both passing and degraded preflight scenarios using harness-driven auth/bootstrap failures
- `apps/control/src/release-candidate-config.ts`, `startup-manifest.ts`, `release-candidate-surface.ts`, `release-candidate-runner.ts`, and `release-candidate-cli.ts` now define a more release-like source-level validation flow for the combined candidate
- `apps/control/src/release-candidate-runner.test.ts` now validates both passing and degraded release-candidate scenarios, including mutation and proxy-preview failures
- `apps/control/src/release-sandbox-layout.ts`, `release-sandbox-pack.ts`, `release-sandbox-entrypoint.ts`, and `release-sandbox-runner.ts` now define a workspace-local release-sandbox that simulates a release-shaped control runtime without writing to `/opt/simplehostman/release`
- `apps/control/src/release-sandbox-smoke.test.ts` and `release-sandbox-parity.test.ts` now validate both the sandboxed candidate itself and parity against the direct combined candidate over real HTTP
- `apps/control/src/release-sandbox-bundle.ts` now defines a persistent bundle contract and human-readable bundle summary for the sandboxed candidate
- `apps/control/src/release-sandbox-bundle-parity.test.ts` now validates that the packed sandbox bundle stays aligned with the direct combined candidate metadata
- `apps/control/src/release-sandbox-activation.ts` plus `release-sandbox-activation.test.ts` now model release inventory, activation metadata, version switching, and rollback inside one workspace-local sandbox
- `apps/control/src/release-sandbox-promotion.ts` plus `release-sandbox-promotion.test.ts` now model release-like promotion manifests and promotion history inside the workspace-local sandbox
- `apps/control/src/release-sandbox-deployment.ts`, `release-sandbox-promotion-ready.ts`, and `release-sandbox-promotion-ready.test.ts` now model deploy/rollback manifests plus a promotion-ready report for the promoted sandbox candidate
- `apps/control/src/release-shadow-layout.ts`, `release-shadow-manifest.ts`, `release-shadow-pack.ts`, `release-shadow-runner.ts`, `release-shadow-smoke.test.ts`, and `release-shadow-parity.test.ts` now model a workspace-local shadow of `/opt/simplehostman/release` without touching the real release root
- `apps/control/src/release-shadow-activation.ts`, `release-shadow-promotion.ts`, `release-shadow-deployment.ts`, `release-shadow-inspect-cli.ts`, `release-shadow-promotion-ready.ts`, and `release-shadow-promotion-ready.test.ts` now give that shadow its own inventory, activation/promote state, deploy/rollback manifests, inspection output, and promotion-ready report
- `apps/control/src/release-rehearsal.ts`, `release-rehearsal-cli.ts`, and `release-rehearsal.test.ts` now validate that a promoted release-shadow remains aligned with the release-sandbox it came from, covering both persisted metadata and representative HTTP behavior
- the sandbox now models `releases/<version>`, `current` as a symlink, `shared/meta`, promotion history, and `shared/{tmp,logs,run}` inside `.tmp/control-release-sandbox`, making it a closer rehearsal for a future real release layout
- the sandbox now also materializes `deploy.json`, `deploy-summary.txt`, `rollback.json`, and `rollback-summary.txt` inside `shared/meta`
- `pnpm test:control:candidate` now acts as the shortest canonical test command for the combined candidate before any runtime promotion work
- `pnpm test:control:runtime-parity` now acts as the canonical process-level parity check between split and combined candidate servers
- `pnpm check:control:preflight` now acts as the canonical source-level pre-promotion check for the combined candidate
- `pnpm check:control:release-candidate` now acts as the canonical source-level release-like smoke check for the combined candidate
- `pnpm check:control:bundle-parity` now acts as the canonical bundle-contract check for the sandboxed candidate
- `pnpm check:control:release-sandbox` now acts as the canonical source-level release-sandbox check for the combined candidate
- `pnpm check:control:promotion-ready` now acts as the canonical source-level promotion-ready check for the promoted sandbox candidate
- `pnpm check:control:release-shadow` now acts as the canonical source-level release-root-shadow check for the combined candidate
- `pnpm check:control:release-rehearsal` now acts as the canonical source-level rehearsal check between the release-sandbox candidate and the promoted release-shadow
- `pnpm activate:control:release-sandbox -- <version> [sandboxId]` now acts as the canonical source-level release switching command inside the sandbox
- `pnpm promote:control:release-sandbox -- <version> [sandboxId]` now acts as the canonical source-level release promotion command inside the sandbox
- `pnpm inspect:control:release-sandbox -- [sandboxId]` now acts as the canonical source-level inspection command for sandbox inventory and active release state
- `pnpm inspect:control:release-shadow -- [sandboxId]` now acts as the canonical source-level inspection command for shadow inventory and active release state
- `pnpm promotion-ready:control:release-shadow` now acts as the canonical source-level promotion-ready report for the release-root shadow
- `pnpm rehearse:control:release-shadow -- [sandboxId] [version]` now acts as the canonical source-level rehearsal command between the sandboxed candidate and its promoted release-root shadow
- `pnpm audit:legacy-roots` now guards against reintroducing functional references to legacy repo roots or retired package names outside docs/build output
- clean-room validation passed from the unified tree: `pnpm install --frozen-lockfile`, `pnpm build:clean-room`, `pnpm typecheck`, `pnpm build:panel-runtime`, `pnpm build:manager-runtime`, `pnpm typecheck:panel-runtime`, `pnpm typecheck:manager-runtime`, and `git diff --check`

## Remaining legacy surface after the current checkpoint

The following areas are still transitional even though `src` is now canonical:

- legacy repos under `/opt/simplehostman/repos/*` are still kept for comparison and migration reference
- imported product packaging under `src/packaging/{panel,manager}` still carries legacy product boundaries
- imported release scripts under `src/scripts/{panel,manager}` now build from the unified source tree, but still preserve legacy product-specific release flows that must be normalized later
- imported service names such as `spanel-*` and `shm-agent` remain transitional until release/runtime convergence
- imported packaging is now source-aligned with `/opt/simplehostman/release`, but product boundaries inside `packaging/{panel,manager}` are still transitional

## Combined candidate pre-promotion checklist

Before `apps/control` can attempt any promotion of `combined` beyond source-level validation, all of the following should remain green:

- `pnpm test:control:parity`
- `pnpm test:control:runtime-parity`
- `pnpm test:control:combined-smoke`
- `pnpm test:control:combined:e2e`
- `pnpm check:control:candidate`
- `pnpm check:control:preflight`
- `pnpm check:control:release-candidate`
- `pnpm check:control:bundle-parity`
- `pnpm check:control:release-sandbox`
- `pnpm check:control:promotion-ready`
- `pnpm check:control:release-shadow`
- `pnpm check:control:release-rehearsal`

And all of the following should still be true:

- split mode remains the documented runtime default in `scripts/` and `packaging/`
- no deploy flow under `/opt/simplehostman/release` or `systemd` units has switched to `combined`
- candidate validation remains entirely workspace-local and reversible

Promotion language at the current checkpoint:

- `candidate source-ready`: unit/parity/smoke/e2e validation is green inside the workspace
- `candidate runtime-ready`: process-level parity and ephemeral server validation are green
- `candidate preflight-ready`: the human-readable source-level preflight report is green
- `candidate release-like-ready`: the release-like startup manifest and smoke report are green inside the workspace
- `candidate bundle-parity-ready`: the workspace-local release-sandbox bundle stays structurally aligned with the direct combined candidate
- `candidate sandbox-ready`: the candidate can be packed and booted from a workspace-local release-sandbox with smoke and parity checks green
- `candidate release-layout-ready`: the sandboxed candidate now exercises versioned releases, a `current` symlink, and shared writable roots inside the workspace
- `candidate release-switch-ready`: the sandboxed candidate now supports inventory-backed version switching and rollback inside the workspace
- `candidate release-promotion-ready`: the sandboxed candidate now supports promotion manifests and promotion history inside the workspace
- `candidate promotion-ready`: the sandboxed candidate now also emits deploy/rollback manifests plus a human-readable promotion-ready report inside the workspace
- `candidate release-shadow-ready`: the candidate now also boots from a workspace-local shadow of `/opt/simplehostman/release`
- `candidate release-shadow-lifecycle-ready`: that shadow now also maintains its own inventory, activation/promote metadata, deploy/rollback manifests, and promotion-ready checks inside the workspace
- `candidate release-rehearsal-ready`: the promoted release-shadow now also proves it stays aligned with the release-sandbox it came from before any move toward the real release root
- `release-ready`: still not reached; packaging and deploy flows remain split-first

## Target layout

The target source tree is:

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

Expected ownership:

- `apps/control`: unified `SHP` control-plane app serving UI and API from one process and one port
- `apps/worker`: background jobs and async control-plane work
- `apps/agent`: long-running node agent currently provided by `SHM`
- `apps/cli`: break-glass and local operator CLI
- `packages/*`: shared contracts, UI primitives, persistence, renderers, drivers, config, and test helpers
- `platform`: host-level templates and managed artifacts currently owned by `simplehost-manager/platform`
- `bootstrap`: bootstrap inventory and import/export material currently owned by `simplehost-panel/bootstrap`
- `packaging`: service units, environment examples, RPM specs, and install payloads
- `scripts`: deploy, install, rollback, maintenance, and migration helpers
- `docs`: integrated architecture and operational documentation

## Current-to-target mapping

### Apps

- `repos/simplehost-panel/apps/web` -> `src/apps/control`
- `repos/simplehost-panel/apps/api` -> `src/apps/control`
- `repos/simplehost-panel/apps/worker` -> `src/apps/worker`
- `repos/simplehost-manager/apps/agent` -> `src/apps/agent`
- `repos/simplehost-manager/apps/cli` -> `src/apps/cli`

### Packages

- `repos/simplehost-panel/packages/*` -> `src/packages/*`
- `repos/simplehost-manager/packages/*` -> `src/packages/*`

### Platform and bootstrap

- `repos/simplehost-manager/platform` -> `src/platform`
- `repos/simplehost-panel/bootstrap` -> `src/bootstrap`

### Packaging and scripts

- `repos/simplehost-panel/packaging` -> `src/packaging/panel` during transition, then normalized under `src/packaging/*`
- `repos/simplehost-manager/packaging` -> `src/packaging/manager` during transition, then normalized under `src/packaging/*`
- `repos/simplehost-panel/scripts` -> `src/scripts/panel` during transition, then normalized under `src/scripts/*`
- `repos/simplehost-manager/scripts` -> `src/scripts/manager` during transition, then normalized under `src/scripts/*`

### Documentation

- `src/docs` remains the canonical shared docs tree
- `repos/simplehost-panel/docs/MIGRATIONS` has already been absorbed into `src/docs/MIGRATIONS`
- any future app-local docs should stay next to the app only if they describe behavior unique to `apps/control` or `apps/worker`

## Migration principles

- Do not merge source and runtime migrations into one cut.
- Do not unify `worker` and `agent` into the same process as `control`.
- Preserve behavior first; improve structure before redesigning features.
- Prefer preserving Git history with `git subtree`, `git filter-repo`, or equivalent import strategy.
- Keep deployment compatibility until the new release layout is proven in staging or on a non-critical node.
- Avoid simultaneous rewrites of routing, packaging, and runtime config in the same phase.

## Phase 1: Create the root workspace

Goal:
Create `/opt/simplehostman/src` as the canonical source workspace without changing product behavior.

Work:
- add `pnpm-workspace.yaml` at `src/`
- add root `package.json`
- add shared base `tsconfig`
- define workspace package naming rules
- define folder ownership and conventions for `apps`, `packages`, `platform`, `packaging`, `scripts`, and `docs`

Acceptance criteria:
- `src` is a valid root workspace
- the current repos can be mirrored or imported without ambiguity
- no live deploy depends on the new workspace yet

## Phase 2: Move non-executable trees first

Goal:
Unify the trees that are least risky and most structural.

Work:
- keep `src/docs` as the shared documentation root
- migrate `repos/simplehost-manager/platform` into `src/platform`
- migrate `repos/simplehost-panel/bootstrap` into `src/bootstrap`
- migrate `repos/simplehost-panel/packaging` and `repos/simplehost-manager/packaging` into transition paths under `src/packaging`
- migrate `repos/simplehost-panel/scripts` and `repos/simplehost-manager/scripts` into transition paths under `src/scripts`

Acceptance criteria:
- non-runtime structure is unified under `src`
- references are updated
- packaging and scripts still remain functionally attributable to their current product owners

## Phase 3: Consolidate shared packages

Goal:
Move all shared libraries into one workspace before touching runtime unification.

Work:
- migrate `contracts`
- migrate `ui`
- migrate `database`
- migrate `config`
- migrate `drivers`
- migrate `renderers`
- migrate `node-config`
- migrate shared `testing` helpers
- resolve naming overlaps and import paths

Acceptance criteria:
- `src/packages/*` builds from one workspace
- there is one shared contract layer
- there is one shared UI primitive layer
- runtime behavior remains unchanged

## Phase 4: Move the still-separate apps

Goal:
Bring `worker`, `agent`, and `cli` under the new root while keeping them operationally separate.

Work:
- move `worker` to `src/apps/worker`
- move `agent` to `src/apps/agent`
- move `cli` to `src/apps/cli`
- update imports to the unified `src/packages/*`
- adapt app-local build and test commands

Acceptance criteria:
- `worker`, `agent`, and `cli` build from `src`
- they still run as separate deployable units
- no `control` runtime unification has happened yet

## Phase 5: Create `apps/control` with two entrypoints

Goal:
Unify `web` and `api` into one source tree before unifying them into one process.

Work:
- move `repos/simplehost-panel/apps/web` into `src/apps/control`
- move `repos/simplehost-panel/apps/api` into `src/apps/control`
- keep temporary internal separation such as `src/apps/control/shared/*`, `src/apps/control/web/*`, and `src/apps/control/api/*`
- share route wiring, auth context, config loading, and contracts where appropriate
- keep `/v1/*` compatibility intact

Acceptance criteria:
- one source tree owns the control plane UI and API
- the app can still be built with separate entrypoints if needed
- no external URL or route behavior changes yet

## Phase 6: Unify `control` runtime on one port

Goal:
Serve UI and API from one process and one port.

Work:
- collapse `web` and `api` server entrypoints into a single `control` server
- move API routing into the same server process as the UI
- remove internal HTTP dependency from UI to API where possible
- review cookies, auth boundaries, health checks, reverse proxy config, and CORS assumptions

Acceptance criteria:
- `apps/control` serves UI and `/v1/*`
- one runtime port is used for the control plane
- `worker` and `agent` remain separate

## Phase 7: Rebuild packaging and release logic for the unified tree

Goal:
Make the runtime and release layout follow the unified source model.

Work:
- adapt release logic to `/opt/simplehostman/release`
- define release units for:
  - `control`
  - `worker`
  - `agent`
- keep `cli` as tooling rather than a daemon
- update systemd units, RPM specs, environment examples, deploy scripts, install scripts, and rollback scripts
- remove assumptions tied to `/opt/simplehostman/spanel` and `/opt/simplehostman/shm`

Acceptance criteria:
- build artifacts come from the unified source tree
- runtime code is deployed from `/opt/simplehostman/release`
- service boundaries remain explicit even if the source tree is unified

## Phase 8: Cutover and cleanup

Goal:
Retire the legacy split source layout after the new workspace is proven.

Work:
- freeze the legacy repos or make them read-only mirrors
- remove stale references to the old split source layout
- finalize ownership guidance in `docs`
- update operational runbooks and onboarding material
- document the final release and rollback process

Acceptance criteria:
- `/opt/simplehostman/src` is the canonical source root
- old source locations are no longer the source of truth
- documentation, packaging, and runtime all describe the same structure

## Risks and controls

### Risk: source and runtime migration get coupled

Control:
- do not change release layout during phases 1 through 5
- keep runtime cutover isolated to phase 7

### Risk: `apps/control` becomes too large before simplification

Control:
- unify the source tree first
- keep separate internal modules for UI and API until phase 6 is complete

### Risk: packaging ownership becomes blurry

Control:
- use transition paths such as `src/packaging/panel` and `src/packaging/manager`
- normalize only after ownership and runtime shape are stable

### Risk: documentation diverges from the actual migration state

Control:
- update this document when a phase starts, completes, or changes scope
- keep open migration tasks tracked in `docs/TODO.md`

## Recommended execution order

1. Phase 1: root workspace
2. Phase 2: docs, bootstrap, platform, packaging, scripts
3. Phase 3: shared packages
4. Phase 4: worker, agent, cli
5. Phase 5: control source unification
6. Phase 6: single-port control runtime
7. Phase 7: release and packaging cutover
8. Phase 8: cleanup

## Related references

- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [`/opt/simplehostman/src/docs/ARQUITECTURE.md`](/opt/simplehostman/src/docs/ARQUITECTURE.md)
- [`/opt/simplehostman/src/docs/TODO.md`](/opt/simplehostman/src/docs/TODO.md)
