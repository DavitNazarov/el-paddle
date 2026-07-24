# Full Codebase Review Report

**Project:** El Padel (`el-paddle` v1.2.9) — club & tournament management platform
**Review type:** Review-only, evidence-based, multi-perspective senior panel
**Date:** 2026-07-24
**Reviewer scope:** Entire repository (backend, frontend, database, DevOps, docs)

> This is a review-only pass. No source code, config, or dependencies were modified. Every finding cites a file and, where possible, a line number. Where confidence is limited, the finding is marked **Needs manual verification**.

---

## 1. Executive Summary

El Padel is a genuinely well-engineered codebase. It shows disciplined layering (routes vs. services), server-side authorization on every privileged mutation, optimistic concurrency with `version` columns, idempotent commands via `commandId` receipts, a transactional outbox for realtime/email, and honest privacy-aware serializers. Lint, type-check, tests (46 total), and the production build all pass cleanly. This is well above the median for a project of this size.

The issues below are refinements, not rescue work. The two that matter most before scale are a **per-request stats aggregation on the hot auth path** and a **dead opponent-request expiry worker**. The dependency audit failing CI is the most urgent operational item.

| Metric | Score | Notes |
|---|---|---|
| Overall risk level | **Medium** | No auth bypass / data-loss defects found. Risks are perf, scale, and one dead workflow. |
| Production readiness | **74 / 100** | Solid, but `npm audit` fails CI and a background workflow is inert. |
| Maintainability | **80 / 100** | Clean architecture; a few oversized files and dense one-liner JSX. |
| Security | **82 / 100** | Strong auth/CSRF/headers. Deducted for dependency CVEs and read-path writes. |
| Performance | **68 / 100** | Hot-path stats query + unbounded list queries + serial in-tx notifications. |
| Test confidence | **55 / 100** | Good unit coverage of pure logic; **no route/authorization/integration tests** despite `supertest` being installed. |

### Top 10 Most Important Findings

1. **[HIGH] Player stats recomputed with a match-aggregation query on every authenticated request** — `getCurrentUser` → `getPlayerStats` for every `USER` role call. `backend/src/modules/auth/auth.service.ts:268`.
2. **[HIGH] Opponent-request auto-expiry is dead code.** `OpponentRequest.expiresAt` is never written, so the worker's `expiresAt: { lte: now }` query never matches; pending requests never transition to `EXPIRED`. `backend/src/workers/outbox.worker.ts:97`.
3. **[HIGH] `npm audit --audit-level=high` fails (11 vulns, incl. high-severity Next.js advisories).** The CI pipeline's final step will fail on every run. `.github/workflows/ci.yml` + `frontend/package.json` (`next@16.2.7`).
4. **[HIGH] Dual source of truth for player stats.** Denormalized `User.wins/losses/matchesPlayed` (written in `matches.service.ts:147`) vs. snapshot-computed stats (`player-stats.ts`). The two can diverge and are shown in different places.
5. **[MEDIUM] `PATCH /api/events/:id` has no optimistic-concurrency check** while sibling event mutations do — lost-update window on concurrent admin edits. `backend/src/modules/events/events.routes.ts:153`.
6. **[MEDIUM] Unbounded list queries** (`listAdminRegistrations`, `listUsers`, `listPublicPlayers`, audit) return every row with no pagination — linear degradation at scale.
7. **[MEDIUM] Read path performs writes.** `GET`-triggered `getCurrentUser` issues `user.update` and `deleteMany` on role drift. `backend/src/modules/auth/auth.service.ts:248,264`.
8. **[MEDIUM] Dead 3D stack ships as a dependency.** `three` + `@types/three`, `PadelBall3D.tsx`, `SplineBallViewer.tsx`, `spline-viewer.d.ts`, and `public/models/haahaa.glb` are entirely unreferenced.
9. **[MEDIUM] Oversized files.** `PadelHomeStyles.tsx` (3,330 lines / 86 KB, one styled-jsx literal), `clubs.service.ts` (843), `auth.routes.ts` (768), `registrations.service.ts` (684), `AdminEventsClient.tsx` (670).
10. **[MEDIUM] Zero API/authorization integration tests.** `supertest` is a declared dev dependency but unused; the most security-critical surfaces (auth, capability gates, IDOR) have no automated coverage.

---

## 2. Commands Run

| Command | Result | Important output | Meaning |
|---|---|---|---|
| `npm run lint` (frontend eslint + backend `tsc --noEmit`) | **Passed** | No output | Type-safe; no lint violations. |
| `npm test` (backend vitest + frontend vitest) | **Passed** | Backend: 10 files / 41 tests. Frontend: 2 files / 5 tests. | Unit logic is green; coverage is narrow (pure functions only). |
| `npm run build` (backend `tsc` + `next build`) | **Passed** | All 40+ routes compiled; standalone output produced. | Production build is healthy. |
| `npm audit --audit-level=high` | **Failed (exit 1)** | 11 vulns (1 low, 3 moderate, 7 high): `next`, `fast-uri`, `brace-expansion`, `body-parser`, `shell-quote`→`concurrently`, `@hono/node-server`→`prisma`. | CI's audit step fails; see §8. |
| `git diff --check` | Skipped | — | Working tree has only doc edits (see git status). |
| `knip` / `depcheck` / bundle analyzer | **Skipped — not installed** | — | Dead-code detection done manually + with a custom export-usage scan (see §6). Recommend adding `knip` to devDeps and running `npx knip` for a maintained inventory. |

