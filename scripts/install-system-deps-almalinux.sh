#!/usr/bin/env bash
set -euo pipefail

if ! command -v dnf >/dev/null 2>&1; then
  echo "dnf is required on this host." >&2
  exit 1
fi

run_as_root=()
if [[ "$(id -u)" -ne 0 ]]; then
  run_as_root=(sudo)
fi

packages=(
  git
  nodejs
  nodejs-npm
)

missing=()
for package in "${packages[@]}"; do
  if ! rpm -q "${package}" >/dev/null 2>&1; then
    missing+=("${package}")
  fi
done

if (( ${#missing[@]} > 0 )); then
  "${run_as_root[@]}" dnf install -y "${missing[@]}"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10
fi

echo "node: $(node --version)"
echo "npm: $(npm --version)"
echo "pnpm: $(pnpm --version)"

