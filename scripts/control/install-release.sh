#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"
runtime_root="$(simplehost_resolve_runtime_root SIMPLEHOST_RUNTIME_ROOT)"
version="${1:-$(simplehost_read_workspace_version "${repo_root}")}"
release_dir="${runtime_root}/releases/${version}"
temp_dir="${release_dir}.tmp.$$"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install Node.js, npm, and pnpm first." >&2
  exit 1
fi

rm -rf "${temp_dir}"
install -d "${runtime_root}/releases" "${runtime_root}/shared" /etc/simplehost /var/log/simplehost
cp -a "${repo_root}/." "${temp_dir}"
rm -rf "${temp_dir}/.git" "${temp_dir}/node_modules"

(
  cd "${temp_dir}"
  pnpm install --frozen-lockfile
  pnpm exec tsc -b --force tsconfig.control.json
  pnpm exec tsc -b --force tsconfig.agent.json
)

rm -rf "${release_dir}"
mv "${temp_dir}" "${release_dir}"
ln -sfn "${release_dir}" "${runtime_root}/current"

install -m 0644 "${repo_root}/packaging/systemd/simplehost-control.service" /etc/systemd/system/simplehost-control.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-worker.service" /etc/systemd/system/simplehost-worker.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-backup-runner.service" /etc/systemd/system/simplehost-backup-runner.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-backup-runner.timer" /etc/systemd/system/simplehost-backup-runner.timer
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-control-full.service" /etc/systemd/system/simplehost-pgbackrest-control-full.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-control-full.timer" /etc/systemd/system/simplehost-pgbackrest-control-full.timer
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-control-incr.service" /etc/systemd/system/simplehost-pgbackrest-control-incr.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-control-incr.timer" /etc/systemd/system/simplehost-pgbackrest-control-incr.timer
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-apps-full.service" /etc/systemd/system/simplehost-pgbackrest-apps-full.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-apps-full.timer" /etc/systemd/system/simplehost-pgbackrest-apps-full.timer
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-apps-incr.service" /etc/systemd/system/simplehost-pgbackrest-apps-incr.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-apps-incr.timer" /etc/systemd/system/simplehost-pgbackrest-apps-incr.timer
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-offhost-sync.service" /etc/systemd/system/simplehost-pgbackrest-offhost-sync.service
install -m 0644 "${repo_root}/packaging/systemd/simplehost-pgbackrest-offhost-sync.timer" /etc/systemd/system/simplehost-pgbackrest-offhost-sync.timer
install -m 0644 "${repo_root}/packaging/pgbackrest/pgbackrest.conf" /etc/pgbackrest.conf
install -d /etc/systemd/system/postgresql@control.service.d /etc/systemd/system/postgresql@apps.service.d
install -m 0644 "${repo_root}/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf" /etc/systemd/system/postgresql@control.service.d/30-postgresql-setup.conf
install -m 0644 "${repo_root}/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf" /etc/systemd/system/postgresql@control.service.d/40-pgdg18-binary.conf
install -m 0644 "${repo_root}/packaging/systemd/postgresql@apps.service.d/30-postgresql-setup.conf" /etc/systemd/system/postgresql@apps.service.d/30-postgresql-setup.conf
install -m 0644 "${repo_root}/packaging/systemd/postgresql@apps.service.d/40-pgdg18-binary.conf" /etc/systemd/system/postgresql@apps.service.d/40-pgdg18-binary.conf
install -m 0644 "${repo_root}/packaging/env/simplehost-control.env.example" /etc/simplehost/control.env.example
install -m 0644 "${repo_root}/packaging/env/simplehost-worker.env.example" /etc/simplehost/worker.env.example
install -m 0644 "${repo_root}/packaging/env/simplehost-pgbackrest-offhost.env.example" /etc/simplehost/pgbackrest-offhost.env.example
if [[ ! -f /etc/simplehost/pgbackrest-offhost.env ]]; then
  install -m 0640 "${repo_root}/packaging/env/simplehost-pgbackrest-offhost.env.example" /etc/simplehost/pgbackrest-offhost.env
fi
bash "${release_dir}/scripts/control/normalize-api-env.sh" /etc/simplehost/control.env.example

if [[ -f /etc/simplehost/control.env ]]; then
  bash "${release_dir}/scripts/control/normalize-api-env.sh" /etc/simplehost/control.env
fi

systemctl daemon-reload

echo "Installed control release ${version} into ${release_dir}"
