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
- expose an explicit per-request cache shape through `request-context.ts`
- expose a semantic route boundary in `route-surface.ts`
- expose a single high-level candidate primitive in `combined-surface.ts`
- expose a formal runtime surface in `runtime-surface.ts`
- expose a reusable combined HTTP server candidate in `server.ts`
- expose a shared validation harness in `test-harness.ts` so split and combined flows can reuse the same fixtures and stubbed API surface
- expose a reusable runtime parity harness in `runtime-parity-harness.ts` so split and combined candidates can be compared over real HTTP servers
- expose a source-level preflight surface in `preflight-surface.ts`
- expose a human-readable preflight runner in `preflight-runner.ts`
- expose a CLI entrypoint for the preflight runner in `preflight-cli.ts`
- define the candidate runtime shape in `runtime-contract.ts`
- keep an end-to-endish smoke test in `combined-smoke.test.ts` that compares split and combined behavior over the real web surface
- keep a real HTTP e2e smoke in `combined-server.test.ts` that boots the candidate on an ephemeral port
- keep a runtime parity test in `runtime-parity.test.ts` for representative protected routes over split and combined candidate servers
- keep a preflight runner test in `preflight-runner.test.ts` for both passing and degraded candidate scenarios
- keep focused request-context coverage in `request-context.test.ts` so per-request cache semantics stay pinned down during convergence

The current checkpoint now distinguishes:

- candidate source validation (`combined-smoke`, `runtime-parity`, `combined:e2e`)
- source-level preflight (`preflight-cli`, `preflight-runner`)

That still stops short of any packaging or release promotion.
- concentrate semantic auth, dashboard bootstrap, and runtime health in `bootstrap-surface.ts` so the combined candidate depends on higher-level surfaces instead of raw request wiring
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
