# Operational Views

SimpleHostMan operational views are intended to move routine node diagnostics out
of SSH sessions and into the control plane. They consume node runtime snapshots
reported by the agent and present them alongside existing inventory, jobs and
audit context.

## Dashboard render model

The dashboard shell renders shared chrome, sidebar badges, top-bar controls and
Overview metrics for every authenticated page. The heavier workspace HTML is
rendered only for the active view selected by the route.

This keeps the common Overview path from paying the server-side cost of building
inactive operational workspaces such as Logs, Services, Packages, Jobs or
Backups. It also prevents malformed data in an inactive workspace from blocking
unrelated navigation or login redirect flows.

The current bootstrap payload is still broad: it loads the runtime snapshots
needed for sidebar counts and cross-workspace navigation. Future per-view API
loading can reduce data transfer further, but the present contract is that only
the selected workspace renderer should execute for a dashboard request.

Agent job polling and runtime reporting are separate cadences. Nodes may poll
for work frequently, but full runtime snapshots refresh on
`SIMPLEHOST_AGENT_RUNTIME_SNAPSHOT_INTERVAL_MS`, which defaults to 60 seconds.
When a poll arrives without a runtime snapshot, the control plane preserves the
last reported snapshot instead of clearing operational view data.

The control plane also caches resource-drift summaries for 60 seconds. Overview
and the Drift workspace both depend on the same reconciliation projection, so
sharing that short-lived result avoids recalculating desired-state drift twice
during one dashboard bootstrap while keeping operator-facing counts fresh.

## Overview and Reconciliation

Overview is the lightweight landing workspace. It keeps platform status in a
dedicated Status panel with headline counts first and operational signals below,
then leaves execution controls to specialized workspaces.

The Reconciliation workspace lives under Control plane and owns the explicit
`Run reconciliation` action. This keeps the landing view focused on posture
while still keeping catalog comparison and missing-work dispatch one click away.

## Updates

The Updates view reports available RPM updates per managed node. The agent uses
`dnf check-update` and `dnf updateinfo list updates`, tolerating the normal DNF
`100` exit code used when updates are available, then enriches each package with
the currently installed RPM version when `rpm -qa` can provide it.

The control UI shows:

- cross-node package update inventory with current version, available version,
  repository and advisory metadata
- counters for nodes with pending updates and security-related advisories
- selected-update detail with quick navigation to the installed Packages view

This view is read-only in the first iteration. Applying updates should be added
as audited jobs with explicit node targeting, package scope and confirmation so
patch rollout does not bypass the existing dispatch history.

## Repositories

The Repositories view reports configured DNF/YUM repositories per managed node.
The agent collects `dnf repoinfo --all` when available, falling back to
`dnf repolist --all`, and records repository enablement, package counts, repo
files, URL sources and GPG policy.

The control UI shows:

- cross-node repository inventory with status, package count, repo file and GPG
  check state
- counters for enabled, disabled and package-GPG-disabled repositories
- selected-repository detail with source URLs, metadata revision and GPG keys

This view is read-only. Repository enablement, base URL changes and GPG policy
changes should be made through explicit audited jobs or desired node
configuration so package supply-chain changes stay traceable.

## Reboots

The Reboots view reports kernel and boot posture per managed node. The agent
collects `uname -r`, `/proc/sys/kernel/random/boot_id`, host uptime, the latest
installed kernel package from RPM metadata, and `needs-restarting -r` when that
tool is available.

The control UI shows:

- per-node reboot inventory with running kernel, latest installed kernel, boot
  timestamp and uptime
- counters for nodes that report a required reboot and nodes whose running
  kernel differs from the latest installed kernel
- selected-node details with boot ID and the first reboot-required reason

This view is read-only in the first iteration. Reboot actions should be queued
as audited maintenance jobs with explicit confirmation and HA awareness before
they become available from the dashboard.

## Config Validation

The Config Validation view reports syntax checks for critical node-local service
configuration. The agent runs bounded validation commands such as `sshd -t`,
`httpd -t`, `postfix check`, `doveconf -n`, `rspamadm configtest`,
`named-checkconf`, `pdnsutil check-all-zones`, and `php-fpm -t` when those
commands are present on the node.

The control UI shows:

- cross-node validation inventory with status, command and first summary line
- counters for failed checks and unavailable validation commands
- selected-check detail with command, node context and validation summary

Unavailable commands are reported separately from failures so optional services
do not look broken merely because their validation tool is absent. Repair
actions should continue through desired state or explicit audited jobs.

