#!/usr/bin/env bash
# Restore a custom-format pg_dump into the Pi Postgres container.
# Refuses to run without an explicit confirmation flag.
#
#   ./restore.sh --i-understand-this-overwrites-the-database /path/to/elpadel-….dump
#
# Prefer restoring into a throwaway verification stack first.
# Never run against production data without a fresh backup.

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose -f docker-compose.pi.yml)
CONFIRM_FLAG='--i-understand-this-overwrites-the-database'

usage() {
  cat <<EOF
Usage: $0 ${CONFIRM_FLAG} <dump-file>

Restores a pg_dump -Fc file into the running postgres service.
This OVERWRITES the current database contents.
EOF
}

[[ $# -eq 2 ]] || { usage; exit 1; }
[[ "$1" == "${CONFIRM_FLAG}" ]] || die "Refusing to restore without ${CONFIRM_FLAG}"
DUMP="$2"
[[ -f "${DUMP}" ]] || die "Dump file not found: ${DUMP}"

[[ -f .env ]] || die "Missing .env in ${ROOT_DIR}"
# shellcheck disable=SC1091
set -a
source .env
set +a

log "Stopping api, worker, and migrate to drop DB clients"
"${COMPOSE[@]}" stop api worker || true
"${COMPOSE[@]}" rm -f migrate 2>/dev/null || true

log "Restoring ${DUMP} into ${POSTGRES_DB} (clean + if-exists)"
# --clean --if-exists drops objects before recreate; database itself remains.
"${COMPOSE[@]}" exec -T postgres \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --role="${POSTGRES_USER}" \
  <"${DUMP}" || {
    # pg_restore returns non-zero on some benign notices; check connectivity after.
    log "pg_restore exited non-zero — verifying database responds"
  }

if ! "${COMPOSE[@]}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c 'SELECT 1' >/dev/null; then
  die "Database did not respond after restore"
fi

log "Re-running migrate to ensure schema matches the image"
"${COMPOSE[@]}" up -d --force-recreate migrate

log "Starting api and worker"
"${COMPOSE[@]}" up -d api worker cloudflared

log "Restore finished. Verify with: ./scripts/healthcheck.sh"
