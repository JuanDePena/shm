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
  - next implementation step: add backup and restore-test coverage for
    Authentik
  - first protected surface: `https://code.pyrosa.com.do/`
  - SSH remains unchanged and outside the Authentik scope

Historical migration runbooks can retain execution records, validation gates, and conditional
operator notes, but they should not be treated as active TODOs unless this file links to them.
