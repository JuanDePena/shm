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

Status: published on `2026-05-02`; admin TOTP MFA and recovery codes are
enrolled.

Goal: expose only the Authentik login/admin surface.

Actions:

- add the `auth.pyrosa.com.do` DNS record
- create the Apache TLS vhost for `auth.pyrosa.com.do`
- complete initial admin setup
- enable the initial MFA policy
- document the recovery and break-glass procedure

Validation:

- `https://auth.pyrosa.com.do/` reaches Authentik
- `webmaster@pyrosa.com.do` exists as an active superuser with a usable password
- `/if/flow/initial-setup/` is blocked at Apache after bootstrap
- admin TOTP MFA is enrolled
- recovery codes are registered before the first protected app is enforced
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
- After operator password rotation, the temporary initial-password file
  `/etc/simplehost/iam/authentik/akadmin-initial-password` was removed.
- Live bootstrap password/email values were removed from
  `/etc/simplehost/iam/authentik/authentik.env`, which remains mode `0600`.
- `webmaster@pyrosa.com.do` has one confirmed TOTP authenticator.
- `webmaster@pyrosa.com.do` has one confirmed static/recovery-code
  authenticator with ten one-time tokens.
- The recovery codes are stored in the root-only file
  `/etc/simplehost/iam/authentik/recovery-codes-webmaster-pyrosa-20260502.txt`
  with mode `0600`.
- `code.pyrosa.com.do` was not changed in this phase.

### Phase 3: Backup Policy And Restore Test

Status: completed on `2026-05-02` through SimpleHostMan backup policy
`iam-authentik-primary-daily`.

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

Completion evidence:

- SimpleHostMan worker supports the dedicated selectors `iam:authentik` and
  `host-service:authentik`.
- Backup policy:
  - slug: `iam-authentik-primary-daily`
  - target node: `primary`
  - schedule: `35 4 * * *`
  - retention: `14` days
  - storage: `/srv/backups/iam/authentik/primary`
  - selectors: `iam:authentik`, `host-service:authentik`
- Forced backup run:
  `backup-run-f1cd328b-92db-4959-8721-d15565922056`
- Artifacts:
  - `authentik-files.tar.gz`
  - `app_authentik.dump`
  - `postgresql-apps-globals.sql`
  - `manifest.json`
- Artifact mode: `0600`.
- Restore test `20260502T062345Z` restored `app_authentik` into scratch
  database `restoretest_authentik_20260502t062345z` and validated:
  - `212` public tables
  - `3` users
  - `1` confirmed TOTP device
  - `1` confirmed static/recovery-code device
  - `10` static/recovery-code tokens
- The file archive restored expected Authentik config, recovery-code, data,
  certificate, and template paths into a scratch directory.
- Scratch database, staging directory, and scratch file target were removed.
- No secret values were printed or committed.

### Phase 4: Protect `code.pyrosa.com.do`

Status: completed on the primary on `2026-05-02`.

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

Completion evidence:

- Authentik group `PYROSA Operators` was created and
  `webmaster@pyrosa.com.do` was added.
- Authentik authentication flow `pyrosa-authentication-mfa-required` was
  created with MFA validation set to deny users that have no MFA device.
- Authentik Brand `pyrosa.com.do` was created for Pyrosa-owned subdomains:
  - title: `PYROSA`
  - logo media: `pyrosa/logo-transp-white.png`
  - favicon media: `pyrosa/favicon.ico`
  - authentication flow: `pyrosa-authentication-mfa-required`
  - brand CSS hides the flow footer links, including `Powered by authentik`,
    centers the login title/header, and tightens the logo-to-title spacing
- The `pyrosa-authentication-mfa-required` flow title was updated to
  locale-neutral `PYROSA`.
- Authentik Proxy Provider `code.pyrosa.com.do` was created in `proxy` mode:
  - external host: `https://code.pyrosa.com.do`
  - internal host: `http://host.containers.internal:18080`
  - authorization flow: `default-provider-authorization-implicit-consent`
- The provider internal host uses the Podman host alias because the embedded
  outpost runs inside the Authentik container; `127.0.0.1` there is the
  container itself, not the SimpleHostMan host.
