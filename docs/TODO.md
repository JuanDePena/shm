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

Phase 5 is now complete:

- `SimpleHost Control` now blocks alias loops, unsupported `mailHost` and `MX` combinations, incoherent standby topology, and nonsensical mailbox quotas before they are persisted.
- `SimpleHostMan` now derives per-domain pre-dispatch warnings when DNS, deliverability prerequisites, or runtime mail snapshots drift out of the expected posture.
- The current mail execution model is now guarded explicitly around zone-apex domains, stable `mail.<domain>` routing, and domain-level standby semantics.
- Mail editing flows now return operator-facing validation notices inside the dashboard instead of falling through to low-level backend errors.

Phase 6 is now complete:

- Backup runs can now report explicit mail artifact coverage for `Maildir`, DKIM keys, mail runtime config, and `Roundcube` state.
- `SimpleHostMan` now surfaces per-domain backup posture and restore readiness for mailbox, domain, and full mail-stack recoveries.
- The mail product now documents concrete recovery procedures instead of treating backup policy presence as sufficient evidence.
- Restore rehearsal evidence now travels end-to-end from backup run details into the operator UI so recovery readiness is visible, not implied.

Phase 7 is now complete:

- `mail.sync` dispatch stability now has automated regression coverage so unchanged mail plans do not redispatch in loops.
- Mail DNS generation and observability now cover long TXT values plus segmented TXT verification for deliverability records.
- `SimpleHost Agent` now reports intended public mail ports, firewall service port alignment, and `Rspamd` milter readiness as explicit runtime checks.
- Combined `preflight` and `release-candidate` workflows now run a repeatable mail baseline so regressions are caught before publish.
