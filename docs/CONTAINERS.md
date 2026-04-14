# Podman Container Runbook

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target container runtime design for the two-node platform.

Primary runtime goals:

- Deploy web applications without introducing a cluster scheduler
- Keep application packaging consistent across both nodes
- Keep host-managed infrastructure outside containers where that simplifies operations
- Preserve explicit state paths for backup and recovery
- Support one isolated application container per customer or per application slug

Host-level services that remain outside Podman:

- PowerDNS Authoritative
- Apache reverse proxy
- `firewalld`
- WireGuard

Containerized services:

- Web applications
- Worker processes and schedulers
- MariaDB primary and replica services when a workload requires them
- selected edge services that need direct TCP or UDP exposure and do not fit behind Apache, such as a self-hosted RustDesk server

## Status on 2026-03-14

- `SHP` and `SHM` themselves are not containerized; they are installed as host-native Node.js release trees under `/opt/simplehostman/spanel` and `/opt/simplehostman/shm`.
- This runbook now mainly covers customer app workloads and optional MariaDB container services.
- Node-local service ownership for app workload containers, `wireguard`, `pdns`, `postgresql-apps`, and `mariadb` lives in `simplehost-manager`, not in the shared docs tree.
- `SHM` now has a real `container.reconcile` driver for Quadlet-managed services, which is the preferred path for bringing in additional containerized services such as RustDesk.

## Selected runtime model

Target platform:

- `Podman`
- `Quadlet`
- `systemd`

Operational rules:

- Do not use ad-hoc `podman run` commands for persistent services.
- Do not rely on `podman-compose` for the baseline platform.
- Keep service definitions under source control, then install the rendered units on each host.
- Use explicit per-service environment files for host-specific settings.

## Why Quadlet

- Native `systemd` lifecycle management
- Clean boot ordering
- Straightforward restart policy handling
- Easier inspection with standard host tooling
- No dependency on a separate orchestration control plane

## Host layout

Recommended paths:

- Quadlet units: `/etc/containers/systemd/`
- Environment files: `/etc/containers/systemd/env/`
- Persistent application data: `/srv/containers/<service>/`
- Logs through `journald`

Use bind mounts for persistent data instead of hiding important state inside anonymous volumes.

Recommended application layout:

- `/srv/containers/apps/<slug>/app`
- `/srv/containers/apps/<slug>/uploads`
- `/srv/containers/apps/<slug>/logs` only if the image cannot log cleanly to stdout

The multi-domain inventory and naming rules are documented in:

- [`/opt/simplehostman/src/docs/MULTI_DOMAIN.md`](/opt/simplehostman/src/docs/MULTI_DOMAIN.md)

Source-controlled container artifacts:

- [`/opt/simplehostman/src/platform/containers/quadlet/app-template.container`](/opt/simplehostman/src/platform/containers/quadlet/app-template.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/worker-template.container`](/opt/simplehostman/src/platform/containers/quadlet/worker-template.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/mariadb-primary.container`](/opt/simplehostman/src/platform/containers/quadlet/mariadb-primary.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/mariadb-replica.container`](/opt/simplehostman/src/platform/containers/quadlet/mariadb-replica.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container)
- [`/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml`](/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml)

## Network model

### Ingress

- Public traffic lands on host Apache.
- Apache forwards to application containers over loopback-published ports or local Podman bridge addresses.
- Non-HTTP edge services such as RustDesk are the exception: they publish their required TCP or UDP listeners directly and must be paired with an explicit host firewall policy.

Preferred default:

- Publish application ports only on `127.0.0.1`

### Databases

- MariaDB containers never publish on public interfaces.
- MariaDB ports bind only to the WireGuard address or remain local to the host, depending on service role.
- PostgreSQL is host-native and is documented in [`/opt/simplehostman/src/docs/DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md).

### Inter-container communication

- Keep each application stack isolated to the smallest practical network surface.
- Do not place unrelated applications on a single flat bridge unless there is a clear need.

## Security baseline

Each long-lived container should define:

- Explicit image tag and, ideally, digest pinning
- Read-only root filesystem where supported
- Dedicated writable bind mounts for only the data it needs
- Memory limits
- CPU limits
- PID limits
- Health checks
- Non-root execution where supported by the image
- No privileged mode
- No host networking unless the service explicitly requires it

Use SELinux-aware mounts on AlmaLinux so host labeling remains correct.

## Deployment model

### Web applications

- Deploy the same application release to both nodes.
- Keep the default public mode active/passive unless the app is stateless.
- Promote the secondary application node only after session state, uploads, and job ownership have been externalized.

### Workers

- Run scheduled jobs and queue workers on one node by default.
- Avoid duplicate execution by design, not by chance.
- Promote workers manually during failover unless the workload is provably safe for active/active execution.

### Databases

- MariaDB containers are not updated automatically.
- Apply updates in a planned sequence with backup verification before restart.

## Update policy

Safe update sequence for application containers:

1. Pull the new image explicitly.
2. Validate image digest and configuration changes.
3. Restart the secondary node first.
4. Validate application health on the secondary.
5. Restart the primary node.
6. Confirm Apache proxy health and application endpoint health on both nodes.

Database services require a separate maintenance workflow documented in [`/opt/simplehostman/src/docs/DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md).

## Backups

Back up at minimum:

- Quadlet unit files
- Environment files
- Application bind mounts
- Deployment scripts and release metadata

Do not treat container images in a registry as a substitute for configuration backup.

## Validation

Example validation commands:

```bash
podman ps
podman images
systemctl list-units --type=service | grep container-
podman inspect <container-name>
journalctl -u <quadlet-service-name> --since today
```

Expected state:

- Services are managed by `systemd`
- Persistent data is on host bind mounts
- No application container is listening on a public address unless explicitly intended

## Non-goals

- Kubernetes
- Swarm
- Automatic cross-node container scheduling
- Shared-write container storage across both nodes
