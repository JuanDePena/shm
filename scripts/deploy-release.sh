#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: deploy-release.sh <version> [target-host|local] [active|disabled]}"
target_host="${2:-local}"
mode="${3:-active}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${SHM_RUNTIME_ROOT:-/opt/simplehost/shm}"
release_dir="${runtime_root}/releases/${version}"

if [[ "${mode}" != "active" && "${mode}" != "disabled" ]]; then
  echo "mode must be active or disabled" >&2
  exit 1
fi

if [[ ! -d "${release_dir}" ]]; then
  "${repo_root}/scripts/install-release.sh" "${version}"
fi

activate_local() {
  systemctl daemon-reload

  if [[ "${mode}" == "disabled" ]]; then
    systemctl disable shm-agent.service || true
    systemctl stop shm-agent.service || true
    echo "Installed SHM ${version} locally in disabled mode"
    return
  fi

  systemctl enable shm-agent.service
  systemctl restart shm-agent.service
  systemctl is-active shm-agent.service
  echo "Installed SHM ${version} locally in active mode"
}

activate_remote() {
  local remote_release_dir="${release_dir}"

  rsync -a "${release_dir}/" "${target_host}:${remote_release_dir}/"

  ssh "${target_host}" \
    "install -d '${runtime_root}/releases' /etc/shm /var/log/shm && \
     ln -sfn '${remote_release_dir}' '${runtime_root}/current' && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/shm-agent.service' /etc/systemd/system/shm-agent.service && \
     install -m 0644 '${remote_release_dir}/packaging/env/shm-agent.env.example' /etc/shm/agent.env.example && \
     systemctl daemon-reload"

  if [[ "${mode}" == "disabled" ]]; then
    ssh "${target_host}" \
      "systemctl disable shm-agent.service || true && \
       systemctl stop shm-agent.service || true"
    echo "Installed SHM ${version} on ${target_host} in disabled mode"
    return
  fi

  ssh "${target_host}" \
    "systemctl enable shm-agent.service && \
     systemctl restart shm-agent.service && \
     systemctl is-active shm-agent.service"
  echo "Installed SHM ${version} on ${target_host} in active mode"
}

if [[ "${target_host}" == "local" ]]; then
  activate_local
else
  activate_remote
fi