---

## 3. Project Inventory

- **Package manager / workspaces:** npm workspaces — root orchestrates `frontend` and `backend`. Single `package-lock.json` (424 KB). Node 22 in CI and Docker.
- **Backend:** Express 4 (ESM, `"type": "module"`), Prisma 7 + Postgres (`@prisma/adapter-pg`), Socket.IO 4, `zod` 4, `jsonwebtoken`, `bcryptjs`, `resend`. Feature-module layout under `backend/src/modules/*` with `.routes.ts` / `.service.ts` split; cross-cutting helpers in `backend/src/common/*`; transactional outbox worker in `backend/src/workers/`.
- **Frontend:** Next.js 16 (App Router, `output: standalone`), React 19, Tailwind 4, Radix UI primitives, `framer-motion`, `socket.io-client`, `three` (unused — see §6). Domain components under `frontend/src/components/*`, shared API client in `frontend/src/lib/api/`.
- **Database:** `backend/prisma/schema.prisma` (783 lines, ~30 models) is the source of truth; 22 immutable migrations. Rich indexing, unique constraints, `version` optimistic-lock columns, and a Postgres trigger for registration-player overlap.
- **Testing:** Vitest in both workspaces. Backend tests cover pure helpers (bracket sizing, judge queue, serializers, cookie-domain, legal, player-stats). No integration/route tests.
- **Build/deploy:** Multi-stage Dockerfiles (non-root, `read_only`, `cap_drop: ALL`, `no-new-privileges`), `docker-compose.yml` (postgres + backend + worker + frontend), Nginx reverse proxy, `vercel.json` for a Vercel frontend path. CI in `.github/workflows/ci.yml`.
- **Architecture:** event lifecycle `REGISTRATION_OPEN → CLOSED → ONGOING → COMPLETED` (reopen gated by `EVENT_STATE_CORRECT`); capability-based admin authorization; outbox → Socket.IO rooms + Resend email; four audiences (public, player, judge, admin).

---

## 4. Critical and High Severity Issues

### H-1 — Player stats aggregation runs on every authenticated request
- **Severity:** High · **Category:** Performance · **Confidence:** High
- **File:** `backend/src/modules/auth/auth.service.ts:268-271` (inside `getCurrentUser`, called by `requireUser`)
- **Evidence:**
  ```ts
  const publicUser = toPublicUser(current);
  if (publicUser.role === UserRole.USER) {
    const stats = await getPlayerStats([publicUser.id]);   // match.findMany + snapshot join
    publicUser.stats = stats.get(publicUser.id) ?? { matchesPlayed: 0, wins: 0, losses: 0 };
  }
  ```
  `getPlayerStats` (`player-stats.ts:43`) issues a `match.findMany` with a nested `snapshots` filter. `getCurrentUser` is invoked by **every** `requireUser`/optional-auth handler.
- **Problem:** Each authenticated player request pays for a match/snapshot aggregation, even for endpoints that don't display stats (dashboard load, registration, notifications, opponent requests, judge actions).
- **Why it matters:** As match history grows, p95 latency on the entire authenticated surface degrades linearly, and DB load scales with request volume × history size.
- **Fix:** The denormalized `User.wins/losses/matchesPlayed` already exist and are maintained transactionally (`matches.service.ts:147`). Return those from `toPublicUser` and drop the per-request recompute; expose the snapshot-computed stats only on the dedicated public player/profile endpoints that actually need point-in-time accuracy. This also resolves H-4.
- **Effort:** Small (½ day). **Risk:** Low.

### H-2 — Opponent-request expiry worker is inert (`expiresAt` never set)
- **Severity:** High (business-flow) · **Category:** Correctness / dead workflow · **Confidence:** High
- **Files:** `backend/src/workers/outbox.worker.ts:97`; `backend/src/modules/opponent-requests/opponent-requests.service.ts:193` (create); schema `OpponentRequest.expiresAt DateTime?` at `schema.prisma:499`
- **Evidence:** The expiry query filters `where: { status: PENDING_RESPONSE, expiresAt: { lte: new Date() } }`, but no code path ever assigns `expiresAt` — `createOpponentRequest` and `updateOpponentRequest` omit it, so the column is always `NULL`. In SQL, `NULL <= now()` is never true, so the worker selects nothing.
- **Problem:** Pending opponent requests are never auto-transitioned to `EXPIRED`; the `OPPONENT_REQUEST_EXPIRED` notification never fires. The per-category `opponentRequestDeadline` is only *soft*-enforced by `requireOpenWindow` (it blocks *new* actions after the deadline) but leaves stale `PENDING_RESPONSE` rows indefinitely.
- **Why it matters:** Players see requests that look actionable but can't be acted on; admins may generate brackets believing requests will lapse. It's an entire subsystem (`expireOpponentRequests`, the notification type, the index `@@index([status, expiresAt, id])`) that does nothing.
- **Fix:** Set `expiresAt` at creation from the category's `opponentRequestDeadline` (or a fixed TTL), e.g. `expiresAt: link.opponentRequestDeadline ?? addDays(...)`. Also set it in `updateOpponentRequest` if the target changes. Add a test that creates a request with a past deadline and asserts the worker expires it.
- **Effort:** Small. **Risk:** Low.

