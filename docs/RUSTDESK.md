# RustDesk Deployment Notes

Date drafted: 2026-04-10

## Scope

This document captures the recommended way to run a self-hosted RustDesk OSS server on the SimpleHost platform.

The intended fit is:

- `SHM` owns the node-local execution through `container.reconcile`
- RustDesk runs as two Quadlet-managed containers: `hbbs` and `hbbr`
- the service starts on the primary node first
- the secondary can receive the same artifacts later for controlled failover

## Status on 2026-04-10

Upstream RustDesk documentation currently recommends running `hbbs` and `hbbr` in containers and opening these ports for the OSS server:

- `21115/tcp`
- `21116/tcp`
- `21116/udp`
- `21117/tcp`

Optional upstream ports:

- `21118/tcp` for web client support
- `21119/tcp` for web client support
- `21114/tcp` for the Pro web console

The SimpleHost baseline does not open those ports by default. Use the optional firewalld service artifact in:

- [`/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml`](/opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml)

Verified upstream references on 2026-04-10:

- https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/docker/
- https://rustdesk.com/docs/en/self-host/client-configuration/

The pinned image tag in the example Quadlet units is `docker.io/rustdesk/rustdesk-server:1.1.14`, chosen to avoid drifting `latest` tags in product-owned artifacts.

## Recommended host layout

- shared data: `/srv/containers/rustdesk/data`
- Quadlet units: `/etc/containers/systemd/rustdesk-hbbs.container` and `/etc/containers/systemd/rustdesk-hbbr.container`
- optional env files: `/etc/containers/systemd/env/*.env`

RustDesk stores the public key in the shared data directory after the first `hbbs` start:

- `/srv/containers/rustdesk/data/id_ed25519.pub`

That key is what clients need for encrypted self-hosted connections.

## Recommended deployment model

Use host networking for both containers.

Why:

- it matches the upstream guidance for Linux
- it avoids extra port-mapping complexity
- it keeps the real client IP visible to RustDesk

Keep the first rollout active on the primary node only. The secondary should stay passive until:

- DNS and routing for the chosen RustDesk hostname are settled
- the same shared key material is available on the secondary
- a failover playbook is documented and tested

## Example `container.reconcile` payloads

`hbbs`:

```json
{
  "serviceName": "rustdesk-hbbs",
  "containerName": "rustdesk-hbbs",
  "image": "docker.io/rustdesk/rustdesk-server:1.1.14",
  "description": "RustDesk ID and rendezvous service",
  "exec": "hbbs",
  "network": "host",
  "hostDirectories": [
    "/srv/containers/rustdesk/data"
  ],
  "volumes": [
    "/srv/containers/rustdesk/data:/root:Z"
  ],
  "enable": true,
  "start": true
}
```

`hbbr`:

```json
{
  "serviceName": "rustdesk-hbbr",
  "containerName": "rustdesk-hbbr",
  "image": "docker.io/rustdesk/rustdesk-server:1.1.14",
  "description": "RustDesk relay service",
  "exec": "hbbr",
  "network": "host",
  "hostDirectories": [
    "/srv/containers/rustdesk/data"
  ],
  "volumes": [
    "/srv/containers/rustdesk/data:/root:Z"
  ],
  "enable": true,
  "start": true
}
```

Matching source-controlled Quadlet examples live in:

- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbs.container)
- [`/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container`](/opt/simplehostman/src/platform/containers/quadlet/rustdesk-hbbr.container)

## Firewall activation

Install the optional service definition and attach it to the `public` zone only on nodes that should expose RustDesk publicly.

Example:

```bash
install -D -m 0644 \
  /opt/simplehostman/src/platform/host/firewalld/services/rustdesk-oss.xml \
  /etc/firewalld/services/rustdesk-oss.xml
firewall-cmd --permanent --zone=public --add-service=rustdesk-oss
firewall-cmd --reload
```

If web client support is needed later, add `21118/tcp` and `21119/tcp` deliberately instead of widening the default service upfront.

## Client configuration

For OSS clients, set:

- `ID Server`: the RustDesk hostname or IP, normally the `hbbs` endpoint
- `Key`: the contents of `id_ed25519.pub`
- `Relay Server`: optional when it matches the same host, but it can be set explicitly to the `hbbr` host

## Operational notes

- Treat RustDesk as an edge service, not as an Apache-proxied web app.
- Keep the public hostname explicit, for example `rustdesk.<domain>`.
- Back up `/srv/containers/rustdesk/data` because it contains the server key material clients trust.
- Do not open RustDesk ports on every node by default; expose them only where the service is intended to run.
