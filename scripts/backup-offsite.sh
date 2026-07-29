#!/usr/bin/env sh
# Off-site PostgreSQL backup for El Padel.
#
# Dumps the production database from the Postgres container, uploads the dump to
# an off-site rclone remote, and prunes old copies both locally and remotely.
# Designed to run from the project root on the VPS, typically via cron.
#
# Prerequisites:
#   - Run from the project root (where docker-compose.yml and .env live).
#   - Docker Compose stack is up (the `postgres` service must be running).
#   - `rclone` is installed and a remote is configured (see `rclone config`).
#
# Configure via environment or `.env`:
#   BACKUP_RCLONE_REMOTE   rclone target, e.g. "b2:elpadel-backups/db" (required)
#   BACKUP_DIR             local dump directory (default: ./backups)
#   BACKUP_RETAIN_DAYS     days to keep local and remote dumps (default: 30)
#   POSTGRES_USER          from .env
#   POSTGRES_DB            from .env
#
# Exit codes: 0 success; non-zero on any failure so cron mail / monitors alert.

set -eu

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"; }
die() { printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >&2; exit 1; }

# Load .env from the current directory if present (project root).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"

[ -n "${BACKUP_RCLONE_REMOTE:-}" ] || die "BACKUP_RCLONE_REMOTE is required (e.g. b2:elpadel-backups/db)"
[ -n "${POSTGRES_USER:-}" ] || die "POSTGRES_USER is not set (expected from .env)"
[ -n "${POSTGRES_DB:-}" ] || die "POSTGRES_DB is not set (expected from .env)"
command -v docker >/dev/null 2>&1 || die "docker command not found"
command -v rclone >/dev/null 2>&1 || die "rclone command not found (install it and run 'rclone config')"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="$BACKUP_DIR/elpadel-$stamp.dump"

log "Dumping database '$POSTGRES_DB' to $dump_file"
# -T disables TTY so this works non-interactively under cron.
if ! docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$dump_file"; then
  rm -f "$dump_file"
  die "pg_dump failed"
fi

# A truncated or empty dump is worse than no dump: fail loudly, keep nothing.
if [ ! -s "$dump_file" ]; then
  rm -f "$dump_file"
  die "dump file is empty; aborting"
fi
log "Dump complete ($(wc -c < "$dump_file" | tr -d ' ') bytes)"

log "Uploading to $BACKUP_RCLONE_REMOTE"
rclone copy "$dump_file" "$BACKUP_RCLONE_REMOTE" --no-traverse || die "rclone upload failed"
log "Upload complete"

log "Pruning local dumps older than $BACKUP_RETAIN_DAYS days"
find "$BACKUP_DIR" -name 'elpadel-*.dump' -type f -mtime +"$BACKUP_RETAIN_DAYS" -print -delete || true

log "Pruning remote dumps older than $BACKUP_RETAIN_DAYS days"
rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${BACKUP_RETAIN_DAYS}d" --include 'elpadel-*.dump' || \
  log "WARN: remote prune reported an error (non-fatal)"

log "Backup finished successfully"
