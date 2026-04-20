# Bootstrap Inventory

This directory contains bootstrap and seed material for the unified source workspace.

Path:

- `/opt/simplehostman/src/bootstrap`

Primary file:

- `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`

This tree remains useful as seed material for controlled import and disaster recovery.

Day-to-day desired state is now authoritative in PostgreSQL through `SimpleHostMan`.
When operators need a YAML artifact, they should prefer exporting the current resource catalog from the control plane instead of treating this file as the live source of truth.
