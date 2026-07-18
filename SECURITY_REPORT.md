# Production Security Audit And Hardening Report

Date: 2026-07-18

Verdict: READY WITH OPS.

The repository-side production blockers found in the audit have been addressed or reduced to explicit operational launch gates. Production launch still requires live-environment evidence: a fresh production database, successful backup and restore drill, real Resend/OAuth/domain configuration, production migration execution, monitoring/alerting, and a deployed HTTP/WebSocket smoke test.

## Standards Baseline

Verified current references on 2026-07-18:

- OWASP Top 10:2025: https://owasp.org/Top10/2025/
- OWASP ASVS latest stable 5.0.0: https://owasp.org/www-project-application-security-verification-standard/
- OWASP API Security Top 10 2023 stable: https://owasp.org/www-project-api-security/
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- NIST SSDF SP 800-218 v1.1: https://csrc.nist.gov/pubs/sp/800/218/final
- Express behind proxies: https://expressjs.com/en/guide/behind-proxies.html
- Socket.IO server options: https://socket.io/docs/v4/server-options/
- Socket.IO multiple nodes/adapters: https://socket.io/docs/v4/using-multiple-nodes/

## Pre-Change Map

Architecture:

- Frontend: Next.js 16 / React 19, standalone Node server.
- Backend: Express 4, Prisma 7.8, PostgreSQL 16, JWT session cookie auth, CSRF double-submit header/cookie guard, Resend email, Google OAuth, Socket.IO.
- Background work: PostgreSQL-backed transactional outbox plus standalone worker.
- Reverse proxy: host nginx with TLS, HSTS, auth endpoint rate limits, WebSocket upgrade forwarding.
- Data: single-tenant tournament system with users, clubs, events, registrations, brackets, schedule/courts, matches/scores, notifications, email deliveries, outbox, command receipts, audit records.

Trust boundaries:

- Browser to nginx: public internet, cookie-authenticated.
- nginx to frontend/backend: localhost-bound container ports.
- Backend/worker to PostgreSQL: internal compose network.
- Backend/worker to Resend and Google: external provider boundary.
- Socket.IO rooms: public event/match rooms plus authenticated user/admin/judge rooms.

Roles and authorization:

- `USER`: player/club member flows.
- `JUDGE`: assigned court/match scoring flows.
- `ADMIN`: broad admin operations with capability grants/denies for selected high-risk tournament actions.
- Capability DENY model existed, but several legacy/admin routes still relied on broad admin checks.

Sensitive data flows:

- Credentials: password hashes in PostgreSQL, session JWT in HttpOnly cookie, CSRF token in readable cookie and header.
- PII: email, phone, names, club membership, disqualification data.
- Secrets: JWT secret, database password, Resend key, Google OAuth client secret, bootstrap token.
- Tournament integrity data: match scores, schedule, brackets, command IDs, audit/outbox messages.

## Pre-Change Findings And Plan

Critical/high items selected for implementation in this pass:

- Rate-limit/audit IP spoofing via first `X-Forwarded-For` entry.
- OAuth login could reactivate inactive users and did not require Google `verified_email`.
- Login path leaked status before password verification and did not deny inactive password users before issuing a session.
- Production env accepted missing Resend config and local `.env` values could override real process env.
- Bootstrap token was accepted in request body and password minimum was 8 characters.
- Development email console fallback logged verification/invite body text containing secrets.
- Mock seed script had no hard runtime production guard.
- Socket.IO allowed unbounded subscription attempts, oversized messages, stale session authorization, and judge subscriptions outside current assignment windows.
- Match scoring/start/complete/correction used read-then-update optimistic checks without conditional database writes.
- Active court/judge match uniqueness depended only on application checks.
- Completed event rollback used ordinary status capability instead of explicit correction capability.
- Standalone worker could claim realtime outbox rows but had no Socket.IO server to emit them.
- Notification API returned internal bookkeeping fields.
- Login `next` accepted protocol-relative paths.
- Deployment docs/templates allowed stale production DB habits and lacked restore drill instructions.
- CI lacked tests and production build validation.

