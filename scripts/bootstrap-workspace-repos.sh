#!/usr/bin/env bash
set -euo pipefail

repos_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
repos=(
  "simplehost-manager"
  "simplehost-panel"
)

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install Node.js, npm, and pnpm first." >&2
  exit 1
fi

for repo in "${repos[@]}"; do
  repo_path="${repos_root}/${repo}"

  if [[ ! -f "${repo_path}/package.json" ]]; then
    echo "Skipping ${repo_path}: package.json not found."
    continue
  fi

  echo "Bootstrapping ${repo_path}"
  (
    cd "${repo_path}"
    pnpm install
  )
done

