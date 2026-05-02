# VPS Hardening

Date applied: 2026-03-11
Last administrative access update: 2026-05-02
Host OS: AlmaLinux 10.1

## Scope

This runbook documents the hardening currently applied to the SimpleHost
primary and secondary VPS nodes:

- SSH access is key-only.
- `root` is still allowed over SSH, but passwords are disabled.
- `code-server` can be reached through the named HTTPS vhost
  `https://code.pyrosa.com.do/`; its backend remains local-only on
  `127.0.0.1:8080`.
- The SimpleHost control plane may also be proxied over Apache HTTPS on `:3200`.
- Host firewalling is active through `firewalld`.
- `rpcbind` has been disabled.
- Brute-force protection for `sshd` is active through `fail2ban`.
- Basic local observability is active through a systemd health-check timer.

## Status on 2026-03-14

- The `public.xml` source now matches the normalized live operator-facing posture.
- The current platform runtime exposes `http`, `https`, `51820/udp`, and
  operator port `3200/tcp` on both nodes.
- Private platform ports `3306/tcp`, `5432/tcp`, `5433/tcp`, and `8081/tcp` remain intended for localhost or WireGuard only.
- The passive secondary keeps the same public operator ingress shape as the primary for smoke tests and controlled failover.
- The `httpd` operator listener on `3200` stays pinned to the node public IPv4
  and uses a `network-online` dependency to avoid boot-time bind failures.

## Baseline observed before changes

### SSH

