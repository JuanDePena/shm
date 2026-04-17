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
- expose a release-like config adapter in `release-candidate-config.ts`
- expose a release-like startup manifest in `startup-manifest.ts`
- expose a source-level release-candidate surface in `release-candidate-surface.ts`
- expose a release-like smoke runner in `release-candidate-runner.ts`
- expose a CLI entrypoint for the release-candidate runner in `release-candidate-cli.ts`
- expose a workspace-local release-sandbox layout in `release-sandbox-layout.ts`
- expose a persistent release-sandbox bundle contract in `release-sandbox-bundle.ts`
- expose a release-sandbox packer in `release-sandbox-pack.ts`
- expose release inventory and activation helpers in `release-sandbox-activation.ts`
- expose a CLI entrypoint for packing the release-sandbox in `release-sandbox-pack-cli.ts`
- expose a CLI entrypoint for activating a packed release-sandbox in `release-sandbox-activate-cli.ts`
- expose a CLI entrypoint for promoting an active release-sandbox version in `release-sandbox-promote-cli.ts`
- expose deploy and rollback manifest helpers in `release-sandbox-deployment.ts`
- expose a promotion-ready runner in `release-sandbox-promotion-ready.ts`
- expose a CLI entrypoint for the promotion-ready runner in `release-sandbox-promotion-ready-cli.ts`
- expose a CLI entrypoint for inspecting packed release-sandbox state in `release-sandbox-inspect-cli.ts`
- expose a runtime entrypoint used inside the sandbox in `release-sandbox-entrypoint.ts`
- expose a release-sandbox runner in `release-sandbox-runner.ts`
- expose a CLI entrypoint for starting the release-sandbox in `release-sandbox-start-cli.ts`
- expose a workspace-local shadow layout for `/opt/simplehostman/release` in `release-shadow-layout.ts`
- expose a release-shadow manifest in `release-shadow-manifest.ts`
- expose release-shadow inventory and activation helpers in `release-shadow-activation.ts`
- expose release-shadow promotion metadata and history in `release-shadow-promotion.ts`
- expose release-shadow deploy/rollback manifests in `release-shadow-deployment.ts`
- expose a release-shadow packer in `release-shadow-pack.ts`
- expose a release-shadow runner in `release-shadow-runner.ts`
- expose CLI entrypoints for packing, starting, inspecting, and promotion-ready checks for the release-shadow in `release-shadow-pack-cli.ts`, `release-shadow-start-cli.ts`, `release-shadow-inspect-cli.ts`, and `release-shadow-promotion-ready-cli.ts`
- define the candidate runtime shape in `runtime-contract.ts`
- keep an end-to-endish smoke test in `combined-smoke.test.ts` that compares split and combined behavior over the real web surface
- keep a real HTTP e2e smoke in `combined-server.test.ts` that boots the candidate on an ephemeral port
- keep a runtime parity test in `runtime-parity.test.ts` for representative protected routes over split and combined candidate servers
- keep a preflight runner test in `preflight-runner.test.ts` for both passing and degraded candidate scenarios
- keep a release-candidate runner test in `release-candidate-runner.test.ts` for passing and degraded release-like scenarios
- keep a release-sandbox smoke test in `release-sandbox-smoke.test.ts` for the packed sandbox runtime
- keep a release-sandbox parity test in `release-sandbox-parity.test.ts` to compare direct and sandbox-started combined candidates
- keep a release-sandbox bundle parity test in `release-sandbox-bundle-parity.test.ts` to lock bundle metadata against the direct combined candidate
- keep a release-sandbox activation test in `release-sandbox-activation.test.ts` to lock switching and rollback behavior inside the sandbox
- keep a release-sandbox promotion test in `release-sandbox-promotion.test.ts` to lock promotion metadata and history inside the sandbox
- keep a release-sandbox promotion-ready test in `release-sandbox-promotion-ready.test.ts` to lock deploy/rollback manifests and the promotion-ready report inside the sandbox
- keep a release-shadow smoke test in `release-shadow-smoke.test.ts` for the shadow release-root candidate
- keep a release-shadow parity test in `release-shadow-parity.test.ts` to compare the shadow release-root candidate against the release-sandbox candidate
- keep a release-shadow activation test in `release-shadow-activation.test.ts` to lock copied inventory plus version switching inside the shadow
- keep a release-shadow promotion-ready test in `release-shadow-promotion-ready.test.ts` to lock deploy/rollback manifests and the promotion-ready report inside the shadow
- expose an end-to-end release rehearsal between the release-sandbox and release-shadow in `release-rehearsal.ts` and `release-rehearsal-cli.ts`
- keep a release-rehearsal test in `release-rehearsal.test.ts` to lock metadata and representative HTTP parity between the promoted shadow and the sandbox it came from
- keep focused request-context coverage in `request-context.test.ts` so per-request cache semantics stay pinned down during convergence

The current checkpoint now distinguishes:

- candidate source validation (`combined-smoke`, `runtime-parity`, `combined:e2e`)
- source-level preflight (`preflight-cli`, `preflight-runner`)
- source-level release-candidate (`release-candidate-cli`, `release-candidate-runner`)
- source-level release-sandbox (`release-sandbox-layout`, `release-sandbox-pack`, `release-sandbox-runner`)
- source-level release-sandbox bundle parity (`release-sandbox-bundle`, `release-sandbox-bundle-parity.test.ts`)
- source-level release-sandbox promotion-ready (`release-sandbox-deployment`, `release-sandbox-promotion-ready`)
- source-level release-shadow (`release-shadow-layout`, `release-shadow-pack`, `release-shadow-runner`)
- source-level release-shadow lifecycle (`release-shadow-activation`, `release-shadow-promotion`, `release-shadow-deployment`)
- source-level release rehearsal (`release-rehearsal`, `release-rehearsal-cli`, `release-rehearsal.test.ts`)

The current sandbox now simulates a more release-like filesystem shape inside the workspace:

- `releases/<version>` for the versioned candidate tree
- `current` as a symlink to the versioned release directory
- `shared/meta` for release inventory plus activation metadata
- persistent promotion metadata and history under `shared/meta`
- persistent deploy/rollback manifests and summaries under `shared/meta`
- `shared/tmp`, `shared/logs`, and `shared/run` for shared writable state

The next rehearsal layer now targets a workspace-local shadow of `/opt/simplehostman/release`:

- `.tmp/control-release-shadow/<sandboxId>/opt/simplehostman/release`
- `releases/<version>` and `current` within that shadow root
- copied promotion/deploy/rollback metadata under `shared/meta`

That still stops short of any packaging or release promotion against `/opt/simplehostman/release`.
- concentrate semantic auth, dashboard bootstrap, and runtime health in `bootstrap-surface.ts` so the combined candidate depends on higher-level surfaces instead of raw request wiring
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
