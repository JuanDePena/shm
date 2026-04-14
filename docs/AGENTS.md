# SimpleHost Workspace Guide

## Scope

This file applies to `/opt/simplehostman` and everything under it.

Use it as the default operational guide for work on:

- `SHP` (`SimpleHostPanel`)
- `SHM` (`SimpleHostManager`)
- the shared platform docs tree under `/opt/simplehostman/src/docs`

## Canonical paths

Current canonical paths:

- workspace root: `/opt/simplehostman`
- source workspace root: `/opt/simplehostman/src`
- source workspace root: `/opt/simplehostman/src`
- shared docs root: `/opt/simplehostman/src/docs`
- bootstrap inventory: `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- `SHP` runtime root: `/opt/simplehostman/spanel`
- `SHM` runtime root: `/opt/simplehostman/shm`

Do not reintroduce `/home/server` or `/opt/server`. That transition is already complete.

## Repository layout

Current source workspace:

- `/opt/simplehostman/src` is the canonical source tree
- `/opt/simplehostman/repos/*` remains transitional legacy source material during migration
- `/opt/simplehostman/src/docs` is the canonical shared docs tree

Packaging direction:

- product-owned distributable artifacts must live in the owning product repository
- this includes `systemd` units, default env examples, install helpers, and future `rpm` payload files
- `simplehost-panel` owns `SHP` packaging and `postgresql-shp` templates
- `simplehost-manager` owns node-local service templates and host-service artifacts, including `wireguard`, `pdns`, `mariadb`, `postgresql-apps`, app containers, app proxy templates, firewall policy, SSH hardening, fail2ban, and host observability helpers
- keep shared docs in `/opt/simplehostman/src/docs`
- avoid introducing a new catch-all transition repository now that ownership is already split between `simplehost-panel`, `simplehost-manager`, and `docs`

## Product direction

This project is not a generic hosting panel clone.

It is a focused control plane for the current stack:

- PowerDNS Authoritative
- Apache
- Podman + Quadlet
- PostgreSQL
- MariaDB
- backups
- future mail-domain and mailbox management

## Language and tooling defaults

For both `SHP` and `SHM`:

- use `Node.js`
- use `TypeScript`
- prefer a monorepo layout
- prefer `pnpm` workspaces

For shared docs and bootstrap material:

- keep files human-readable
- prefer templates and declarative config over ad-hoc imperative scripts

## Product invariants

For `SHP`:

- `SHP` is the central control plane for UI, API, workers, jobs, and audit
- use `PostgreSQL` as the product database
- keep `SHP` as the authoritative source of truth for desired state

For `SHM`:

- keep `SHM` node-local and non-public
- prefer outbound agent connections from `SHM` to `SHP`
- do not introduce a local database unless a concrete need justifies it
- keep `SHM` local state non-authoritative and recoverable

For `SHM` local persistence:

- prefer minimal machine-written `JSON` state under `/var/lib/shm`
- keep operator-managed configuration in `/etc/shm/config.yaml`
- use `YAML` only for human-authored configuration

## Current source of truth

Current operational state:

- `SHP` PostgreSQL is already the operational control-plane source of truth
- bootstrap inventory remains in `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- runtime bootstrap import normally reads `/etc/spanel/inventory.apps.yaml`
- shared docs live in `/opt/simplehostman/src/docs`

Long-term target:

- keep `SHP` as the control-plane source of truth
- YAML import/export remains available for audit and disaster recovery
- product runtime packaging is being normalized inside `/opt/simplehostman/src/packaging`
- keep remaining open work tracked in `/opt/simplehostman/src/docs/TODO.md`

## Current implementation snapshot

As of `2026-03-14`:

- `SHP` runs from `/opt/simplehostman/spanel/current` with `spanel-api`, `spanel-web`, and `spanel-worker` active on the primary node
- the secondary node keeps a passive `SHP` runtime with `spanel-web` available for smoke tests while `spanel-api` and `spanel-worker` stay inactive until promotion
- `SHM` runs on both nodes from `/opt/simplehostman/shm/current`
- `postgresql-shp` and `postgresql-apps` run host-native with primary/standby replication over WireGuard on `10.89.0.0/24`
- `SHP` operator UI, auth, desired-state CRUD, jobs, drift, and backup visibility are already implemented
- YAML is now a bootstrap, import/export, and disaster-recovery path, not the daily source of truth
- remaining open work should be reflected in `/opt/simplehostman/src/docs/TODO.md`, not scattered across stale prose

## Key design constraints

- Keep `SHM` node-local and non-public.
- Do not design around arbitrary shell execution from the UI.
- Keep service changes declarative, validated, and auditable.
- Keep runtime state out of git-managed repositories.
- Keep product config in `/etc`, mutable state in `/var/lib`, and logs in `/var/log`.

## Runtime boundaries

Under `/opt/simplehostman`:

- `repos/` is for source code and tracked config
- `spanel/` is for installed `SHP` releases
- `shm/` is for installed `SHM` releases

Do not store mutable runtime state under:

- `/opt/simplehostman/repos`

## Working rules

- Before large structural changes, read the docs listed below.
- Prefer updating docs and templates together when architecture changes.
- When touching docs paths, keep `/opt/simplehostman/src/docs` as the current canonical docs location unless explicitly refactoring that tree.
- Avoid introducing parallel competing layouts for the same concern.
- Keep tenant boundaries explicit in data models and APIs.
- When a file is definitive and product-owned, move it into the owning repo instead of creating a new shared catch-all path.
- Prefer deleting replaced files promptly once docs and references have moved to the established owner path.
- When closing or redefining major work, update `/opt/simplehostman/src/docs/TODO.md` in the same turn as the docs.

## Priority order

When in doubt, prioritize work in this order:

1. platform safety and auditability
2. correct tenancy and permissions
3. declarative infrastructure and reproducibility
4. small usable phase-1 scope
5. convenience features

## Phase 1 focus

The preferred first useful release of `SHP`/`SHM` should focus on:

- authentication
- tenants and users
- nodes
- DNS zones and records
- sites and vhosts
- certificates
- apps and deployments
- databases and database users
- jobs and audit trail
- backup visibility and controlled triggers

Mail should stay in the design, but should not expand phase 1 beyond a practical MVP.

## Required references

Read these before making architectural changes:

- `/opt/simplehostman/src/docs/ARQUITECTURE.md`
- `/opt/simplehostman/src/docs/MULTI_DOMAIN.md`
- `/opt/simplehostman/src/docs/REPO_LAYOUT.md`
- `/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md`

Read these when working on product behavior and boundaries:

- `/opt/simplehostman/repos/simplehost-panel/README.md`
- `/opt/simplehostman/repos/simplehost-manager/README.md`

Read this when working on `SHP` operator UI, shared visual primitives, or layout behavior:

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
- If a change affects both product design and platform layout, update the docs in the same turn.