Completed in the readiness follow-up:

- Route-level broad `requireAdmin` use was replaced with explicit capabilities.
- New capability enum values and migration were added for dashboard, event, category, club, and user management.
- A CSP baseline was enforced on API and frontend responses.
- A non-mutating `npm run readiness:check` launch checker was added for VPS/operator validation.

## Implemented Hardening

Auth and session:

- Rate limiting and audit logs now use Express `request.ip`, matching the configured one-proxy trust model.
- Login performs a bcrypt comparison for unknown users using a dummy hash, validates the password before status-specific messages, and denies inactive users.
- Password creation paths now require at least 12 characters and at most 72 UTF-8 bytes.
- Bootstrap token is header-only via `x-bootstrap-token`, must be at least 32 characters when configured, and no longer accepts body tokens.
- Google OAuth requires `verified_email === true` and refuses inactive linked/existing users instead of reactivating them.
- Development email logging no longer prints verification codes or invite links.
- Production startup now fails closed when `RESEND_API_KEY` is missing.
- `.env` loading no longer overwrites already-provided process environment variables.

Realtime and background processing:

- Socket.IO `maxHttpBufferSize` reduced to 16 KiB.
- Subscription IDs are shape-validated.
- Per-socket subscription rate and room caps were added.
- Socket subscription authorization revalidates the session/version before joining protected rooms.
- Judge event/match subscriptions now require a current unrevoked court assignment unless explicitly assigned to the schedule item.
- Production outbox ownership split: API process emits realtime topics; worker processes email topics and expiry jobs.

Data integrity:

- Match start, score, decision completion, and correction now use conditional `updateMany` writes on `id`, `status`, and `version`.
- New migration adds partial unique indexes for one active match per court and one active match per assigned judge.
- Completed-event rollback requires `EVENT_STATE_CORRECT` in addition to valid transition logic.
- Notification API now serializes only frontend-needed fields.

Deployment and supply chain:

- Docker Compose Node services now use `init`, read-only filesystems, tmpfs `/tmp`, dropped Linux capabilities, no-new-privileges, PID limits, and memory limits.
- nginx overwrites `X-Forwarded-For` with `$remote_addr`, caps body size, and adds Permissions-Policy.
- Production templates now keep `RUN_OUTBOX_IN_API=true` and use fresh production DB naming.
- Deployment guide now documents brand-new production DB, no production seeds, header-only admin bootstrap, pre-migration backups, restore drills, and corrected Socket.IO/outbox topology.
- CI now runs lint, tests, build, and high npm audit threshold.
- Backend Vitest now excludes `dist/**` so tests run against source rather than stale compiled output.

## Residual Findings

Required launch operations:

- No evidence yet of a created fresh production database, migration execution, first-admin bootstrap, bootstrap token removal, or successful restore drill.
- No deployed-stack integration test evidence for CSRF, CORS, cookies, OAuth, Socket.IO, realtime outbox, or concurrent scoring.
- No production monitoring/alerting/log retention configuration is present in the repo.
- No MFA for destructive admin operations; add before scaling staff access or handling higher-risk data.
- In-process app rate limiting is still complemented by nginx endpoint limits; add Redis/edge/WAF limits before multi-node API scaling beyond the documented single-host topology.

Medium and tracked:

- `npm audit --audit-level=high` passes, but moderate advisories remain in `postcss` through Next and `@hono/node-server` through Prisma dev tooling. `npm audit fix --force` proposes breaking/downgrade paths and was not applied.
- GitHub Actions still uses tagged actions rather than pinned commit SHAs.
- Public event serialization may expose payment receiver/IBAN by design; confirm business intent before launch.
- Some admin create/delete/update flows still lack expected-version/idempotency semantics.
- CSP currently allows inline script/style for Next compatibility. Move to nonce/hash-based script policy when the app has a nonce propagation path.