### H-3 — CI dependency audit fails; high-severity Next.js advisories present
- **Severity:** High · **Category:** Security / DevOps · **Confidence:** High
- **Files:** `.github/workflows/ci.yml` (final `npm audit --audit-level=high` step); `frontend/package.json` (`next: 16.2.7`)
- **Evidence:** `npm audit --audit-level=high` exits `1` with 11 vulnerabilities. Runtime-relevant ones: **`next` ≤ 16.3.0-preview** (multiple high advisories incl. SSRF in Server Actions/rewrites, cache confusion, image-optimization DoS), `body-parser` (DoS via silently-disabled limit), `brace-expansion`/`fast-uri` (high). Dev-only: `shell-quote`→`concurrently`, `@hono/node-server`→`prisma`/`@prisma/dev`.
- **Problem:** The pipeline's last step fails on every push/PR, so either CI is red or the step is being ignored — both are bad signals. The `next` advisories affect the deployed app.
- **Why it matters:** SSRF/DoS in the framework that terminates public traffic is a real exposure; a permanently-red audit trains the team to ignore audit output.
- **Fix:** Bump `next` to a patched 16.2.x/16.3.x (`npm audit fix` proposes `next@16.2.11`; verify against the App Router build). Update `body-parser` via Express transitive bump. For dev-only chains (`concurrently`, `@prisma/dev`), accept or pin, and consider running the CI audit with `--omit=dev` or an allowlist so production-relevant vulns are the ones that gate. Document the policy.
- **Effort:** Small–Medium (validate Next.js upgrade). **Risk:** Medium (framework bump).

### H-4 — Two sources of truth for player win/loss stats
- **Severity:** High (data consistency) · **Category:** Correctness / duplicated business rule · **Confidence:** High
- **Files:** `backend/src/modules/matches/matches.service.ts:147-148` (denormalized increments) & `:261-262` (correction adjustments) vs. `backend/src/modules/users/player-stats.ts` (snapshot-derived); consumed inconsistently in `auth.service.ts:118` (`toPublicUser` uses denormalized) and `auth.service.ts:269` (self uses computed).
- **Evidence:** `completeMatch` increments `User.matchesPlayed/wins/losses`. `getPlayerStats` independently derives the same numbers from `MatchParticipantSnapshot` + `winnerEntryId`. `toPublicUser` returns the **denormalized** counts, but `getCurrentUser` overrides the **current** user with the **computed** ones — so a player's own header can disagree with how they appear in a registration list rendered from `serializeRegistration` → `toPublicUser`.
- **Problem:** Any drift between the two mechanisms (a missed increment, a correction that updates one but not the other, BYE handling differences) surfaces as inconsistent numbers depending on the screen.
- **Why it matters:** Stats are user-visible and trust-sensitive; two independent code paths computing "the same" number is a classic divergence bug.
- **Fix:** Pick one. Recommended: keep the transactionally-maintained denormalized counters as the single source, delete the per-request recompute (see H-1), and reserve `getPlayerStats` for an admin "recount/repair" utility. If snapshots must be authoritative, remove the `User` counters entirely.
- **Effort:** Small–Medium. **Risk:** Low–Medium.

---

## 5. Medium and Low Severity Issues

### M-1 — `PATCH /api/events/:id` lacks optimistic concurrency
- **Severity:** Medium · **File:** `backend/src/modules/events/events.routes.ts:153-179`, `events.service.ts:213 updateEvent`
- **Evidence:** Sibling mutations (`/status`, `/tournament-publication`) require `expectedVersion` and `commandId`; the core event edit does not. `updateEvent` reads then writes without a `version` guard.
- **Why it matters:** Two admins editing the same event concurrently produce a silent last-writer-wins overwrite. Consistency is otherwise a stated invariant ("registration, bracket, match, schedule, and request writes use optimistic version checks").
- **Fix:** Accept `expectedVersion`, add `version: { increment: 1 }`, and guard the update with `updateMany({ where: { id, version } })` like the others.

### M-2 — Unbounded list endpoints (no pagination)
- **Severity:** Medium · **Category:** Performance / scale
- **Files:** `registrations.service.ts:267 listAdminRegistrations`, `users.service.ts:63 listUsers` / `:71 listPublicPlayers`, `operations.routes.ts` audit (capped at 250 — OK), `clubs.service.ts listAdminClubs`.
- **Evidence:** `listAdminRegistrations` returns every registration for the event (or globally) with full `registrationInclude`. `listPublicPlayers` loads all active players *and* computes stats for all of them.
- **Why it matters:** Response size and DB cost grow unbounded; the public `/api/public/players` page is the worst because it fans out a stats query over every player.
- **Fix:** Add cursor/limit pagination and server-side filtering; cap `take` (the codebase already has the pattern in `listMatchHistory` and notifications). Batch the players stats query (it already accepts an array — good — but still returns all players).

