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
