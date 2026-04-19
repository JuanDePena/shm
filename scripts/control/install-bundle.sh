#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"

bundle_path="${1:?usage: install-bundle.sh <bundle.tar.gz>}"
runtime_root="$(simplehost_resolve_runtime_root SIMPLEHOST_RUNTIME_ROOT)"
extract_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${extract_dir}"
}
trap cleanup EXIT

install -d "${runtime_root}/releases" "${runtime_root}/shared" /etc/simplehost /var/log/simplehost
tar -xzf "${bundle_path}" -C "${extract_dir}"
release_source="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [[ -z "${release_source}" ]]; then
  echo "Bundle ${bundle_path} did not contain a release directory." >&2
  exit 1
fi

version="$(basename "${release_source}" | sed 's/^simplehost-control-//')"
release_dir="${runtime_root}/releases/${version}"

rm -rf "${release_dir}"
mv "${release_source}" "${release_dir}"
ln -sfn "${release_dir}" "${runtime_root}/current"

install -m 0644 "${release_dir}/packaging/systemd/simplehost-control.service" /etc/systemd/system/simplehost-control.service
install -m 0644 "${release_dir}/packaging/systemd/simplehost-worker.service" /etc/systemd/system/simplehost-worker.service
install -d /etc/systemd/system/postgresql@control.service.d /etc/systemd/system/postgresql@apps.service.d
install -m 0644 "${release_dir}/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf" /etc/systemd/system/postgresql@control.service.d/30-postgresql-setup.conf
install -m 0644 "${release_dir}/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf" /etc/systemd/system/postgresql@control.service.d/40-pgdg18-binary.conf
install -m 0644 "${release_dir}/packaging/systemd/postgresql@apps.service.d/30-postgresql-setup.conf" /etc/systemd/system/postgresql@apps.service.d/30-postgresql-setup.conf
install -m 0644 "${release_dir}/packaging/systemd/postgresql@apps.service.d/40-pgdg18-binary.conf" /etc/systemd/system/postgresql@apps.service.d/40-pgdg18-binary.conf
install -m 0644 "${release_dir}/packaging/env/simplehost-control.env.example" /etc/simplehost/control.env.example
install -m 0644 "${release_dir}/packaging/env/simplehost-worker.env.example" /etc/simplehost/worker.env.example
systemctl daemon-reload

echo "Installed control bundle ${bundle_path} into ${release_dir}"