## Time

The Time view reports clock and NTP posture per managed node. The agent collects
`timedatectl show` fields for timezone, NTP enablement, synchronization and
local RTC state, then enriches the snapshot with `chronyc tracking` and
`chronyc sources -n` when chrony is available.

The control UI shows:

- per-node synchronization inventory with timezone, time service and source
  counts
- counters for unsynchronized nodes, active time services and local RTC usage
- selected-node details with chrony tracking summary and reported NTP sources

This view is read-only. Time service changes should be modeled as audited
configuration jobs before becoming dashboard actions, because clock drift can
affect TLS, mail, backups and job ordering.

## DNS Resolver

The DNS Resolver view reports node-local resolver configuration. The agent reads
`/etc/resolv.conf` for nameservers, search domains and resolver options, then
collects `resolvectl dns` and `resolvectl domain` when systemd-resolved tooling
is present.

The control UI shows:

- per-node resolver inventory with nameservers, search domains and resolved
  server reports
- counters for nodes with missing resolver configuration and active
  `systemd-resolved`
- selected-node detail for `/etc/resolv.conf` and resolved domains

This view is read-only. Resolver changes should remain in node configuration or
audited maintenance jobs so DNS changes stay explicit and reversible.

## Accounts

The Accounts view reports local account and sudo posture per managed node. The
agent reads `getent passwd`, checks account status with `passwd -S -a` when
available, collects common administrative groups (`wheel`, `sudo`, `admin`),
and validates sudoers syntax with `visudo -c` when present.

The control UI shows:

- cross-node account inventory with UID, GID, login shell and system-account
  classification
- counters for login-enabled accounts, UID 0 accounts and sudoers failures
- selected-account detail with home directory, password status, admin groups
  and sudoers validation summary

This view intentionally avoids password hashes or secret material. Account and
sudo changes should be implemented through explicit audited jobs before becoming
interactive dashboard actions.

## Services

The Services view reports critical `systemd` units per managed node. The agent
collects a bounded inventory with `systemctl show` for the platform-facing units
that operators commonly inspect during incidents, including SimpleHost services,
web ingress, container runtime, firewall, Fail2Ban, mail, databases and DNS.

The control UI shows:

- per-node service inventory with active and enabled state
- selected-node service cards with unit path, main PID, restart count and active
  timestamp
- quick navigation back to Node health for broader node context

This view is read-only by design in its first iteration. Restart/reload actions
should be added only when they can be queued as audited jobs with an explicit
target node and confirmation.

## Logs

The Logs view surfaces recent `journalctl` entries for the same critical
platform units tracked by Services. The agent collects a bounded sample per unit
from the last 24 hours and reports normalized timestamp, unit, priority and
message fields.

The control UI shows:

- a cross-node log table with client-side filtering
- priority counters for warnings and errors
- selected-node log cards for the most recent entries

The snapshot is intentionally bounded. It is meant for incident triage and
context switching reduction, not as a full log archive or SIEM replacement.

## TLS

The TLS view inventories certificates from `/etc/letsencrypt/live` on each node.
The agent uses `openssl x509` to report subject, issuer, serial, SHA-256
fingerprint, validity dates and SAN DNS names.

The control UI shows:

- cross-node certificate inventory with expiration posture
- DNS name coverage for each certificate
- selected-node certificate detail cards with issuer and fingerprint context

Renewal actions are intentionally outside the first read-only implementation.
They should be introduced as audited jobs after the renewal path is explicit for
the active certificate authority and web ingress layout.

## Storage

The Storage view reports filesystem capacity, inode pressure and a bounded set
of important platform paths. The agent uses `df` for mounted filesystems and
`du -x` for selected paths so the reported size stays on the same filesystem.

The control UI shows:

- cross-node filesystem inventory with byte and inode usage
- pressure counters for filesystems above the warning threshold
- selected-node cards for mounts and tracked paths such as `/root`, `/home`,
  `/etc`, `/opt`, `/srv`, `/var`, logs and backups

This view is for triage and capacity awareness. Destructive cleanup operations
should remain outside the UI until they can be modeled as audited, reversible
jobs with explicit path constraints.

## Mounts

The Mounts view reports mounted filesystems and persistent `/etc/fstab`
configuration per managed node. The agent collects `findmnt -P` output, reads
`/etc/fstab`, merges both sources by mountpoint, and filters pseudo-filesystems
unless they are explicitly declared in fstab.

