# PowerDNS Authoritative Runbook

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target authoritative DNS design for:

- Primary node: `vps-3dbbfb0b.vps.ovh.ca`
- Secondary node: `vps-16535090.vps.ovh.ca`

The goal is to replace legacy DNS hosted on an older cPanel VPS with a PowerDNS Authoritative deployment that provides:

- Public authoritative service from both nodes
- API-driven zone management
- LMDB-backed local storage
- Signed zone transfers with `TSIG`
- DNSSEC-capable zone management
- multi-domain zone hosting for customer domains

## Status on 2026-03-14

- Public operator aliases for the nodes are `vps-prd.pyrosa.com.do` and `vps-des.pyrosa.com.do`; the underlying system hostnames remain the legacy OVH names.
- PowerDNS ownership and templates now live in [`/opt/simplehostman/src/platform/pdns`](/opt/simplehostman/src/platform/pdns).
- `dns.sync` is already dispatched from `SHP` and executed by `SHM` against the local PowerDNS API.
- Desired DNS state now lives in `SHP` PostgreSQL; `apps.yaml` is only the bootstrap/import-export path.

## Selected platform

Target DNS stack:

- `PowerDNS Authoritative`
- `LMDB` backend on both nodes
- Primary and secondary zone replication through `AXFR` or `IXFR`
- API enabled only where required for administrative automation

Why `LMDB` was selected:

- Good fit for a one-writer, two-node topology
- No separate SQL daemon is required
- Supports writable API workflows on the primary
- Supports DNSSEC and DNS Update in current PowerDNS releases
- Keeps the DNS control plane independent from application databases

Known `LMDB` tradeoffs accepted by this design:

- No record comments
- No `autosecondary`
- No shared multi-instance write model against the same LMDB files

If future requirements need richer metadata or external SQL reporting, the primary can later move to `gpgsql` while the secondary remains a standard transfer-based secondary.

## Node roles

### Primary node

Host: `vps-3dbbfb0b.vps.ovh.ca`

Responsibilities:

- Hosts all writable authoritative zones
- Exposes the PowerDNS API only on `127.0.0.1` by default
- Performs zone imports and edits
- Holds zone signing material for DNSSEC-enabled zones
- Sends `NOTIFY`
- Serves `AXFR` or `IXFR` to the secondary after `TSIG` authentication

### Secondary node

Host: `vps-16535090.vps.ovh.ca`

Responsibilities:

- Stores transferred copies of secondary zones
- Answers public authoritative queries
- Accepts zone transfers only from the primary
- Does not expose a public write API

## Exposure policy

Public inbound exposure on both nodes:

- `53/tcp`
- `53/udp`

Administrative exposure:

- PowerDNS API on `8081/tcp` bound to `127.0.0.1`
- Optional API access over WireGuard only if remote administration is needed

Hard rules:

- No recursive DNS service
- No public API listener
- No unauthenticated zone transfers
- No DNS management from application containers with full-zone credentials

## Configuration model

Recommended host paths:

- Main configuration: `/etc/pdns/pdns.conf`
- Drop-in configuration: `/etc/pdns/pdns.d/`
- LMDB data: `/var/lib/pdns/lmdb/`
- TSIG keys: `/etc/pdns/tsig/`
- DNSSEC keys: `/var/lib/pdns/keys/`

The primary and secondary keep local configuration and local storage. The secondary is populated only by transfers, not by file replication of the LMDB backend.

## Zone management workflow

### New zones

1. Create or import the zone on the primary.
2. Enable DNSSEC if the zone will be signed.
3. Configure the secondary as an authorized transfer target with `TSIG`.
4. Trigger `NOTIFY`.
5. Validate that both public nameservers answer the same `SOA` and `NS` data.
6. Update registrar delegation to both nameservers.

### Ongoing changes

1. Apply changes on the primary through the local API or local administrative tooling.
2. Rectify and sign as needed when DNSSEC is enabled.
3. Confirm the serial increment.
4. Confirm transfer completion on the secondary.
5. Validate public answers from both nodes.

### ACME support

Even though HTTP on `80/tcp` is allowed in the target architecture, DNS automation should still support `DNS-01` if needed later.

Preferred rule:

- Keep certificate automation credentials narrow and service-specific.

Avoid:

- Giving full-zone API credentials to each web application container

Preferred options:

- Use a dedicated ACME automation client on the host
- Use restricted RFC2136 or API credentials where possible
- Delegate challenge-only records later if tighter separation is needed

## Migration from the legacy cPanel DNS host

Recommended migration sequence:

1. Export the current zone data from the old cPanel VPS.
2. Normalize the zone files before import.
3. Lower TTLs to `300` at least 24 hours before the nameserver cutover.
4. Import zones into the new primary.
5. Confirm zone transfers to the new secondary.
6. Validate answers directly from both new nameservers.
7. Update registrar delegation to the two new authoritative nameservers.
8. Add DS records only after DNSSEC answers validate end-to-end.
9. Keep the old DNS host online until the cutover has fully propagated.

## Multi-domain policy

- Host one PowerDNS zone per customer apex domain.
- Keep zone ownership explicit in the inventory.
- Use separate records for canonical and alias hostnames.
- Keep redirect-only names visible in Apache configuration even if they share the same zone.

Current example inventory:

- [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml)

Source-controlled DNS artifacts:

- [`/opt/simplehostman/src/platform/pdns/primary/pdns.conf`](/opt/simplehostman/src/platform/pdns/primary/pdns.conf)
- [`/opt/simplehostman/src/platform/pdns/secondary/pdns.conf`](/opt/simplehostman/src/platform/pdns/secondary/pdns.conf)
- [`/opt/simplehostman/src/platform/pdns/tsig/zone-transfer.key.example`](/opt/simplehostman/src/platform/pdns/tsig/zone-transfer.key.example)

## Backup policy

Back up all DNS control-plane material from the primary:

- `/etc/pdns/`
- `/var/lib/pdns/lmdb/`
- `/var/lib/pdns/keys/`

Back up enough from the secondary to rebuild it quickly:

- `/etc/pdns/`
- local secondary metadata if used

The secondary is not a backup replacement because operator error on the primary can still replicate outward.

## Validation

Example checks after deployment:

```bash
ss -tulpn | grep ':53 '
ss -tulpn | grep ':8081 '
dig @vps-3dbbfb0b.vps.ovh.ca example.com SOA
dig @vps-16535090.vps.ovh.ca example.com SOA
dig @vps-3dbbfb0b.vps.ovh.ca example.com DNSKEY
dig @vps-16535090.vps.ovh.ca example.com DNSKEY
pdnsutil list-all-zones
```

Expected outcomes:

- Both nodes answer authoritative queries.
- The API is not listening on a public address.
- Secondary zone serials match the primary after changes.
- DNSSEC-enabled zones return `DNSKEY` and validate externally.

## Failure handling

- If the primary fails, the secondary continues answering DNS.
- Zone edits pause until the primary is restored or the secondary is promoted by operator action.
- A secondary promotion should be treated as a planned control-plane change, not an automatic event.
