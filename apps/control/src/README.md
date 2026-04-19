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
- expose a dry-run handoff contract toward `/opt/simplehostman/release` in `release-shadow-handoff.ts`
- expose a runner and CLI entrypoint for validating that handoff in `release-shadow-handoff-runner.ts` and `release-shadow-handoff-cli.ts`
- expose a workspace-local emulated release root in `release-target-layout.ts`
- expose a handoff applier plus runtime runner for that emulated release root in `release-target-apply.ts` and `release-target-runner.ts`
- expose CLI entrypoints for applying and starting the emulated release root in `release-target-apply-cli.ts` and `release-target-start-cli.ts`
- expose a real release-root staging layout under `/opt/simplehostman/release/.staging/control` in `release-root-staging-layout.ts`
- expose plan, diff, apply, inspect, and runtime helpers for that staging area in `release-root-staging.ts` and `release-root-staging-runner.ts`
- expose CLI entrypoints for planning, diffing, applying, inspecting, and starting the staging area in `release-root-staging-plan-cli.ts`, `release-root-staging-diff-cli.ts`, `release-root-staging-apply-cli.ts`, `release-root-staging-inspect-cli.ts`, and `release-root-staging-start-cli.ts`
- expose a release-root promotion target sourced from that real staging area in `release-root-promotion-layout.ts`
- expose plan, diff, apply, inspect, and runtime helpers for promoting staging into an emulated live release root in `release-root-promotion.ts` and `release-root-promotion-runner.ts`
- expose release inventory and activation helpers for that promotion target in `release-root-promotion-activation.ts`
- expose promotion metadata, history, and cutover helpers for that promotion target in `release-root-promotion-promotion.ts`
- expose deploy and rollback manifests for that promotion target in `release-root-promotion-deployment.ts`
- expose a promotion-ready runner for that target in `release-root-promotion-ready.ts`
- expose CLI entrypoints for planning, diffing, applying, inspecting, activating, promoting, starting, and promotion-ready checks for that promotion target in `release-root-promotion-plan-cli.ts`, `release-root-promotion-diff-cli.ts`, `release-root-promotion-apply-cli.ts`, `release-root-promotion-inspect-cli.ts`, `release-root-promotion-activate-cli.ts`, `release-root-promotion-promote-cli.ts`, `release-root-promotion-start-cli.ts`, and `release-root-promotion-ready-cli.ts`
- expose a release-root cutover layout aimed at the real release root, still in plan-only mode, in `release-root-cutover-layout.ts`
- expose cutover planning and readiness helpers for that real release root in `release-root-cutover.ts` and `release-root-cutover-ready.ts`
- expose a cutover handoff runner that consolidates the real cutover plan/ready layer with the emulated target handoff in `release-root-cutover-handoff.ts`
- expose CLI entrypoints for planning, inspecting, readiness checks, and handoff checks for that cutover layer in `release-root-cutover-plan-cli.ts`, `release-root-cutover-inspect-cli.ts`, `release-root-cutover-ready-cli.ts`, and `release-root-cutover-handoff-cli.ts`
- expose a cutover-target readiness runner for the emulated actual release root in `release-root-cutover-target-ready.ts`
- expose a CLI entrypoint for that cutover-target readiness runner in `release-root-cutover-target-ready-cli.ts`
- expose an end-to-end cutover rehearsal runner for the emulated actual release root in `release-root-cutover-target-rehearsal.ts`
- expose a CLI entrypoint for that cutover rehearsal runner in `release-root-cutover-target-rehearsal-cli.ts`
- expose a cutover parity runner that compares the real cutover plan against the emulated target rehearsal in `release-root-cutover-target-parity.ts`
- expose a CLI entrypoint for that cutover parity runner in `release-root-cutover-target-parity-cli.ts`
- expose a cutover handoff runner that consolidates target-ready, actual-cutover-ready, rehearsal, and parity into one auditable artifact in `release-root-cutover-target-handoff.ts`
- expose a CLI entrypoint for that cutover handoff runner in `release-root-cutover-target-handoff-cli.ts`
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
- keep a release-shadow handoff test in `release-shadow-handoff.test.ts` to lock the dry-run handoff contract toward `/opt/simplehostman/release`
- keep a release-target test in `release-target.test.ts` to lock the applied handoff against a separate emulated release root
- keep a release-root staging test in `release-root-staging.test.ts` to lock parity between the real release-root staging area and the workspace-local `release-target`
- keep a release-root promotion test in `release-root-promotion.test.ts` to lock parity between the real staging area and the emulated live-root promotion target
- keep a release-root promotion activation test in `release-root-promotion-activation.test.ts` to lock inventory-backed version switching inside that emulated live root
- keep a release-root promotion cutover test in `release-root-promotion-promotion.test.ts` to lock promotion history plus rollback semantics inside that emulated live root
- keep a release-root promotion ready test in `release-root-promotion-ready.test.ts` to lock health/login plus manifest readiness inside that emulated live root
- keep a release-root cutover test in `release-root-cutover.test.ts` to lock plan and readiness checks against a fake actual release root before touching `/opt/simplehostman/release/current`
- keep a release-root cutover handoff test in `release-root-cutover-handoff.test.ts` to lock the consolidated actual-root cutover handoff artifact before touching `/opt/simplehostman/release/current`
- keep a release-root cutover target ready test in `release-root-cutover-target-ready.test.ts` to lock manifest, history, `current`, and runtime health/login checks for the emulated actual release root
- keep a release-root cutover target rehearsal test in `release-root-cutover-target-rehearsal.test.ts` to lock the cutover -> ready -> rollback cycle on the emulated actual release root
- keep a release-root cutover target parity test in `release-root-cutover-target-parity.test.ts` to lock agreement between the actual cutover plan and the emulated target rehearsal
- keep a release-root cutover target handoff test in `release-root-cutover-target-handoff.test.ts` to lock the consolidated handoff artifact before any move toward the real cutover
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
- source-level release-shadow handoff (`release-shadow-handoff`, `release-shadow-handoff-runner`, `release-shadow-handoff-cli.ts`)
- source-level release target (`release-target-layout`, `release-target-apply`, `release-target-runner`)
- source-level release-root staging (`release-root-staging-layout`, `release-root-staging`, `release-root-staging-runner`)
- source-level release-root promotion (`release-root-promotion-layout`, `release-root-promotion`, `release-root-promotion-runner`)
- source-level release-root promotion lifecycle (`release-root-promotion-activation`, `release-root-promotion-promotion`, `release-root-promotion-deployment`, `release-root-promotion-ready`)
- source-level release-root cutover planning (`release-root-cutover-layout`, `release-root-cutover`, `release-root-cutover-ready`)
- source-level release-root cutover handoff (`release-root-cutover-handoff`)
- source-level release-root cutover target (`release-root-cutover-target-layout`, `release-root-cutover-target`, `release-root-cutover-target-runner`)
- source-level release-root cutover rollback rehearsal (`release-root-cutover-target-rollback`)
- source-level release-root cutover target ready (`release-root-cutover-target-ready`)
- source-level release-root cutover target rehearsal (`release-root-cutover-target-rehearsal`)
- source-level release-root cutover target parity (`release-root-cutover-target-parity`)
- source-level release-root cutover target handoff (`release-root-cutover-target-handoff`)
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

