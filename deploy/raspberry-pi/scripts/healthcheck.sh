#!/usr/bin/env bash
# Host health snapshot for cron or a human.
# Checks API readiness (via docker exec), container state, disk, memory,
# and Raspberry Pi throttling/temperature when vcgencmd is available.
#
#   ./healthcheck.sh
# Exit 0 when healthy; 1 when any check fails.

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose -f docker-compose.pi.yml)
FAILED=0

fail() {
  log "FAIL: $*"
  FAILED=1
}

ok() { log "OK: $*"; }

[[ -f .env ]] || fail "Missing .env"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

# --- Containers ---
if ! command -v docker >/dev/null 2>&1; then
  fail "docker not installed"
else
  for svc in postgres api worker cloudflared; do
    state="$("${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -x "${svc}" || true)"
    if [[ "${state}" == "${svc}" ]]; then
      ok "container ${svc} running"
    else
      fail "container ${svc} not running"
    fi
  done
fi

# --- API readiness (no published port required) ---
if "${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:4000/health/ready 2>/dev/null | grep -q '"ok":true'; then
  ok "api /health/ready"
elif curl -fsS http://127.0.0.1:4400/health/ready 2>/dev/null | grep -q '"ok":true'; then
  ok "api /health/ready (smoke port 4400)"
elif curl -fsS http://127.0.0.1:4000/health/ready 2>/dev/null | grep -q '"ok":true'; then
  ok "api /health/ready (host 4000)"
else
  fail "api /health/ready not OK"
fi

# --- Disk ---
root_use="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
pg_mount="${PG_DATA_DIR:-/srv/elpadel/pgdata}"
if [[ -d "${pg_mount}" ]]; then
  pg_use="$(df -P "${pg_mount}" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
else
  pg_use="${root_use}"
fi
log "disk root=${root_use}% pgdata=${pg_use}%"
if (( root_use >= 90 )) || (( pg_use >= 90 )); then
  fail "disk usage >= 90%"
else
  ok "disk usage under 90%"
fi

# --- Memory ---
if command -v free >/dev/null 2>&1; then
  free -h | awk 'NR==1 || /Mem:/ || /Swap:/' | while IFS= read -r line; do log "mem ${line}"; done
  avail_kib="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
  if [[ -n "${avail_kib}" ]] && (( avail_kib < 102400 )); then
    fail "MemAvailable under 100 MiB (${avail_kib} KiB)"
  else
    ok "MemAvailable ${avail_kib:-unknown} KiB"
  fi
fi

# --- Pi thermals ---
if command -v vcgencmd >/dev/null 2>&1; then
  throttled="$(vcgencmd get_throttled 2>/dev/null || true)"
  temp="$(vcgencmd measure_temp 2>/dev/null || true)"
  log "pi ${throttled} ${temp}"
  if [[ "${throttled}" == *"throttled=0x0"* ]]; then
    ok "no throttling"
  elif [[ -n "${throttled}" ]]; then
    fail "throttling reported: ${throttled}"
  fi
else
  log "vcgencmd not available (skip thermals)"
fi

if (( FAILED != 0 )); then
  log "healthcheck FAILED"
  exit 1
fi
log "healthcheck OK"
exit 0
