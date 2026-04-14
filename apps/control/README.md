# Control App Transition Layout

This directory is the transitional source container for the unified control plane.

Current internal layout:

- `api/`: former `simplehost-panel/apps/api`
- `web/`: former `simplehost-panel/apps/web`

The short-term goal is to keep separate entrypoints while consolidating source ownership under `apps/control`.
The later goal is to collapse both into one runtime process and one port.

This directory is now the canonical source location for control-plane UI and API code inside `/opt/simplehostman/src`.

This directory is now the canonical source location for control-plane UI and API code inside `/opt/simplehostman/src`.