## ASVS / OWASP Coverage Notes

Improved:

- ASVS authentication/session areas: stronger password boundaries, inactive account denial, session-version revalidation for sockets, no secret-bearing dev email logs.
- ASVS access control/API authorization: OAuth reactivation fixed, completed-event rollback capability gate, safer notification serialization.
- ASVS validation/resource management: Socket.IO payload/rate/room limits, safer redirect handling, CSP baseline, nginx body limits.
- ASVS configuration: production env fail-closed checks, process env precedence, Docker/nginx hardening.
- OWASP API Top 10: addressed broken function-level auth in one status path, unrestricted resource consumption in Socket.IO, security misconfiguration in proxy/env/deploy, and excessive data exposure in notifications.
- NIST SSDF: CI now runs tests/build/audit, deployment docs include backup/restore and seed controls.

Not fully satisfied without production operations:

- ASVS MFA/re-auth requirements for high-risk admin actions.
- ASVS comprehensive security logging/monitoring with retention and alerting.
- ASVS automated dynamic/integration security testing.
- ASVS nonce/hash-based script control.

## Validation

Commands run from `/Users/sn/ElPaddle `:

- `npm run lint`
  - Result: pass. Frontend ESLint passed; backend TypeScript `--noEmit` passed.
- `npm test`
  - Result: pass. Backend 9 files / 37 tests; frontend 2 files / 5 tests.
- `npm run build`
  - Result: pass. Backend Prisma generate and TypeScript build passed; frontend Next production build compiled and generated 33 app routes.
- `docker compose config --quiet`
  - Result: pass. Warnings only because local shell did not set production `.env` variables.
- `npm audit --audit-level=high`
  - Result: pass threshold. Reported 5 moderate vulnerabilities, no high/critical threshold failure.
- `gitleaks git . --redact --no-banner --exit-code 2`
  - Result: pass. 17 commits scanned, no leaks found.
- `npm run readiness:check`
  - Result: added for production use. Not run locally as a pass/fail launch signal because this workspace does not have the live production `.env`, running backend URL, first admin state, or backup evidence.

## Files Changed By This Hardening Pass

Primary code/config:

- `.env.example`
- `.github/workflows/ci.yml`
- `DEPLOY.md`
- `backend/prisma/seed.ts`
- `backend/prisma/migrations/20260718200000_active_schedule_uniqueness/migration.sql`
- `backend/prisma/migrations/20260718201000_admin_capability_coverage/migration.sql`
- `backend/src/common/audit.ts`
- `backend/src/common/email.ts`
- `backend/src/common/rateLimit.ts`
- `backend/src/common/security.ts`
- `backend/src/config/env.ts`
- `backend/src/index.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/events/events.routes.ts`
- `backend/src/modules/events/events.service.ts`
- `backend/src/modules/events/events.service.test.ts`
- `backend/src/modules/matches/matches.service.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/users/users.routes.ts`
- `backend/src/realtime/gateway.ts`
- `backend/src/worker.ts`
- `backend/src/workers/outbox.worker.ts`
- `backend/vitest.config.ts`
- `deploy/nginx.conf`
- `docker-compose.yml`
- `frontend/src/app/login/page.tsx`
- `frontend/src/components/auth/InviteForm.tsx`
- `frontend/src/components/auth/RegisterForm.tsx`
- `frontend/next.config.ts`
- `scripts/production-readiness-check.sh`

The repository had many pre-existing uncommitted and untracked changes before this pass. They were preserved.

## Final Verdict

READY WITH OPS.

The source, container, proxy, and runbook are ready for a controlled single-host production launch once the operator completes and records the launch operations: provision a new production DB, run migrations, bootstrap the first admin, remove bootstrap token, configure real email/OAuth/domains, run and record backup/restore, run `npm run readiness:check`, and test deployed HTTP/WebSocket flows end to end.
