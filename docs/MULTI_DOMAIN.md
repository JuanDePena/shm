# Multi-Domain Deployment Model

Date drafted: 2026-03-11
Target OS: AlmaLinux 10.1

## Scope

This runbook defines how multiple customer domains and applications are organized on the two-node platform.

Example domains currently in scope:

- `pyrosa.com.do`
- `gomezrosado.com.do`
- `adudoc.com`

The model is designed so more domains can be added without changing the baseline platform.

## Status on 2026-03-14

- `apps.yaml` remains the bootstrap inventory, but day-to-day desired state now lives in `SHP` PostgreSQL.
- Runtime imports normally read `/etc/spanel/inventory.apps.yaml`, and YAML export remains for audit and disaster recovery.
- Canonical node IDs in the control plane are `primary` and `secondary`; public operator aliases are `vps-prd.pyrosa.com.do` and `vps-des.pyrosa.com.do`.

## Isolation model

The baseline isolation unit is the application, which can also align to a customer when one customer owns one application.

Per application:

- Dedicated application container
- Dedicated environment file
- Dedicated bind-mounted data paths
- Dedicated Apache virtual host
- Dedicated DNS zone or record set
- Dedicated database and database role inside the selected shared engine

This does not mean one database engine container per application by default.

Baseline database isolation:

- One shared PostgreSQL cluster for PostgreSQL-backed applications
- One shared MariaDB cluster only when MySQL-compatible workloads are needed
- One database and one application role per application inside that shared engine

Separate database engine containers per customer are reserved for cases that require stronger operational isolation.

## Domain classes

Each application can use three domain classes:

- Canonical domain: primary public hostname for the application
- Alias domain: additional hostname that serves the same application
- Redirect-only domain: hostname that only redirects to the canonical domain

Examples:

- `pyrosa.com.do` as canonical
- `www.pyrosa.com.do` as alias or redirect
- `sync.pyrosa.com.do` as a separate application under the same apex zone
- `adudoc.com` and `www.adudoc.com` handled explicitly per application policy

## Naming conventions

Use a short slug per application.

Recommended slug pattern:

- lowercase
- letters, digits, hyphen only

Examples:

- `pyrosa-wp`
- `pyrosa-sync`
- `gomezrosado`
- `adudoc`

Derived object names:

- Container name: `app-<slug>`
- Apache vhost file: `<slug>.conf`
- Environment file: `app-<slug>.env`
- Application data root: `/srv/containers/apps/<slug>/`
- PostgreSQL database: `app_<slug>`
- PostgreSQL role: `app_<slug>`
- MariaDB database: `app_<slug>`
- MariaDB user: `app_<slug>`

## Inventory model

Keep a source-controlled inventory for applications and domains in:

- [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml)

That file defines:

- node metadata
- public and WireGuard addresses
- application slugs
- domain mapping
- backend port assignment
- database engine selection
- storage paths

## Port allocation

Each application gets a fixed local backend port on each host.

Recommended convention:

- Use a dedicated block of `100` ports per customer or domain family.
- Keep the same block on both nodes.
- Use low sequence numbers inside the block for public application backends.

Suggested block layout for the current inventory:

- `10100-10199` for `pyrosa`
- `10200-10299` for `gomezrosado`
- `10300-10399` for `adudoc`

Within each block:

- `xx01` for the primary public application
- `xx02` for a second public application under the same customer or zone
- higher numbers reserved for future related applications

Examples:

- `pyrosa-wp`: `10101`
- `pyrosa-sync`: `10102`
- `gomezrosado`: `10201`
- `adudoc`: `10301`

Keep the same backend port on both nodes so Apache configuration remains symmetric.

## DNS model

Per apex domain:

- Create one authoritative zone in PowerDNS
- Publish `NS` records that point to the two platform nameservers
- Publish `A` and `AAAA` records for the application hostname set

Recommended policy:

- One zone per customer apex
- Multiple applications may live under the same zone when they use different hostnames
- Keep aliases explicit
- Use low TTLs during migrations, then raise them after stabilization

The DNS platform artifacts are documented in:

- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)

## Apache model

Per application:

