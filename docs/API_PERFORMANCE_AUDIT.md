# API Over-Fetching & Performance Audit

**Date:** 2026-07-25
**Scope:** Every fetched endpoint in the frontend and its backend serializer/query path.
**Goal:** Find responses that return more than the consuming page needs, and identify changes that reduce payload size, database load, and round-trips.

---

## Method

1. Enumerated every `apiFetch`/`fetch` call site in `frontend/src` and mapped each to the fields the page actually reads.
2. Enumerated every backend GET route (`grep '.get(' *.routes.ts`) and traced it to its serializer and Prisma `include`/`select`.
3. Compared "columns loaded from the database" → "fields emitted in JSON" → "fields the UI consumes".

The gap between those three layers is where over-fetching lives.

---

## Executive summary

The **wire-level serializers are already well designed** — there is a deliberate public/admin split and financial PII is gated. The over-fetching is concentrated one layer down, in the **Prisma `include`s**, plus a handful of endpoints that serialize more than the page renders, missing HTTP caching, and one redundant client round-trip.

Severity legend: 🔴 high · 🟠 medium · 🟢 low

| # | Finding | Severity | Type |
|---|---------|----------|------|
| F1 | `include` without `select` loads entire rows (incl. `passwordHash`) | 🔴 | Perf + latent security |
| F2 | Public roster endpoint over-fetches full user rows + admin reviewer | 🔴 | Perf + PII exposure risk |
| F3 | Bank IBAN sent for every event in list payloads | 🟠 | Payload + PII spread |
| F4 | `serializeMatch` embeds a full event object per match | 🟠 | Payload |
| F5 | No HTTP caching on read endpoints; client `no-store` everywhere | 🟠 | DB load |
| F6 | Dashboard SSR-hydrates then immediately refetches (double round-trip) | 🟠 | Round-trips |
| F7 | `clubMembers` over-serialized for what the dashboard uses | 🟢 | Payload |
| F8 | `listEvents` admin scope is unbounded (`where: {}`) | 🟢 | Scaling |
| F9 | Per-page fan-out of separate calls on admin tool pages | 🟢 | Round-trips |

---

## What is already good (keep doing this)

- **Public/admin serializer split** — `serializePublicClub` vs `serializeClub`, `serializePublicRegistrationTeam` vs `serializeRegistration`. `backend/src/common/serializers.ts`.
- **Bank details are gated** behind an explicit `includeBankDetails` opt-in with a safe default. `serializers.ts:44`.
- **Cursor pagination exists** for clubs, users, registrations, matches, notifications, and audit logs (`common/pagination.ts`, `parseListRange` / `cursorArgs`).
- **`listPublicClubs` uses `select`** (id/name/slug only) — the model to copy. `clubs.service.ts`.
- **The email-delivery admin endpoint uses `select`** with an explicit column list — another good reference. `operations.routes.ts:20`.
- **The player dashboard batches** its three queries with `Promise.all`. `dashboard.service.ts:15`.

---

## Findings

### F1 — `include` without `select` loads entire rows, including `passwordHash` 🔴

**Where (systemic):**
- `backend/src/common/includes.ts` — `registrationInclude` (`owner`/`teammate` fully included with nested `clubMemberships`), `clubInclude` (`user: true`).
- `backend/src/modules/brackets/brackets.service.ts:11` — `participantA/B: { include: { owner: true, teammate: true } }`.
- `backend/src/modules/matches/matches.service.ts:8` — `bracket: { include: { event: true, … } }`.
- `backend/src/modules/scheduling/scheduling.service.ts:9`.

**Evidence.** The `User` model has `passwordHash` and verification/OAuth columns (`schema.prisma` → `model User`). Every `include: { owner: true }` (no `select`) pulls **all** of them into application memory. Rendering a 16-team bracket loads **32 full `User` rows** while `serializeEntrySummary` (`serializers.ts:169`) emits only `id`, `name`, `surname`.

**Impact.**
- **Performance:** larger DB reads, more bytes over the DB wire, more serialization/GC pressure — multiplied per match/registration.
- **Security (latent):** `passwordHash` reaches the Node process on nearly every request. It is stripped by `toPublicUser` today, so nothing leaks over HTTP — but any future `res.json(user)`, spread, or new serializer would leak it. Loading it at all is the risk.