- SSH listened on port `22`.
- [`/etc/ssh/sshd_config`](/etc/ssh/sshd_config#L40) set `PermitRootLogin yes`.
- [`/etc/ssh/sshd_config.d/50-cloud-init.conf`](/etc/ssh/sshd_config.d/50-cloud-init.conf#L1) set `PasswordAuthentication yes`.
- [`/etc/ssh/sshd_config.d/50-redhat.conf`](/etc/ssh/sshd_config.d/50-redhat.conf#L10) set `X11Forwarding yes`.
- Default SSH behavior still allowed TCP forwarding and agent forwarding.
- `root` already had SSH keys configured in [`/root/.ssh/authorized_keys`](/root/.ssh/authorized_keys).

### Network and services

- No firewall service was installed or active.
- No brute-force protection service was installed or active.
- `rpcbind` was enabled, active, and exposed on `111/tcp` and `111/udp`.
- `code-server` listened only on `127.0.0.1:8080`.

## Applied configuration

### SSH

OpenSSH on AlmaLinux uses the first value read for duplicated directives. The
current cross-node enforcement therefore lives in an early `00-*` drop-in so it
wins over provider and cloud-init defaults that may still exist later in
`sshd_config.d`.

Source-controlled copies:

- [`/opt/simplehostman/src/platform/host/ssh/00-simplehost-admin-hardening.conf`](/opt/simplehostman/src/platform/host/ssh/00-simplehost-admin-hardening.conf)
- [`/opt/simplehostman/src/platform/host/ssh/50-cloud-init.conf`](/opt/simplehostman/src/platform/host/ssh/50-cloud-init.conf)
- [`/opt/simplehostman/src/platform/host/ssh/50-redhat.conf`](/opt/simplehostman/src/platform/host/ssh/50-redhat.conf)
- [`/opt/simplehostman/src/platform/host/ssh/99-hardening.conf`](/opt/simplehostman/src/platform/host/ssh/99-hardening.conf)

Deployed files:

- [`/etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf`](/etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf)
  on both nodes
- [`/etc/ssh/sshd_config.d/99-hardening.conf`](/etc/ssh/sshd_config.d/99-hardening.conf)
  on the primary only, for the root `code-server` local tunnel exception

Current first-read SSH hardening content:

[`/etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf`](/etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf):

```sshconfig
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
```

Primary-only root tunnel exception:

```sshconfig
Match User root
    AllowTcpForwarding local
    PermitOpen 127.0.0.1:8080 localhost:8080
```

The temporary primary drop-in
`/etc/ssh/sshd_config.d/01-vps-prd-root-password.conf` was removed during the
2026-05-02 administrative access hardening pass.

### Firewall

Source-controlled copy:

- [`/opt/simplehostman/src/platform/host/firewalld/zones/public.xml`](/opt/simplehostman/src/platform/host/firewalld/zones/public.xml)
- [`/opt/simplehostman/src/platform/host/systemd/httpd-network-online.conf`](/opt/simplehostman/src/platform/host/systemd/httpd-network-online.conf)

Deployed file:

- [`/etc/firewalld/zones/public.xml`](/etc/firewalld/zones/public.xml)
- [`/etc/systemd/system/httpd.service.d/10-network-online.conf`](/etc/systemd/system/httpd.service.d/10-network-online.conf)

Effective `firewalld` zone:

```xml
<?xml version="1.0" encoding="utf-8"?>
<zone>
  <short>Public</short>
  <description>Public operator-facing zone for Apache TLS ingress and WireGuard.</description>
  <interface name="eth0"/>
  <service name="ssh"/>
  <service name="http"/>
  <service name="https"/>
  <service name="dhcpv6-client"/>
  <port protocol="udp" port="51820"/>
  <port protocol="tcp" port="3200"/>
</zone>
```

Runtime state:

- `firewalld` is enabled and active.
- `eth0` is bound to the `public` zone.
- Allowed inbound services are `ssh`, `http`, `https`, and `dhcpv6-client`.
- Allowed inbound ports are `51820/udp` and `3200/tcp`.
- Zone forwarding is disabled.
- `httpd.service` now waits for `network-online.target` before trying to bind
  the public-IP listener on `3200`.

### rpcbind

`rpcbind` was stopped and disabled:

- `rpcbind.service`
- `rpcbind.socket`

Result:

- Port `111/tcp` is no longer listening.
- Port `111/udp` is no longer listening.

### Fail2ban

Source-controlled copy:

- [`/opt/simplehostman/src/platform/host/fail2ban/jail.d/sshd.local`](/opt/simplehostman/src/platform/host/fail2ban/jail.d/sshd.local)

Deployed file:

- [`/etc/fail2ban/jail.d/sshd.local`](/etc/fail2ban/jail.d/sshd.local)

Effective `fail2ban` jail:

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
banaction = firewallcmd-rich-rules
banaction_allports = firewallcmd-rich-rules

[sshd]
enabled = true
backend = systemd
mode = normal
port = ssh
```

Runtime state:

- `fail2ban` is enabled and active.
- One jail is active: `sshd`.
- `sshd` uses the journal backend.
- Ban actions are applied through `firewalld` using `firewallcmd-rich-rules`.

### Observability

Source-controlled copies:

- [`/opt/simplehostman/src/platform/host/observability/server-healthcheck.sh`](/opt/simplehostman/src/platform/host/observability/server-healthcheck.sh)
- [`/opt/simplehostman/src/platform/host/systemd/server-healthcheck.service`](/opt/simplehostman/src/platform/host/systemd/server-healthcheck.service)
- [`/opt/simplehostman/src/platform/host/systemd/server-healthcheck.timer`](/opt/simplehostman/src/platform/host/systemd/server-healthcheck.timer)

Deployed files:

- [`/usr/local/sbin/server-healthcheck`](/usr/local/sbin/server-healthcheck)
- [`/etc/systemd/system/server-healthcheck.service`](/etc/systemd/system/server-healthcheck.service)
- [`/etc/systemd/system/server-healthcheck.timer`](/etc/systemd/system/server-healthcheck.timer)

What the health check verifies:

- Critical services are active: `sshd`, `firewalld`, `fail2ban`, `code-server@root`,
  `postfix`, `dovecot`, `rspamd`, and `valkey`
- Disk usage for `/`, `/var`, `/home`, and `/tmp`
- Memory pressure from `MemAvailable`
- `fail2ban` `sshd` current failed and banned counts
- Local application TLS certificates under `/etc/letsencrypt/live`

Runtime state:

- `server-healthcheck.timer` is enabled and active.
- The timer runs 5 minutes after boot, then every 15 minutes.
- The check exits `0` when healthy, `1` on warning, and `2` on critical state.
- The systemd service treats exit `1` as successful so warning-only runs do not
  leave the unit failed.
- Warnings and critical states are written to the journal with tag `server-health`.
- A manual operator report is available without waiting for the timer.

## Effective security posture

- SSH passwords are disabled for all users.
- `root` can log in only with an SSH key.
- `root` can create only local SSH tunnels and only to `127.0.0.1:8080`.
- X11 forwarding is disabled.
- SSH TCP forwarding is disabled by default for all other users.
- SSH agent forwarding is disabled.
- Host-level inbound filtering is active.
- Public operator ingress is exposed through Apache on `443` and `3200`.
- `code-server` browser access is exposed through `https://code.pyrosa.com.do/`
  on `443`.
- `code-server` itself still remains local-only on `127.0.0.1:8080`.
- `rpcbind` is no longer exposed.
- Repeated SSH auth failures are rate-limited through `fail2ban`.
- A recurring local health check now watches the current service and resource baseline.

## Validation

### SSH

```bash
sshd -t
systemctl reload sshd
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|x11forwarding|allowtcpforwarding|allowagentforwarding|port) '
sshd -T -C user=root,host=localhost,addr=127.0.0.1 | grep -E '^(allowtcpforwarding|permitopen) '
ssh -i /root/.ssh/id_ed25519 -o BatchMode=yes almalinux@127.0.0.1 'sudo -n true'
ssh -o PreferredAuthentications=publickey -o PasswordAuthentication=no root@SERVER_IP
ssh -N -L 8080:127.0.0.1:8080 root@SERVER_IP
```

Expected effective values:

```text
port 22
permitrootlogin without-password
pubkeyauthentication yes
passwordauthentication no
kbdinteractiveauthentication no
x11forwarding no
allowtcpforwarding no
allowagentforwarding no
```

Expected primary root-specific values:

```text
allowtcpforwarding local
permitopen 127.0.0.1:8080 localhost:8080
```

### Firewall

```bash
systemctl is-active firewalld
firewall-cmd --get-active-zones
firewall-cmd --zone=public --list-all
ss -tulpn
```

Expected firewall state:

```text
public (default, active)
  interfaces: eth0
  services: dhcpv6-client http https ssh
  ports: 51820/udp 3200/tcp
  forward: no
```

### rpcbind

```bash
systemctl is-active rpcbind rpcbind.socket
systemctl is-enabled rpcbind rpcbind.socket
ss -tulpn | grep ':111\b'
```

Expected `rpcbind` state:

- Both units report `inactive`.
- Both units report `disabled`.
- No listener remains on port `111`.

### Fail2ban

```bash
systemctl is-active fail2ban
fail2ban-client status
fail2ban-client status sshd
fail2ban-client get sshd actions
fail2ban-client get sshd journalmatch
fail2ban-client get sshd bantime
fail2ban-client get sshd findtime
fail2ban-client get sshd maxretry
```

Expected `fail2ban` values:

```text
actions: firewallcmd-rich-rules
journalmatch: _SYSTEMD_UNIT=sshd.service + _COMM=sshd + _COMM=sshd-session
bantime: 3600
findtime: 600
maxretry: 5
```

### Observability

```bash
systemctl is-enabled server-healthcheck.timer
systemctl is-active server-healthcheck.timer
systemctl list-timers server-healthcheck.timer --no-pager
systemctl status server-healthcheck.service --no-pager
/usr/local/sbin/server-healthcheck --report
journalctl -t server-health -n 50 --no-pager
journalctl -p warning -S -24h -u sshd -u firewalld -u fail2ban -u code-server@root --no-pager
```

Expected observability state:

```text
server-healthcheck.timer: enabled, active
server-healthcheck.service: last run success when no critical issue is present
```

## Rollback

### SSH

Restore password access only from console access or an already authenticated
root key session, and only for a bounded break-glass window:

```bash
rm -f /etc/ssh/sshd_config.d/00-simplehost-admin-hardening.conf
printf '%s\n' \
  '# Temporary break-glass password access.' \
  'PermitRootLogin yes' \
  'PasswordAuthentication yes' \
  >/etc/ssh/sshd_config.d/01-vps-prd-root-password.conf
sshd -t
systemctl reload sshd
```

### Firewall

Disable `firewalld` and remove the custom zone override:

```bash
systemctl disable --now firewalld
rm -f /etc/firewalld/zones/public.xml
```

### rpcbind

Re-enable `rpcbind` only if a real RPC or NFS use case appears:

```bash
systemctl enable --now rpcbind.socket rpcbind.service
```

### Fail2ban

Disable `fail2ban` and remove the custom jail:

```bash
systemctl disable --now fail2ban
rm -f /etc/fail2ban/jail.d/sshd.local
```

### Observability

Disable the periodic health check and remove the deployed artifacts:

```bash
systemctl disable --now server-healthcheck.timer
rm -f /etc/systemd/system/server-healthcheck.service
rm -f /etc/systemd/system/server-healthcheck.timer
rm -f /usr/local/sbin/server-healthcheck
systemctl daemon-reload
```

## Historical Hardening Notes

The original hardening backlog is no longer tracked as a document-local open
list. Active security and resilience follow-up now lives in
[`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md).

Historical topics retained for context:

- routine administration through a non-root sudo user, with `root` kept for
  break-glass access only
- removing the temporary `code-server` SSH tunnel exception from `root`
- automating OS security updates on a defined cadence
- backup and restore validation for `code-server` data and server configuration
- SSH source-IP restriction if the administrator source range is stable enough
- optional cleanup of the mail-related `fail2ban` dependency chain

## Security Update Cadence

Implemented on `2026-05-02`.

Both nodes use `dnf-automatic` in conservative mode:

- package installed: `dnf-automatic`
- hold helper installed: `python3-dnf-plugin-versionlock`
- config source:
  [`platform/host/dnf/automatic.conf`](/opt/simplehostman/src/platform/host/dnf/automatic.conf)
- live config: `/etc/dnf/automatic.conf`
- update scope: `upgrade_type = security`
- downloads: `download_updates = yes`
- automatic installs: `apply_updates = no`
- automatic reboot: `reboot = never`
- timer: `dnf-automatic.timer`, daily at `06:00 UTC` with the package's
  built-in randomized delay

Manual validation on `2026-05-02` used:

```bash
/usr/bin/dnf-automatic /etc/dnf/automatic.conf --downloadupdates --no-installupdates
```

The validation downloaded the currently available security set but did not
install it.

Routine review commands:

```bash
dnf updateinfo list security --available
dnf check-update --security
systemctl list-timers dnf-automatic.timer
journalctl -u dnf-automatic.service -n 120 --no-pager
```

Manual apply procedure:

```bash
dnf upgrade --security
dnf history list
systemctl --failed --no-pager
```

Package hold procedure:

```bash
dnf versionlock add <package-or-nevra>
dnf versionlock list
dnf versionlock delete <package-or-nevra>
```

Rollback procedure for a package transaction:

```bash
dnf history list
dnf history info <transaction-id>
dnf history undo <transaction-id>
systemctl --failed --no-pager
```

Kernel rollback procedure:

```bash
grubby --default-kernel
grubby --info=ALL | grep -E '^(title|kernel)='
grubby --set-default /boot/vmlinuz-<previous-version>
reboot
```

Apply security updates in a maintenance window, one node at a time, with
primary services validated before moving to the secondary.

## code-server Administrative Posture

Reviewed on `2026-05-02`.

Current decision:

- keep `code-server@root` as a root-owned administrative tool
- keep the backend bound to `127.0.0.1:8080`
- expose browser access only through `https://code.pyrosa.com.do/`, protected
  by Authentik on the primary before Apache reaches the local backend
- keep node-name `:8080` public reverse proxies retired
- back up root `code-server` config, user data, profiles and extensions through
  SimpleHostMan backup policies:
  - `code-server-primary-daily`
  - `code-server-secondary-daily`

Implemented IAM hardening:

- `https://code.pyrosa.com.do/` is behind Authentik with username/password plus
  OTP/MFA before traffic reaches the local `code-server` backend
- the Authentik outpost reaches code-server through the internal Apache bridge
  on `10.88.0.1:18080`; that bridge is limited to the Podman subnet and proxies
  to `127.0.0.1:8080`
- use Authentik to own MFA, session cookies, lockout/rate limiting, and
  recovery codes
- keep code-server's own password enabled as a second layer unless an explicit
  operational reason exists to remove it
- use a break-glass path documented outside the browser flow before enforcing
  MFA
- keep SSH out of the Authentik scope; SSH remains governed by the hardened
  public-key policy in this document

IAM/SSO rollout plan:

- [`/opt/simplehostman/src/docs/IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

## Phase 5 Administrative Access Review

Reviewed on `2026-05-02` during the post-migration resilience pass.

Baseline before the administrative access change:

- `PermitRootLogin yes`
- `PasswordAuthentication yes`
- public-key authentication enabled
- `almalinux` existed as a non-root account with passwordless sudo through
  `/etc/sudoers.d/90-cloud-init-users`
- the primary had a temporary
  `/etc/ssh/sshd_config.d/01-vps-prd-root-password.conf` drop-in

Implemented outcome:

- `almalinux` is the tested routine administration path on both nodes.
- `almalinux` has operator and node-operation public keys installed on both
  nodes; the tracked fingerprints are:
  - `SHA256:8r2X/jTbPpmPmXFvXrAxvUH+6BNKL0pjOMbgPIFNPY8`
    (`vps-root-ed25519-2026`)
  - `SHA256:tpARyU16T3kbPoxFNI3VfXg3RvK5BMOxdVdlxMA7Qrg`
    (`root@vps-3dbbfb0b.vps.ovh.ca`)
  - `SHA256:O3ZhT25KzejEOyTewO6MbAcxhTcOPCmfseBnLOmOoUQ`
    (`root@vps-16535090.vps.ovh.ca`)
- `sshd` now reports `PermitRootLogin without-password` and
  `PasswordAuthentication no` on both nodes.
- Root remains available only by key as a break-glass account.
- The primary keeps the root-only local tunnel exception to
  `127.0.0.1:8080` for `code-server`; the secondary has SSH forwarding
  disabled for root and all other users.
- The temporary root-password drop-in was backed up and removed.
- Source-IP SSH restriction remains deferred because the operator ingress range
  is not documented as stable enough yet.

Validation completed after `sshd` reload:

- `ssh -i /root/.ssh/id_ed25519 almalinux@127.0.0.1 'sudo -n true'`
  succeeded on both nodes.
- Primary to secondary `almalinux` SSH with `sudo -n` succeeded.
- Root key break-glass succeeded from primary to secondary and from secondary
  to primary.
- Password-only SSH attempts failed with server methods limited to
  `publickey,gssapi-keyex,gssapi-with-mic`.

Remaining related follow-up:

- Continue the Authentik IAM/SSO rollout for additional administrative web
  surfaces following [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md),
  while keeping SSH unchanged.