- Source-controlled internal Apache bridge:
  [`platform/httpd/vhosts/pyrosa-code-internal-bridge.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code-internal-bridge.conf)
- Live internal Apache bridge:
  `/etc/httpd/conf.d/pyrosa-code-internal-bridge.conf`
- The bridge listens on `10.88.0.1:18080`, allows only the Podman subnet, and
  proxies to the local `code-server` backend on `127.0.0.1:8080`.
- SELinux port label: `18080/tcp` is registered as `http_port_t` for the
  internal Apache listener.
- Authentik application `code-pyrosa` was created and restricted to
  `PYROSA Operators`.
- The embedded outpost now includes provider `code.pyrosa.com.do`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-code.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-code.conf`
- Rollback vhost copy:
  `/root/simplehost-rollbacks/pyrosa-code-direct-20260502T063848Z.conf`
- `apachectl -t` returned `Syntax OK`; Apache was reloaded.
- Validation from the primary public address:
  - `https://code.pyrosa.com.do/` returns `302` to the Authentik outpost start
    path.
  - `https://code.pyrosa.com.do/login` returns `302` to the Authentik outpost
    start path.
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/start?...` returns
    `302` to `https://auth.pyrosa.com.do/application/o/authorize/...`.
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/ping` returns `204`.
- `https://auth.pyrosa.com.do/` still returns `302`.
- `https://auth.pyrosa.com.do/flows/-/default/authentication/?next=/`
  redirects to `/if/flow/pyrosa-authentication-mfa-required/?next=%2F`.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` still returns `403`.
- `https://auth.pyrosa.com.do/if/flow/pyrosa-authentication-mfa-required/`
  renders with `<title>PYROSA</title>`, Pyrosa media-backed logo/favicon, and
  no static `Welcome to authentik!` or `Powered by authentik` text.
- The login title/header is centered by the Brand custom CSS.
- The Brand custom CSS reduces logo-to-title spacing by lowering the logo
  header bottom padding and the title header top padding.
- The flow executor API reports title `PYROSA`.
- The flow executor API returned the same locale-neutral title with
  `Accept-Language` set to `en`, `es`, and `fr`.
- Break-glass local backend check:
  `http://127.0.0.1:8080/login` still returns `200`.
- Internal bridge checks:
  - `http://10.88.0.1:18080/login` returns `200`.
  - `http://host.containers.internal:18080/login` returns `200` from inside
    the Authentik container.
- Authenticated browser traffic after the bridge correction returned `200` for
  code-server pages and `101` for WebSocket upgrade requests through the bridge.
- `authentik-server.service`, `authentik-worker.service`,
  `simplehost-worker.service`, and `httpd` remained active.
- A post-enforcement forced backup succeeded:
  `backup-run-3db0fd3e-7651-402a-b7d4-deb894c7195e`.
- A post-bridge-correction forced backup succeeded:
  `backup-run-846c771e-a73b-48ea-9153-babc69eccbf6`.
- Post-bridge-correction backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-58-38-417Z`
- A post-branding forced backup succeeded:
  `backup-run-0cb8786b-47f7-4a80-bc56-bfa1e7de299f`.
- Post-branding backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-13-23-428Z`
- A post-title-adjustment forced backup succeeded:
  `backup-run-02e1fc98-1798-4be7-8504-f9a8c3c42430`.
- Post-title-adjustment backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-17-03-754Z`
- A post-centered-title forced backup succeeded:
  `backup-run-b3f8ac07-9a0e-4131-96ee-79a3e4f0e678`.
- Post-centered-title backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-26-10-550Z`
- A post-login-spacing forced backup succeeded:
  `backup-run-1d00efaa-e832-41db-82a5-22b8ce75c57b`.
- Post-login-spacing backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-29-56-575Z`
- The post-enforcement backup restored into scratch database
  `restoretest_authentik_phase4_20260502t0643z` and validated:
  - `1` `code-pyrosa` application
  - `1` `https://code.pyrosa.com.do` proxy provider
  - `1` embedded-outpost/provider link
  - `1` MFA-required validation stage
- Scratch database and temporary dump copy were removed.
- No secret values were printed or committed.

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

Status: completed in conservative standby mode on `2026-05-02`.

Goal: define the passive-node IAM posture after the primary rollout is stable.

Selected posture:

- Authentik runs on the primary only during normal operation.
- The secondary carries restored Authentik files, secrets, media, vhosts,
  Quadlet units and the pinned container image, but the services remain
  inactive.
- Secondary Authentik units have a systemd hold:
  [`platform/host/systemd/authentik-secondary-standby-hold.conf`](/opt/simplehostman/src/platform/host/systemd/authentik-secondary-standby-hold.conf).
  They will not start unless
  `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED` exists.
- The secondary `app_authentik` database is supplied by the PostgreSQL apps
  physical standby. The logical `app_authentik.dump` backup remains the
  fallback if a fresh restore is required instead of standby promotion.

Promotion outline:

1. Confirm the primary is intentionally out of service or stopped for IAM.
2. Promote the secondary PostgreSQL apps cluster and confirm
   `pg_is_in_recovery()` returns `f` on port `5432`.
3. Confirm `/etc/simplehost/iam/authentik/authentik.env` points to
   `AUTHENTIK_POSTGRESQL__HOST=10.89.0.2`.
4. Release the hold:

   ```bash
   touch /etc/simplehost/iam/authentik/SECONDARY_PROMOTED
   systemctl start authentik-server authentik-worker
   ```

5. Repoint `auth.pyrosa.com.do` and protected app hostnames such as
   `code.pyrosa.com.do` to the secondary public address.
6. Validate the Authentik login flow, the embedded outpost ping and the
   protected app.

Rollback before promotion:

- leave the hold marker absent
- keep `authentik-server` and `authentik-worker` inactive
- restore the previous secondary direct `code.pyrosa.com.do` vhost from
  `/root/simplehost-rollbacks/pyrosa-code-secondary-direct-20260502T074400Z.conf`
  if direct secondary code-server exposure is needed again

Do not enable automatic IAM failover before database and persistent file
behavior is explicitly tested.

Completion evidence:

- Latest Authentik backup seed replicated to the secondary:
  `/srv/backups/iam/authentik/primary-replicated/iam-authentik-primary-daily-2026-05-02T07-29-56-575Z`
- Secondary restored root-only Authentik config/runtime paths:
  - `/etc/simplehost/iam/authentik`
  - `/srv/containers/iam/authentik`
- Secondary `authentik.env` was adjusted for the local standby node with
  `AUTHENTIK_POSTGRESQL__HOST=10.89.0.2`.
- Secondary Pyrosa logo and favicon media were present after restore.
- Secondary Quadlet units were installed but left inactive:
  - `/etc/containers/systemd/authentik-server.container`
  - `/etc/containers/systemd/authentik-worker.container`
- Secondary hold drop-ins were installed:
  - `/etc/systemd/system/authentik-server.service.d/10-secondary-standby-hold.conf`
  - `/etc/systemd/system/authentik-worker.service.d/10-secondary-standby-hold.conf`
- Secondary Authentik image `ghcr.io/goauthentik/server:2026.2.2` was pulled.
- Secondary vhosts were aligned to primary standby shape:
  - `/etc/httpd/conf.d/pyrosa-authentik.conf`
  - `/etc/httpd/conf.d/pyrosa-code.conf`
  - `/etc/httpd/conf.d/pyrosa-code-internal-bridge.conf`
- Secondary SELinux `http_port_t` includes `18080/tcp` for the internal
  code-server bridge.
- Secondary Apache returned `Syntax OK`, `httpd` is active and there are no
  failed systemd units.
- Secondary `postgresql@apps` remains in recovery and contains
  `app_authentik`.
- Secondary `auth.pyrosa.com.do` and `code.pyrosa.com.do` return `503` with
  `--resolve` while Authentik is intentionally held inactive.
- Primary `auth.pyrosa.com.do` and `code.pyrosa.com.do` still return `302`,
  and primary Authentik services remain active.

## Operational Hold Points

These hold points were satisfied before the `2026-05-02` phase 4 enforcement.
Do not protect any later app until the equivalent rollback and recovery
conditions are true for that app:

- Authentik admin login requires MFA.
- A root-key SSH break-glass path is tested.
- The previous direct `code.pyrosa.com.do` vhost is saved for rollback.
- Authentik backup and restore have been validated.
- The operator can recover or reset MFA without using the browser path being
  protected.