**Recommendation.** Introduce slim `select` contracts and use them everywhere a user/event is only shown, not edited:

```ts
// includes.ts
export const playerIdentitySelect = {
  id: true, name: true, surname: true, email: true, phone: true,
  role: true, status: true, emailVerifiedAt: true,
  matchesPlayed: true, wins: true, losses: true,
  disqualifiedUntil: true, disqualificationReason: true,
} as const;
// owner: { select: playerIdentitySelect }  ← instead of owner: true
```

Never select `passwordHash`. **Effort:** M (mechanical, touches ~5 include definitions + their tests).

---

### F2 — Public roster over-fetches full user rows and the admin reviewer 🔴

**Where.** `backend/src/modules/registrations/registrations.service.ts:280` `listPublicRegistrationRoster` uses the full `registrationInclude`, but the route serializes with `serializePublicRegistrationTeam` (`serializers.ts:106`).

**Evidence.** The public roster only emits: owner `{id, fullName}`, teammate `{id, fullName}`, category, club. But `registrationInclude` loads the **full owner and teammate `User` rows** (incl. `passwordHash`, phone, email, stats), the **full `reviewedBy` admin user**, the **full event row**, and `ownerPhone`/`teammatePhone`/`declineReason` (never emitted). This is on an **unauthenticated public route**.

**Impact.** Same latent-leak risk as F1 but on a public surface, plus wasted DB work on the highest-traffic tournament page.

**Recommendation.** Give the public roster its own minimal include:

```ts
include: {
  category: true,
  owner:    { select: { id: true, name: true, surname: true,
              clubMemberships: { select: { club: { select: { id:true, name:true, slug:true } } }, take: 1 } } },
  teammate: { /* same */ },
}
```

Drop `event`, `reviewedBy`, and contact fields from the query entirely. **Effort:** S.

---

### F3 — Bank IBAN sent for every event in list payloads 🟠

**Where.**
- `backend/src/modules/dashboard/dashboard.routes.ts:27` — `serializeEvent(event, { includeBankDetails: true })` over the whole events array.
- `backend/src/modules/events/events.routes.ts:113` — `includeBankDetails = Boolean(user)` on the `/api/events` list, so any logged-in user (including judges) receives IBANs for **all** events.

**Evidence.** The IBAN is only rendered inside the registration/payment modal for a single event (`frontend/src/components/dashboard/PlayerShared.tsx:314`). It is not used anywhere in list/card views.

**Impact.** Financial PII fanned out far wider than needed; larger list payloads.

**Recommendation.** Omit bank details from list responses. Fetch them on demand from `/api/events/:id` (already returns them for authenticated users, `events.routes.ts:126`) when the register modal opens. **Effort:** S.

---

### F4 — `serializeMatch` embeds a full event object per match 🟠

**Where.** `backend/src/common/serializers.ts:243-255`. Triggered whenever `match.bracket.event` is included, e.g. `matches.service.ts:8` (`matchInclude`) used by the match-history list (`/api/matches`, `/api/me/matches`, `/api/players/:id/matches`, `/api/clubs/:id/matches`).

**Evidence.** Each serialized match carries a duplicate of its event (title/date/location/description/categories). A history list of N matches repeats the identical event **N times** in JSON. `matchInclude` also loads the full event row per match at the DB layer (F1 again — the event carries the IBAN columns).

**Impact.** Response size grows with match count for zero information gain; redundant DB joins.

**Recommendation.** Hoist `event` to the top of the response once and reference `eventId` on each match; `select` only the event fields the match card needs. **Effort:** M (touches the match list serializer shape and its frontend consumers).

---

### F5 — No HTTP caching on read endpoints; client `no-store` everywhere 🟠

**Where.** No `Cache-Control`/`ETag` is set on any backend GET (only cookie `maxAge` exists in `auth.service.ts`). The frontend uses `cache: 'no-store'` broadly (clubs, players, events, public tournament, home).

**Evidence.** Public, rarely-changing data — `/api/categories`, `/api/public/events`, `/api/public/clubs`, `/api/public/players`, `/api/public/events/:id/schedule` — hits the database on every navigation.

**Impact.** Avoidable database load and latency for anonymous traffic.

