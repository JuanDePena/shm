# simplehost-manager

`simplehost-manager` is the repository for `SHM` (`SimpleHostManager`), the node-local agent for the SimpleHost platform.

`SHM` is not a public control plane. It is the execution side of the system and should stay local to each managed node.

## Core role

`SHM` is responsible for:

- receiving and validating jobs from `SHP`
- rendering local configuration
- applying changes to local services
- persisting minimal node-local operational state in `JSON`
- reloading or restarting local services safely
- reporting status, health, and job results back to `SHP`

`SHM` is not a second source of truth. It executes desired state defined by `SHP`.

## Bootstrap

This repository is bootstrapped as a `pnpm` workspace with a shared TypeScript base config.

Useful commands:

- `./scripts/install-system-deps-almalinux.sh`
- `./scripts/bootstrap.sh`
- `./scripts/bootstrap-apps-standby.sh`
- `./scripts/bootstrap-workspace-repos.sh`
- `pnpm build`
- `pnpm typecheck`
- `pnpm start:agent`
- `pnpm start:cli`
- `node apps/cli/dist/index.js register`
- `node apps/cli/dist/index.js claim`

## Communication model

Recommended control channel:

- `SHM` connects outbound to `SHP` over WireGuard plus TLS
- `SHM` authenticates with a node certificate
- `SHP` issues signed jobs
- `SHM` polls or maintains a control stream to fetch pending jobs

Keep `SHM` non-public.

## Execution model

Recommended lifecycle:

1. `SHP` computes a node-relevant operation.
2. `SHP` sends a signed job to the target `SHM`.
3. `SHM` validates the job against an allowlist.
4. `SHM` renders and validates local changes.
5. `SHM` applies the change, checkpoints local execution state when needed, and reports the result back to `SHP`.

Supported operation types should remain explicit and driver-based. Do not design around arbitrary shell execution from the UI or API.

Current bootstrap implementation:

1. the agent writes node identity and local execution state under `/var/lib/shm`
2. the agent registers itself with `SHP`
3. the agent flushes buffered reports from previous runs
4. the agent claims allowlisted jobs from `SHP`
5. the agent executes them locally and reports the results back

## Local persistence

Recommended persistence model for `SHM`:

- no local database
- human-authored configuration in `YAML`
- machine-authored agent state in `JSON`

Directory split:

- `/etc/shm/config.yaml`: operator-managed agent configuration
- `/var/lib/shm/`: machine-written persistent agent state
- `/var/log/shm/`: agent logs

Recommended persisted JSON files:

- `/var/lib/shm/node-identity.json`
- `/var/lib/shm/last-applied-state.json`
- `/var/lib/shm/job-spool/<job-id>.json`
- `/var/lib/shm/report-buffer/<job-id>.json`

Current bootstrap file semantics:

- `job-spool/<job-id>.json`: claimed or executed local work unit
- `report-buffer/<job-id>.json`: completed result waiting to be delivered to `SHP`
- `last-applied-state.json`: last desired-state revision seen by the agent

Allowed local persisted state:

- node identity and enrollment metadata
- last applied desired-state revision or hashes
- local job execution checkpoints
- retry and backoff metadata
- buffered execution reports waiting to be delivered to `SHP`

Do not persist locally as authoritative data:

- tenants, users, memberships, or permissions
- global desired state for the platform
- the authoritative job queue
- cross-node coordination state
- long-term audit history

File rules:

- use `JSON` for machine-written files under `/var/lib/shm`
- keep files small and scoped per object when practical
- include a schema version in persisted documents
- write atomically through a temporary file plus rename
- treat local JSON state as recoverable cache or execution state, not product truth

## Safety rules

- no arbitrary shell command execution from the API
- render to a staging path first
- validate service configuration before replacing live files
- persist only minimal recoverable `JSON` state under `/var/lib/shm`
- reload only after validation succeeds
- keep job output and failure details in the central audit system

## Service adapters

Recommended internal drivers:

- `dns-driver`
- `proxy-driver`
- `cert-driver`
- `container-driver`
- `postgres-driver`
- `mariadb-driver`
- `backup-driver`
- `mail-driver`

Driver expectations:

- `dns-driver`: primary edits on the primary node only; secondary remains transfer-based
- `proxy-driver`: render Apache vhost configuration and validate with `httpd -t`
- `cert-driver`: keep certificate management host-native
- `container-driver`: render Quadlet units and environment files, then reload only the targeted service
- `postgres-driver`: create databases and roles, rotate passwords, report health
- `mariadb-driver`: create databases and users, rotate passwords, report health
- `backup-driver`: trigger controlled backup workflows and collect status
- `mail-driver`: reserved for a later mail backend or external provider adapter

## Runtime layout

Runtime path:

- `/opt/simplehost/shm`

Non-`/opt` runtime paths:

- `/etc/shm/`
- `/var/lib/shm/`
- `/var/log/shm/`

## Repository layout

Current scaffold:

- `apps/agent`: long-running node agent service
- `apps/cli`: local maintenance and break-glass CLI
- `packages/contracts`: shared job and status schemas
- `packages/drivers`: service adapters for DNS, Apache, databases, backups, and mail
- `packages/node-config`: node identity, TLS, and config loading
- `packages/renderers`: renderers for vhosts, Quadlet units, DNS changes, and env files
- `packages/testing`: node-driver and renderer test helpers
- `docs`

## References

- [`/opt/simplehost/AGENTS.md`](/opt/simplehost/AGENTS.md)
- [`/opt/simplehost/repos/simplehost-panel/README.md`](/opt/simplehost/repos/simplehost-panel/README.md)
- [`/opt/simplehost/repos/simplehost-platform-config/docs/ARQUITECTURE.md`](/opt/simplehost/repos/simplehost-platform-config/docs/ARQUITECTURE.md)
- [`/opt/simplehost/repos/simplehost-platform-config/docs/CONTAINERS.md`](/opt/simplehost/repos/simplehost-platform-config/docs/CONTAINERS.md)
- [`/opt/simplehost/repos/simplehost-platform-config/docs/DATABASES.md`](/opt/simplehost/repos/simplehost-platform-config/docs/DATABASES.md)
- [`/opt/simplehost/repos/simplehost-platform-config/docs/PROXY.md`](/opt/simplehost/repos/simplehost-platform-config/docs/PROXY.md)
