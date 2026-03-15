#!/usr/bin/env bash
set -euo pipefail

readonly TAG="server-health"
readonly DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
readonly DISK_CRIT_PCT="${DISK_CRIT_PCT:-90}"
readonly MEM_WARN_PCT="${MEM_WARN_PCT:-90}"
readonly MEM_CRIT_PCT="${MEM_CRIT_PCT:-95}"
readonly CERT_WARN_DAYS="${CERT_WARN_DAYS:-21}"
readonly FAIL2BAN_WARN_BANNED="${FAIL2BAN_WARN_BANNED:-10}"
readonly FAIL2BAN_WARN_FAILED="${FAIL2BAN_WARN_FAILED:-25}"

readonly -a SERVICES=(
  "sshd"
  "firewalld"
  "fail2ban"
  "code-server@root"
)

readonly -a PATHS_TO_CHECK=(
  "/"
  "/var"
  "/home"
  "/tmp"
)

MODE="${1:---check}"

if [[ "${MODE}" != "--check" && "${MODE}" != "--report" ]]; then
  echo "Usage: $0 [--check|--report]" >&2
  exit 2
fi

declare -a INFO_MESSAGES=()
declare -a WARNING_MESSAGES=()
declare -a CRITICAL_MESSAGES=()

record_info() {
  INFO_MESSAGES+=("$*")
}

record_warning() {
  WARNING_MESSAGES+=("$*")
}

record_critical() {
  CRITICAL_MESSAGES+=("$*")
}

check_services() {
  local service state substate

  for service in "${SERVICES[@]}"; do
    state="$(systemctl is-active "${service}" 2>/dev/null || true)"
    substate="$(systemctl show -p SubState --value "${service}" 2>/dev/null || true)"
    if [[ "${state}" == "active" ]]; then
      record_info "service ${service} is active/${substate:-unknown}"
    else
      record_critical "service ${service} is ${state:-unknown}/${substate:-unknown}"
    fi
  done
}

check_disk() {
  declare -A seen_mounts=()
  local path mountpoint use_pct

  while read -r mountpoint use_pct; do
    if [[ -n "${seen_mounts[${mountpoint}]:-}" ]]; then
      continue
    fi
    seen_mounts["${mountpoint}"]=1

    if (( use_pct >= DISK_CRIT_PCT )); then
      record_critical "filesystem ${mountpoint} usage is ${use_pct}%"
    elif (( use_pct >= DISK_WARN_PCT )); then
      record_warning "filesystem ${mountpoint} usage is ${use_pct}%"
    else
      record_info "filesystem ${mountpoint} usage is ${use_pct}%"
    fi
  done < <(df -P "${PATHS_TO_CHECK[@]}" | awk 'NR > 1 {gsub(/%/, "", $5); print $6, $5}')
}

check_memory() {
  local total_kb available_kb used_kb used_pct

  total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  used_kb=$(( total_kb - available_kb ))
  used_pct=$(( (100 * used_kb) / total_kb ))

  if (( used_pct >= MEM_CRIT_PCT )); then
    record_critical "memory usage is ${used_pct}%"
  elif (( used_pct >= MEM_WARN_PCT )); then
    record_warning "memory usage is ${used_pct}%"
  else
    record_info "memory usage is ${used_pct}%"
  fi
}

check_fail2ban() {
  local status_output current_failed current_banned total_banned

  if ! status_output="$(fail2ban-client status sshd 2>/dev/null)"; then
    record_critical "fail2ban jail sshd is unavailable"
    return
  fi

  current_failed="$(awk -F '\t' '/Currently failed:/ {print $2}' <<<"${status_output}")"
  current_banned="$(awk -F '\t' '/Currently banned:/ {print $2}' <<<"${status_output}")"
  total_banned="$(awk -F '\t' '/Total banned:/ {print $2}' <<<"${status_output}")"

  current_failed="${current_failed:-0}"
  current_banned="${current_banned:-0}"
  total_banned="${total_banned:-0}"

  if (( current_failed >= FAIL2BAN_WARN_FAILED )); then
    record_warning "fail2ban sshd currently failed count is ${current_failed}"
  else
    record_info "fail2ban sshd currently failed count is ${current_failed}"
  fi

  if (( current_banned >= FAIL2BAN_WARN_BANNED )); then
    record_warning "fail2ban sshd currently banned count is ${current_banned}"
  else
    record_info "fail2ban sshd currently banned count is ${current_banned}"
  fi

  record_info "fail2ban sshd total banned count is ${total_banned}"
}

check_certificates() {
  local cert found_any now_epoch warn_seconds end_date end_epoch days_left

  now_epoch="$(date +%s)"
  warn_seconds=$(( CERT_WARN_DAYS * 86400 ))
  found_any=0

  shopt -s nullglob
  for cert in /etc/letsencrypt/live/*/fullchain.pem; do
    found_any=1
    if ! end_date="$(openssl x509 -noout -enddate -in "${cert}" 2>/dev/null | cut -d= -f2-)"; then
      record_warning "certificate ${cert} could not be parsed"
      continue
    fi

    if ! end_epoch="$(date -d "${end_date}" +%s 2>/dev/null)"; then
      record_warning "certificate ${cert} has an unreadable expiry date"
      continue
    fi

    days_left=$(( (end_epoch - now_epoch + 86399) / 86400 ))

    if (( end_epoch <= now_epoch )); then
      record_critical "certificate ${cert} is expired"
    elif ! openssl x509 -checkend "${warn_seconds}" -noout -in "${cert}" >/dev/null 2>&1; then
      record_warning "certificate ${cert} expires in ${days_left} days"
    else
      record_info "certificate ${cert} expires in ${days_left} days"
    fi
  done
  shopt -u nullglob

  if (( found_any == 0 )); then
    record_info "no application TLS certificates found under /etc/letsencrypt/live"
  fi
}

run_checks() {
  check_services
  check_disk
  check_memory
  check_fail2ban
  check_certificates
}

log_messages() {
  local message

  for message in "${WARNING_MESSAGES[@]}"; do
    logger -t "${TAG}" -p user.warning -- "${message}"
  done

  for message in "${CRITICAL_MESSAGES[@]}"; do
    logger -t "${TAG}" -p user.err -- "${message}"
  done
}

print_group() {
  local header="$1"
  shift
  local -a messages=( "$@" )
  local message

  if (( ${#messages[@]} == 0 )); then
    return
  fi

  printf '%s\n' "${header}"
  for message in "${messages[@]}"; do
    printf ' - %s\n' "${message}"
  done
  printf '\n'
}

print_report() {
  printf 'Server health report at %s\n\n' "$(date -Is)"
  print_group "Critical" "${CRITICAL_MESSAGES[@]}"
  print_group "Warnings" "${WARNING_MESSAGES[@]}"
  print_group "Info" "${INFO_MESSAGES[@]}"
}

run_checks

if [[ "${MODE}" == "--report" ]]; then
  print_report
fi

if [[ "${MODE}" == "--check" ]]; then
  log_messages
fi

if (( ${#CRITICAL_MESSAGES[@]} > 0 )); then
  exit 2
fi

if (( ${#WARNING_MESSAGES[@]} > 0 )); then
  exit 1
fi

exit 0