### M-3 — Read path performs database writes
- **Severity:** Medium · **Category:** Side effects / correctness
- **File:** `backend/src/modules/auth/auth.service.ts:242-265` (`getCurrentUser`)
- **Evidence:** On role drift, a `GET`-triggered call runs `prisma.user.update(...)` and, for new admins, `removeAdminAthleteLinks` which `deleteMany`s registrations and club memberships.
- **Why it matters:** Mutations on read handlers are surprising, complicate caching, and mean a `GET /api/auth/me` can delete tournament registrations as a side effect. It also runs inside otherwise read-only request flows.
- **Fix:** Move role reconciliation to explicit events (login, verify, invite-complete, an admin action) rather than every session read. At minimum, gate the destructive `removeAdminAthleteLinks` behind an explicit promotion path, not `me`.

### M-4 — Serial `await` notification loops inside transactions
- **Severity:** Medium · **Category:** Performance / transaction duration
- **Files:** `matches.service.ts:96,152`, `brackets.service.ts:198`, `registrations.service.ts:639`, `events.service.ts:126`, `opponent-requests.service.ts:288`, `scheduling.service.ts:90`
- **Evidence:** Patterns like `for (const entry of [...]) for (const user of [...]) await queueNotification(tx, ...)` execute dependent `upsert`s sequentially while holding the transaction open. `bracket.publish` loops over *all* approved entries.
- **Why it matters:** Long-held transactions increase lock contention and connection-pool pressure, especially on bracket publish and event-status changes that notify everyone.
- **Fix:** Batch notification/outbox inserts (`createMany` with `skipDuplicates`) or move fan-out notification generation out of the critical transaction into an outbox-driven step. Keep the state change + one outbox row in the transaction; expand recipients in the worker.

### M-5 — Dead 3D dependency stack
- **Severity:** Medium · **Category:** Unused dependency / bundle & repo weight · **Confidence:** High
- **Evidence:** `three` and `@types/three` are declared in `frontend/package.json`, but `import ... from 'three'` appears only in `PadelBall3D.tsx`, which is never rendered (0 external references). `SplineBallViewer.tsx`, `types/spline-viewer.d.ts`, and `public/models/haahaa.glb` (110 KB) are likewise unreferenced.
- **Fix:** Remove the two components, the type decl, the `.glb`, and the `three` / `@types/three` dependencies. Verify with `npx knip` first.

### M-6 — Duplicate API barrel modules
- **Severity:** Low · **File:** `frontend/src/lib/api.ts` and `frontend/src/lib/api/index.ts`
- **Evidence:** Both re-export the identical seven symbols from `./client`. Imports across the app use `@/lib/api` (resolving to `api.ts`), leaving `api/index.ts` redundant (or vice-versa).
- **Fix:** Keep one barrel. Standardize imports on `@/lib/api`.

### M-7 — Truly-dead exports (confirmed)
- **Severity:** Low · **Category:** Dead code · **Confidence:** High (0 references outside the defining file)
- `backend/src/modules/auth/auth.service.ts:282` `requireAdmin`
- `backend/src/workers/outbox.worker.ts:118` `stopOutboxWorker`
- `backend/src/common/notifications.ts:78` `sendRegistrationStatusEmail`
- `backend/src/common/security.ts:32` `addHours`
- `frontend/src/components/shared/dashboard/DashboardUI.tsx` `StatCard`, `PremiumButton`, `mobileTabTriggerClassName`, `sidebarTabTriggerClassName`
- **Fix:** Delete, or (for `requireAdmin`/`stopOutboxWorker`) confirm they aren't a deliberate public API before removing. See §6 for the caveat on false positives.

### M-8 — `event.status` fan-out notification uses a misleading type
- **Severity:** Low · **Category:** Correctness/clarity · **File:** `events.service.ts:127`
- **Evidence:** Event-status change notifications are queued with `type: NotificationType.MATCH_SCHEDULED` (there is no event-status notification type). The title/message are correct, but the semantic type is wrong, which will mislead any future per-type filtering/rendering.
- **Fix:** Add a dedicated `EVENT_STATUS_CHANGED` notification type (enum + migration) and use it.

### L-1 — Home page styling is one 86 KB inline literal
See §12 (split plan). Low functional risk, high maintenance cost.

### L-2 — Dense single-line JSX components
- `JudgeQueueClient.tsx:27`, `NotificationsClient.tsx:21-25`, and several tournament clients pack entire component trees onto one line. Type-safe but hostile to diffs/review. Reformat.

### L-3 — `frontend/src/lib/api.ts` vs `client.ts` `resolveApiBaseUrl` duplicated in `next.config.ts`
- The API-base normalization logic exists in both `frontend/src/lib/api/client.ts` and `frontend/next.config.ts` (`resolvePublicApiUrl`). Acceptable (different runtimes) but note the duplication if the rule changes.

---

## 6. Dead Code and Unused Code

**Method:** manual review plus a custom scan matching each exported symbol against references outside its defining file. **Caveat:** the scan flags symbols used only *within* their own module as "unused" (false positives). These were manually cleared: `createSessionToken`, `SESSION_MAX_AGE_SECONDS`, `databaseUnavailableMessage`, `clientKey`, `CSRF_COOKIE`, `bracketInclude`, `matchInclude`, `opponentRequestInclude`, `scheduleInclude`, `serializeEntrySummary`, `getUserWithClub`, `authEntryHref`, and the home-section components (loaded via `next/dynamic` string imports in `lazy-sections.ts`) are all **in use**.

