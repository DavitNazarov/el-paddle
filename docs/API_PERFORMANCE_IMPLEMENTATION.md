# API Over-Fetching & Performance — Implementation Notes

**Date:** 2026-07-25
**Implements:** [`docs/API_PERFORMANCE_AUDIT.md`](API_PERFORMANCE_AUDIT.md) (findings F1–F9)
**Status:** All nine findings addressed. `npm run lint`, `npm test` (70 tests), `npm run build`, and `git diff --check` pass.

This document records what was changed for each finding, the reusable primitives introduced, and the response-contract changes that affect API consumers. The audit remains the "why"; this is the "what was done." Where the audit's line references had drifted from the current code, the finding's **intent** was implemented against the real code (noted per finding).

---

## Reusable primitives introduced

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `playerIdentitySelect`, `playerWithClubSelect`, `entryUserSelect`, `registrationEventSelect`, `clubSummarySelect` | [backend/src/common/includes.ts](../backend/src/common/includes.ts) | Slim Prisma `select` contracts. Never include `passwordHash`, OAuth, verification, or session columns. |
| `PublicUserSource` | [backend/src/modules/auth/auth.service.ts](../backend/src/modules/auth/auth.service.ts) | Structural (`Pick`-based) input type for `toPublicUser`, so slim selects satisfy it exactly as a full row does. |
| `serializeMatchList(matches)` | [backend/src/common/serializers.ts](../backend/src/common/serializers.ts) | Returns `{ matches, events }` with the shared event de-duplicated (F4). |
| `serializeTeammateOption(user)` | [backend/src/common/serializers.ts](../backend/src/common/serializers.ts) | 4-field saved-teammate DTO (F7). |
| `setPublicCache(response, opts?)` | [backend/src/common/http.ts](../backend/src/common/http.ts) | Sets `Cache-Control: public, max-age, stale-while-revalidate` on anonymous GETs (F5). |
| `getPlayerDashboardData()` | [frontend/src/lib/dashboard.ts](../frontend/src/lib/dashboard.ts) | Server-side dashboard fetch used for gating **and** hydration (F6). |

---

## Findings

### F1 — Slim `select` contracts (removes `passwordHash` over-read) 🔴

Every read path that only *shows* a user or event now `select`s the exact columns the serializer emits, instead of `include`-ing whole rows.

- Contracts defined in [includes.ts](../backend/src/common/includes.ts); `registrationInclude` and `clubInclude` rewritten to use them.
- `toPublicUser` signature changed from a full `User` to the structural `PublicUserSource` — full rows still satisfy it, so callers are unaffected.
- Applied to the participant/event includes in [brackets.service.ts](../backend/src/modules/brackets/brackets.service.ts) (`bracketInclude`, `snapshotEntry`, publish-notification query), [matches.service.ts](../backend/src/modules/matches/matches.service.ts) (`matchInclude` + new `matchEventSelect`), [scheduling.service.ts](../backend/src/modules/scheduling/scheduling.service.ts) (`scheduleInclude`, `scheduleMatch`, `requireJudgeQueue`), [events.service.ts](../backend/src/modules/events/events.service.ts) (status-change notifications), and [opponent-requests.service.ts](../backend/src/modules/opponent-requests/opponent-requests.service.ts) (`opponentRequestInclude`).
- Serializer input types in [serializers.ts](../backend/src/common/serializers.ts) narrowed to structural `Pick`s (`EntryUser`, `MatchEventSummary`, `RosterMember`, etc.) so slim query results typecheck.

**Effect:** `passwordHash` and ~15 other `User` columns no longer load into the Node process on registration/bracket/match/schedule/roster reads. **No wire change** — the emitted JSON is identical.

### F2 — Minimal public roster include 🔴

