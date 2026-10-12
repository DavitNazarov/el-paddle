# Security

This is the current security posture of El Padel: what the system does, what is
deliberately accepted, and what is still open. It replaces the point-in-time
audit reports that used to sit at the repository root — those described the
system as it was in July 2026 and every finding in them has since been closed,
accepted, or is restated below. Git history holds them if the reasoning is ever
needed.

**Last reviewed:** 2026-08-13, against `develop` at v1.7.0.

The rules a change must not break live in [CLAUDE.md](../CLAUDE.md#security-requirements).
This document is the *state*; that one is the *contract*.

---

## Open items

Three things are genuinely outstanding. Nothing else on this page is a
to-do.

### 1. Open redirect via the login `next` parameter — **live**

`safeNextPath` in [frontend/src/app/login/page.tsx](../frontend/src/app/login/page.tsx)
guards with `!value?.startsWith('/') || value.startsWith('//')`. That blocks
`//evil.com` but not a backslash variant:

```text
/login?next=/\evil.com
```

Browsers normalize `\` → `/`, so `/\evil.com` becomes protocol-relative
`//evil.com`, and `router.push(destination)` in `LoginForm.tsx` navigates the
victim off-site after a successful login. Usable for phishing with a
credential-harvesting clone.

Severity is low — it needs the victim to follow a crafted link *and*
authenticate — but the fix is one line:

```js
if (!value || !/^\/[^/\\]/.test(value) || /[\x00-\x1f\\]/.test(value)) return '/dashboard';
```

Behaviour that must hold after the change: `/dashboard`, `/admin/events/123` and
`/ok?x=1` pass; `//evil.com`, `/\evil.com`, `https://evil.com` and control
characters all fall back to `/dashboard`.

### 2. `BACKUP_PASSPHRASE` is not set in production

[scripts/backup-offsite.sh](../scripts/backup-offsite.sh) refuses to run without
it rather than uploading a plaintext dump. Nothing invokes the script yet (it is
cron-only), so no backup is silently failing — but there is also **no offsite
backup at all**. See [DEPLOY.md](../DEPLOY.md) for the variable and the restore
procedure, and keep a copy of the passphrase somewhere that is not that server:
it is not recoverable, and a backup you cannot decrypt is not a backup.

### 3. Two high-severity dependency advisories

`npm run audit` currently exits non-zero on `js-yaml` (quadratic CPU in `!!omap`
resolution) and `nanoid` (custom generators can loop indefinitely at size zero).
Both are transitive build-tooling dependencies with fixes available, and neither
is reachable from request handling — but the audit gate stays red until they are
taken.

---

## What the system does

### Authentication and sessions

- Session cookies are HTTP-only JWTs pinned to `HS256`, so there is no `alg:none`
  bypass. Each token names a `Session` row, so signing out revokes that one
  device; the row is read inside the existing user lookup, costing no extra
  query per request.
- The token also carries the user's `sessionVersion`. A password change, a
  password reset, a verified email change, disqualification, judge deactivation,
  and an explicit "log out of all devices" bump it, invalidating every
  outstanding token at once.
- Passwords are bcrypt at cost 12, with a 12-character floor and a 72-byte cap.
  A dummy-hash comparison on unknown addresses prevents user enumeration and
  timing leaks.
- There is **no direct registration endpoint**. Accounts come into existence
  three ways only: an approved club application, an invitation, and the
  first-admin bootstrap. `ADMIN_EMAILS` elevation applies only after the address
  is verified.
- The bootstrap token is header-only and taken behind a PostgreSQL advisory
  lock. Production refuses to start when `FIRST_ADMIN_BOOTSTRAP_TOKEN` remains
  set after an admin exists.
- Authentication endpoints are rate limited per window (registration bursts,
  login and verify attempts, password changes).

### Authorization

- Every privileged operation checks a **specific capability**, not the `ADMIN`
  role. Per-user `UserCapabilityGrant` rows (ALLOW or DENY) override the role
  default.
- Organisers hold **no global capability**. Every power is checked against an
  `EventOrganiser` link by `requireEventCapability`, and the exact set is pinned
  by a test. They cannot create or edit events, review registrations, correct
  results, reopen events, or manage accounts, clubs, and club requests.
- Judges are scoped by an active, unrevoked, time-boxed court assignment.
- Public player endpoints use a database-level `select` (no email, phone, or
  status column is even fetched) as well as an allowlist serializer, and filter
  to `role: USER, status: ACTIVE`, so staff accounts answer 404 rather than
  surfacing. Resources a viewer may not see return `404`, not `403`.
- Notification queries are scoped by `recipientUserId` throughout.

### Request integrity

- Unsafe requests (POST/PATCH/DELETE) require a double-submit CSRF cookie plus a
  matching `x-csrf-token` header, compared with `crypto.timingSafeEqual`, and an
  allowed `Origin`.
- The JSON body parser rejects payloads above 100 KB.
- Tournament commands carry a client `commandId` (idempotency, via
  `CommandReceipt` payload hashes) and `expectedVersion` (optimistic
  concurrency). Hot paths add PostgreSQL advisory locks.
- No route spreads `req.body` into a Prisma write, so there is no mass
  assignment. Prisma is parameterized throughout; the only raw SQL is a
  test-only `TRUNCATE`.

### Data exposure

- DTO serializers are allow-listed, so raw Prisma records never leave the API.
  `serializeEvent` omits the bank IBAN and receiver name unless the call site
  opts in — anonymous reads never carry financial PII, while authenticated
  players still get the IBAN they need in order to pay.
- Public routes and realtime rooms only ever expose explicitly published data.
  The six publication switches are independent, and completed-match detail stays
  redacted until results are published.
- Realtime subscriptions re-validate the session version on subscribe, place
  subscribers in role-scoped rooms (`event-staff:<id>` full, `event:<id>`
  stripped to `{ eventId }`), and cap subscriptions, rate, rooms (40), and
  buffer size (16 KiB).
- Structured data is escaped before it reaches an inline `application/ld+json`
  block. `JSON.stringify` never escapes `<`, and the HTML parser ends a script
  block at the first literal `</script` regardless of JSON context, so club and
  player names — user input — were a stored-XSS sink. `jsonLdPayload` replaces
  every `<` with its unicode escape, which is valid JSON and parses identically;
  keep it in front of every such block.
- No secrets appear in `NEXT_PUBLIC_*`. Passwords, tokens, cookies, bootstrap
  secrets, and raw OAuth credentials are never logged.

### Accountability

- Privileged transitions write append-only `AuditLog` rows with actor,
  before/after state, and a public reason where players deserve one.
  Registrations and events keep dedicated status histories.
- Account deletion writes its `user.deleted` audit row inside the same
  transaction, before the delete. Cascades leave nothing else behind, so that
  row is the only surviving record — it carries a sha256 `emailHash` and never
  an email, name, or phone.
- Audit, notifications, email jobs, and realtime events commit in the same
  transaction as the domain change and are delivered by the outbox worker, so
  nothing is published for a transaction that rolled back.

---

## Accepted risks

Both were reviewed and deliberately left as they are.

**The CSRF token is not bound to the session.** It is a double-submit
cookie/header pair rather than an HMAC over the session id. With the strict
`Origin` allow-list and `SameSite=Lax` session cookies, practical CSRF risk is
low. Binding it to the session would be defence in depth, not a fix.

**Rate limiting is in-process.** `common/rateLimit.ts` is a fixed-window,
per-process, per-IP limiter with no per-account lockout, complemented by nginx
endpoint limits. That is adequate for the documented single-host topology, and
must be revisited — Redis, edge, or WAF limits plus per-account throttling —
before running multiple API replicas.

One deployment note belongs with that: every host is proxied through Cloudflare,
so nginx must restore the real client IP or the limiters bucket a whole
point-of-presence together and `AuditLog` records edge addresses instead of
actors. The live nginx configs are not in this repository; the check command is
in [ENVIRONMENTS.md](ENVIRONMENTS.md).

---

## Product decisions

These are settled. Do not re-litigate them as findings.

- **The player directory is public.** Players agree to it at registration; the
  disclosure is in Privacy §5 and Terms §7, and the legal versions were bumped
  so the consent actually covers it.
- **Both logout behaviours are wanted** — per-device sign-out *and* an explicit
  "log out everywhere".
- **Bank details are hidden from anonymous visitors** but remain available to
  authenticated players, who need the IBAN to pay the entry fee.

---

## Reviewing a change

`/security-review` covers the pending diff. For anything touching authentication,
capabilities, publication gating, or realtime rooms, the questions worth asking
are: is the check on the server rather than in the UI; does an unpublished
surface stay unreachable for an anonymous caller *and* for a signed-in
non-participant; does the write enqueue its audit and outbox work inside the same
transaction; and does a refusal answer `404` where `403` would confirm the
resource exists.
