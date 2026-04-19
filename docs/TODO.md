# SimpleHost TODO

Updated from the workspace guide and platform runbooks on `2026-03-15`.

This file tracks work that is still open after the current documentation sync.
Closed work should stay in the docs as implemented state, not linger here.

## 1. Plan the PostgreSQL upgrade path

- The deployed PostgreSQL runtime is currently `16.13`.
- The documented target policy is PostgreSQL `18.x`.
- Plan and document the safe upgrade path for both `postgresql-apps` and `postgresql-control`.

## 2. Finish real per-action diffs in `SHP`

- Move from comparison summaries to field-accurate diffs before `dns.sync`, `proxy.render`, `database reconcile`, and destructive operations.
- Keep those previews tied to the actual last applied or effective runtime state, not only to desired state.

## 3. Deepen diagnostics, jobs, audit, and backups

- Keep improving cross-links between resources, jobs, drift, audit, nodes, and backup runs.
- Make backup policies and failures more operational from the UI, not only visible.
- Keep pushing resource detail views toward one-place operational diagnosis.

## 4. Keep shrinking transitional bootstrap state

- Continue reducing the daily operational role of YAML bootstrap/import paths.
- The bootstrap inventory now lives in [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml).
- Keep reducing its day-to-day operational role in favor of PostgreSQL desired state plus controlled import/export.

## 5. Implement the mail execution backend from the documented design

- The target mail architecture is now documented in [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md).
- `SHP` desired-state objects, operator CRUD, `mail.sync` dispatching, baseline DNS derivation, and `webmail.<domain>` proxy scaffolding are now in place.
- `SHM` now renders node-local `Postfix`, `Dovecot`, and `Rspamd` artifacts, prepares mailbox and webmail roots, generates DKIM material, and `adudoc.com` is seeded as the first pilot mail domain.
- Remaining work is now operational productization: install and enable `Postfix`, `Dovecot`, `Rspamd`, and `Redis` through the platform, replace the `Roundcube` placeholder with a real deployment, add firewall policy, credential reset and set flows, mailbox migration runbooks, deliverability diagnostics, and deeper operator-facing tracing.
