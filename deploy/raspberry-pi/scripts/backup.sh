#!/usr/bin/env bash
# Nightly (or on-demand) Postgres backup for the Pi stack.
# Custom-format dump, 7 daily + 4 weekly retention.
# A backup that lives only on the same SD card is not a real backup —
# set BACKUP_OFFSITE_CMD to rsync/rclone a copy elsewhere (recommended).
#
#   ./backup.sh
#
# Cron / systemd timer should run this from deploy/raspberry-pi/.

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose -f docker-compose.pi.yml)
BACKUP_DIR="${BACKUP_DIR:-/srv/elpadel/backups}"
DAILY_KEEP="${DAILY_KEEP:-7}"
WEEKLY_KEEP="${WEEKLY_KEEP:-4}"

[[ -f .env ]] || die "Missing .env in ${ROOT_DIR}"
# shellcheck disable=SC1091
set -a
source .env
set +a

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dow="$(date -u +%u)" # 1=Mon … 7=Sun
out_daily="${BACKUP_DIR}/daily/elpadel-${stamp}.dump"

log "Dumping ${POSTGRES_DB} → ${out_daily}"
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  >"${out_daily}"
chmod 600 "${out_daily}"
log "Daily dump written ($(wc -c <"${out_daily}") bytes)"

# Promote Sunday (7) dumps into weekly.
if [[ "${dow}" == "7" ]]; then
  weekly="${BACKUP_DIR}/weekly/elpadel-${stamp}.dump"
  cp -p "${out_daily}" "${weekly}"
  chmod 600 "${weekly}"
  log "Weekly copy → ${weekly}"
fi

# Retention: keep newest N by mtime.
prune_dir() {
  local dir="$1"
  local keep="$2"
  local f
  # shellcheck disable=SC2012
  mapfile -t files < <(ls -1t "${dir}"/elpadel-*.dump 2>/dev/null || true)
  local i=0
  for f in "${files[@]:-}"; do
    [[ -n "${f}" ]] || continue
    i=$((i + 1))
    if (( i > keep )); then
      log "Prune ${f}"
      rm -f "${f}"
    fi
  done
}

prune_dir "${BACKUP_DIR}/daily" "${DAILY_KEEP}"
prune_dir "${BACKUP_DIR}/weekly" "${WEEKLY_KEEP}"

# Optional off-device copy. Example:
#   BACKUP_OFFSITE_CMD='rclone copy /srv/elpadel/backups remote:elpadel-pi-backups'
# or: BACKUP_OFFSITE_CMD='rsync -a /srv/elpadel/backups/ user@host:/backups/elpadel/'
if [[ -n "${BACKUP_OFFSITE_CMD:-}" ]]; then
  log "Running off-site copy (BACKUP_OFFSITE_CMD)"
  bash -c "${BACKUP_OFFSITE_CMD}"
  log "Off-site copy finished"
else
  log "WARNING: no BACKUP_OFFSITE_CMD set. Same-SD backups are not disaster recovery."
fi

log "Backup complete"
