# Control Combined Entrypoint Candidate

This subtree contains the transitional one-process entrypoint candidate for `apps/control`.

Path:

- `/opt/simplehostman/src/apps/control/src`

Current role:

- expose a one-process control-plane candidate that serves UI routes and `/v1/*` from one combined request surface
- reuse a shared `ControlProcessContext` so both entrypoints see the same config and startup timestamp
- sit on top of the injected `PanelWebApi` seam now used by the web layer
- drive the web layer through an in-process `PanelWebApi` backed by the API request handler instead of a local HTTP hop
- support explicit `combined` and `split` runtime modes while convergence is still in progress
- keep route composition covered by source-level tests under `router.test.ts`
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
