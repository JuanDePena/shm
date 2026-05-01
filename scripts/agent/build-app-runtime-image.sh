#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-registry.example.com/adudoc-app:stable}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_DIR="${SCRIPT_DIR}/../../platform/containers/images/php-apache-runtime"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required to build managed app runtime images" >&2
  exit 1
fi

podman build \
  --tag "${IMAGE_TAG}" \
  --file "${CONTEXT_DIR}/Containerfile" \
  "${CONTEXT_DIR}"
