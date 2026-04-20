# SimpleHost TODO

Updated on `2026-04-20`.

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

The next mail work should happen as a deliberate 7-phase roadmap.

### Phase 1. Mailbox credentials UX

- Add first-class flows for generating, resetting, and rotating mailbox credentials.
- Show newly generated credentials only once and audit every reset or rotation.
- Make `reset_required` operationally clear in UI, API responses, and job history.
- Add guards so operators can distinguish “missing”, “reset required”, and “configured”.

### Phase 2. Mail observability

- Surface `Postfix` queue state, recent delivery failures, and defer reasons in `SimpleHostMan`.
- Expose per-domain deliverability state for `SPF`, `DKIM`, `DMARC`, `MTA-STS`, and `TLS-RPT`.
- Add node-level mail runtime health for `Postfix`, `Dovecot`, `Rspamd`, webmail, and policy documents.
- Improve operator tracing from mail resources into jobs, audit, and runtime snapshots.

### Phase 3. Anti-spam policy

- Make `Rspamd` thresholds and actions explicit instead of relying on opaque defaults.
- Add support for allowlists, denylists, and basic rate-limiting policy.
- Decide whether greylisting should be part of the default profile or an opt-in policy.
- Surface anti-spam policy state in the UI so operators can understand why mail was accepted, tagged, or rejected.

### Phase 4. Mail HA model

- Define what `primary` and `secondary` mean for mail as a product concept, not only as node labels.
- Specify which mail artifacts must exist on both nodes: `Maildir`, DKIM keys, policy documents, runtime config, and webmail assets.
- Document and implement the exact failover behavior for mail delivery, mailbox access, and DNS-facing artifacts.
- Add explicit health and promotion criteria before treating a secondary node as mail-ready.

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
