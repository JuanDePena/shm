#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install Node.js, npm, and pnpm first." >&2
  exit 1
fi

if [[ ! -f "${workspace_root}/package.json" ]]; then
  echo "Workspace root not found at ${workspace_root}" >&2
  exit 1
fi

echo "Bootstrapping ${workspace_root}"
(
  cd "${workspace_root}"
  pnpm install
)