### Confirmed dead (Confidence: High)
| Kind | Location | Symbol |
|---|---|---|
| Function | `backend/src/modules/auth/auth.service.ts:282` | `requireAdmin` |
| Function | `backend/src/workers/outbox.worker.ts:118` | `stopOutboxWorker` |
| Function | `backend/src/common/notifications.ts:78` | `sendRegistrationStatusEmail` |
| Function | `backend/src/common/security.ts:32` | `addHours` |
| Component | `frontend/src/components/padel/PadelBall3D.tsx` | `PadelBall3D` (+ `three` dep) |
| Component | `frontend/src/components/padel/SplineBallViewer.tsx` | `SplineBallViewer` |
| Type decl | `frontend/src/types/spline-viewer.d.ts` | (unused) |
| Asset | `frontend/public/models/haahaa.glb` | 110 KB, unreferenced |
| Exports | `frontend/src/components/shared/dashboard/DashboardUI.tsx` | `StatCard`, `PremiumButton`, `mobileTabTriggerClassName`, `sidebarTabTriggerClassName` |
| Module | `frontend/src/lib/api/index.ts` **or** `frontend/src/lib/api.ts` | duplicate barrel |

### Dependencies
- **Unused:** `three`, `@types/three` (only consumer is dead `PadelBall3D`). **Confidence: High.**
- **Declared but unused in code:** `supertest`, `@types/supertest` are in `backend/package.json` devDeps but no test imports them (Confidence: High) — either wire up integration tests (recommended, see §14) or remove.

### Needs manual verification
- Type-only exports flagged by the scan (`BadgeProps`, `InputProps`, `TextareaProps`, `SavedTeammate`, `LegalDocument`, `EntrySummary`, `UserClub`, `BusyKey`, `UserStatusFilter`, `EventWithCategoryLinks`, `ClubFull`, `PlayerStats`, `UserClubSummary`). Several are convenience/public types; confirm with `npx knip` before deletion.

### Routes / migrations / generated
- No dead API routes found — all routers are mounted in `routes.ts` and exercised by the frontend. **Do not** treat public `/api/public/*` routes as dead. Prisma migrations and `backend/src/generated/*` are correctly gitignored/excluded and were not analyzed as source.

---

## 7. API and Backend Findings

**Strengths (evidence-backed):** every privileged mutation calls `requireCapability`/`requireUser`/judge-assignment checks; CSRF is enforced globally with double-submit + timing-safe compare + origin allowlist (`csrf.ts:38`); errors are centralized and production-redacted (`http.ts:71`); idempotency via `commandId` receipts with payload-hash mismatch detection (`commands.ts`); param IDs validated and length-bounded (`http.ts:87`); JSON body capped at 100 KB (`index.ts:35`).

**Findings:**
- **Missing optimistic lock on `PATCH /api/events/:id`** — M-1.
- **Inconsistent input validation stack.** `zod` is a declared dependency but the codebase validates by hand (`cleanString`, `isValidEmail`, ad-hoc `Number()` coercion). This is *consistent internally* and works, but request bodies aren't schema-validated, so unexpected fields pass silently and numeric coercions like `Number(request.body.expectedVersion)` yield `NaN` that is only caught deeper in the service. Consider adopting `zod` at the route boundary (it's already installed) for uniform 400s. **Category: consistency.**
- **`event.status` notification type mismatch** — M-8.
- **Long transactions from serial notification fan-out** — M-4.
- **Response shapes are consistent** (`{ event }`, `{ registration }`, `{ error }`) — good. `serialize*` helpers keep DTOs centralized and prevent Prisma-shape leakage. Public serializers correctly drop PII (`serializePublicRegistrationTeam`, `serializePublicClub`).
- **HTTP status codes are deliberate and correct** (401 vs 403 vs 404 vs 409 used meaningfully; 409 for version conflicts).

---

## 8. Security Findings

Overall the security posture is strong and clearly deliberate (there is even a `SECURITY_REPORT.md`). No auth bypass, IDOR, injection, or secret-leak was found in application code.

| ID | Severity | Finding |
|---|---|---|
| SEC-1 | **High** | **Dependency vulnerabilities** (H-3): `next@16.2.7` high-severity SSRF/DoS advisories; `body-parser`, `fast-uri`, `brace-expansion`. Runtime-facing. |
| SEC-2 | Medium | **Read-path writes** (M-3): a `GET` can delete registrations via role reconciliation — an availability/integrity foot-gun more than an attacker vector. |
| SEC-3 | Low | **In-memory rate limiting** (`rateLimit.ts:12`, `gateway.ts`) is per-process. On multi-replica deploys limits multiply by replica count. Correctly documented as single-instance; note before horizontal scaling. Move to Redis when scaling. |
| SEC-4 | Low | **Login user-enumeration hardening is good** (dummy bcrypt compare at `auth.routes.ts:336`), but timing still differs slightly because the dummy-hash branch skips the club `include`. Negligible; noted for completeness. |
| SEC-5 | Info | **Bootstrap safety is excellent:** advisory-lock-guarded, rate-limited, timing-safe token compare, and a startup assertion that refuses to run in production if `FIRST_ADMIN_BOOTSTRAP_TOKEN` remains after an admin exists (`index.ts:42`). |

