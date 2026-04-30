# Agent App

`apps/agent` is the canonical source location for the node-local execution agent.

Current root:

- `/opt/simplehostman/src/apps/agent`

Responsibilities:

- claiming jobs from the control plane
- rendering local artifacts
- applying node-local changes
- reporting execution status and health back to the control plane

Runtime reporting is intentionally decoupled from job polling. The agent keeps
claiming jobs every `SIMPLEHOST_HEARTBEAT_MS` milliseconds, while the full node
runtime snapshot is refreshed every
`SIMPLEHOST_AGENT_RUNTIME_SNAPSHOT_INTERVAL_MS` milliseconds by defaulting to 60
seconds. This keeps operational views fresh without running expensive inventory
commands such as package, repository, firewall, container and log probes on every
poll.

This app is intentionally separate from `apps/control` and remains node-local.
