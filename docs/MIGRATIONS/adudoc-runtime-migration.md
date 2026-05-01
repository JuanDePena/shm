# Adudoc Runtime Migration

This document captures the live discovery work for migrating `adudoc` from the legacy cPanel host into the `SimpleHost Control + SimpleHost Agent` app-service model.

## Discovery Summary

Discovery was performed on `2026-04-12` over SSH against `root@vps-old.pyrosa.com.do`.

- Legacy host: `vps-1926167b.vps.ovh.ca`
- cPanel account: `wmadudoc`
- primary domain: `adudoc.com`
- legacy document root: `/home/wmadudoc/public_html`
- legacy app size: `841M`
- legacy database engine: `postgresql`
- legacy database name: `adudoc_db`
- legacy database user: `adudoc_user`
- legacy database size: about `8.5 MB`
- legacy PHP runtime: `PHP 8.4.19`

## Legacy App Shape

`adudoc` is a custom PHP application, not a Composer-managed Laravel deployment.

Key characteristics:

- entrypoint: `index.php`
- bootstrap: `bootstrap/autoload.php`
- route files:
  - `routes/web.php`
  - `routes/admin.php`
  - `routes/api.php`
- config files:
  - `config/database.php`
  - `config/auth.php`
  - `config/assets.php`
  - `config/csrf.php`
  - `config/i18n.php`
- custom PDO bootstrap in `app/Support/DB.php`

The largest directory is `lib/` at roughly `839M`, so migration must copy the full application tree and not only `app/` or `public/`.

## Runtime Findings

- Apache vhosts exist on the legacy host for `adudoc.com` and `www.adudoc.com`.
- No user cron jobs were found for `wmadudoc`.
- No obvious background worker process model was found.
- `storage/uploads`, `storage/cache`, and `storage/logs` were empty at discovery time.
- The application currently hardcodes PostgreSQL credentials in `config/database.php`.
- `config/auth.php` still contains bootstrap placeholders (`change-me`) and should be reviewed during cutover hardening.

## Migration Implications

The target runtime should treat `adudoc` as:

1. a managed application service `app-adudoc.service`
2. a reverse-proxied Apache site on `127.0.0.1:10301`
3. a mounted application tree under `/srv/containers/apps/adudoc/app`
4. a separate uploads root under `/srv/containers/apps/adudoc/uploads`

To make that viable, the app needs one deployment-time refactor:

- convert `config/database.php` from hardcoded credentials to environment-driven configuration with sane fallback defaults

## Migration Inputs

These are the concrete sources used by the pilot migration scripts:

- code source: `root@vps-old.pyrosa.com.do:/home/wmadudoc/public_html/`
- DB source: `postgresql://adudoc_user@vps-old.pyrosa.com.do/adudoc_db`
- target code root: `/srv/containers/apps/adudoc/app`
- target uploads root: `/srv/containers/apps/adudoc/uploads`
- target database: `app_adudoc`
- target DB role: `app_adudoc`
- target backend bind: `127.0.0.1:10301`

## Historical Follow-ups

These notes were recorded during the pilot cutover. They are not active TODOs
unless `TODO.md` or the operational inspection plan reopens them:

- confirm whether `config/auth.php` should also become environment-driven before public cutover
- verify if any content under `lib/` is cacheable/generated and can be reduced later
- verify whether `adudoc_db` should be preserved as an archival restore or fully retired after cutover

## Pilot Execution Status

Pilot migration was executed on `2026-04-12` on the primary node.

Completed outcomes:

- runtime image built locally as `registry.example.com/adudoc-app:stable`
- application tree copied into `/srv/containers/apps/adudoc/app`
- application database imported into local PostgreSQL database `app_adudoc`
- `config/database.php` converted to environment-driven PostgreSQL configuration
- Quadlet unit written to `/etc/containers/systemd/app-adudoc.container`
- Apache vhost switched to reverse proxy `adudoc.com -> 127.0.0.1:10301`
- `app-adudoc.service` started successfully under Podman + systemd
- local end-to-end proxy validation returned `200 OK` for `Host: adudoc.com`
- desired database credential for `adudoc` persisted into `SimpleHost Control`

## Implementation Notes From The Pilot

These adjustments were required to make the migration reliable:

- `rsync` must not preserve legacy `xattrs` or ACLs from the cPanel host because SELinux rejects those on the target filesystem
- the copied application tree must be normalized to `root:root` plus `u=rwX,go=rX`, otherwise Apache inside the container cannot read `.htaccess`
- writable directories must be created explicitly:
  - `/srv/containers/apps/adudoc/uploads`
  - `/srv/containers/apps/adudoc/app/storage/cache`
  - `/srv/containers/apps/adudoc/app/storage/logs`
- Quadlet-managed app services should be started or restarted with `systemctl restart app-adudoc.service`; `systemctl enable` against the generated unit is not the right primitive on this host
- health validation for the landing page must use `GET /`, not `HEAD /`, because the app does not implement a dedicated `HEAD` route for `/`

## Rollback

Minimum rollback for the runtime pilot:

1. `systemctl stop app-adudoc.service`
2. `systemctl disable app-adudoc.service` only if a persistent override or manual symlink was later added
3. restore or replace `/etc/httpd/conf.d/adudoc.conf` if traffic must stop proxying to the container
4. move `/srv/containers/apps/adudoc` aside instead of deleting it immediately
5. if the imported database must be discarded, drop and recreate `app_adudoc` only after confirming no other process depends on it

Current operational note:

- the source changes for automatic `container.reconcile` dispatch and `appServices` runtime reporting now live in `/opt/simplehostman/src`
- the installed releases still need a formal deployment under the normalized `/opt/simplehostman/release` runtime layout before the live dashboard and agent expose those new capabilities
