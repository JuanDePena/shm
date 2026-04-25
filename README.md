# SimpleHostMan

SimpleHostMan is a self-hosted control plane for operating a small but serious multi-service hosting platform without adopting a heavyweight orchestrator.

It is designed for teams that want:

- clear ownership of infrastructure
- predictable release and rollback flows
- a real control plane for DNS, apps, databases, mail, backups, and node operations
- a simpler operating model than Kubernetes or a traditional shared-hosting stack

## What The Product Is

SimpleHostMan combines three product surfaces into one system:

- `control`: the operator-facing control plane, including UI and API
- `worker`: asynchronous control-plane execution for background tasks and reconciliations
- `agent`: the node-local execution layer that applies desired state and reports runtime state

Together, they provide a focused platform for managing:

- DNS
- reverse proxy and ingress
- application runtimes
- PostgreSQL and MariaDB workloads
- host and container services
- mail infrastructure
- backups and operational jobs

## Value Proposition

SimpleHostMan is meant to replace ad hoc server administration with an explicit platform model.

Instead of treating each node as a snowflake, it gives operators:

- a declarative resource catalog for the platform
- an operator UI for state, actions, diagnostics, and history
- a node agent that turns desired state into actual runtime changes
- auditable packaging, release, staging, promotion, cutover, and rollback workflows

The goal is not to become a generic cloud. The goal is to run a known stack well, with high operator clarity and low operational ambiguity.

## Why It Exists

The project exists to fill the gap between:

- manual VPS administration
- legacy shared-hosting control panels
- and overbuilt orchestration platforms

SimpleHostMan takes the position that many teams need:

- more structure than shell scripts
- more control than a black-box panel
- and less complexity than a full cluster orchestrator

## Product Goals

SimpleHostMan is built around a few explicit goals:

1. Keep infrastructure understandable.
2. Make runtime changes traceable and reversible.
3. Separate control-plane logic from node-local execution.
4. Support a two-node production model with explicit failover boundaries.
5. Keep packaging, release, promotion, cutover, and rollback first-class.
6. Treat documentation, platform assets, and release flows as part of the product, not as side notes.

## Current Scope

The platform is intentionally opinionated around the current operating stack:

- PowerDNS Authoritative
- Apache
- Podman + Quadlet
- PostgreSQL
- MariaDB
- backups
- mail domains, mailbox lifecycle, observability, HA readiness, and recovery readiness

This is a focused product for operating that stack reliably. It is not trying to be a universal hosting panel for every workload model.

## Repository Structure

This repository is the canonical source tree for the product.

Root path:

- `/opt/simplehostman/src`

High-level structure:

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

What each area means:

- `apps/control`: the operator-facing control plane, including UI, API, and the ongoing convergence toward a unified control runtime
- `apps/worker`: background execution for control-plane jobs, reconciliations, and async workflows
- `apps/agent`: node-local execution and reporting
- `apps/cli`: operator and break-glass tooling
- `packages`: shared contracts, config, persistence, renderers, drivers, UI primitives, and test helpers
- `platform`: host- and service-level templates and managed artifacts
- `bootstrap`: bootstrap inventory and seed data
- `packaging`: release artifacts, RPM-related packaging, env examples, and release layout material
- `scripts`: install, deploy, rollback, bootstrap, and migration helpers
- `docs`: architecture, runbooks, migration plans, UI guidance, and operational references

## Operating Model

SimpleHostMan treats runtime management as part of the product itself.

That means the repository does not stop at application code. It also owns:

- packaging
- staging
- promotion
- cutover planning
- rollback semantics
- release-root rehearsal

The runtime normalization target is:

- `/opt/simplehostman/release`

This keeps the platform closer to an auditable appliance than to a loose collection of apps and scripts.

## Versioning

Workspace and release versioning use the UTC format:

- `YYMM.DD.HH`

Example:

- `2604.19.06`

Helper commands:

- `pnpm version:set 2604.19.06`
- `pnpm version:set:now`
- `pnpm version:print-now`

## Status

This repository already acts as the single source of truth for the platform.

The major ongoing transition is no longer source unification. It is runtime convergence:

- consolidating the control plane into a cleaner runtime model
- normalizing the release root
- and promoting the combined control runtime through staged, rehearsed cutover flows

## For Engineers And Operators

If you need implementation details, architecture, or runbooks, start here:

- [Architecture](/opt/simplehostman/src/docs/ARQUITECTURE.md)
- [Repo Layout](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [Workspace Guide](/opt/simplehostman/src/docs/AGENTS.md)
- [Database Platform](/opt/simplehostman/src/docs/DATABASES.md)
- [PostgreSQL Upgrade Path](/opt/simplehostman/src/docs/POSTGRESQL_UPGRADE.md)

If you need detailed boundaries for the main product surfaces:

- [Control](/opt/simplehostman/src/apps/control/README.md)
- [Worker](/opt/simplehostman/src/apps/worker/README.md)
- [Agent](/opt/simplehostman/src/apps/agent/README.md)
- [Packages](/opt/simplehostman/src/packages/README.md)
- [Platform](/opt/simplehostman/src/platform/README.md)
