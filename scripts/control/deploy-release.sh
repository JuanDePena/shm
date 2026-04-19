#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: deploy-release.sh <version> [target-host|local] [active|disabled]}"
target_host="${2:-local}"
mode="${3:-active}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"
runtime_root="$(simplehost_resolve_runtime_root SIMPLEHOST_RUNTIME_ROOT)"
release_dir="${runtime_root}/releases/${version}"

if [[ "${mode}" != "active" && "${mode}" != "disabled" ]]; then
  echo "mode must be active or disabled" >&2
  exit 1
fi

if [[ "${target_host}" == "local" || ! -d "${release_dir}" ]]; then
  bash "${repo_root}/scripts/control/install-release.sh" "${version}"
fi

ensure_env_version() {
  local target_path="$1"
  local example_path="$2"

  if [[ ! -f "${target_path}" ]]; then
    install -m 0640 "${example_path}" "${target_path}"
  fi

  if grep -q '^SIMPLEHOST_VERSION=' "${target_path}"; then
    sed -i "s/^SIMPLEHOST_VERSION=.*/SIMPLEHOST_VERSION=${version}/" "${target_path}"
  else
    printf '\nSIMPLEHOST_VERSION=%s\n' "${version}" >>"${target_path}"
  fi
}

normalize_api_env() {
  local target_path="$1"

  if [[ -f "${target_path}" ]]; then
    bash "${release_dir}/scripts/control/normalize-api-env.sh" "${target_path}"
  fi
}

sync_worker_job_secret() {
  local api_env_path="/etc/simplehost/control.env"
  local worker_env_path="/etc/simplehost/worker.env"
  local job_secret_line

  if [[ ! -f "${api_env_path}" || ! -f "${worker_env_path}" ]]; then
    return
  fi

  if grep -q '^SIMPLEHOST_JOB_SECRET_KEY=' "${worker_env_path}"; then
    return
  fi

  job_secret_line="$(grep -E '^SIMPLEHOST_JOB_SECRET_KEY=' "${api_env_path}" | tail -n 1 || true)"

  if [[ -n "${job_secret_line}" ]]; then
    printf '\n%s\n' "${job_secret_line}" >>"${worker_env_path}"
  fi
}

activate_local() {
  ensure_env_version /etc/simplehost/control.env "${release_dir}/packaging/env/simplehost-control.env.example"
  ensure_env_version /etc/simplehost/worker.env "${release_dir}/packaging/env/simplehost-worker.env.example"
  normalize_api_env /etc/simplehost/control.env.example
  normalize_api_env /etc/simplehost/control.env
  sync_worker_job_secret
  systemctl daemon-reload

  if [[ "${mode}" == "disabled" ]]; then
    systemctl disable simplehost-control.service simplehost-worker.service || true
    systemctl stop simplehost-control.service simplehost-worker.service || true
    echo "Installed control runtime ${version} locally in disabled mode"
    return
  fi

  systemctl enable simplehost-control.service simplehost-worker.service
  systemctl restart simplehost-control.service simplehost-worker.service
  systemctl is-active simplehost-control.service simplehost-worker.service
  echo "Installed control runtime ${version} locally in active mode"
}

activate_remote() {
  local remote_release_dir="${release_dir}"

  rsync -a "${release_dir}/" "${target_host}:${remote_release_dir}/"

  ssh "${target_host}" \
    "install -d '${runtime_root}/releases' /etc/simplehost /var/log/simplehost && \
     ln -sfn '${remote_release_dir}' '${runtime_root}/current' && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/simplehost-control.service' /etc/systemd/system/simplehost-control.service && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/simplehost-worker.service' /etc/systemd/system/simplehost-worker.service && \
     install -d /etc/systemd/system/postgresql@control.service.d /etc/systemd/system/postgresql@apps.service.d && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/postgresql@control.service.d/30-postgresql-setup.conf' /etc/systemd/system/postgresql@control.service.d/30-postgresql-setup.conf && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/postgresql@control.service.d/40-pgdg18-binary.conf' /etc/systemd/system/postgresql@control.service.d/40-pgdg18-binary.conf && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/postgresql@apps.service.d/30-postgresql-setup.conf' /etc/systemd/system/postgresql@apps.service.d/30-postgresql-setup.conf && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/postgresql@apps.service.d/40-pgdg18-binary.conf' /etc/systemd/system/postgresql@apps.service.d/40-pgdg18-binary.conf && \
     install -m 0644 '${remote_release_dir}/packaging/env/simplehost-control.env.example' /etc/simplehost/control.env.example && \
     install -m 0644 '${remote_release_dir}/packaging/env/simplehost-worker.env.example' /etc/simplehost/worker.env.example && \
     if [ ! -f /etc/simplehost/control.env ]; then install -m 0640 '${remote_release_dir}/packaging/env/simplehost-control.env.example' /etc/simplehost/control.env; fi && \
     if [ ! -f /etc/simplehost/worker.env ]; then install -m 0640 '${remote_release_dir}/packaging/env/simplehost-worker.env.example' /etc/simplehost/worker.env; fi && \
     if grep -q '^SIMPLEHOST_VERSION=' /etc/simplehost/control.env; then sed -i 's/^SIMPLEHOST_VERSION=.*/SIMPLEHOST_VERSION=${version}/' /etc/simplehost/control.env; else printf '\nSIMPLEHOST_VERSION=${version}\n' >> /etc/simplehost/control.env; fi && \
     if grep -q '^SIMPLEHOST_VERSION=' /etc/simplehost/worker.env; then sed -i 's/^SIMPLEHOST_VERSION=.*/SIMPLEHOST_VERSION=${version}/' /etc/simplehost/worker.env; else printf '\nSIMPLEHOST_VERSION=${version}\n' >> /etc/simplehost/worker.env; fi && \
     bash '${remote_release_dir}/scripts/control/normalize-api-env.sh' /etc/simplehost/control.env.example && \
     bash '${remote_release_dir}/scripts/control/normalize-api-env.sh' /etc/simplehost/control.env && \
     if ! grep -q '^SIMPLEHOST_JOB_SECRET_KEY=' /etc/simplehost/worker.env; then worker_secret_line=\$(grep -E '^SIMPLEHOST_JOB_SECRET_KEY=' /etc/simplehost/control.env | tail -n 1 || true); if [ -n \"\${worker_secret_line}\" ]; then printf '\n%s\n' \"\${worker_secret_line}\" >> /etc/simplehost/worker.env; fi; fi && \
     systemctl daemon-reload"

  if [[ "${mode}" == "disabled" ]]; then
    ssh "${target_host}" \
      "systemctl disable simplehost-control.service simplehost-worker.service || true && \
       systemctl stop simplehost-control.service simplehost-worker.service || true"
    echo "Installed control runtime ${version} on ${target_host} in disabled mode"
    return
  fi

  ssh "${target_host}" \
    "systemctl enable simplehost-control.service simplehost-worker.service && \
     systemctl restart simplehost-control.service simplehost-worker.service && \
     systemctl is-active simplehost-control.service simplehost-worker.service"
  echo "Installed control runtime ${version} on ${target_host} in active mode"
}

if [[ "${target_host}" == "local" ]]; then
  activate_local
else
  activate_remote
fi
