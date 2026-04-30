# vps-old Domain Migration Sequence

Updated on `2026-04-30`.

This runbook tracks the sequential migration plan for the remaining domains currently discovered on
`root@vps-old.pyrosa.com.do`.

Target domains:

- `bitfay.org`
- `kynasoft.com`
- `ppdpr.us`
- `sipoel.com`
- `zcrmt.com`
- `tatokka.com`
- `solucionesmercantilnr.com` (out of active scope: expired, not renewing)
- `pyrosa.net` (out of active scope: expired, not renewing)

Related references:

- [`/opt/simplehostman/src/docs/MAIL_MIGRATION.md`](/opt/simplehostman/src/docs/MAIL_MIGRATION.md)
- [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-runtime-migration.md`](/opt/simplehostman/src/docs/MIGRATIONS/gomezrosado-runtime-migration.md)

## Execution model

Run phases sequentially. Do not begin a later phase for a domain until the previous phase has a
recorded outcome.

1. Discovery and inventory from `vps-old`.
2. SimpleHostMan staging.
3. Initial copy without public cutover.
4. Pre-cutover validation.
5. DNS and SMTP cutover.
6. Stabilization and closure.

The preferred cutover model is still one domain at a time for the first domain in this set, then
small batches only after the first closure is clean.

## Phase 0 discovery snapshot

Discovery was performed read-only on `2026-04-30` against `root@vps-old.pyrosa.com.do`.

Legacy host:

- hostname: `vps-1926167b.vps.ovh.ca`
- cPanel detected: yes
- legacy public IP observed in cPanel userdata and zones: `51.161.11.249`

| Domain | cPanel user | Web shape | Mailboxes | Mail size | Database inventory | Public DNS note |
| --- | --- | --- | ---: | --- | --- | --- |
| `bitfay.org` | `wmbitfay` | small static HTML | 4 | `664K` | none | public `A` and `MX` still point to legacy apex |
| `kynasoft.com` | `wmkynasoft` | empty docroot | 3 | `564K` | none | public `A` and `MX` still point to legacy apex |
| `ppdpr.us` | `wmppdpr` | small static HTML | 1 | `172K` | none | public `A` and `MX` still point to legacy apex |
| `sipoel.com` | `wmsipoel` | small static HTML | 1 | `23M` | none | public `A` and `MX` still point to legacy apex |
| `zcrmt.com` | `wmzcrmt` | WordPress | 2 | `45M` | MySQL `wmzcrmt_wp_main` | public web points to legacy; MX points to Zoho |
| `tatokka.com` | `wmtatokka` | small static HTML | 1 | `172K` | MySQL `wmtatokka_dev_2025a` | public `A` and `MX` still point to legacy apex |
| `solucionesmercantilnr.com` | `wmsolucionesmnr` | small static HTML | 5 | `27M` | none | expired; not renewing; migration retired |
| `pyrosa.net` | `wmpyrosanet` | small static HTML | 0 | `0` | none | expired; not renewing; migration retired |

## Legacy mailboxes

### bitfay.org

- `admin@bitfay.org`: `160K`, `1` message
- `info@bitfay.org`: `160K`, `1` message
- `support@bitfay.org`: `160K`, `1` message
- `webmaster@bitfay.org`: `184K`, `4` messages
- legacy catch-all: `*: wmbitfay`

### kynasoft.com

- `contact@kynasoft.com`: `352K`, `10` messages
- `j.depena@kynasoft.com`: `140K`, `3` messages
- `webmaster@kynasoft.com`: `72K`, `0` messages
- legacy catch-all: `*: wmkynasoft`

### ppdpr.us

- `it@ppdpr.us`: `172K`, `1` message
- legacy catch-all: `*: wmppdpr`

### sipoel.com

- `zoho@sipoel.com`: `23M`, `508` messages
- legacy catch-all: `*: wmsipoel`

### zcrmt.com

- `j.depena@zcrmt.com`: `22M`, `20` messages
- `n.herrera@zcrmt.com`: `23M`, `620` messages
- aliases:
  - `zoho@zcrmt.com -> j.depena@zcrmt.com,n.herrera@zcrmt.com`
  - catch-all `* -> j.depena@zcrmt.com`

### tatokka.com

- `webmaster@tatokka.com`: `172K`, `1` message
- legacy catch-all: `*: wmtatokka`

### solucionesmercantilnr.com

- `contabilidad@solucionesmercantilnr.com`: `228K`, `2` messages
- `info@solucionesmercantilnr.com`: `268K`, `7` messages
- `t.nunez@solucionesmercantilnr.com`: `3.8M`, `12` messages
- `y.nunez@solucionesmercantilnr.com`: `22M`, `63` messages
- `zoho@solucionesmercantilnr.com`: `840K`, `18` messages
- legacy catch-all: `*: wmsolucionesmnr`

### pyrosa.net

- no mailbox directories discovered
- legacy catch-all: `*: wmpyrosanet`

## Recommended order

### Wave 1: lowest-risk live pilot

Start with `ppdpr.us`.

Reason:

- only one mailbox
- tiny mailbox size
- no database
- small static site
- public DNS is currently live on the legacy host, so it exercises the real cutover path

Do not batch another domain into this first cutover window.

### Wave 2: simple low-volume domains

Run after `ppdpr.us` has stable inbound and outbound mail.

- `bitfay.org`
- `kynasoft.com`
- `tatokka.com`

Notes:

- `tatokka.com` has a MySQL database named `wmtatokka_dev_2025a`; confirm whether it is active before
  treating the site as static-only.
- Preserve or explicitly replace the legacy catch-all behavior before cutover.

### Wave 3: medium mail domain

- `sipoel.com`

Notes:

- `sipoel.com` has the largest non-WordPress mailbox count by volume in this set.

### Out of active scope

- `solucionesmercantilnr.com`
- `pyrosa.net`

Both domains are expired and will not be renewed, so they should not receive mail validation, final
Maildir delta, backup evidence, DNS cutover work, or web migration work.

### Wave 4: special-case domain

Handle `zcrmt.com` separately.

Reasons:

- WordPress site under `/home/wmzcrmt/public_html`
- MySQL database `wmzcrmt_wp_main`
- public mail exchange currently uses Zoho, not cPanel local delivery
- cPanel still contains local mailbox data and aliases that need an explicit keep/drop decision

Do not repoint `MX` away from Zoho unless that is an intentional product decision.

## Sequential gates

### Gate 0: discovery complete

Required before staging a domain:

- cPanel account identified
- document root and app type identified
- database inventory captured
- mailbox inventory captured
- aliases and catch-all behavior captured
- legacy zone captured
- registrar/public DNS posture understood

### Gate 1: SimpleHostMan staging ready

Required before first copy:

- DNS zone created or confirmed
- Mail Domain created or intentionally skipped
- mailboxes and aliases modeled
- catch-all decision recorded
- backup policy created when mail or app content is in scope
- reconciliation complete
- Mail view reports no blocking warning for the domain

### Gate 2: first copy complete

Required before validation:

- web files copied if in scope
- database dump/import completed if in scope
- Maildir or IMAP copy completed
- copied mailbox counts recorded
- target standby seeded or blocking reason recorded

### Gate 3: pre-cutover validation complete

Required before DNS changes:

- IMAPS login works for each mailbox
- SMTP submission works for each mailbox or selected representative accounts
- local inbound delivery works
- Roundcube login works when webmail is in scope
- DKIM, SPF, DMARC, MTA-STS, and TLS-RPT posture is ready
- backup evidence exists or a backup exception is explicitly accepted

### Gate 4: cutover complete

Required before stabilization:

- `mail.<domain>` points to the new active node when mail is hosted by SimpleHostMan
- `MX` points to `mail.<domain>` when mail is hosted by SimpleHostMan
- web `A` and `www` records point to the target proxy when web is migrated
- final mailbox delta copy completed
- old host retained for the overlap window

### Gate 5: closure complete

Required before decommissioning legacy state:

- no new inbound mail is landing on `vps-old`
- users confirm login
- queues and recent failures are clean
- backup run evidence is present
- migration closure document is updated per domain

## Execution log

### 2026-04-30: ppdpr.us phase 1 staging

The legacy catch-all `*: wmppdpr` is intentionally not preserved.

Replacement aliases:

- `postmaster@ppdpr.us -> it@ppdpr.us`
- `abuse@ppdpr.us -> it@ppdpr.us`
- `webmaster@ppdpr.us -> it@ppdpr.us`

Applied in `SimpleHostMan`:

- tenant `ppdpr`
- zone `ppdpr.us`
- mail domain `ppdpr.us`
- mailbox `it@ppdpr.us` with `5 GiB` quota and `reset_required` credentials
- backup policy `mail-ppdpr-daily`

Reconciliation generated `dns.sync`, `mail.sync`, and mail policy proxy render jobs for both nodes.
The first secondary `dns.sync` attempt failed while verifying the initial transferred zone, then a
targeted `ppdpr.us` zone sync completed successfully on both primary and secondary.

Verified after the retry:

- `mail.sync` applied on `primary`
- `mail.sync` applied on `secondary`
- `zone:ppdpr.us` synchronized on `primary`
- `zone:ppdpr.us` synchronized on `secondary`
- `webmail.ppdpr.us` and `mta-sts.ppdpr.us` Apache vhosts installed on both nodes
- Maildir, DKIM, Roundcube, and MTA-STS artifacts exist on both nodes

### 2026-04-30: temporary credentials generated

Temporary migration credentials were generated from SimpleHostMan for all discovered legacy
mailboxes in the target domain set.

Credential inventory:

- `bitfay.org`: `4` mailbox credential(s)
- `kynasoft.com`: `3` mailbox credential(s)
- `ppdpr.us`: `1` mailbox credential
- `sipoel.com`: `1` mailbox credential
- `zcrmt.com`: `2` mailbox credential(s)
- `tatokka.com`: `1` mailbox credential
- `solucionesmercantilnr.com`: `5` mailbox credential(s), now retired because the domain is expired
- `pyrosa.net`: none generated because no legacy mailbox directories were discovered; domain retired

The credentials were captured in:

- [`/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md`](/opt/simplehostman/src/docs/MIGRATIONS/vps-old-temporary-mail-credentials.md)

That file is intentionally local and sensitive. Do not publish it without an explicit decision.

To generate the credentials, the mail-plane desired state was staged for all domains with discovered
mailboxes. Reconciliation then rendered `dns.sync`, `mail.sync`, `webmail`, and `mta-sts` jobs for
the new mail domains. The main reconciliation completed with one transient secondary `dns.sync`
verification failure for `sipoel.com`; a targeted retry completed successfully on both nodes.

After reconciliation, SimpleHostMan reported:

- all `17` discovered target mailboxes as `configured`
- `0` reset-required mailboxes across these newly staged domains
- `pyrosa.net` with no mailbox state because no legacy mailbox was discovered

The `solucionesmercantilnr.com` credentials are no longer active migration credentials after the
domain was removed from scope.

### 2026-04-30: registrar NS cutover mitigation

After the registrar-side nameserver update in ResellerClub, public resolvers were checked against
`1.1.1.1`.

Observed with new SimpleHostMan nameservers:

- `bitfay.org`
- `kynasoft.com`
- `ppdpr.us`
- `sipoel.com`
- `zcrmt.com`
- `tatokka.com`

Still without public answers at the time of validation:

- `solucionesmercantilnr.com`
- `pyrosa.net`

Because the NS change can make the new SimpleHostMan zones authoritative before web migration is
closed, explicit `@` and `www` records were added to preserve legacy web traffic:

- `@ A 51.161.11.249`
- `www A 51.161.11.249`

For `pyrosa.net`, a minimal preservation zone was created because the target nameservers had no zone
for it yet and no legacy mailbox directories had been discovered.

DNS reconciliation after this mitigation generated `22` jobs and all applied successfully.

Important mail note:

- `zcrmt.com` discovery showed public `MX` on Zoho before the NS move.
- Do not treat `zcrmt.com` as a SimpleHostMan-hosted mail domain unless that becomes an explicit
  product decision.

### 2026-04-30: zcrmt.com restored to vps-old mail posture

After the registrar nameserver cutover, `zcrmt.com` briefly had SimpleHostMan mail records staged in
the target zone. The operator decision is to leave `zcrmt.com` as it was on `vps-old` for now because
mail is publicly hosted by Zoho and the WordPress/MySQL runtime is not migrated.

Desired-state changes applied:

- removed `zcrmt.com` from SimpleHostMan mail domains
- removed `j.depena@zcrmt.com` and `n.herrera@zcrmt.com` from SimpleHostMan mailbox state
- removed the `zcrmt.com` mail aliases, quotas, and `mail-zcrmt-daily` backup policy
- kept the `zcrmt.com` DNS zone so the new nameservers can preserve the legacy posture

Authoritative `zcrmt.com` DNS now mirrors the legacy mail posture:

- `@ A 51.161.11.249`
- `www CNAME zcrmt.com.`
- `mail CNAME zcrmt.com.`
- `webmail A 51.161.11.249`
- `MX 10 mx.zoho.com.`
- `MX 20 mx2.zoho.com.`
- `MX 50 mx3.zoho.com.`
- Zoho verification TXT
- Zoho SPF TXT
- `zmail._domainkey` Zoho DKIM TXT

Cleanup and verification:

- removed stale SimpleHostMan-derived mail DNS artifacts from both nodes
- `zone:zcrmt.com` latest targeted sync applied on `primary` and `secondary`
- `zcrmt.com` no longer appears in SimpleHostMan Mail overview
- Cloudflare resolver validation returned Zoho `MX`, legacy `A`, and legacy `mail`/`www` CNAMEs

The two temporary `zcrmt.com` credentials generated earlier are retired because those mailboxes are
no longer active in SimpleHostMan desired state.

The previously copied `zcrmt.com` Maildir content remains staged on disk as a non-destructive copy,
but it is not part of active SimpleHostMan mail delivery.

### 2026-04-30: expired domains removed from migration scope

`solucionesmercantilnr.com` and `pyrosa.net` were confirmed expired and not planned for renewal.
They are excluded from the active migration sequence.

Operational decision:

- do not validate mail for either domain
- do not run final Maildir deltas for either domain
- do not collect backup evidence for either domain
- do not migrate web/DNS runtime for either domain
- retire any temporary credentials generated for `solucionesmercantilnr.com`

The earlier non-destructive Maildir copy for `solucionesmercantilnr.com` can remain on disk as
staged historical material, but it is not part of active mail delivery.

### 2026-04-30: bulk Maildir copy

To avoid split-mail risk after the registrar NS change, legacy Maildir content was copied
non-destructively from `vps-old` into SimpleHostMan for every discovered mailbox.

Copy mode:

- `rsync --ignore-existing`
- no `--delete`
- ownership normalized to `vmail:vmail`
- replicated from primary to secondary without deleting target files

Copied mailbox counts:

- `bitfay.org`: `7` messages across `4` mailboxes
- `kynasoft.com`: `13` messages across `3` mailboxes
- `ppdpr.us`: `1` message across `1` mailbox
- `sipoel.com`: `508` messages across `1` mailbox
- `zcrmt.com`: `643` messages across `2` mailboxes
- `tatokka.com`: `1` message across `1` mailbox
- `solucionesmercantilnr.com`: `102` messages across `5` mailboxes

All copied mailbox trees were also replicated to the secondary node.

## Immediate next action

Proceed with `ppdpr.us` phase 3:

- set or generate a temporary credential for `it@ppdpr.us`
- validate IMAPS, SMTP submission, Roundcube, and local inbound delivery
- run or verify a backup for `mail-ppdpr-daily`
