# Repository and Directory Layout

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This document defines the exact repository and directory layout for the SimpleHost platform after moving the former `/home/server` tree into `/opt`.

Current canonical paths:

- source workspace root: `/opt/simplehostman/src`
- source workspace root: `/opt/simplehostman/src`
- shared docs root: `/opt/simplehostman/src/docs`
- bootstrap inventory: `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- consolidated root: `/opt/simplehostman`

## Current state

The shared docs tree now lives directly at:

- `/opt/simplehostman/src/docs`

Current transition note:

- the phased unification plan for the source tree is documented in [`/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md`](/opt/simplehostman/src/docs/MONOREPO_MIGRATION.md)
- `/opt/simplehostman/src` is now the canonical source workspace
- `/opt/simplehostman/repos/*` remains transitional legacy source material during migration
- `/opt/simplehostman/src` is now the canonical source workspace
- legacy repos under `/opt/simplehostman/repos` remain transitional inputs and historical reference material only
- shared open documentation lives in `/opt/simplehostman/src/docs`
- remaining open cross-workspace work is tracked in [`/opt/simplehostman/src/docs/TODO.md`](/opt/simplehostman/src/docs/TODO.md)

## Top-level layout

The exact top-level layout is:

```text
/opt
  /simplehost
    /repos
      /docs
      /simplehost-panel
      /simplehost-manager
    /spanel
      /releases
      /current -> releases/<version>
      /shared
    /shm
      /releases
      /current -> releases/<version>
      /shared
```

## Repository layout

### `simplehost-panel`

Repository path:

- `/opt/simplehostman/repos/simplehost-panel`

Repository type:

- Node.js monorepo
- `TypeScript`
- `pnpm` workspaces

Exact directory layout:

```text
/opt/simplehostman/repos/simplehost-panel
  /apps
    /api
    /web
    /worker
  /bootstrap
    apps.bootstrap.yaml
  /packaging
    /env
    /postgresql
      /shp
        /conf
        /sql
    /systemd
  /packages
    /config
    /contracts
    /database
    /testing
    /ui
  /docs
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md
```

Responsibility split:

- `apps/api`: public and internal HTTP API
- `apps/web`: operator and tenant web UI
- `apps/worker`: background jobs, planners, and async control-plane tasks
- `bootstrap/apps.bootstrap.yaml`: transitional bootstrap/import-export inventory owned by `SHP`
- `packaging/env`: product-owned environment file examples for packaged installs
- `packaging/postgresql/shp`: dedicated `postgresql-shp` config and SQL templates owned by `SHP`
- `packaging/systemd`: product-owned `systemd` units for packaged installs
- `packages/config`: runtime config loading and validation
- `packages/contracts`: shared schemas and API contracts
- `packages/database`: ORM, migrations, seed data, and persistence helpers
- `packages/database`: ORM, migrations, seed data, persistence helpers, and operational snapshots such as installed package inventory
- `packages/testing`: test fixtures and shared test helpers
- `packages/ui`: shared UI components

### `simplehost-manager`

Repository path:

- `/opt/simplehostman/repos/simplehost-manager`

Repository type:

- Node.js monorepo
- `TypeScript`
- `pnpm` workspaces

Exact directory layout:

```text
/opt/simplehostman/repos/simplehost-manager
  /apps
    /agent
    /cli
  /packaging
    /env
    /systemd
  /platform
    /containers
      /env
      /quadlet
    /host
      /fail2ban
        /jail.d
      /firewalld
        /services
        /zones
      /observability
      /ssh
      /systemd
    /httpd
      /conf.d
      /vhosts
    /mariadb
      /conf
      /sql
    /pdns
      /primary
      /secondary
      /tsig
    /postgresql
      /apps
        /conf
        /sql
    /wireguard
  /packages
    /contracts
    /drivers
    /node-config
    /renderers
    /testing
  /docs
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md
```

Responsibility split:

- `apps/agent`: long-running node agent service
- `apps/cli`: local maintenance and break-glass CLI
- `packaging`: product-owned install artifacts for packaged `SHM` installs
- `platform`: node-local service templates and bootstrap material managed by `SHM`
- `packages/contracts`: shared job and status schemas
- `packages/drivers`: service adapters for DNS, Apache, databases, packages, backups, and mail
- `packages/node-config`: node identity, TLS, and config loading
- `packages/renderers`: renderers for vhosts, Quadlet units, DNS changes, and env files
- `packages/testing`: node-driver and renderer test helpers

### Shared docs

Tree path:

- `/opt/simplehostman/src/docs`

Current exact directory layout:

```text
/opt/simplehostman/src/docs
  AGENTS.md
  ARQUITECTURE.md
  BASH.md
  CONTAINERS.md
  DATABASES.md
  DNS.md
  HARDENING.md
  MAIL.md
  MULTI_DOMAIN.md
  UI_STYLE.md
  PROXY.md
  REPO_LAYOUT.md
  TODO.md
```

Current responsibility split:

- shared architecture and operational documentation
- cross-workspace guidance and TODO tracking
- no runtime ownership of definitive product or host-service artifacts
- migration runbooks from the former panel-local docs tree now live under `/opt/simplehostman/src/docs/MIGRATIONS`

## Runtime layout

### `SHP`

Runtime path:

- `/opt/simplehostman/spanel`

Exact runtime layout:

```text
/opt/simplehostman/spanel
  /releases
    /<version>
  /current -> releases/<version>
  /shared
    /tmp
```

Non-`/opt` runtime paths:

- `/etc/spanel/`
- `/var/lib/spanel/`
- `/var/log/spanel/`

### `SHM`

Runtime path:

- `/opt/simplehostman/shm`

Exact runtime layout:

```text
/opt/simplehostman/shm
  /releases
    /<version>
  /current -> releases/<version>
  /shared
    /tmp
```

Non-`/opt` runtime paths:

- `/etc/shm/`
- `/var/lib/shm/`
- `/var/log/shm/`

## Rules

- Keep repositories under `/opt/simplehostman/repos`.
- Keep installed runtime code under `/opt/simplehostman/spanel` and `/opt/simplehostman/shm`.
- Keep mutable runtime state outside `/opt`.
- Treat `/opt/simplehostman/src/docs` as the canonical shared docs tree.
- Treat `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml` as the canonical bootstrap inventory file.
- Keep definitive `SHP` and `SHM` packaging artifacts in their owning repositories.

## Current transition direction

Keep reducing the operational role of the bootstrap YAML as soon as PostgreSQL
desired state and product workflows fully cover the same use cases, and keep
the resulting open work in [`/opt/simplehostman/src/docs/TODO.md`](/opt/simplehostman/src/docs/TODO.md).