**Recommendation.**
- Add `Cache-Control: public, max-age=…, stale-while-revalidate=…` (or `ETag`) to public GETs.
- For public Next.js pages, use `revalidate` / server-fetch caching instead of `no-store`.
- Consider SWR/react-query on the client for request dedupe + background refresh.

**Effort:** S–M.

---

### F6 — Dashboard SSR-hydrates then immediately refetches 🟠

**Where.** `frontend/src/hooks/usePlayerDashboard.ts:111-116`. The page renders with `initialUser`, then a mount effect calls `/api/dashboard`, guaranteeing a second round-trip on every load.

**Recommendation.** Hydrate the initial dashboard payload from the server render (pass full `DashboardData`, not just `initialUser`) and reserve `loadDashboard()` for post-mutation refreshes. **Effort:** M.

---

### F7 — `clubMembers` over-serialized for what the dashboard uses 🟢

**Where.** `/api/dashboard` sends full `toPublicUser` (~13 fields incl. role, status, stats, club, disqualification) per club member (`dashboard.routes.ts:29`), but `usePlayerDashboard.ts:79-88` reads only `id`, `email`, `fullName`, `phone` to build the saved-teammate dropdown.

**Recommendation.** Add a slim `serializeTeammateOption` (4 fields). **Effort:** S.

---

### F8 — `listEvents` admin scope is unbounded 🟢

**Where.** `backend/src/modules/events/events.service.ts` `listEvents` uses `where: {}` for admin scope (all events ever), no pagination. Non-admin scope is bounded by `date >= today` but still uncapped in count.

**Recommendation.** Apply the existing cursor pagination (`parseListRange`) or a sensible cap; the admin events page already handles lists elsewhere. **Effort:** S–M.

---

### F9 — Per-page fan-out of separate calls on admin tool pages 🟢

**Where.** Admin event tooling fires several independent calls (events + categories + brackets + registrations + opponent-requests). Compare the dashboard service, which batches with `Promise.all`.

**Recommendation.** Either a composite endpoint per admin screen, or client-side batching/parallelism where the calls are independent. Lower priority — correctness is fine, this is latency polish. **Effort:** M.

---

## Prioritized roadmap

| Order | Finding(s) | Effort | Payoff |
|-------|-----------|--------|--------|
| 1 | F1 — `select` contracts for users/events | M | DB perf + removes `passwordHash` over-read everywhere |
| 2 | F2 — minimal include for public roster | S | Public-surface PII + perf |
| 3 | F3 — bank details out of list payloads | S | Payload + PII spread |
| 4 | F5 — cache headers on public GETs | S | Fewer DB hits |
| 5 | F7 — slim teammate serializer | S | Payload |
| 6 | F6 — hydrate dashboard from server | M | One fewer round-trip per load |
| 7 | F4 — de-dupe event in match lists | M | Payload |
| 8 | F8 / F9 — pagination + batching | M | Scaling / latency |

**Suggested first PR:** F1 + F2 + F3 together — define slim `select` contracts in `includes.ts`, point the public roster and bracket/match queries at them, and drop bank details from the two list routes. One coherent change with the largest combined payoff, verifiable with existing lint/test/build.

---

## Patterns to adopt

**1. Select what you serialize.** For any read path, the Prisma `select` should mirror the serializer's output. `include: { owner: true }` is the anti-pattern; `select: playerIdentitySelect` is the fix. This closes the perf gap and the `passwordHash` exposure in one move.

**2. One shape per audience.** Continue the public/admin serializer split down into the query layer — a public route should have a public *include*, not just a public *serializer*.

**3. Reference, don't embed.** Shared parents (event, category) belong once at the top of a list response, with children referencing them by id.

**4. Cache the public, no-store the private.** Anonymous GETs should carry `Cache-Control`/`ETag`; authenticated, mutable data stays `no-store`.

---

## Verification

After each change, run (from repo root):

```bash
npm run lint
npm test
npm run build
git diff --check
```

For payload/DB changes, spot-check the actual JSON with the browser network panel or:

```bash
curl -s "$API/api/public/events/<id>/registered-teams" | jq '.teams[0] | keys'
```

Confirm no `passwordHash`, phone, or reviewer fields appear on public responses, and that list payloads shrink.
