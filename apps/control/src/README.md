# Control Combined Entrypoint Candidate

This subtree contains the transitional one-process entrypoint candidate for `apps/control`.

Path:

- `/opt/simplehostman/src/apps/control/src`

Current role:

- start `control-api` and `control-web` from one Node.js process
- reuse a shared `ControlProcessContext` so both entrypoints see the same config and startup timestamp
- sit on top of the injected `PanelWebApi` seam now used by the web layer
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