The control UI shows:

- cross-node mount inventory with mountpoint, source, filesystem type, active
  state and fstab presence
- counters for active mounts, fstab-backed mounts and fstab entries that are not
  currently mounted
- selected-mount detail with live mount options and persisted fstab options

The view is read-only. Mount, unmount and fstab edit operations should be
implemented as audited jobs with strong confirmation because they can affect
running services and boot behavior.

## Kernel

The Kernel view reports kernel release and selected runtime parameters per
managed node. The agent collects `uname -r`, `uname -v`, `uname -m`, selected
`sysctl -n` values and a bounded `lsmod` module inventory.

The control UI shows:

- per-node kernel inventory with release, architecture and key sysctl posture
- counters for nodes reporting kernel data, IPv4 forwarding exposure and loaded
  modules
- selected-node detail with kernel build metadata, tracked sysctl values and
  loaded module usage

This view is read-only. Kernel parameter edits, module changes and bootloader
changes should be modeled as audited maintenance jobs with rollback notes before
they are exposed as actions.

## Network

The Network view reports node-local interface, route, and listener posture. The
agent uses `ip -j address`, `ip -j route`, `ip -6 -j route`, and `ss -lntup` to
collect a bounded snapshot without requiring an operator to open an SSH session.

The control UI shows:

- cross-node TCP and UDP listening sockets with protocol, bind address, port,
  state, and reported process context
- selected-node interface cards with addresses, state, MTU, and MAC address
- selected-node route cards with destination, gateway, device, protocol, and
  source address

This first iteration is read-only. Network changes should continue to flow
through desired-state resources, firewall baselines, or audited jobs rather than
ad hoc shell edits.

## Processes

The Processes view reports a bounded process and resource snapshot per managed
node. The agent combines `ps` output with host load average, uptime, total
memory, and `/proc/meminfo` available memory so operators can triage obvious
resource pressure without opening a terminal.

The control UI shows:

- cross-node top CPU processes with PID, user, CPU, memory, RSS, and command
- selected-node load averages, uptime, total memory, and available memory
- selected-node process cards for the highest CPU consumers

The process list is intentionally sampled and read-only. It is meant for
triage, not for killing processes or replacing deeper observability tooling.

## Containers

The Containers view reports the Podman container inventory per managed node. The
agent uses `podman ps --all --format json` to collect container identity, image,
state, status, published ports, networks, and lifecycle timestamps.

The control UI shows:

- cross-node container inventory with image, state, status, ports, and networks
- running and stopped container counters
- selected-node container cards with short ID, image, published ports, networks,
  created timestamp, and started timestamp

This view is read-only in the first pass. Container reconciliation, restart, and
image rollout should continue to go through desired-state resources and audited
jobs rather than direct process control from the UI.

## Timers

The Timers view reports `systemd` timer inventory per managed node. The agent
uses `systemctl list-timers --all --output=json` to collect timer names,
activated units, next trigger timing, last trigger timing, and relative timing
strings.

The control UI shows:

- cross-node timer inventory with activation target, next trigger, last trigger,
  and remaining time
- scheduled and activation-target counters
- selected-node timer cards for the reported timers

The view is read-only. Starting, stopping, or enabling timers should be modeled
as explicit audited jobs before becoming UI actions.

## SELinux

The SELinux view reports node-local SELinux posture. The agent uses `getenforce`
and `sestatus` to collect current mode, configured mode, loaded policy, policy
version, and SELinux status.

The control UI shows:

- per-node SELinux inventory with current mode, configured mode, policy name,
  policy version, and collection timestamp
- counters for reported nodes, enforcing nodes, and weak modes such as
  `permissive` or `disabled`
- selected-node posture details

The view is read-only. Mode changes and policy edits should stay outside the UI
until they are represented as explicit audited maintenance jobs.

## SSH

The SSH view reports node-local `sshd` access posture. The agent collects the
`sshd.service` active/enabled state, runs `sshd -T` to read the effective daemon
configuration, and counts non-comment entries in `/root/.ssh/authorized_keys`
when the file is present.

The control UI shows:

- per-node SSH inventory with service state, port, root login, password auth,
  root key count and collection timestamp
- counters for reported nodes, active daemons, password auth exposure and direct
  root login exposure
- selected-node details for public-key auth, forwarding controls and `PermitOpen`

The view is read-only. SSH configuration edits, key rotation and daemon reloads
should be modeled as explicit audited jobs before becoming UI actions.
