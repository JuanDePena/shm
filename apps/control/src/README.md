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
- carry a combined per-request context in `request-context.ts` so session resolution and authenticated dashboard bootstrap are reusable in one-process mode
- centralize cached auth/session/dashboard lookups in `auth-gate.ts`
- expose a semantic route boundary in `route-surface.ts`
- expose a single high-level candidate primitive in `combined-surface.ts`
- expose a reusable combined HTTP server candidate in `server.ts`
- define the candidate runtime shape in `runtime-contract.ts`
- keep an end-to-endish smoke test in `combined-smoke.test.ts` that compares split and combined behavior over the real web surface
- keep a real HTTP e2e smoke in `combined-server.test.ts` that boots the candidate on an ephemeral port
- concentrate semantic auth, dashboard bootstrap, and runtime health in `bootstrap-surface.ts` so the combined candidate depends on higher-level surfaces instead of raw request wiring
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
