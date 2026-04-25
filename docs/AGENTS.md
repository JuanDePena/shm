# SimpleHost Workspace Guide

## Scope

This file applies to `/opt/simplehostman` and everything under it.

Use it as the default operational guide for work on the unified source workspace.

## Canonical paths

Current canonical paths:

- workspace root: `/opt/simplehostman`
- source workspace root: `/opt/simplehostman/src`
- shared docs root: `/opt/simplehostman/src/docs`
- bootstrap inventory: `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- runtime and release root: `/opt/simplehostman/release`

Do not reintroduce `/home/server`, `/opt/server`, or `/opt/simplehost`.

## Current source-of-truth rules

- `/opt/simplehostman/src` is the canonical source tree.
- `/opt/simplehostman/src/docs` is the canonical shared documentation tree.
- the former split source trees are now historical only and should not be treated as live inputs.
- runtime and release normalization under `/opt/simplehostman/release` is a later migration phase.

## Product direction

This project is not a generic hosting panel clone.

It is a focused control plane for the current stack:

- PowerDNS Authoritative
- Apache
- Podman + Quadlet
- PostgreSQL
- MariaDB
- backups
- mail domains, mailbox lifecycle, observability, HA readiness, and recovery readiness

## Workspace layout

Canonical source layout:

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

Ownership:

- `apps/control`: unified source boundary for UI and API, with transitional `shared/`, `web/`, `api/`, and combined-entrypoint subtrees; the canonical combined runtime already serves UI and `/v1/*` from one process, while the same subtree still carries `combined|split` validation and release rehearsal tooling
- `apps/worker`: background control-plane work
- `apps/agent`: node-local execution agent
- `apps/cli`: break-glass and operator CLI
- `packages/*`: shared contracts, config, UI, persistence, renderers, drivers, and testing helpers
- `platform`: host and container templates
- `bootstrap`: bootstrap inventory and seed material
- `packaging`: release and install artifacts still organized by legacy owner during transition
- `scripts`: install, deploy, rollback, bootstrap, and migration helpers
- `docs`: integrated architecture, operational guides, and migration plans

## Runtime direction

Current runtime normalization target:

- `/opt/simplehostman/release`

Important note:

- source migration is happening before runtime migration
- the runtime now uses `simplehost-control`, `simplehost-worker`, and `simplehost-agent` together with `/etc/simplehost/*`
- do not assume that imported panel/manager release scripts already represent the final runtime layout

## Working rules

- Start source work from `/opt/simplehostman/src`.
- Use legacy repos only for comparison or migration reference.
- Before major structural edits, read the references below.
- Update docs in the same turn when architecture or ownership changes.
- Avoid parallel competing source layouts for the same concern.
- Keep `worker` and `agent` separate from `control`.
- Do not mix source migration and live runtime migration in the same cut unless explicitly required.

## Priority order

When in doubt, prioritize work in this order:

1. platform safety and auditability
2. correct tenancy and permissions
3. declarative infrastructure and reproducibility
4. source ownership clarity
5. convenience features

## Required references

Read these before making architectural changes:

- `/opt/simplehostman/src/README.md`
- `/opt/simplehostman/src/docs/ARQUITECTURE.md`
- `/opt/simplehostman/src/docs/REPO_LAYOUT.md`

Read these when working on source ownership boundaries:

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

Read this when working on operator UI or shared visual primitives:

- `/opt/simplehostman/src/docs/UI_STYLE.md`

Read these when working on service-specific behavior:

- `/opt/simplehostman/src/docs/DNS.md`
- `/opt/simplehostman/src/docs/PROXY.md`
- `/opt/simplehostman/src/docs/CONTAINERS.md`
- `/opt/simplehostman/src/docs/DATABASES.md`
- `/opt/simplehostman/src/docs/MAIL.md`

## Notes for future agents

- If bootstrapping the codebase, start with `/opt/simplehostman/src`.
- If changing bootstrap inventory, work in `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`.
- If a change affects both source layout and architecture, update the migration docs in the same turn.
- If a task touches releases or systemd, verify whether it belongs to the later runtime-migration phase before changing anything live.
