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
- `apps/control/src/index.ts` now exists as a transitory one-process candidate that starts both control-plane entrypoints without changing the current runtime model
- the web layer now depends on an injected `PanelWebApi` interface instead of a hard-wired module-global HTTP client, which prepares a future move from local HTTP calls to in-process control routing
- `pnpm audit:legacy-roots` now guards against reintroducing functional references to legacy repo roots or retired package names outside docs/build output
- clean-room validation passed from the unified tree: `pnpm install --frozen-lockfile`, `pnpm build:clean-room`, `pnpm typecheck`, `pnpm build:panel-runtime`, `pnpm build:manager-runtime`, `pnpm typecheck:panel-runtime`, `pnpm typecheck:manager-runtime`, and `git diff --check`

## Remaining legacy surface after the current checkpoint

The following areas are still transitional even though `src` is now canonical:

- legacy repos under `/opt/simplehostman/repos/*` are still kept for comparison and migration reference
- imported product packaging under `src/packaging/{panel,manager}` still carries legacy product boundaries
- imported release scripts under `src/scripts/{panel,manager}` now build from the unified source tree, but still preserve legacy product-specific release flows that must be normalized later
- imported service names such as `spanel-*` and `shm-agent` remain transitional until release/runtime convergence
- imported packaging is now source-aligned with `/opt/simplehostman/release`, but product boundaries inside `packaging/{panel,manager}` are still transitional

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