The next rehearsal layer after that now targets the real release root, but only under staging:

- `/opt/simplehostman/release/.staging/control`
- `releases/<version>` and `current` within that staging root
- shared metadata, logs, tmp, and run state inside staging only
- parity checks against the workspace-local `release-target`

The next rehearsal layer after staging now models promotion into an emulated live root sourced from the real staging area:

- `.tmp/control-release-root-promotion/<targetId>/opt/simplehostman/release`
- `releases/<version>` and `current` within that emulated live root
- metadata copied from the real `.staging/control/shared/meta`
- inventory and activation metadata persisted under `shared/meta`
- cutover history plus deploy/rollback manifests persisted under `shared/meta`
- parity checks against the runtime started directly from the real staging area

The next rehearsal layer after that now models a cutover plan toward the real release root, still without applying it:

- `.tmp/control-release-root-cutover/<targetId>/meta`
- plan and readiness manifests that describe how `/opt/simplehostman/release/current` would move
- rollback candidate detection based on the current real `current` symlink shape
- readiness checks that block unsafe `current` shapes before any real cutover attempt

That still stops short of any packaging or release promotion against `/opt/simplehostman/release`.
- concentrate semantic auth, dashboard bootstrap, and runtime health in `bootstrap-surface.ts` so the combined candidate depends on higher-level surfaces instead of raw request wiring
- provide a safe source-level checkpoint before the runtime model is actually unified

This entrypoint is not yet the deployed runtime. It exists to prepare the convergence from two control-plane processes to one.