**Positive controls verified:** strong `JWT_SECRET` validation with placeholder rejection (`env.ts:46`); HTTPS-only URLs enforced in production; strict CSP/HSTS/frame headers on both API (`securityHeaders.ts`) and Next.js (`next.config.ts`); session invalidation via `sessionVersion` bump on logout/disqualify/deactivate; OAuth `state` CSRF with timing-safe compare and `verified_email` requirement; audit logging on privileged actions with `ip`/actor/before-after; no secrets logged; cookies `httpOnly`+`secure`(prod)+`sameSite=lax`; Socket.IO authorization re-checked per subscription with room caps and per-socket rate buckets (`gateway.ts`).

**Copyright/PII:** public routes and realtime rooms correctly exclude unpublished data and contact details.

---

## 9. Database and Data Integrity Findings

**Strengths:** comprehensive indexing (composite indexes aligned to query patterns), unique constraints enforcing domain invariants (`@@unique([eventId, clubId])`, `@@unique([eventId, ownerId/teammateId])`, `@@unique([courtId, queuePosition])`, `@@unique([matchId, side])`), `version` optimistic-lock columns, deliberate `onDelete` policies (`Restrict` on bracket/match participant FKs to protect history; `Cascade` on ownership; `SetNull` on soft references), a DB-level registration-overlap trigger, and dedup keys on outbox/notification/email/command tables.

**Findings:**
- **DB-1 [Medium] — `CommandReceipt` / expired-token growth.** `CommandReceipt` rows carry `expiresAt` (30-day TTL, `commands.ts:saveCommandReceipt`) and there's `@@index([expiresAt])`, but **no job deletes expired receipts** (grep found no `commandReceipt.deleteMany`). Likewise `EmailVerificationCode` and used `InviteToken` rows are never purged. These tables grow monotonically. **Fix:** add a periodic cleanup (extend the worker) deleting `expiresAt < now()` receipts and consumed/expired codes/tokens.
- **DB-2 [Medium] — Dead `OpponentRequest.expiresAt` + its index** (see H-2). The `@@index([status, expiresAt, id])` supports a query that never returns rows.
- **DB-3 [Low] — `EventRegistration.onDelete: Cascade` from `User`.** Deleting a user hard-deletes their registrations (migration `20260707140000_init:204`). `deleteUserAccount` guards the last admin but a normal player delete cascades registrations; combined with `Match.participant* onDelete: Restrict`, deleting a user who is a *locked-bracket participant* will fail at the DB (Restrict) — good — but the interaction isn't covered by a test. Verify the intended behavior for "delete player mid-tournament."
- **DB-4 [Low] — `reorderSchedule` two-pass reindex** (`scheduling.service.ts:100`) bumps every position by +1000 then renumbers; correct given the unique constraint, but O(2N) writes per reorder. Fine at court scale; note if courts ever hold large queues.

No SQL/ORM injection risk found — all queries are parameterized; the few `$executeRaw` advisory-lock calls use tagged-template parameterization (`registrations.service.ts:129`).

---

## 10. Frontend Findings

**Strengths:** clean App-Router structure; server components fetch with `cookies()` forwarding; a single `apiFetch` client centralizes CSRF + credentials; realtime is debounced (`useTournamentRealtime` 120 ms); `useCallback`/`useMemo` used to keep effect deps stable; loading/error/empty states are present (`InlineNotice`, `EmptyTournamentState`); Radix primitives give accessible dialogs/tabs; home sections are code-split via `next/dynamic` (`lazy-sections.ts`).

**Findings:**
- **FE-1 [Medium] — Oversized components.** `PadelHomeStyles.tsx` (3,330 lines), `AdminEventsClient.tsx` (670, 13 `useState/useEffect`), `PlayerClubClient.tsx` (653), `DashboardUI.tsx` (565), `AdminUsersClient.tsx` (535), `AdminBracketClient.tsx` (533). See split plans in §12.
- **FE-2 [Low] — `useTournamentRealtime` reconnects on every `onChange` identity change.** The effect deps include `input.onChange`; callers pass a `useCallback`'d `load`, so it's stable *if* its own deps are stable (they are, in the clients checked). Fragile pattern — a future caller passing an inline function will open/close a socket on every render. Consider stashing `onChange` in a ref inside the hook.
- **FE-3 [Low] — Public players page fan-out.** `/players` → `listPublicPlayers` computes stats for all players (server side, M-2); the client renders them all with no virtualization/pagination.
- **FE-4 [Low] — Dense one-line JSX** hurts readability/reviewability (L-2).
- **FE-5 [Info] — Accessibility is generally good** (visible focus rings, 44px targets, icon+text pairing per CLAUDE.md standards). No systemic a11y defect found in the components reviewed; a full audit (axe) is recommended but out of scope here.

---

## 11. Performance Findings

**Backend**
- **P-1 [High]** Per-request stats aggregation (H-1) — the single biggest backend hot-path cost.
- **P-2 [Medium]** Unbounded list queries (M-2) — linear growth on admin/public lists.
- **P-3 [Medium]** Serial in-transaction notification fan-out (M-4) — long transactions on publish/status changes.
- **P-4 [Low]** `roleForEmail` rebuilds the admin-email `Set` from `String.split` on every call, and `toPublicUser` calls it repeatedly per serialized record. Micro-cost; memoize the parsed set once at startup.
- **P-5 [Info]** Outbox worker polls every 2 s (idle) / 250 ms (busy) — reasonable. `compression` threshold 1 KB is sensible.

