# Operational Views

SimpleHostMan operational views are intended to move routine node diagnostics out
of SSH sessions and into the control plane. They consume node runtime snapshots
reported by the agent and present them alongside existing inventory, jobs and
audit context.

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
- selected-node cards for mounts and tracked paths such as logs, backups and the
  active release root

This view is for triage and capacity awareness. Destructive cleanup operations
should remain outside the UI until they can be modeled as audited, reversible
jobs with explicit path constraints.

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
