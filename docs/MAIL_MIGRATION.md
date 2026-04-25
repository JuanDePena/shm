# Mail Migration Runbook

Updated on `2026-04-25`.

This runbook describes the recommended low-risk migration flow for moving a customer domain from a
legacy cPanel-style mail host into the current `SimpleHostMan` mail runtime baseline.

Related references:

- [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md)

## Scope

Use this runbook when:

- the mail domain already exists on a legacy host
- the target runtime is the two-node `SimpleHostMan` platform
- mailbox contents must be copied into the new `Maildir`-based runtime

This runbook assumes:

- `Postfix`, `Dovecot`, `Roundcube`, DKIM material, and the node-local firewall policy are already
  managed by `mail.sync`
- `SimpleHost Control` is the source of truth for domains, mailboxes, aliases, quotas, and mailbox
  credential state
- `SimpleHostMan` can already report deliverability posture, primary-node runtime readiness, and
  dispatch-blocking mail warnings

## Pre-checks

Before touching DNS or copying mailboxes:

1. Create or confirm the mail domain in `SimpleHost Control`.
2. Create the target mailboxes and aliases in `SimpleHost Control`.
3. Set mailbox credentials if end users will validate before cutover.
4. Run reconciliation so `mail.sync` is dispatched to the active mail node.
5. Confirm in `SimpleHost Control` that the active node reports:
   - `Postfix` active
   - `Dovecot` active
   - `Roundcube` deployed
   - intended public mail ports listening
   - mail firewall policy configured
   - `Rspamd` milter ready
6. Confirm the derived DNS payload for:
   - `MX`
   - `mail.<domain>`
   - `mta-sts.<domain>`
   - `webmail.<domain>`
   - SPF
   - `TLS-RPT`
   - `_dmarc`
   - `_mta-sts`
   - DKIM selector TXT
7. Confirm DKIM material exists on the active node under `/srv/mail/dkim/<domain>/`.
8. Confirm the mail domain has no dispatch-blocking warnings in `SimpleHostMan`.

Do not start mailbox copy until those checks pass.

## Migration sequence

### 1. Freeze the target shape in `SimpleHost Control`

- Ensure the mail domain uses the intended primary and standby nodes.
- Ensure all destination mailboxes and aliases exist.
- Set or reset mailbox credentials intentionally.
- If a mailbox should start locked and be enabled later, leave it in `reset_required` state.

### 2. Stage DNS without cutting delivery yet

- Lower TTLs on legacy DNS if possible.
- Prepare the target records so cutover is a small delta:
  - `MX -> mail.<domain>`
  - `mail.<domain> -> active-node-ip`
  - `webmail.<domain> -> web proxy`

Do not repoint `MX` until mailbox copy and validation are complete.

### 3. Copy mailboxes from the legacy host

Recommended tool:

- `imapsync`

Run one mailbox at a time or in small batches. Example shape:

```bash
imapsync \
  --host1 legacy.example.com \
  --user1 webmaster@example.com \
  --password1 'legacy-password' \
  --host2 mail.example.com \
  --user2 webmaster@example.com \
  --password2 'new-password' \
  --ssl1 --ssl2 \
  --syncinternaldates
```

Guidance:

- prefer copying over `IMAPS`
- preserve internal dates
- repeat mailbox copies until delta runs are small
- keep the legacy source writable until the final pass

### 4. Validate before switching delivery

For each mailbox:

1. verify `IMAPS` login to the new host
2. confirm recent messages are visible
3. send a submission test through `587/tcp`
4. confirm the message leaves through the new node
5. confirm inbound delivery works locally for the target domain

Also validate:

- `Roundcube` login on `webmail.<domain>`
- DKIM TXT published in DNS
- SPF, `_dmarc`, `_smtp._tls`, and `_mta-sts` records present
- `mta-sts.<domain>/.well-known/mta-sts.txt` responds over HTTPS

### 5. Cut DNS and SMTP delivery

Cut the domain in this order:

1. point `mail.<domain>` at the active mail node
2. point `MX` at `mail.<domain>`
3. keep the legacy host reachable for a short overlap window
4. run one final `imapsync` pass for each mailbox

Avoid deleting the legacy mailbox host immediately. Keep it available until late-arriving messages
and client cache churn are no longer a concern.

### 6. Stabilization window

For the first post-cutover window:

- watch `SimpleHost Control` jobs and node runtime
- inspect `Postfix` and `Dovecot` logs on the active node
- confirm users can authenticate through both `IMAP` and `Roundcube`
- confirm mailbox quotas and aliases behave as expected

## Rollback

Rollback is still possible before the stabilization window closes.

If the new runtime fails validation:

1. repoint `MX` back to the legacy host
2. repoint `mail.<domain>` back to the legacy host if needed
3. keep the new node intact for debugging
4. copy any mail received during the short cutover window back to legacy if required

Do not destroy the new domain configuration in `SimpleHost Control` during rollback. Keep it as the
debuggable desired state until the issue is understood.

## Notes for the first pilot domains

- Start with low-volume domains first.
- Do not batch multiple domains into the same first cutover window.
- Treat the first domain as a full rehearsal for:
  - queue visibility
  - mailbox copy timing
  - DNS latency
  - user credential rotation
  - rollback muscle memory
- `adudoc.com` is now the first closed live reference and is documented in [`/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/adudoc-mail-migration.md).

## Current baseline status

The migration flow now sits on top of an already complete mail execution and reliability baseline:

- `mail.sync` and the node-local mail runtime are fully implemented
- `SimpleHostMan` exposes deliverability, runtime, HA, and backup/restore readiness before cutover
- combined `preflight` and `release-candidate` checks already include a repeatable mail baseline
