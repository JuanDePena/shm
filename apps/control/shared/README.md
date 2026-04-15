# Control Shared

Internal shared package for the transitional control-plane source tree.

Path:

- `/opt/simplehostman/src/apps/control/shared`

Current scope:

- process and module-entry helpers shared by `control-api` and `control-web`
- shared runtime context creation for the control-plane boundary
- shared server shutdown helpers used by standalone and combined entrypoints
- mock HTTP invocation helpers used by the combined candidate to call the API boundary in-process
- control-plane process seams that support convergence toward one runtime
- shared auth/session resolution and dashboard-bootstrap helpers used by `control-web` and the combined control candidate
- transitional glue that belongs to the unified `apps/control` boundary but should not live in `packages/*`

This package is intentionally narrow. It exists to reduce duplication between `api/` and `web/` while `apps/control` still runs with two entrypoints.
