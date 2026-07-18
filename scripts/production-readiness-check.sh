#!/usr/bin/env sh
set -eu

missing=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  missing=1
}

pass() {
  printf 'OK: %s\n' "$1"
}

require_var() {
  name="$1"
  value="$(eval "printf '%s' \"\${$name:-}\"")"
  if [ -z "$value" ]; then
    fail "$name is required"
  else
    pass "$name is set"
  fi
}

require_https_url() {
  name="$1"
  value="$(eval "printf '%s' \"\${$name:-}\"")"
  case "$value" in
    https://*) pass "$name uses https" ;;
    *) fail "$name must be an https:// URL" ;;
  esac
}

require_not_placeholder() {
  name="$1"
  value="$(eval "printf '%s' \"\${$name:-}\"")"
  case "$value" in
    *replace*|*changeme*|*change-me*|*example*|*password*)
      fail "$name appears to contain a placeholder"
      ;;
    *)
      pass "$name is not an obvious placeholder"
      ;;
  esac
}

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

for name in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL FRONTEND_URL BACKEND_URL NEXT_PUBLIC_API_URL JWT_SECRET ADMIN_EMAILS RESEND_API_KEY RESEND_FROM_EMAIL; do
  require_var "$name"
done

for name in FRONTEND_URL BACKEND_URL NEXT_PUBLIC_API_URL; do
  require_https_url "$name"
done

for name in POSTGRES_PASSWORD DATABASE_URL JWT_SECRET RESEND_API_KEY; do
  require_not_placeholder "$name"
done

if [ "${POSTGRES_DB:-}" = "elpadel" ]; then
  fail "POSTGRES_DB should be a fresh production-specific database name, not the generic development name"
else
  pass "POSTGRES_DB is production-specific"
fi

if [ -n "${FIRST_ADMIN_BOOTSTRAP_TOKEN:-}" ]; then
  printf 'WARN: FIRST_ADMIN_BOOTSTRAP_TOKEN is still set. This is allowed only before the first admin is created.\n' >&2
fi

if command -v docker >/dev/null 2>&1; then
  docker compose config --quiet
  pass "docker compose config parses"
else
  fail "docker command is not available"
fi

if command -v curl >/dev/null 2>&1 && [ -n "${BACKEND_URL:-}" ]; then
  if curl -fsS "${BACKEND_URL%/}/health" >/dev/null; then
    pass "backend health endpoint responds"
  else
    fail "backend health endpoint did not respond"
  fi
fi

if [ "$missing" -ne 0 ]; then
  printf '\nProduction readiness check failed.\n' >&2
  exit 1
fi

printf '\nProduction readiness check passed.\n'
