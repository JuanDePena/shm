#!/usr/bin/env bash
set -euo pipefail

bundle_path="${1:?usage: install-bundle.sh <bundle.tar.gz>}"
runtime_root="${SHM_RUNTIME_ROOT:-/opt/simplehost/shm}"
extract_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${extract_dir}"
}
trap cleanup EXIT

install -d "${runtime_root}/releases" "${runtime_root}/shared" /etc/shm /var/log/shm
tar -xzf "${bundle_path}" -C "${extract_dir}"
release_source="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [[ -z "${release_source}" ]]; then
  echo "Bundle ${bundle_path} did not contain a release directory." >&2
  exit 1
fi

version="$(basename "${release_source}" | sed 's/^simplehost-manager-//')"
release_dir="${runtime_root}/releases/${version}"

rm -rf "${release_dir}"
mv "${release_source}" "${release_dir}"
ln -sfn "${release_dir}" "${runtime_root}/current"

install -m 0644 "${release_dir}/packaging/systemd/shm-agent.service" /etc/systemd/system/shm-agent.service
install -m 0644 "${release_dir}/packaging/env/shm-agent.env.example" /etc/shm/agent.env.example
systemctl daemon-reload

echo "Installed SHM bundle ${bundle_path} into ${release_dir}"