- One canonical HTTPS virtual host
- Optional HTTP redirect vhost
- Optional redirect-only vhost for alias domains

Recommended policy:

- Serve one application per vhost file
- Keep aliases explicit inside the same file if they serve the same content
- Use separate redirect-only files when the alias should not terminate at the app backend

The proxy platform artifacts are documented in:

- [`/opt/simplehostman/src/docs/PROXY.md`](/opt/simplehostman/src/docs/PROXY.md)

## Container model

Per application:

- One Quadlet `.container` file derived from the app template
- One environment file
- One bind-mounted application root
- One bind-mounted uploads path when the application uses local file uploads

Optional per application:

- Worker container
- Scheduled-job container
- Cache container if the workload justifies it

The container platform artifacts are documented in:

- [`/opt/simplehostman/src/docs/CONTAINERS.md`](/opt/simplehostman/src/docs/CONTAINERS.md)

## Database model

Per application:

- One database
- One least-privilege application role or user
- Credentials stored only in the application environment file and database secret handling path

Recommended defaults:

- Prefer PostgreSQL for new applications
- Use MariaDB only for compatibility-driven workloads

The database platform artifacts are documented in:

- [`/opt/simplehostman/src/docs/DATABASES.md`](/opt/simplehostman/src/docs/DATABASES.md)

## Example mapping

Illustrative mapping for the current domains:

- `pyrosa-wp` application
  - zone: `pyrosa.com.do`
  - canonical domain: `pyrosa.com.do`
  - aliases: `www.pyrosa.com.do`
  - backend port: `10101`
  - engine: MariaDB
  - workload: WordPress

- `pyrosa-sync` application
  - zone: `pyrosa.com.do`
  - canonical domain: `sync.pyrosa.com.do`
  - aliases: none
  - backend port: `10102`
  - engine: MariaDB
  - workload: legacy PHP portal
  - future target: PostgreSQL after migration

- `gomezrosado` application
  - zone: `gomezrosado.com.do`
  - canonical domain: `gomezrosado.com.do`
  - aliases: `www.gomezrosado.com.do`
  - backend port: `10201`
  - engine: PostgreSQL

- `adudoc` application
  - zone: `adudoc.com`
  - canonical domain: `adudoc.com`
  - aliases: `www.adudoc.com`
  - backend port: `10301`
  - engine: PostgreSQL

## WordPress and legacy PHP policy

For the current `pyrosa.com.do` estate:

- `pyrosa.com.do` and `www.pyrosa.com.do` map to the `pyrosa-wp` WordPress application
- `sync.pyrosa.com.do` maps to the `pyrosa-sync` PHP portal
- Both applications use the shared MariaDB cluster today
- `pyrosa-sync` can migrate to PostgreSQL later without forcing any change on WordPress

WordPress-specific rules:

- Treat `wp-content/uploads` as persistent application data
- Prefer plugin and theme deployment through the image or release artifact, not live edits only on the primary node
- Keep the application active/passive until media and mutable content handling are proven safe on both nodes

## Operational artifacts

The source-controlled artifacts that implement this model are stored under:

- [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml)
- [`/opt/simplehostman/src/platform/httpd/vhosts/app-vhost.conf.template`](/opt/simplehostman/src/platform/httpd/vhosts/app-vhost.conf.template)
- [`/opt/simplehostman/src/platform/httpd/vhosts/redirect-vhost.conf.template`](/opt/simplehostman/src/platform/httpd/vhosts/redirect-vhost.conf.template)
- [`/opt/simplehostman/src/platform/containers/quadlet/app-template.container`](/opt/simplehostman/src/platform/containers/quadlet/app-template.container)
- [`/opt/simplehostman/src/platform/containers/env/app-template.env.example`](/opt/simplehostman/src/platform/containers/env/app-template.env.example)
- [`/opt/simplehostman/src/platform/postgresql/apps/sql/create-app-database.sql.template`](/opt/simplehostman/src/platform/postgresql/apps/sql/create-app-database.sql.template)
- [`/opt/simplehostman/src/platform/mariadb/sql/create-app-database.sql.template`](/opt/simplehostman/src/platform/mariadb/sql/create-app-database.sql.template)
