# IAM And SSO Runbook

Updated on `2026-05-02`.

## Scope

This runbook documents the planned Identity and Access Management layer for
SimpleHostMan administrative and selected application web surfaces.

Selected IAM product:

- Authentik

Primary hostname:

- `auth.pyrosa.com.do`

First protected application:

- `https://code.pyrosa.com.do/`

Explicitly out of scope:

- SSH login and SSH key policy
- direct RustDesk `hbbs` and `hbbr` transport ports
- public customer websites that must remain anonymously reachable

SSH remains governed by [`HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md).

## Current Decision

The platform should run Authentik as a dedicated IAM/SSO service, not as a
generic `control_plane_apps` web application.

Reasoning:

- Authentik is a multi-service stack, not a single HTTP container.
- It needs a server component, a worker component, PostgreSQL, persistent file
  storage, and at least one proxy outpost path for protected applications.
- The current generic app reconciler assumes one app container published to a
  local HTTP backend port with application file volumes; that is the wrong
  shape for an IAM stack.
- Treating IAM as a special platform resource keeps rollback and break-glass
  procedures clearer.

Official Authentik references checked during this planning pass:

- https://docs.goauthentik.io/core/architecture/
- https://docs.goauthentik.io/install-config/install/docker-compose/
- https://docs.goauthentik.io/install-config/configuration/
- https://docs.goauthentik.io/add-secure-apps/outposts/
- https://docs.goauthentik.io/add-secure-apps/providers/proxy/

## Target Architecture

Initial topology:

- Apache remains the public TLS terminator.
- Authentik listens only on local backend ports.
- `auth.pyrosa.com.do` proxies to the Authentik server.
- Protected applications are placed behind an Authentik Proxy Provider and
  outpost flow.
- `code-server` keeps its own password enabled as a second layer during the
  first rollout.
- Root key SSH and the local `code-server` tunnel remain the break-glass path.

Primary runtime components:

- `authentik-server`
- `authentik-worker`
- Authentik embedded outpost or a standalone local-only proxy outpost
- PostgreSQL database `app_authentik`

The official `2026.2.2` Compose file no longer includes Redis. Do not add a
Redis or Valkey dependency unless the reviewed Authentik release explicitly
requires it again.

The preferred database is the platform PostgreSQL app cluster, not a bundled
throwaway database container. If a bundled database is used temporarily during
the first lab run, it must not become the production source of truth.

Recommended host paths:

- storage root: `/srv/containers/iam/authentik`
- secrets: `/etc/simplehost/iam/authentik/`
- Apache vhost: `/etc/httpd/conf.d/pyrosa-authentik.conf`
- systemd/Quadlet units: `/etc/containers/systemd/authentik-*.container`

Secret files must be root-owned and mode `0600`. No generated secret, token,
initial password, recovery code, or database password should be committed.

## Port Plan

Reserve the `10170-10179` range for IAM/SSO surfaces in the Pyrosa family.

Initial reservations:

- `10170`: Authentik server HTTP backend
- `10171`: Authentik proxy outpost for the first protected app, if a standalone
  outpost is used
- `10172`: optional internal health or future outpost backend

These ports should stay bound to `127.0.0.1` only.

## DNS Plan

Planned record:

- `auth.pyrosa.com.do A 51.222.204.86`
- TTL: `300` during rollout

No `www.auth.pyrosa.com.do` alias is required.

Do not publish the record or reconcile the vhost until the local Authentik
health checks pass on the primary node.

## Application Protection Order

Protect applications in this order:

1. `code.pyrosa.com.do`
2. SimpleHostMan operator web surfaces such as `vps-prd.pyrosa.com.do:3200`
   after the `code-server` rollout is stable
3. internal admin apps such as `pgadmin.pyrosa.com.do` and
   `ldap.pyrosa.com.do`
4. selected customer or project apps that need user identity and policy

Do not put WordPress public sites or public marketing pages behind IAM unless
there is an explicit business requirement.

RustDesk note:

- Authentik can protect a future web management surface around RustDesk.
- Authentik should not be placed in the direct `hbbs` or `hbbr` transport path.
- RustDesk server key material and exposed ports remain governed by
  [`RUSTDESK.md`](/opt/simplehostman/src/docs/RUSTDESK.md).

## MFA Policy

Initial Authentik policy:

- local operator users or an operator group only
- username and password
- TOTP MFA required for administrator access
- recovery codes generated and stored outside the browser session
- lockout and rate-limiting enabled before protecting `code-server`

Later options:

- WebAuthn/passkeys for routine operators
- per-app policies for admin tools versus customer apps
- LDAP/OIDC integration if a stable upstream identity provider is selected

## Backup And Restore

Required backup coverage before protecting `code.pyrosa.com.do`:

- PostgreSQL logical backup for `app_authentik`
- Authentik media, blueprints, custom templates and local storage under
  `/srv/containers/iam/authentik`
- root-only secret material under `/etc/simplehost/iam/authentik`
- Apache vhost fragments for `auth.pyrosa.com.do` and protected apps
- Authentik outpost token or deployment secret if a standalone outpost is used

Restore validation before enforcement:

- restore `app_authentik` into a scratch database
- restore Authentik files into a scratch path
- confirm the restored configuration identifies at least the admin flow,
  provider, application and outpost objects
- document the backup run id and restore-test id in
  [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md)

## Rollout Phases

### Phase 0: Design And Guardrails

Status: completed in source documentation on `2026-05-02`.

Actions:

- select Authentik as the IAM/SSO product
- exclude SSH from the Authentik scope
- define hostname, port reservations, backup expectations and rollback posture
- document that Authentik is a special IAM stack, not a generic app resource

Validation:

- documentation links from architecture, proxy, hardening and active TODOs
- no live DNS, vhost or `code-server` proxy change yet

### Phase 1: Stage Primary IAM Runtime

Status: completed on primary on `2026-05-02`.

Goal: start Authentik on the primary without protecting any existing app.

Actions:

- create `app_authentik` in the PostgreSQL app cluster
- generate root-only Authentik secret material
- create `/srv/containers/iam/authentik`
- create local-only Quadlet-managed containers for server and worker
- pin the Authentik image version reviewed at implementation time
- keep all services bound to `127.0.0.1`

Validation:

- server and worker containers are healthy
- Authentik can reach PostgreSQL
- local initial setup URL responds through `127.0.0.1:10170`
- `systemctl --failed` remains clean

Rollback:

- stop and disable Authentik units
- leave `code.pyrosa.com.do` unchanged
- preserve secrets and database until explicit cleanup approval

Completion evidence:

- Authentik image pinned to `ghcr.io/goauthentik/server:2026.2.2`, matching the
  current official Compose file reviewed during rollout.
- Source-controlled Quadlet artifacts were added:
  - [`platform/containers/quadlet/authentik-server.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-server.container)
  - [`platform/containers/quadlet/authentik-worker.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-worker.container)
  - [`platform/containers/env/authentik.env.example`](/opt/simplehostman/src/platform/containers/env/authentik.env.example)
- Live Quadlet units were installed under `/etc/containers/systemd/`.
- Root-only runtime environment is stored at
  `/etc/simplehost/iam/authentik/authentik.env` with mode `0600`.
- Persistent runtime paths were created under `/srv/containers/iam/authentik`.
- PostgreSQL app database `app_authentik` and role `app_authentik` were created
  on the app cluster.
- `authentik-server.service` and `authentik-worker.service` are active.
- `app_authentik` has Authentik schema state after initial migrations.
- `http://127.0.0.1:10170/` returns `302`.
- `http://127.0.0.1:10170/if/flow/initial-setup/` returns `200`.
- `10170/tcp` listens only on `127.0.0.1`.
- `https://code.pyrosa.com.do/login` continued to return `200` through the
  existing direct vhost.
- No live DNS, Apache vhost, public `auth.pyrosa.com.do`, or
  `code.pyrosa.com.do` proxy change was applied in this phase.

### Phase 2: Publish `auth.pyrosa.com.do`

Status: published on `2026-05-02`; admin MFA enrollment is the operator hold
point before any protected app enforcement.

Goal: expose only the Authentik login/admin surface.

Actions:

- add the `auth.pyrosa.com.do` DNS record
- create the Apache TLS vhost for `auth.pyrosa.com.do`
- complete initial admin setup
- enable the initial MFA policy
- document the recovery and break-glass procedure

Validation:

- `https://auth.pyrosa.com.do/` reaches Authentik
- `akadmin` exists as an active superuser with a usable password
- `/if/flow/initial-setup/` is blocked at Apache after bootstrap
- admin MFA and recovery codes must be enrolled from the Authentik UI before
  the first protected app is enforced
- logout and session expiry work
- no existing app vhost is changed

Rollback:

- remove or disable the `auth.pyrosa.com.do` vhost
- stop Authentik units if needed
- keep existing app vhosts untouched

Completion evidence:

- DNS desired state now includes `auth.pyrosa.com.do A 51.222.204.86` with
  TTL `300`.
- DNS sync completed on the primary and secondary authoritative nodes.
- Both authoritative nodes answer `auth.pyrosa.com.do` as `51.222.204.86`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-authentik.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-authentik.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-authentik.conf`
- `apachectl -t` returned `Syntax OK`; Apache was reloaded.
- `https://auth.pyrosa.com.do/` returns `302` to the default Authentik
  authentication flow with a valid wildcard `pyrosa.com.do` certificate.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` returns `403`.
- `authentik-server.service`, `authentik-worker.service`, and `httpd` are
  active.
- `10170/tcp` remains bound only to `127.0.0.1`.
- The initial `akadmin` password is stored only in
  `/etc/simplehost/iam/authentik/akadmin-initial-password` with mode `0600`.
- Live bootstrap values remain only in
  `/etc/simplehost/iam/authentik/authentik.env` with mode `0600`.
- `code.pyrosa.com.do` was not changed in this phase.

### Phase 3: Backup Policy And Restore Test

Goal: make IAM recoverable before enforcing it.

Actions:

- add a SimpleHostMan backup policy for Authentik files and secrets
- add logical backup coverage for `app_authentik`
- run a scratch restore test
- document artifacts and cleanup evidence

Validation:

- backup runs complete with `succeeded`
- scratch restore can read Authentik state
- no secret values are printed or committed

Rollback:

- disable the Authentik backup policy only if it is noisy or excessive
- keep service runtime unchanged

### Phase 4: Protect `code.pyrosa.com.do`

Goal: require Authentik MFA before Apache reaches the local `code-server`
backend.

Actions:

- create Authentik application and Proxy Provider for `code.pyrosa.com.do`
- configure the embedded or standalone outpost
- update the `code.pyrosa.com.do` Apache vhost to route through the Authentik
  proxy path
- keep `code-server` own password enabled

Validation:

- unauthenticated browser requests are redirected to Authentik
- authenticated operator with MFA reaches `code-server`
- `/outpost.goauthentik.io/ping` behaves as expected for the chosen outpost
- root SSH tunnel break-glass still reaches local `code-server`
- direct node-name `:8080` public access remains closed

Rollback:

- restore the previous `code.pyrosa.com.do` vhost that proxies directly to
  `127.0.0.1:8080`
- reload Apache
- leave Authentik running for investigation unless it is the outage source

### Phase 5: Extend To Other Web Surfaces

Goal: reuse IAM only where it improves administrative safety.

Candidates:

- SimpleHostMan operator UI
- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- selected internal Pyrosa apps

Non-candidates by default:

- SSH
- RustDesk transport ports
- public WordPress sites
- public package repository traffic on `repos.pyrosa.com.do`

### Phase 6: Secondary And Disaster Recovery

Goal: define the passive-node IAM posture after the primary rollout is stable.

Options:

- primary-only Authentik with documented restore on secondary
- standby Authentik units disabled on secondary with replicated config and
  restored database during failover
- later active/passive automation after failover behavior is rehearsed

Do not enable automatic IAM failover before database and persistent file
behavior is explicitly tested.

## Operational Hold Points

Do not protect `code.pyrosa.com.do` until all of these are true:

- Authentik admin login requires MFA.
- A root-key SSH break-glass path is tested.
- The previous direct `code.pyrosa.com.do` vhost is saved for rollback.
- Authentik backup and restore have been validated.
- The operator can recover or reset MFA without using the browser path being
  protected.
