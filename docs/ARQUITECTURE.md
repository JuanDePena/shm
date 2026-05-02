# Two-Node Service Architecture

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target service architecture for the two OVH VPS nodes:

- Primary node: `vps-3dbbfb0b.vps.ovh.ca`
- Secondary node: `vps-16535090.vps.ovh.ca`

It defines the intended split of responsibilities for:

- Authoritative DNS with API, replacing legacy cPanel-hosted DNS
- Application delivery through Apache and Podman-managed web workloads
- PostgreSQL application primary and standby service
- PostgreSQL control-plane primary and standby service for `SimpleHost Control`
- Optional MariaDB primary and replica service for MySQL-compatible workloads
- Host firewalling, private inter-node transport, backups, and failover boundaries

Detailed service docs:

- [`/opt/simplehostman/src/docs/HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/CONTAINERS.md`](/opt/simplehostman/src/docs/CONTAINERS.md)
- [`/opt/simplehostman/src/docs/DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md)
- [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)
- [`/opt/simplehostman/src/docs/PROXY.md`](/opt/simplehostman/src/docs/PROXY.md)
- [`/opt/simplehostman/src/docs/IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- [`/opt/simplehostman/src/docs/MULTI_DOMAIN.md`](/opt/simplehostman/src/docs/MULTI_DOMAIN.md)
- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)

Product design references:

- [`/opt/simplehostman/src/README.md`](/opt/simplehostman/src/README.md)
- [`/opt/simplehostman/src/apps/control/README.md`](/opt/simplehostman/src/apps/control/README.md)
- [`/opt/simplehostman/src/apps/control/api/README.md`](/opt/simplehostman/src/apps/control/api/README.md)
- [`/opt/simplehostman/src/apps/control/web/README.md`](/opt/simplehostman/src/apps/control/web/README.md)
- [`/opt/simplehostman/src/apps/control/shared/README.md`](/opt/simplehostman/src/apps/control/shared/README.md)
- [`/opt/simplehostman/src/apps/control/src/README.md`](/opt/simplehostman/src/apps/control/src/README.md)
- [`/opt/simplehostman/src/apps/control/shared/README.md`](/opt/simplehostman/src/apps/control/shared/README.md)
- [`/opt/simplehostman/src/apps/agent/README.md`](/opt/simplehostman/src/apps/agent/README.md)
- [`/opt/simplehostman/src/platform/README.md`](/opt/simplehostman/src/platform/README.md)

## Status on 2026-03-14

- Public operator hostnames are `vps-prd.pyrosa.com.do` and `vps-des.pyrosa.com.do`.
- Current system hostnames still remain the legacy OVH names `vps-3dbbfb0b.vps.ovh.ca` and `vps-16535090.vps.ovh.ca`.
- `wg0` is live between the nodes on `10.89.0.1` and `10.89.0.2`.
- `postgresql-apps` and `postgresql-control` are already deployed as host-native primary/standby clusters.
- `SimpleHost Control` now runs as the combined `simplehost-control` runtime on the primary node; the secondary keeps `simplehost-control` and `simplehost-worker` stopped until promotion.
- `SimpleHost Agent` is active on both nodes and desired state already lives in `SimpleHost Control` PostgreSQL.
- PostgreSQL `control_plane_*` tables are the desired-state source of truth;
  generated exports remain available for audit and disaster recovery.
- Public operator ingress is normalized on both nodes through the `public` zone for `80/tcp`, `443/tcp`, `51820/udp`, and `3200/tcp`.
- The combined control plane now serves operator UI and `/v1/*` over `3200/tcp`.
- `code-server` is reached through `https://code.pyrosa.com.do/` on `443`;
  its backend remains local-only on `127.0.0.1:8080`.
- Authentik protects `code.pyrosa.com.do` on the primary before Apache reaches
  the local `code-server` backend. The Authentik outpost reaches code-server
  through the internal Apache bridge on `10.88.0.1:18080` because the outpost
  runs inside a container. SSH remains out of scope for IAM/SSO and keeps the
  hardening policy documented separately.

## Design goals

- Keep authoritative DNS self-hosted and API-driven without depending on cPanel.
- Keep DNS available from both public nodes.
- Run application workloads in Podman without introducing an orchestrator.
- Keep database traffic private over an inter-node tunnel only.
- Use simple, explicit failover instead of unsafe two-node automatic promotion.
- Preserve a clean split between host-level infrastructure and containerized workloads.
- Support multiple customer domains and applications from the same two-node platform.
- Protect administrative browser surfaces with a dedicated IAM/SSO layer
  without putting SSH or non-HTTP service transports behind that layer.

## Node roles

### Primary node

Host: `vps-3dbbfb0b.vps.ovh.ca`

Target responsibilities:

- PowerDNS Authoritative primary with LMDB backend
- Apache reverse proxy and TLS termination
- Podman application containers
- PostgreSQL applications primary
- PostgreSQL `SimpleHost Control` primary
- Optional MariaDB primary
- ACME automation endpoint
- Backup job runner
- WireGuard peer

### Secondary node

Host: `vps-16535090.vps.ovh.ca`

Target responsibilities:

- PowerDNS Authoritative secondary with LMDB backend
- Apache reverse proxy and TLS termination
- Podman application containers
- PostgreSQL applications physical standby
- PostgreSQL `SimpleHost Control` physical standby
- Optional MariaDB replica
- Backup job runner
- WireGuard peer

## Traffic planes

### Public plane

Current normalized public ingress to both nodes:

- `80/tcp`
- `443/tcp`
- `51820/udp`
- `3200/tcp` for `SimpleHost Control` web

Future DNS cutover, when activated publicly:

