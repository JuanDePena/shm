# Control Web Entrypoint

This directory contains the current web entrypoint for the unified control-plane app.

Path:

- `/opt/simplehostman/src/apps/control/web`

Current role:

- serve the operator and tenant-facing UI
- render dashboard workspaces and desired-state views
- expose the current web server boundary for the control plane

This entrypoint remains separate only as a transitional source boundary inside `apps/control`.
Common process and runtime helpers now live in `/opt/simplehostman/src/apps/control/shared`.
The long-term target is one control-plane runtime process serving both UI and API.
