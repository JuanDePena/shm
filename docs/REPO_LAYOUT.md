# Repository and Directory Layout

Date drafted: 2026-03-11
Updated: 2026-04-14
Target OS: AlmaLinux 10.1

## Scope

This document defines the canonical source layout for the unified SimpleHost workspace and the current boundaries around source, runtime, and packaging material.

## Canonical paths

- workspace root: `/opt/simplehostman`
- source workspace root: `/opt/simplehostman/src`
- shared docs root: `/opt/simplehostman/src/docs`
- bootstrap inventory: `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- runtime and release root: `/opt/simplehostman/release`

## Top-level layout

The current canonical top-level layout is:

```text
/opt/simplehostman
  /src
    /apps
    /packages
    /platform
    /bootstrap
    /packaging
    /scripts
    /docs
  /release
    /releases
    /shared
```

Meaning:

- `src/` is the canonical source workspace
- `release/` is the neutral runtime root reserved for the later runtime/release migration phase

## Canonical source layout

```text
/opt/simplehostman/src
  /apps
    /control
      /api
      /web
    /worker
    /agent
    /cli
  /packages
    /panel-config
    /panel-contracts
    /panel-database
    /panel-testing
    /panel-ui
    /manager-contracts
    /manager-control-plane-client
    /manager-drivers
    /manager-node-config
    /manager-renderers
    /manager-testing
  /platform
  /bootstrap
  /packaging
    /env
    /systemd
    /httpd
    /postgresql
    /rpm
  /scripts
    /panel
    /manager
  /docs
```

## App ownership

### `apps/control`

Path:

- `/opt/simplehostman/src/apps/control`

Responsibility:

- unified source ownership for UI and API
- transitional internal separation between `shared/`, `web/`, `api/`, and a combined entrypoint candidate under `src/`
- current combined candidate already supports one-process routing for UI and `/v1/*` at the source level
- current combined candidate is also exercised by source-level routing tests before any runtime cutover
- eventual target is one control-plane runtime and one port

### `apps/worker`

Path:

- `/opt/simplehostman/src/apps/worker`

Responsibility:

- background jobs
- planners and reconciliation loops
- asynchronous control-plane execution

### `apps/agent`

Path:

- `/opt/simplehostman/src/apps/agent`

Responsibility:

- node-local execution
- rendering and apply logic
- runtime status and health reporting

### `apps/cli`

Path:

- `/opt/simplehostman/src/apps/cli`

Responsibility:

- local operator tooling
- break-glass maintenance commands

## Package ownership

### Panel-origin packages

- `panel-config`
- `panel-contracts`
- `panel-database`
- `panel-testing`
- `panel-ui`

### Manager-origin packages

- `manager-contracts`
- `manager-control-plane-client`
- `manager-drivers`
- `manager-node-config`
- `manager-renderers`
- `manager-testing`

These names remain transitional. The source of truth is already `src/packages/*`.

## Non-app source trees

### `platform`

Path:

- `/opt/simplehostman/src/platform`

Contains:

- host templates
- container templates
- Apache templates
- DNS templates
- database templates
- WireGuard templates

### `bootstrap`

Path:

- `/opt/simplehostman/src/bootstrap`

Contains:

- bootstrap inventory and import/export seed material

### `packaging`

Path:

- `/opt/simplehostman/src/packaging`

Current structure:

- `/opt/simplehostman/src/packaging/env`
- `/opt/simplehostman/src/packaging/systemd`
- `/opt/simplehostman/src/packaging/httpd`
- `/opt/simplehostman/src/packaging/postgresql`
- `/opt/simplehostman/src/packaging/rpm`

Legacy product-facing names such as `spanel-*`, `shm-agent`, `simplehost-panel.spec`, and `simplehost-manager.spec` are still preserved where runtime compatibility depends on them, but the directory layout is now unified by artifact type.

### `scripts`

Path:

- `/opt/simplehostman/src/scripts`

Current transitional split:

- `/opt/simplehostman/src/scripts/panel`
- `/opt/simplehostman/src/scripts/manager`

These scripts now belong to the unified source tree even if many remain product-owned in behavior.

### `docs`

Path:

- `/opt/simplehostman/src/docs`

Contains:

- architecture guides
- operational runbooks
- migration plans
- shared UI guidance
- TODO tracking

## Former split roots

The former `simplehost-panel` and `simplehost-manager` source trees have already been absorbed into `/opt/simplehostman/src` and removed from the live workspace.

Historical references may still appear in migration notes, but they are no longer live workspace inputs.

## Runtime and release direction

Current runtime normalization target:

```text
/opt/simplehostman/release
  /releases
    /<version>
  /shared
```

Notes:

- this root has already been reserved in the filesystem
- final release structure is a later migration phase
- imported panel/manager packaging and deploy scripts may still reflect legacy product-specific assumptions and should be treated as transitional until runtime migration is executed

## Rules

- Keep canonical source in `/opt/simplehostman/src`.
- Keep shared docs in `/opt/simplehostman/src/docs`.
- Do not reintroduce repo-era source roots as active inputs.
- Do not reintroduce `/opt/simplehostman/spanel` or `/opt/simplehostman/shm` as canonical paths.
- Keep mutable runtime state outside the source tree.
- Keep runtime migration separate from source migration.

## Current transition direction

The phased execution plan is tracked in [`/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md`](/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md).

The current source-phase priorities are:

1. make `src` fully self-hosted and buildable
2. remove residual source dependencies on legacy repos
3. harden `apps/control` as the single control-plane source boundary
4. postpone runtime/release convergence until the source workspace is stable

## Ownership quick references

- `/opt/simplehostman/src/apps/control/README.md`
- `/opt/simplehostman/src/apps/control/api/README.md`
- `/opt/simplehostman/src/apps/control/web/README.md`
- `/opt/simplehostman/src/apps/control/shared/README.md`
- `/opt/simplehostman/src/apps/control/src/README.md`
- `/opt/simplehostman/src/apps/worker/README.md`
- `/opt/simplehostman/src/apps/agent/README.md`
- `/opt/simplehostman/src/apps/cli/README.md`
- `/opt/simplehostman/src/packages/README.md`
- `/opt/simplehostman/src/platform/README.md`
- `/opt/simplehostman/src/bootstrap/README.md`
- `/opt/simplehostman/src/packaging/README.md`
- `/opt/simplehostman/src/scripts/README.md`
