# VPS Hardening

Date applied: 2026-03-11
Host OS: AlmaLinux 10.1

## Scope

This runbook documents the hardening currently applied to this VPS:

- SSH access is key-only.
- `root` is still allowed over SSH, but passwords are disabled.
- `code-server` can be reached through a local SSH tunnel to `127.0.0.1:8080` and may also be proxied over Apache HTTPS on `:8080` when operator ingress is enabled.
- The SimpleHost control plane may also be proxied over Apache HTTPS on `:3200`.
- Host firewalling is active through `firewalld`.
- `rpcbind` has been disabled.
- Brute-force protection for `sshd` is active through `fail2ban`.
- Basic local observability is active through a systemd health-check timer.

## Status on 2026-03-14

- The `public.xml` source now matches the normalized live operator-facing posture.
- The current platform runtime exposes `http`, `https`, `51820/udp`, and operator ports `3200/tcp` and `8080/tcp` on both nodes.
- Private platform ports `3306/tcp`, `5432/tcp`, `5433/tcp`, and `8081/tcp` remain intended for localhost or WireGuard only.
- The passive secondary keeps the same public operator ingress shape as the primary for smoke tests and controlled failover.
- `httpd` operator listeners on `3200` and `8080` stay pinned to the node public IPv4 and use a `network-online` dependency to avoid boot-time bind failures.

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

OpenSSH on this host uses the first value read for duplicated directives. Because of that, the hardening required changes in earlier drop-ins as well as a dedicated hardening drop-in.

Source-controlled copies:

- [`/opt/simplehostman/src/platform/host/ssh/50-cloud-init.conf`](/opt/simplehostman/src/platform/host/ssh/50-cloud-init.conf)
- [`/opt/simplehostman/src/platform/host/ssh/50-redhat.conf`](/opt/simplehostman/src/platform/host/ssh/50-redhat.conf)
- [`/opt/simplehostman/src/platform/host/ssh/99-hardening.conf`](/opt/simplehostman/src/platform/host/ssh/99-hardening.conf)

Deployed files:

- [`/etc/ssh/sshd_config.d/50-cloud-init.conf`](/etc/ssh/sshd_config.d/50-cloud-init.conf)
- [`/etc/ssh/sshd_config.d/50-redhat.conf`](/etc/ssh/sshd_config.d/50-redhat.conf)
- [`/etc/ssh/sshd_config.d/99-hardening.conf`](/etc/ssh/sshd_config.d/99-hardening.conf)

Effective SSH content:

[`/etc/ssh/sshd_config.d/50-cloud-init.conf`](/etc/ssh/sshd_config.d/50-cloud-init.conf):

```sshconfig
PasswordAuthentication no
```

[`/etc/ssh/sshd_config.d/50-redhat.conf`](/etc/ssh/sshd_config.d/50-redhat.conf):

```sshconfig
SyslogFacility AUTHPRIV
ChallengeResponseAuthentication no
GSSAPIAuthentication yes
GSSAPICleanupCredentials no
UsePAM yes
X11Forwarding no
PrintMotd no
```

[`/etc/ssh/sshd_config.d/99-hardening.conf`](/etc/ssh/sshd_config.d/99-hardening.conf):

```sshconfig
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowTcpForwarding no
AllowAgentForwarding no

Match User root
    AllowTcpForwarding local
    PermitOpen 127.0.0.1:8080 localhost:8080
```

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
  <description>Public operator-facing zone for Apache TLS ingress, code-server proxy access, and WireGuard.</description>
  <interface name="eth0"/>
  <service name="ssh"/>
  <service name="http"/>
  <service name="https"/>
  <service name="dhcpv6-client"/>
  <port protocol="udp" port="51820"/>
  <port protocol="tcp" port="3200"/>
  <port protocol="tcp" port="8080"/>
</zone>
```

Runtime state:

- `firewalld` is enabled and active.
- `eth0` is bound to the `public` zone.
- Allowed inbound services are `ssh`, `http`, `https`, and `dhcpv6-client`.
- Allowed inbound ports are `51820/udp`, `3200/tcp`, and `8080/tcp`.
- Zone forwarding is disabled.
- `httpd.service` now waits for `network-online.target` before trying to bind the public-IP listeners on `3200` and `8080`.

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
- Public operator ingress is exposed through Apache on `443`, `3200`, and `8080`.
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

Expected root-specific values:

```text
allowtcpforwarding local
permitopen 127.0.0.1:8080
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
  ports: 51820/udp 3200/tcp 8080/tcp
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

Restore previous SSH behavior from console access:

```bash
cat >/etc/ssh/sshd_config.d/50-cloud-init.conf <<'EOF'
PasswordAuthentication yes
EOF

sed -i 's/^X11Forwarding no$/X11Forwarding yes/' /etc/ssh/sshd_config.d/50-redhat.conf
rm -f /etc/ssh/sshd_config.d/99-hardening.conf
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
