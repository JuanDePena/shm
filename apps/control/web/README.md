# Control Web Entrypoint

This directory contains the current web entrypoint for the unified control-plane app.

Path:

- `/opt/simplehostman/src/apps/control/web`

Current role:

- serve the operator and tenant-facing UI
- render dashboard workspaces and desired-state views
- expose the current web server boundary for the control plane
- organize web routing through a shared `WebRouteContext` plus route slices for core pages, session flows, and action POST handlers

This entrypoint remains separate only as a transitional source boundary inside `apps/control`.
Common process and runtime helpers now live in `/opt/simplehostman/src/apps/control/shared`.
`createPanelWebSurface()` now acts as the reusable UI-side equivalent of the API surface boundary.
`WebRouteContext` now carries `sessionToken`, so dashboard, desired-state, mail, and action handlers all share one per-request auth/session boundary.
Login redirects, cookie clearing, and login-error rendering now flow through a shared auth/session helper layer instead of being duplicated across route handlers.
`PanelWebApi` now exposes semantic auth methods (`login`, `logout`, `getCurrentUser`) so web routes no longer need to reach into raw `/v1/auth/*` paths directly.
`PanelWebApi` also now exposes `loadDashboardBootstrap()`, so the initial authenticated dashboard render has a named bootstrap seam that the combined runtime can reuse more directly.
The long-term target is one control-plane runtime process serving both UI and API.