[`listPublicRegistrationRoster`](../backend/src/modules/registrations/registrations.service.ts) uses a dedicated `publicRosterInclude` (category + each player's `id/name/surname` + one club). The full owner/teammate rows, `reviewedBy` admin, event, and contact fields are no longer loaded on this unauthenticated route. `serializePublicRegistrationTeam` now takes a narrow `PublicRosterEntry` type. **No wire change.**

### F3 — Bank details out of list payloads 🟠

> Audit drift: `serializeEvent` previously had **no** `includeBankDetails` opt-in — it always emitted bank details. That opt-in was added here.

- `serializeEvent(event, { includeBankDetails })` — defaults to **omitting** `bankAccountIban` / `bankAccountReceiver` ([serializers.ts](../backend/src/common/serializers.ts)).
- Bank details now included **only** on: authenticated `GET /api/events/:id` (`Boolean(user)`), admin create/update/status/tournament-publication/roster-publication responses. Omitted from: `GET /api/events` browse list, `GET /api/public/events`, `GET /api/public/events/:id`, and `GET /api/dashboard`.
- Frontend: `EventDto.bankAccountIban/Receiver` are now optional ([types/dashboard.ts](../frontend/src/types/dashboard.ts)); [`usePlayerDashboard`](../frontend/src/hooks/usePlayerDashboard.ts) fetches bank details on demand when the register modal opens; [PlayerShared.tsx](../frontend/src/components/dashboard/PlayerShared.tsx) renders from that fetch; admin form prefill in [AdminEventsClient.tsx](../frontend/src/components/admin/AdminEventsClient.tsx) falls back to `''`.

**Consumer note:** anything reading `event.bankAccountIban` from a **list** must instead read a single event.

### F4 — De-duplicate event in match lists 🟠

The four match-history list endpoints now return `{ matches, events }` instead of `{ matches }`:

```
/api/matches   /api/me/matches   /api/players/:id/matches   /api/clubs/:id/matches
```

- `serializeMatchList` hoists each match's event into a de-duplicated top-level `events: [{ id, title }]` array and strips the per-match `bracket.event` embed (each match keeps `bracket.eventId`) — [serializers.ts](../backend/src/common/serializers.ts), [matches.routes.ts](../backend/src/modules/matches/matches.routes.ts).
- Single-match responses (`/api/matches/:matchId`, judge endpoints) are unchanged — they still embed the event via `serializeMatch`.
- Frontend: [MatchHistoryClient.tsx](../frontend/src/components/tournament/MatchHistoryClient.tsx) builds an `eventTitles` map from `events` and resolves each card's title by `bracket.eventId`.

**Consumer note:** list clients must read the event title from the top-level `events` map, not `match.bracket.event`.

### F5 — HTTP caching on public GETs 🟠

- `setPublicCache` helper added to [http.ts](../backend/src/common/http.ts). CORS already emits `Vary: Origin`, so per-origin caching is correct.
- Applied to `/api/public/*` GETs: clubs, club-by-slug, events list, single public event, sitemap-events (longer TTL), players, single player, schedule (short TTL), brackets (short TTL), registered-teams. Live-updating surfaces (schedule, brackets) use `max-age=15`; stable data uses `max-age=60`; sitemap `max-age=300`. Only the success path is cached — DB-unavailable fallbacks and errors are not.
- **`/api/categories` deliberately left uncached** because it is shared with admin mutation flows where immediate consistency matters.
- Frontend public SSR fetches switched from `cache: 'no-store'` to `next: { revalidate }` — events/clubs/players lists and club/player detail pages (matching the existing precedent in `events/[eventId]`).

### F6 — Hydrate dashboard from the server render 🟠

- New server helper `getPlayerDashboardData()` fetches `/api/dashboard` with the request cookies.
- The overview / events / entries pages now call it **once** for both access gating (via the returned `user`) and client hydration, replacing the separate `getCurrentUser()` gating call plus the client-side mount refetch.
- `usePlayerDashboard(initialUser, initialData?)` seeds state from `initialData` and skips the mount fetch when hydrated; `loadDashboard()` remains for post-mutation refreshes.
- Touched: [dashboard/page.tsx](../frontend/src/app/dashboard/page.tsx), [dashboard/events/page.tsx](../frontend/src/app/dashboard/events/page.tsx), [dashboard/entries/page.tsx](../frontend/src/app/dashboard/entries/page.tsx), and the three client components.

**Effect:** eliminates the guaranteed second round-trip and the loading flash on those pages.

### F7 — Slim teammate serializer 🟢

- `serializeTeammateOption` emits only `{ id, email, fullName, phone }`; the dashboard `clubMembers` query is a slim `select` (no `clubMemberships`, stats, status, or disqualification) — [dashboard.service.ts](../backend/src/modules/dashboard/dashboard.service.ts), [dashboard.routes.ts](../backend/src/modules/dashboard/dashboard.routes.ts).
- Frontend: `DashboardData.clubMembers` is now `TeammateOption[]` ([types/dashboard.ts](../frontend/src/types/dashboard.ts)); `ClubLineupEditor`'s `clubPlayers` prop narrowed to `{ id, fullName }[]`, which the `[user, ...clubMembers]` spread still satisfies.

### F8 — Bound admin `listEvents` 🟢

`listEvents` applies a `take: 1000` safety cap to both scopes ([events.service.ts](../backend/src/modules/events/events.service.ts)) — far above any realistic event count, but no longer an unbounded scan. The admin list is not paginated, so this is a cap rather than a page size.

### F9 — Admin tool page fan-out 🟢 (already satisfied)

The audit's recommended remedy — client-side parallelism — is **already in place**. Every admin tool client batches its independent loads with `Promise.all`:

- `AdminBracketClient` (event + brackets + opponent-requests)
- `AdminScheduleClient` (event + schedule + brackets + judges)
- `AdminRegistrationsClient` (registrations + event)
- `AdminOpponentRequestsClient` (event + opponent-requests)
- `PlayerTournamentEventClient` (dashboard + request-state + brackets + schedule)

A composite per-screen endpoint would add backend surface for marginal gain (the calls already run in parallel), against the audit's own "lowest priority / latency polish" framing, so none was added.

---

## Response-contract changes (for API consumers)

| Endpoint(s) | Before | After |
|-------------|--------|-------|
| `GET /api/matches`, `/api/me/matches`, `/api/players/:id/matches`, `/api/clubs/:id/matches` | `{ matches: [{ …, bracket: { event } }] }` | `{ matches: [{ …, bracket: { eventId } }], events: [{ id, title }] }` |
| `GET /api/events`, `/api/public/events`, `/api/public/events/:id`, `/api/dashboard` events | included `bankAccountIban`, `bankAccountReceiver` | bank fields omitted |
| `GET /api/events/:id` (authenticated), admin event responses | included bank fields | unchanged (still included) |
| `GET /api/dashboard` `clubMembers[]` | full `PublicUser` (~13 fields) | `{ id, email, fullName, phone }` |
| All `/api/public/*` GETs | no cache headers | `Cache-Control: public, max-age=…, stale-while-revalidate=…` |

These are also summarized in the Conventions section of [docs/API.md](API.md).

---

## Tests

New unit tests in [backend/src/common/serializers.test.ts](../backend/src/common/serializers.test.ts):

- `serializeEvent` omits bank details by default and includes them only when opted in (F3).
- `serializeMatchList` hoists a de-duplicated `events` array and drops the per-match embed (F4).
- `serializeTeammateOption` emits only the four dropdown fields (F7).
- The existing public-roster test continues to assert no email/phone/reviewer leak (F2).

## Verification

```bash
npm run lint          # frontend eslint + backend tsc --noEmit — clean
npm test              # backend 65 + frontend 5 — pass
npm run build         # backend prisma generate + tsc; frontend next build — pass
git diff --check      # clean
```

## Out of scope / not changed

- **`/api/categories` caching** — intentionally omitted (shared with admin mutation flows).
- **Client data-fetching library (SWR/react-query)** — the audit lists this as "Consider"; not adopted (a dependency/architecture decision beyond these findings).
- **Composite admin endpoints (F9)** — not added; existing `Promise.all` batching already satisfies the finding.
- Incidental worktree changes not part of this work: a `1.2.9 → 1.3.0` version bump in the `package.json`/`package-lock.json` files (concurrent release-prep) and a `frontend/next-env.d.ts` path change (a `next build` artifact) were left untouched.
