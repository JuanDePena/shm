# SimpleHost TODO

Updated on `2026-04-21`.

This file tracks work that is still open after the current monorepo, naming, and runtime cutover work.
Closed work should stay documented as implemented state elsewhere, not linger here.

Current baseline:

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active release: `2604.20.16`
- active services: `simplehost-control`, `simplehost-worker`, `simplehost-agent`

## 1. Mail roadmap after the phase-2 baseline

The phase-2 deliverability baseline is now in place:

- `MTA-STS`
- `TLS-RPT`
- strict `SPF`
- `DKIM`
- reinforced `DMARC`
- `Rspamd` wired as milter

The next mail work should continue as a deliberate roadmap. Phase 1 is now complete:

- operators can generate, rotate, reset, or intentionally leave mailbox credentials missing
- generated credentials are revealed only once and consumed server-side
- mailbox credential state is explicit across UI, API, desired state, and job payloads
- reset and rotation actions are audited

Phase 2 is now complete:

- Surface `Postfix` queue state, recent delivery failures, and defer reasons in `SimpleHostMan`.
- Expose per-domain deliverability state for `SPF`, `DKIM`, `DMARC`, `MTA-STS`, and `TLS-RPT`.
- Add node-level mail runtime health for `Postfix`, `Dovecot`, `Rspamd`, webmail, and policy documents.
- Improve operator tracing from mail resources into jobs, audit, and runtime snapshots.

Phase 3 is now complete:

- `Rspamd` thresholds and actions are now explicit and versioned in desired state instead of opaque defaults.
- Operators can manage sender allowlists, denylists, and a basic authenticated-sender rate-limiting policy.
- Greylisting is now an opt-in policy and remains disabled in the default profile.
- Anti-spam policy state is surfaced in the UI and propagated through API, desired state, and `mail.sync` jobs.

Phase 4 is now complete:

- `primary` and `secondary` are now explicit mail product roles, not only inventory labels.
- `SimpleHost Agent` now treats standby mail nodes as warm replicas that must carry runtime config, `Maildir` scaffolds, DKIM material, policy documents, and webmail roots.
- The failover model is now documented and surfaced as manual DNS cutover through stable `mail.<domain>` and `MX` semantics.
- `SimpleHostMan` now reports per-domain standby promotion readiness and concrete blockers before a secondary is treated as mail-ready.

### Phase 5. Product validations

- Add guardrails for alias loops, inconsistent `MX` or `mailHost` values, missing runtime nodes, and nonsensical quotas.
- Detect domains that have lost deliverability prerequisites and raise clear warnings before dispatch.
- Prevent operators from creating states that the current mail execution model cannot safely apply.
- Extend the UI to explain validation failures in product language rather than low-level backend errors.

### Phase 6. Backup and restore

- Add explicit backup and restore coverage for `Maildir`, DKIM keys, mail runtime config, and webmail state where needed.
- Define recovery procedures for a single mailbox, a single domain, and the full mail stack.
- Add operator-visible restore readiness checks instead of assuming backups are enough.
- Validate at least one real restore path end-to-end, not just backup creation.

### Phase 7. End-to-end reliability

- Add automated tests for stable `mail.sync` behavior with no redispatch loops.
- Add regression coverage for long TXT records, segmented DNS TXT verification, and deliverability records.
- Add runtime checks for the intended mail ports, firewall alignment, and `Rspamd` milter wiring.
- Turn the full mail baseline into repeatable release checks so regressions are caught before publish.
