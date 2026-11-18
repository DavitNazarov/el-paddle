#!/usr/bin/env bash
# Pull a pinned backend image tag, dump the DB, migrate, restart api/worker,
# wait for readiness, and roll back to the last-good tag on failure.
#
#   ./deploy.sh <image-tag>
#
# Run from deploy/raspberry-pi/ (where docker-compose.pi.yml and .env live).

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose -f docker-compose.pi.yml)
STATE_DIR="${STATE_DIR:-/srv/elpadel/state}"
LAST_GOOD_FILE="${STATE_DIR}/last-good-image-tag"
BACKUP_DIR="${BACKUP_DIR:-/srv/elpadel/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/health/ready}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-120}"

[[ $# -eq 1 ]] || die "Usage: $0 <image-tag>"
NEW_TAG="$1"
[[ -n "${NEW_TAG}" && "${NEW_TAG}" != "latest" ]] || die "Refuse empty or 'latest' IMAGE_TAG."

[[ -f .env ]] || die "Missing .env in ${ROOT_DIR}. Copy .env.pi.example and fill secrets."

# shellcheck disable=SC1091
set -a
# Load .env without printing values
source .env
set +a

PREV_TAG="${IMAGE_TAG:-}"
if [[ -f "${LAST_GOOD_FILE}" ]]; then
  PREV_TAG="$(cat "${LAST_GOOD_FILE}")"
fi

mkdir -p "${STATE_DIR}" "${BACKUP_DIR}"

write_image_tag() {
  local tag="$1"
  if grep -q '^IMAGE_TAG=' .env; then
    # Rewrite IMAGE_TAG in place without echoing other secrets.
    local tmp
    tmp="$(mktemp)"
    awk -v t="${tag}" 'BEGIN{done=0} /^IMAGE_TAG=/{print "IMAGE_TAG=" t; done=1; next} {print} END{if(!done) print "IMAGE_TAG=" t}' .env >"${tmp}"
    mv "${tmp}" .env
    chmod 600 .env
  else
    printf '\nIMAGE_TAG=%s\n' "${tag}" >>.env
  fi
  export IMAGE_TAG="${tag}"
}

wait_ready() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SEC))
  # Prefer hitting readiness via docker exec (no published port on the Pi).
  while (( SECONDS < deadline )); do
    if "${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:4000/health/ready 2>/dev/null | grep -q '"ok":true'; then
      return 0
    fi
    # Fallback for smoke overrides that publish 4400/4000 on the host.
    if curl -fsS "${HEALTH_URL}" 2>/dev/null | grep -q '"ok":true'; then
      return 0
    fi
    sleep 3
  done
  return 1
}

pre_migrate_dump() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local out="${BACKUP_DIR}/pre-migrate-${stamp}.dump"
  log "Pre-migration pg_dump → ${out}"
  if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
    log "Postgres not running yet; skipping pre-migrate dump (first deploy)."
    return 0
  fi
  "${COMPOSE[@]}" exec -T postgres \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
    >"${out}"
  log "Pre-migration dump complete."
}

rollback() {
  [[ -n "${PREV_TAG}" && "${PREV_TAG}" != "${NEW_TAG}" ]] || die "Deploy failed and no previous tag available to roll back to."
  log "Rolling back to ${PREV_TAG}"
  write_image_tag "${PREV_TAG}"
  "${COMPOSE[@]}" pull api worker migrate
  "${COMPOSE[@]}" up -d --no-deps --force-recreate migrate
  "${COMPOSE[@]}" up -d --no-deps --force-recreate api worker
  "${COMPOSE[@]}" up -d cloudflared
  if wait_ready; then
    log "Rollback healthy at tag ${PREV_TAG}"
    echo "${PREV_TAG}" >"${LAST_GOOD_FILE}"
  else
    die "Rollback to ${PREV_TAG} also failed health check."
  fi
}

log "Deploying IMAGE_TAG=${NEW_TAG} (previous good: ${PREV_TAG:-none})"
write_image_tag "${NEW_TAG}"

log "Pulling images"
"${COMPOSE[@]}" pull postgres cloudflared api worker migrate

pre_migrate_dump

log "Ensuring postgres is up"
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" up -d --force-recreate migrate

log "Recreating api and worker"
"${COMPOSE[@]}" up -d --no-deps --force-recreate api worker
"${COMPOSE[@]}" up -d cloudflared

if wait_ready; then
  echo "${NEW_TAG}" >"${LAST_GOOD_FILE}"
  log "Deploy succeeded. last-good=${NEW_TAG}"
  "${COMPOSE[@]}" ps
  exit 0
fi

log "Health check failed after deploy."
rollback
exit 1