- `53/tcp`
- `53/udp`

Future mail cutover, when activated publicly on the active mail node:

- `25/tcp`
- `587/tcp`
- `993/tcp`

Mail webmail access should continue using the existing Apache public plane on:

- `443/tcp` for `webmail.<domain>`

Optional later:

- `465/tcp`
- `4190/tcp`

Administrative public exposure:

- `22/tcp`, restricted as tightly as possible by source IP and existing hardening policy

### Private inter-node plane

The two VPS nodes should maintain a dedicated WireGuard tunnel for all stateful service traffic.

Private traffic allowed only across the tunnel:

- PostgreSQL application replication and administrative traffic on `5432/tcp`
- PostgreSQL `SimpleHost Control` replication and administrative traffic on `5433/tcp`
- MariaDB replication and administrative traffic on `3306/tcp`
- Optional restricted DNS API access on `8081/tcp`
- Backup replication or restore traffic as needed

### Local application plane

Application containers remain local to each host:

- Apache proxies to application containers through loopback-published ports or local Podman networks
- Databases are never exposed on public interfaces
- DNS remains host-native and is not containerized

## Service placement principles

- DNS and host firewalling stay on the host OS.
- Apache runs on the host OS so certificate handling and boot ordering stay simple.
- Podman is used for application workloads and for MariaDB only when that engine is required.
- PostgreSQL runs host-native through packaged `systemd` units.
- Persistent service data lives on host-native paths for host services and on bind mounts for containerized services.
- No service depends on the secondary node being writable in order for the primary node to operate.

## Default availability model

### DNS

- Active on both nodes at all times
- Primary/secondary zone replication through `AXFR` or `IXFR` with `TSIG`
- Registrar delegation points to both nameservers

The multi-domain operating model is documented in [`/opt/simplehostman/src/docs/MULTI_DOMAIN.md`](/opt/simplehostman/src/docs/MULTI_DOMAIN.md).

### Web applications

- Deployed to both nodes
- Default public operating mode is active/passive
- Active/active is allowed only after application state is externalized

State that must be externalized before active/active:

- PHP session storage
- User-uploaded files
- Background job ownership or queue coordination

### PostgreSQL

Two separate PostgreSQL clusters are recommended:

- `postgresql-apps`: customer application databases on `5432/tcp`
- `postgresql-control`: the `SimpleHost Control` control-plane database on `5433/tcp`

For both clusters:

- Primary on the primary node
- Physical standby on the secondary node
- Manual failover only in the two-node design

This design intentionally avoids automatic two-node failover because it has no safe quorum.

### MariaDB

- Optional compatibility platform for workloads that require MySQL or MariaDB semantics
- Primary on the primary node
- Asynchronous replica on the secondary node
- Manual promotion only

MariaDB is not part of the DNS control plane in this design.

## Storage and backups

- Keep service data on explicit host paths such as `/var/lib/pgsql/<cluster>` for host-native PostgreSQL and `/srv/containers/<service>` for containerized services.
- Keep backup configuration separate from live data.
- Treat the secondary node as a standby service node, not as a backup substitute.
- Store off-host backups in external object storage or another failure domain.

Minimum backup scope:

- PowerDNS configuration, LMDB data, TSIG keys, and DNSSEC keys
- PostgreSQL physical backups plus WAL archive
- PostgreSQL `SimpleHost Control` physical backups plus WAL archive
- MariaDB physical backups plus logical schema exports when required
- Apache virtual host configuration and ACME material
- Container unit files, environment files, and bind-mounted application data

## Firewall implications

The current hardening baseline in [`/opt/simplehostman/src/docs/HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md) now exposes normalized operator-facing ingress:

- HTTP: `80/tcp`
- HTTPS: `443/tcp`
- WireGuard: `51820/udp`
- `SimpleHost Control` web: `3200/tcp`
- `code-server`: `https://code.pyrosa.com.do/` on `443`

If authoritative DNS is cut over to these nodes publicly, add:

- DNS: `53/tcp`
- DNS: `53/udp`

Database ports `5432`, `5433`, and `3306` remain private to WireGuard only and must not be published publicly.

Source-controlled network artifacts:

- [`/opt/simplehostman/src/platform/host/firewalld/zones/public.xml`](/opt/simplehostman/src/platform/host/firewalld/zones/public.xml)
- [`/opt/simplehostman/src/platform/host/firewalld/zones/wireguard.xml`](/opt/simplehostman/src/platform/host/firewalld/zones/wireguard.xml)
- [`/opt/simplehostman/src/platform/wireguard/wg0-primary.conf`](/opt/simplehostman/src/platform/wireguard/wg0-primary.conf)
- [`/opt/simplehostman/src/platform/wireguard/wg0-secondary.conf`](/opt/simplehostman/src/platform/wireguard/wg0-secondary.conf)

## Implementation order

Recommended rollout order:

1. Extend host hardening and firewall policy for the target public ports.
2. Establish WireGuard between both nodes.
3. Deploy PowerDNS primary and secondary.
4. Migrate authoritative zones from the legacy cPanel VPS.
5. Deploy Apache and ACME automation on both nodes.
6. Deploy Podman and baseline application container units.
7. Deploy PostgreSQL application primary and standby.
8. Deploy PostgreSQL `SimpleHost Control` primary and standby.
9. Deploy MariaDB only if a specific workload needs it.
10. Add backups, monitoring, and failover validation.

## Non-goals for phase 1

- Kubernetes or another cluster scheduler
- Automatic database failover with only two nodes
- Public recursive DNS
- Shared-write application storage across both nodes
- Using the same PostgreSQL cluster for both tenant application data and `SimpleHost Control` control-plane data
