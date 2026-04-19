# Shared Packages

This directory contains the canonical shared libraries for the unified SimpleHost source workspace.

Path:

- `/opt/simplehostman/src/packages`

## Current transitional split

Panel-origin packages:

- `panel-config`
- `panel-contracts`
- `panel-database`
- `panel-testing`
- `panel-ui`

Manager-origin packages:

- `manager-contracts`
- `manager-control-plane-client`
- `manager-drivers`
- `manager-node-config`
- `manager-renderers`
- `manager-testing`

These names remain transitional. The source of truth is already this tree.

## Ownership rules

- keep shared logic here, not in `apps/*`
- prefer explicit product-neutral boundaries where possible
- do not reintroduce dependencies on legacy source roots or retired repo-era paths
- keep UI primitives, contracts, persistence, renderers, drivers, config, and testing helpers buildable from this workspace alone
