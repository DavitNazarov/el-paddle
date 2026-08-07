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
#   BACKUP_PASSPHRASE      symmetric passphrase for gpg (required, see below)
#   BACKUP_DIR             local dump directory (default: ./backups)
#   BACKUP_RETAIN_DAYS     days to keep local and remote dumps (default: 30)
#   POSTGRES_USER          from .env
#   POSTGRES_DB            from .env
#
# The dump is encrypted before it leaves the host. A pg_dump of this database
# holds every account's email, phone, password hash and match history, so an
# unencrypted copy sitting in third-party object storage is a breach waiting on
# someone else's access control. Uploads are `.dump.gpg`; nothing unencrypted is
# ever written to the remote.
#
# Set BACKUP_PASSPHRASE in .env, and keep a copy somewhere that is NOT this
# server — a backup you cannot decrypt is not a backup. Restore with:
#
#   gpg --batch --passphrase "$BACKUP_PASSPHRASE" --decrypt elpadel-<stamp>.dump.gpg \
#     | docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
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
# Refused rather than defaulted to plaintext: an operator who has not set this
# should find out now, not when the bucket leaks.
[ -n "${BACKUP_PASSPHRASE:-}" ] || die "BACKUP_PASSPHRASE is required; backups are never uploaded unencrypted"
command -v docker >/dev/null 2>&1 || die "docker command not found"
command -v rclone >/dev/null 2>&1 || die "rclone command not found (install it and run 'rclone config')"
command -v gpg >/dev/null 2>&1 || die "gpg command not found (apt-get install gnupg)"

mkdir -p "$BACKUP_DIR"
# The dump and its ciphertext both sit here briefly; keep them off other users.
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="$BACKUP_DIR/elpadel-$stamp.dump"
encrypted_file="$dump_file.gpg"

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

# Encrypt before anything leaves the host. The passphrase is piped in on stdin
# rather than passed as an argument, so it never appears in the process list
# where any local user could read it.
log "Encrypting to $encrypted_file"
if ! printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --yes \
  --passphrase-fd 0 --pinentry-mode loopback \
  --symmetric --cipher-algo AES256 \
  --output "$encrypted_file" "$dump_file"; then
  rm -f "$dump_file" "$encrypted_file"
  die "gpg encryption failed"
fi
if [ ! -s "$encrypted_file" ]; then
  rm -f "$dump_file" "$encrypted_file"
  die "encrypted file is empty; aborting"
fi
# The plaintext has served its purpose; only the ciphertext is retained.
rm -f "$dump_file"

log "Uploading to $BACKUP_RCLONE_REMOTE"
rclone copy "$encrypted_file" "$BACKUP_RCLONE_REMOTE" --no-traverse || die "rclone upload failed"
log "Upload complete"

log "Pruning local dumps older than $BACKUP_RETAIN_DAYS days"
find "$BACKUP_DIR" -name 'elpadel-*.dump.gpg' -type f -mtime +"$BACKUP_RETAIN_DAYS" -print -delete || true
# Sweep any plaintext left by a run that died between dump and encryption.
find "$BACKUP_DIR" -name 'elpadel-*.dump' -type f -print -delete || true

log "Pruning remote dumps older than $BACKUP_RETAIN_DAYS days"
rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${BACKUP_RETAIN_DAYS}d" --include 'elpadel-*.dump.gpg' || \
  log "WARN: remote prune reported an error (non-fatal)"

log "Backup finished successfully"