**Frontend**
- **P-6 [Medium]** Dead `three` import risks pulling a large library into the graph if ever referenced; removing it (M-5) also removes a heavy transitive footprint from `node_modules`.
- **P-7 [Low]** `PublicTournamentClient.load` fires four parallel fetches on every realtime tick (debounced) — acceptable, but a combined endpoint would cut round-trips.

**Build/runtime**
- Multi-stage Docker images are lean (standalone Next.js, prod-only deps). Healthchecks present. No blocking issues.

---

## 12. Large Files and Split Plan

### `frontend/src/components/padel/home/PadelHomeStyles.tsx` (3,330 lines / 86 KB)
- **Problem:** A single `styled-jsx global` template literal holding the entire marketing-site CSS. One giant unit mixing layout, typography, animation, responsive, and component-specific rules. Impossible to diff meaningfully; ships all CSS whenever the home page loads.
- **Risk:** Low (presentational) but high maintenance cost.
- **Recommended split (CSS Modules or co-located files):**
  - `home/styles/base.css` — tokens, typography (`.font-display`, `.font-script`), page canvas
  - `home/styles/hero.css`, `home/styles/competition.css`, `home/styles/prize.css`, etc. — per section, co-located with each `*Section.tsx`
  - `home/styles/animations.css` — keyframes + `prefers-reduced-motion`
  - `home/styles/responsive.css` — shared breakpoints
  - **Strategy:** move rules incrementally, one section at a time, verifying at 375 px and desktop after each move (no behavior change).

### `backend/src/modules/clubs/clubs.service.ts` (843 lines)
- **Problem:** Handles club CRUD, slug generation, membership role transitions, join-request workflow, leader transfer, and notifications in one module.
- **Recommended split:** `clubs.service.ts` (club CRUD + slug), `club-membership.service.ts` (setPlayerClub, role/title, leader rules), `club-join-requests.service.ts` (request lifecycle + notifications). Share a `clubInclude`.

### `backend/src/modules/auth/auth.routes.ts` (768 lines)
- **Problem:** password auth, email verification, invite completion, account-club setup, teammate invite, **and** full Google OAuth flow in one router.
- **Recommended split:** `auth.password.routes.ts`, `auth.oauth.routes.ts` (Google), `auth.invite.routes.ts`, `account.club.routes.ts`; keep shared helpers in `auth.service.ts`.

### `backend/src/modules/registrations/registrations.service.ts` (684 lines)
- **Problem:** `createRegistration` alone is ~200 lines doing eligibility, club rules, teammate provisioning, advisory locking, and invite creation.
- **Recommended split:** extract `assertRegistrationEligibility`, `resolveTeammate` (existing/invite/create), and `registration-status.service.ts` (transitions + roster publication). Keep the transaction orchestration thin.

### `frontend/src/components/admin/AdminEventsClient.tsx` (670 lines, 13 hooks)
- **Problem:** data fetch + form state + create/edit modal + publish toggles + filtering + rendering in one component.
- **Recommended split:** `useAdminEvents.ts` (fetch + mutations), `EventForm.tsx` (create/edit modal), `EventListItem.tsx`, `eventForm.schema.ts` (validation), `AdminEventsClient.tsx` (composition only). Mirror the existing `usePlayerDashboard` pattern.

---

## 13. Clean Code Rule Violations

- **Naming:** Generally strong, domain-specific naming. Minor: the home helpers use terse names (`chrome.tsx`, `effects.tsx`, `motion.tsx`, `scroll.tsx`) that don't say what they contain. `data`/`item` appear only in appropriately generic contexts.
- **Functions:** A few do more than one thing — `getCurrentUser` (read + role reconcile + destructive cleanup + stats), `createRegistration` (validate + provision + lock + create + notify). Extract per §12.
- **Comments:** Comments are intent-focused and useful (e.g., cookie-domain rationale in `next.config.ts`, advisory-lock ordering notes in `registrations.service.ts`). No commented-out dead code found. Good.
- **Structure:** Route/service separation is consistently honored. Shared includes/serializers avoid Prisma-shape duplication. The one structural smell is styling monoliths (§12).
- **Objects/modules:** No god classes. `common/*` is well-scoped, not a dumping ground. No circular-dependency errors (build passes with project references).
- **Tests:** Fast, independent, deterministic — but only cover pure functions (§14).
- **Code smells:** Primary ones are **duplicated business rule** (stats, H-4), **dead abstraction** (opponent-request expiry, H-2; dead 3D stack, M-5), and **long transactions** (M-4). Little rigidity/fragility elsewhere.

---

## 14. Testing Gaps

Current: 46 tests, all unit-level over pure helpers (bracket sizing, judge queue ordering, serializers, cookie-domain, legal, player-stats, email). **No route, authorization, or integration tests**, despite `supertest` being installed.

