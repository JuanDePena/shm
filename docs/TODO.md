# SimpleHost TODO

Updated on `2026-05-02`.

This file tracks work that is still open after the current monorepo, naming, and runtime cutover work.
Closed work should stay documented as implemented state elsewhere, not linger here.

Current baseline:

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active release: `2605.02.05`
- primary active services: `simplehost-control`, `simplehost-worker`, `simplehost-agent`
- secondary active services: `simplehost-control`, `simplehost-agent`
- secondary intentionally inactive service: `simplehost-worker`
- backup timers: primary and secondary `simplehost-backup-runner.timer`

## Current status

- The mail roadmap that used to live in this file is complete through phase 7 and has been moved out of `TODO`.
- Implemented mail behavior now lives in [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md).
- The migration and cutover workflow now lives in [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md).
- The first closed live mail-domain migration is documented in [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md).
- `TODO.md` should only carry work that is still genuinely open.

## Open items

Active open items as of `2026-05-02`:

- Post-migration operational hardening, tuning, resilience, and documentation cleanup are tracked in
  [`/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md).

Current active slice:

- Phase 5 resilience and IAM/SSO follow-up:
  - continue the Authentik rollout tracked in
    [`/opt/simplehostman/src/docs/IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
  - admin TOTP MFA and recovery codes are already enrolled for
    `webmaster@pyrosa.com.do`
  - Authentik backup and restore-test coverage is complete through
    SimpleHostMan backup policy `iam-authentik-primary-daily`
  - `https://code.pyrosa.com.do/` is now protected through Authentik on the
    primary, with a direct-vhost rollback copy under `/root/simplehost-rollbacks`
  - `https://vps-prd.pyrosa.com.do:3200/` is now protected through Authentik on
    the primary, with the direct control-panel vhost saved under
    `/root/simplehost-rollbacks`
  - SimpleHostMan trusted-proxy SSO now converts successful Authentik MFA into
    a local `shp_session` for existing active operators, removing the internal
    double-login on the primary operator UI
  - unprovisioned SSO identities now receive a SimpleHostMan `403` access page
    with the received email and an Authentik outpost sign-out action
  - SHM logout now clears the local session and redirects SSO sessions through
    Authentik outpost sign-out before the next login attempt
  - secondary IAM/DR posture is defined and staged conservatively: Authentik
    files, vhosts and units are present on the secondary, but startup is held
    behind `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED`
  - next implementation step: decide whether the secondary node-name
    SimpleHostMan UI should stay as a standby/direct operator route or receive
    its own IAM design after secondary Authentik promotion
  - SSH remains unchanged and outside the Authentik scope

Historical migration runbooks can retain execution records, validation gates, and conditional
operator notes, but they should not be treated as active TODOs unless this file links to them.