### Must-have before production
1. **Authorization matrix** — for each admin route, assert 401 (anon), 403 (wrong capability/role), 200 (granted). Especially capability gates in `events`, `registrations`, `users`, `operations`, `matches` (`MATCH_RESULT_ADMIN`/`MATCH_RESULT_CORRECT`).
2. **IDOR / ownership** — a player cannot read/mutate another club's registration (`replaceRegistrationPlayer`), another player's opponent request, or a match they aren't a participant in (`getMatchDetail` redaction).
3. **CSRF guard** — unsafe method without token → 403; with valid double-submit → passes; cross-origin `Origin` → 403.
4. **Optimistic concurrency** — stale `expectedVersion` → 409 on event status, registration status, bracket lock, match score.
5. **Command idempotency** — same `commandId` replays the receipt; reused `commandId` with different payload → 409.
6. **Event lifecycle invariants** — illegal transitions rejected; reopen requires `EVENT_STATE_CORRECT`; can't complete with unfinished matches.

### Should-have soon
7. **Opponent-request expiry** (would have caught H-2): create with past deadline → worker sets `EXPIRED` + notifies.
8. **Bracket generation/lock** with byes (2/4/8/16 entries) and pairing-request application.
9. **Registration overlap** — one team per club per event; player in only one category; DB trigger path.
10. **Match correction** guard — cannot correct when a downstream match has started (`matches.service.ts:253`).

### Nice-to-have
11. Realtime authorization (`canSubscribeToEvent`/`canSubscribeToMatch`) unit tests.
12. Frontend component tests for the admin forms once split (§12).

Wire these with the already-present `supertest` against an Express app instance and a test Postgres (or Prisma test schema).

---

## 15. Refactoring Roadmap

### Phase 1 — Safe quick wins (low risk)
- Delete confirmed dead code (M-7) and the dead 3D stack + `three`/`@types/three` (M-5) after a `knip` pass.
- Remove the duplicate API barrel (M-6).
- Add `EVENT_STATUS_CHANGED` notification type (M-8).
- Add expired-`CommandReceipt` / used-token cleanup to the worker (DB-1).

### Phase 2 — Important cleanup (medium)
- Fix H-2 (set `expiresAt`, add test).
- Fix H-1 + H-4 together (single stats source; drop per-request recompute).
- Add optimistic lock to `PATCH /api/events/:id` (M-1).
- Add the "must-have" authorization/IDOR/CSRF test suite (§14) — highest ROI.
- Resolve the dependency audit (H-3): upgrade Next.js, decide CI audit policy.

### Phase 3 — Architecture improvements (planned)
- Move notification fan-out out of critical transactions to outbox-driven expansion (M-4).
- Add pagination + server-side filtering to admin/public lists (M-2).
- Split the large modules/components per §12.
- Move role reconciliation off the read path (M-3).

### Phase 4 — Optional polish
- Adopt `zod` at route boundaries for uniform validation.
- Redis-backed rate limiting + Socket.IO adapter before horizontal scale (SEC-3).
- Reformat dense one-line JSX (L-2); extract home CSS monolith (L-1).

---

## 16. Production Checklist

- [ ] **Resolve `npm audit` high-severity items** (upgrade `next`, `body-parser`); make CI's audit step green or scoped to `--omit=dev` (H-3).
- [ ] **Fix opponent-request expiry** or explicitly remove the subsystem (H-2).
- [ ] **Add the authorization/IDOR/CSRF integration test suite** (§14) — currently the biggest confidence gap.
- [ ] **Add optimistic lock to event edit** (M-1).
- [ ] **Add a data-retention/cleanup job** for command receipts, verification codes, and used invite tokens (DB-1).
- [ ] Confirm `FIRST_ADMIN_BOOTSTRAP_TOKEN` is removed post-bootstrap (startup assertion already enforces this — verify in the deploy runbook).
- [ ] Verify `worker` and `backend` both run in production (email vs realtime outbox split); confirm `RUN_OUTBOX_IN_API=true`.
- [ ] Load-test the authenticated dashboard path before/after the H-1 fix.
- [ ] Verify `.env` (untracked) has a real `JWT_SECRET` ≥ 32 chars, HTTPS URLs, and `RESEND_API_KEY` set (production fails closed without it — good).
- [ ] Confirm DB backups (see `DEPLOY.md`) and migration deploy runbook.
- [ ] Decide multi-replica strategy; if >1 backend replica, replace in-memory rate limiter and add a Socket.IO Redis adapter (SEC-3).

---

## 17. Final Recommendation

**Is this codebase production-ready?** **Yes, conditionally.** It is architecturally sound, security-conscious, and passes lint/type/test/build. It can go to production once the H-3 dependency audit is resolved and the H-2 expiry bug is either fixed or the feature is disabled honestly. Everything else is optimization and hardening.

**What must be fixed first:**
1. Dependency vulnerabilities / failing CI audit (H-3).
2. Dead opponent-request expiry (H-2) — a user-facing workflow silently does nothing.
3. A minimal authorization/IDOR integration test suite (§14) — the code is well-secured, but nothing *guards against regression* of those guarantees.

**What can wait:** the per-request stats cost (H-1) and unbounded lists (M-2) are fine at launch volume but should be fixed before meaningful growth. File splits, dead-code removal, and validation-library adoption are maintenance investments, not blockers.

**Biggest hidden risk:** the **dual source of truth for player statistics** (H-4) combined with the **per-request recompute** (H-1). It's invisible today because both paths currently agree, but it couples a performance cost to a correctness landmine — the moment a correction, BYE, or partial failure makes the two disagree, users will see contradictory win/loss numbers on different screens with no error to signal it. Consolidating to one source removes both a performance drain and a future data-integrity incident.

*End of report.*
