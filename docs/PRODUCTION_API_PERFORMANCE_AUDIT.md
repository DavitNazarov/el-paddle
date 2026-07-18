# Production API Usage and Performance Audit

**Audit date:** 2026-07-17

**Scope:** Next.js frontend, Express API, Socket.IO gateway, Prisma/PostgreSQL services, outbox worker, external Google/Resend calls, and the checked-in Nginx production configuration.

**Phase:** Report only. No application code, schema, migration, or public API contract was changed.

## Executive summary

The audit found **2 critical, 7 high, 7 medium, and 2 low-severity confirmed findings**. The largest immediate risks are not theoretical:

1. Opponent-request endpoints return raw Prisma objects. Nested `User` records therefore expose fields such as `passwordHash`, `sessionVersion`, legal-acceptance timestamps/versions, phone/email, and disqualification details. Player-facing request state also exposes `adminInternalNote`.
2. Public bracket, schedule, and match endpoints spread complete `EventRegistration` and `Match` database records into JSON. Public clients receive registration phone numbers, review fields, legal-acceptance fields, user email/phone, and other internal columns that the UI never reads.
3. Event-scoped registration loading calls the unbounded all-registration query and filters it in the controller. Admin navigation separately downloads four complete collections only to count them; page components often download the same collections again.
4. The realtime hook performs a second initial load on Socket.IO `connect` and reloads whole endpoint groups for every relevant event. The public tournament page therefore normally makes six data requests (two sets of three) at initialization, plus its navigation session request and socket handshake.
5. Match history has a hard 50-row window with no cursor or `hasMore`. Search is then applied in the browser, so it silently searches only the first page while presenting itself as history search.

The current development database is intentionally small (10 users, 1 event, 3 registrations, 3 matches). Even at that size, measured uncompressed JSON was:

| Response | Current bytes | Consumer-minimal bytes | Reduction |
| --- | ---: | ---: | ---: |
| Public bracket (2 brackets / 3 matches) | 11,338 | 1,389 | 87.7% |
| Public schedule (1 court / 2 items) | 10,988 | 1,208 | 89.0% |
| Match history (3 matches) | 24,512 | 1,501 | 93.9% |
| Admin registrations (3 rows) | 6,252 | 1,627 | 74.0% |
| Public events (1 row) | 867 | 433 | 50.1% |
| Admin users (10 rows) | 4,348 | 2,372 | 45.4% |

These are local measurements, not production telemetry. Production totals scale with rows and text length; the percentage reductions are representative because they were calculated from the real serializers and real UI field access.

## Method and evidence boundaries

- Traced every production `fetch`/`apiFetch` call through the route, service, Prisma query/include, serializer, frontend types, child components, table/card rendering, conditional branches, mobile/shared components, mutation refreshes, and Socket.IO invalidation paths.
- Excluded tests, fixtures, seed behavior, static visual arrays, and presentation-only filtering of already-loaded bounded bracket/court data.
- Count estimates below are top-level Prisma calls visible in code. Prisma may issue additional SQL for nested relation loading; no production query log or APM trace was available.
- Payload measurements were taken read-only against the local PostgreSQL data and serialized with the checked-in code. No production data was available.
- There is no tenant/organization model in the audited schema. Isolation requirements apply to user, capability, event-publication, judge-assignment, and participant scope.
- “Confirmed” means directly evidenced in checked-in production paths. “Suspected” is used only where the repository cannot prove the deployed proxy/global-Nginx behavior.

## Critical findings

### C-1 — Raw opponent-request responses expose credential and internal decision fields

1. **Finding title:** Raw opponent-request Prisma graph is returned directly.
2. **Severity:** Critical.
3. **Category:** Sensitive over-fetching / response construction / data exposure.
4. **Frontend file and line:** `frontend/src/components/dashboard/PlayerTournamentEventClient.tsx:38-63,190`; `frontend/src/components/admin/AdminOpponentRequestsClient.tsx:29-58`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41` (shared client; no endpoint-specific projection).
6. **Backend controller file and line:** `backend/src/modules/opponent-requests/opponent-requests.routes.ts:20-39,42-64`.
7. **Service/database file and line:** `backend/src/modules/opponent-requests/opponent-requests.service.ts:13-16,29-35,105-115,235-244`.
8. **Endpoint and HTTP method:** `GET /api/events/:eventId/opponent-request-state`; `GET /api/admin/events/:eventId/opponent-requests`; all POST/PATCH/DELETE opponent-request mutation responses.
9. **Current behaviour:** `opponentRequestInclude` loads complete requesting/target registrations and complete owner/teammate `User` rows. Routes return these Prisma objects without a response serializer. Player state includes all scalar `OpponentRequest` fields, including `adminInternalNote`.
10. **Why inefficient/unsafe:** It transfers and serializes many ignored fields and crosses a confidentiality boundary. Full nested users include `passwordHash`, `sessionVersion`, account/legal timestamps and versions, stats, phone/email, disqualification reason, and timestamps. Registrations include phone numbers, review fields, internal notes, legal acceptance, and withdrawal metadata.
11. **Fields returned:** Every `OpponentRequest` scalar (`requestedByUserId`, response/admin actor IDs and times, `adminInternalNote`, canonical key, timestamps, etc.); every `EventRegistration` scalar for both sides; complete owner/teammate/category rows.
12. **Fields actually used:** Player: request `id`, entry IDs, category ID, `status`, `responseReason`, `adminPublicReason`, `version`, and opposing team display names. Admin: the same plus request message and decision-facing public state; `adminInternalNote` should be available only in a dedicated admin DTO if the admin UI adds a display for it. Eligible-opponent UI uses entry `id` and two display names only.
13. **Current request/query count:** State load: 1 HTTP request and 1 unbounded Prisma `findMany` with two full registration/user graphs. Each mutation returns the same full graph and the frontend then reloads the state again, normally 2 requests for one action (plus one first-session CSRF request).
14. **Estimated payload:** Not measurable locally because there were no opponent requests. Shape analysis gives roughly 2–5 KB per request row depending on nullable text; sensitive field count is more important than bytes.
15. **Recommended solution:** Introduce `PlayerOpponentRequestDto`, `AdminOpponentRequestDto`, and `EligibleOpponentDto`; replace `include` with explicit role-specific `select`; never spread Prisma models; return a minimal mutation DTO and update the affected row locally.
16. **Proposed contract:** Player response `{ requests: [{ id, categoryId, requestingEntryId, targetEntryId, status, requestMessage, responseReason, adminPublicReason, version, expiresAt, createdAt, requestingEntry:{id,ownerName,teammateName}, targetEntry:{...} }] }`. Admin may additionally receive `{ adminInternalNote, adminDecisionAt }`. Mutation response `{ request: <same role-specific DTO> }`.
17. **Required database changes:** None for projection. Pagination work should use the existing `(eventId, categoryId, status)` index and add a cursor tie-breaker index `(eventId, createdAt, id)` if event histories can exceed one page.
18. **Expected improvement:** Removes credential/internal-field exposure; likely 60–85% response reduction; mutation flow 2 requests → 1.
19. **Risk of change:** Medium because all player/admin mutation consumers must migrate together; risk is controlled by compile-time DTOs and contract tests.
20. **Tests required:** Negative JSON-key tests for `passwordHash`, `sessionVersion`, `adminInternalNote`, phone/legal/review fields; player/admin role-shape tests; mutation contract tests; authorization regression tests.

### C-2 — Public bracket, schedule, and match DTOs expose complete registrations and personal user fields

1. **Finding title:** Public tournament serializers spread database models into public JSON.
2. **Severity:** Critical.
3. **Category:** Sensitive over-fetching / payload size / public API exposure.
4. **Frontend file and line:** `frontend/src/components/tournament/PublicTournamentClient.tsx:25-29,38-45,105-239`; `frontend/src/components/tournament/MatchHistoryClient.tsx:51-72,119-177`; `frontend/src/components/tournament/MatchDetailClient.tsx:35-94`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/brackets/brackets.routes.ts:39-46`; `backend/src/modules/scheduling/scheduling.routes.ts:72-75`; `backend/src/modules/matches/matches.routes.ts:57-81`.
7. **Service/database file and line:** `backend/src/modules/brackets/brackets.service.ts:7-17,204-205`; `backend/src/modules/scheduling/scheduling.service.ts:6-12,21-27`; `backend/src/modules/matches/matches.service.ts:7-15,147-170`; serializers at `backend/src/common/serializers.ts:106-165`.
8. **Endpoint and HTTP method:** `GET /api/public/events/:eventId/brackets`; `GET /api/events/:eventId/brackets`; `GET /api/public/events/:eventId/schedule`; `GET /api/matches`; `GET /api/matches/:matchId`; public player/club match-history variants.
9. **Current behaviour:** `serializeEntrySummary` returns `{ ...entry, owner: toPublicUser(...), teammate: ... }`; `serializeMatch`, `serializeScheduleItem`, `serializeCourtSchedule`, and `serializeBracket` also spread complete models. `matchInclude` additionally loads winner, loser, schedule, full event, and all snapshots for every list row.
10. **Why inefficient/unsafe:** Public JSON contains registration phone numbers, internal review notes, legal acceptance timestamps/versions, reviewer IDs, user email/phone/disqualification reason, generation seed, actor IDs, and internal timestamps. Match history UI uses snapshots, not live registration/user graphs.
11. **Fields returned:** All `Bracket`, `Match`, `ScheduleItem`, `Court`, `EventRegistration`, selected `Event`, `Category`, `Club`, snapshot, owner/teammate/winner/loser public-user fields, plus relation objects.
12. **Fields actually used:** Public bracket: bracket `id,size,status,publishedAt,category name`; match `id,round,matchNumber,nextMatchId,nextMatchSlot,status,scoreA,scoreB`; two team display names. Public schedule: court `id,name,location`; item `id,queuePosition,plannedStartAt,status`; match identity/round/number/status/scores/team names/category. History: match `id,round,matchNumber,status,resultType,completedAt,scoreA,scoreB`, four snapshot display fields, event `id/title`, category `id/name`.
13. **Current request/query count:** One top-level Prisma call per bracket/history list; public schedule uses a publication query plus the court graph query. Relation loading can add SQL depending on Prisma strategy.
14. **Estimated payload:** Measured local: bracket 11,338 → 1,389 bytes (−87.7%); schedule 10,988 → 1,208 (−89.0%); 3-match history 24,512 → 1,501 (−93.9%).
15. **Recommended solution:** Define explicit public `select` trees and `PublicBracketDto`, `PublicScheduleDto`, `MatchHistoryItemDto`, and `MatchDetailDto`. Use snapshots for historical/public names. Keep judge/admin command DTOs separate because they require `version` and live participant IDs.
16. **Proposed contract:** Use only the fields listed in item 12. No raw spreads. Public team `{ entryId, ownerName, teammateName }`; historical team `{ side, ownerName, teammateName, clubName }`.
17. **Required database changes:** No projection change. Add pagination indexes from M-6 for history.
18. **Expected improvement:** Eliminates public personal/internal data; 88–94% payload reduction in the current sample; less DB column transfer and client hydration/render work.
19. **Risk of change:** Medium-high because bracket, schedule, judge, admin, and history currently share broad TypeScript types. Separate DTOs before removing fields.
20. **Tests required:** Public response allow-list tests; JSON snapshots per endpoint; TypeScript consumer builds; public/participant/admin visibility tests; bracket/schedule/history UI tests.

## High findings

### H-1 — Event registration endpoint loads every registration and filters in the controller

1. **Finding title:** Fake event scoping and unbounded registration retrieval.
2. **Severity:** High.
3. **Category:** Incorrect client/controller-side filtering / pagination / database efficiency.
4. **Frontend file and line:** `frontend/src/components/admin/AdminRegistrationsClient.tsx:54-84,63-66`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/registrations/registrations.routes.ts:63-67,97-102`.
7. **Service/database file and line:** `backend/src/modules/registrations/registrations.service.ts:235-239`; full relation include at `backend/src/common/includes.ts:9-23`.
8. **Endpoint and HTTP method:** `GET /api/admin/registrations`; `GET /api/admin/events/:eventId/registrations`.
9. **Current behaviour:** Both endpoints call the same unbounded `findMany`. The event route then executes `.filter(item => item.eventId === eventId)` in Node. The frontend downloads the event result and filters status locally.
10. **Why inefficient:** Work and sensitive contact data scale with registrations across the entire installation, not the selected event/page. The all-registration endpoint is also downloaded by every admin shell for counts.
11. **Fields returned:** Full serialized registration: event summary, category including description/count, complete public user DTOs, contact phones/emails, status/reasons, reviewer, timestamps.
12. **Fields actually used:** Event review page: `id`, event id/title/date, category id/name, owner/teammate fullName/email/club name, owner/teammate phone, status/version/public reason. Overview needs only six pending summaries and aggregate counts.
13. **Current request/query count:** Event route 1 HTTP; 1 auth query + 1 unbounded registration graph query, then O(all registrations) Node filtering. Local all-registration payload: 6,252 bytes for 3 rows.
14. **Estimated payload:** Minimal local event-review list is 1,627 bytes for the same 3 rows (−74%); production also gains from server event/status pagination.
15. **Recommended solution:** Add service input `{ eventId, status, cursor, limit }`; apply Prisma `where`; return status counts separately via `groupBy`; use cursor pagination; make overview a summary query.
16. **Proposed contract:** `GET /api/admin/events/:eventId/registrations?status=PENDING&limit=25&cursor=...` → `{ items:[RegistrationReviewItem], statusCounts:{...}, nextCursor, hasMore }`.
17. **Required database changes:** Existing `(eventId,status)` helps filtering; add `(eventId,status,createdAt,id)` for stable descending pagination.
18. **Expected improvement:** Database rows/response become O(selected page) instead of O(all registrations); at 10,000 global / 100 event registrations, about 99% fewer rows scanned/serialized before page-size reduction.
19. **Risk of change:** Medium; status chips/counts and mutation refresh logic must use metadata.
20. **Tests required:** Event isolation, status filter, cursor stability, max page size, concurrent insert, empty/error state, and no cross-event rows.

### H-2 — Admin shell downloads four full collections for counts and duplicates page requests

1. **Finding title:** Navigation-count fan-out and same-page duplicate collection fetches.
2. **Severity:** High.
3. **Category:** Duplicate/redundant requests / client-side aggregation.
4. **Frontend file and line:** `frontend/src/hooks/useAdminCounts.ts:18-65`; `frontend/src/components/admin/AdminShell.tsx:59-79`; duplicate page loads in `AdminOverviewClient.tsx:40-71`, `AdminEventsClient.tsx:156-163`, `AdminClubsClient.tsx:45-47`, and `AdminCategoriesClient.tsx:44-46`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41` (no request dedup/cache).
6. **Backend controller file and line:** categories `:19-22`, events `backend/src/modules/events/events.routes.ts:108-113`, registrations `:63-67`, clubs `backend/src/modules/clubs/clubs.routes.ts:30-34`.
7. **Service/database file and line:** categories `categories.service.ts:4-11`; events `events.service.ts:9-19`; registrations `registrations.service.ts:235-239`; clubs `clubs.service.ts:8-12`.
8. **Endpoint and HTTP method:** Four GETs on every `AdminShell`, often duplicated by page GETs.
9. **Current behaviour:** Categories, all admin events, all registrations, and all clubs/member graphs are fetched in parallel solely to calculate eight integers. Admin overview simultaneously refetches events and registrations.
10. **Why inefficient:** Parallelism removes the waterfall but not bandwidth, auth/database work, or duplicate serialization. Counts become slower as collections grow.
11. **Fields returned:** Complete category/event/registration/club DTOs and nested relations.
12. **Fields actually used:** Eight integer counts in the shell. Overview additionally needs six pending registration summaries and four draft event summaries.
13. **Current request/query count:** Admin overview: 1 SSR session API call + 6 client GETs = 7 API calls; about 12 top-level Prisma calls including authentication. Schedule page: 1 + 8 = 9 API calls before mutations.
14. **Estimated payload:** At local size, the four count responses already include about 17.5 KB before headers; grows without bound.
15. **Recommended solution:** `GET /api/admin/navigation-summary` with database counts/grouping, cached in a shared client provider for a short private TTL. Add a purpose-built overview endpoint. Invalidate only affected counts after mutations.
16. **Proposed contract:** `{ pendingRegistrations, approvedRegistrations, declinedRegistrations, publishedEvents, draftEvents, eventCount, clubCount, categoryCount }`; overview adds only `pendingItems[6]` and `draftItems[4]`.
17. **Required database changes:** Use indexes in M-6; no cache shared across users without including user/capability identity. A single SQL aggregate is optional; Prisma `count/groupBy` in `Promise.all` is acceptable.
18. **Expected improvement:** Overview 7 → 2 API calls (−71%); schedule 9 → 3 (−67%) with a workspace endpoint; payload for navigation counts drops to under ~250 bytes.
19. **Risk of change:** Low-medium; eventual count staleness is acceptable only with precise invalidation/short private stale time.
20. **Tests required:** Count correctness after every mutation, capability isolation, shell navigation, cache invalidation, and no shared-user cache key.

### H-3 — User/player directories are unbounded; search, role filtering, and judge filtering happen after retrieval

1. **Finding title:** Full user population is loaded for admin search, public directory, stats, and judge selectors.
2. **Severity:** High.
3. **Category:** Missing pagination / client-side filtering / database aggregation.
4. **Frontend file and line:** `frontend/src/components/admin/AdminUsersClient.tsx:58-96`; `frontend/src/components/admin/AdminScheduleClient.tsx:32-38`; `frontend/src/app/players/page.tsx:29-68`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/users/users.routes.ts:44-65`.
7. **Service/database file and line:** `backend/src/modules/users/users.service.ts:101-160`.
8. **Endpoint and HTTP method:** `GET /api/admin/users`; `GET /api/admin/judges`; `GET /api/public/players`.
9. **Current behaviour:** `listUsers()` is unbounded and selects full user rows; `/admin/judges` loads all users then filters in Node. Admin search/role/disqualification filtering is local. Public players loads all active players, then loads all matching completed match snapshots and calculates stats in JavaScript.
10. **Why inefficient:** Rows, stats input, payload, and render work grow with the entire user/match population. Local admin search cannot enforce server permission shaping and prevents pagination.
11. **Fields returned:** Admin user full public DTO plus created/disqualification fields; public player directory returns identity, club, and stats. DB query loads password/legal/session/timestamp columns that serializer discards.
12. **Fields actually used:** Admin list: `id,fullName,email,role,status,club.name,isDisqualified,disqualifiedUntil,disqualificationReason`. Judge selector: `id,fullName`. Public card: `id,fullName,roleTitle,club{id,name,slug},stats`.
13. **Current request/query count:** Admin schedule loads `/admin/users` once and filters. Public players: 2 top-level queries regardless of player count, but the second can materialize all matching matches/snapshots in application memory.
14. **Estimated payload:** Local admin users 4,348 → 2,372 bytes (−45%) before pagination. Public cost grows linearly.
15. **Recommended solution:** Validated `q,role,status,disqualified,cursor,limit`; DB `where/orderBy/take`; a true judge-option query; public player cursor pages. Compute stats using SQL group/aggregate or maintained counters that are reconciled, not by loading match rows.
16. **Proposed contract:** `/api/admin/users?q=&role=&status=&limit=25&cursor=` → `{items,nextCursor,hasMore,counts}`; `/api/admin/judges?active=true&limit=100` → `{items:[{id,fullName}]}`; `/api/public/players?limit=24&cursor=`.
17. **Required database changes:** `(role,status,name,surname,createdAt,id)` for directory order. For contains search, add a PostgreSQL `pg_trgm` GIN index on a normalized name/email expression only if contains semantics are retained; prefix search can use functional B-tree indexes.
18. **Expected improvement:** O(page size) transfer/rendering; schedule judge payload usually >90% smaller; stats query returns aggregate rows rather than match graphs.
19. **Risk of change:** Medium due search semantics and total count display. Avoid expensive exact total unless UI truly needs it.
20. **Tests required:** Debounced search (250–300 ms), minimum 2 characters, empty query, abort/race, role/status filters, cursor stability, stats parity including byes and unpublished results.

### H-4 — `/api/dashboard` is a page-agnostic monolith and event workspace filters it locally

1. **Finding title:** Every player page receives events, all personal registrations, club roster, and another copy of the current user.
2. **Severity:** High.
3. **Category:** Over-fetching / incorrect page shaping / missing pagination.
4. **Frontend file and line:** `frontend/src/hooks/usePlayerDashboard.ts:42-107,210-213`; `PlayerOverviewClient.tsx:31-49`; `PlayerEventsClient.tsx:13-18`; `PlayerEntriesClient.tsx:24-30`; `PlayerTournamentEventClient.tsx:38-55`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/dashboard/dashboard.routes.ts:10-24`.
7. **Service/database file and line:** `backend/src/modules/dashboard/dashboard.service.ts:5-49`; broad includes in `backend/src/common/includes.ts:1-23`.
8. **Endpoint and HTTP method:** `GET /api/dashboard`.
9. **Current behaviour:** Three parallel database branches return all relevant events, all registrations, and all club members. Overview keeps four registrations; entries ignores events/club members; events needs selectable teammate data; event workspace downloads everything then filters by event ID and also starts eligible-opponent loading during initialization.
10. **Why inefficient:** One shape serves unrelated pages. Personal history grows indefinitely. SSR already fetched `/auth/me`, but client response returns user again.
11. **Fields returned:** Full `PublicUser`; full event DTOs including payment/publication fields; broad registration DTOs; full public-user DTO per club member.
12. **Fields actually used:** Overview: compact user stats, event count/next event, status counts, four registration summaries. Entries: paginated own registrations. Events: open-event cards, registration membership keys, teammate options. Event workspace: one event, that event’s entries, requests, bracket, schedule.
13. **Current request/query count:** Basic dashboard navigation: 1 SSR `/auth/me` + 1 client `/dashboard`; dashboard uses 4 top-level Prisma calls (membership + 3 parallel branches). Event workspace initialization: auth + 4 parallel APIs + eligible-opponent request = 6.
14. **Estimated payload:** Local registered-user dashboard: 4,255 bytes for 1 event, 1 registration, 2 club mates; grows with history and roster.
15. **Recommended solution:** Add page-specific `/api/dashboard/summary`, `/api/me/registrations`, `/api/events/registration-options`, and `/api/events/:id/player-workspace`; server-render initial data; load eligible opponents only when the modal opens or entry changes by the user.
16. **Proposed contract:** Summary `{userSummary,registrationCounts,nextEvent,recentEntries[4]}`; entries cursor page; event workspace `{event,ownEntries,requests,publicBracket,publicSchedule}` with narrow DTOs.
17. **Required database changes:** `(ownerId,createdAt,id)` and `(teammateId,createdAt,id)` for personal registration pagination.
18. **Expected improvement:** Player overview 2 API calls → 1; event workspace 6 → 2 (auth + workspace) and no eligible call until needed; page payloads become bounded.
19. **Risk of change:** Medium because registration form logic currently assumes one shared hook.
20. **Tests required:** Per-page DTO contract tests, SSR auth redirects, teammate options, registration mutation cache update, cursor history, and event/user ownership isolation.

### H-5 — Socket connect duplicates initial loads and every event invalidates full endpoint groups

1. **Finding title:** Realtime connection is an invalidation storm rather than a partial-update channel.
2. **Severity:** High.
3. **Category:** WebSocket/realtime / duplicate requests / rendering cost.
4. **Frontend file and line:** `frontend/src/hooks/useTournamentRealtime.ts:7-32`; callers: `PublicTournamentClient.tsx:37-45`, `JudgeQueueClient.tsx:15-21`, `JudgeMatchClient.tsx:16-22`, `MatchDetailClient.tsx:15-21`, `NotificationsClient.tsx:16-17`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** Socket authorization `backend/src/realtime/gateway.ts:20-84`.
7. **Service/database file and line:** Event emission `backend/src/workers/outbox.worker.ts:40-67`; outbox event payload creation throughout services.
8. **Endpoint and HTTP method:** Socket.IO connection plus each caller’s GET(s).
9. **Current behaviour:** Every caller performs its own initial effect load, then `socket.on('connect', invalidate)` repeats it. All 17 event names call the same full reload. Public tournament reloads event, brackets, and schedule for a one-score change. Notifications opens a socket without user/event parameters and registers all events.
10. **Why inefficient:** Connection reliably duplicates initialization; small events cause broad JSON/DB work and whole-state rerenders. Multiple components would create separate sockets rather than share a provider.
11. **Fields returned:** The complete endpoint responses described in C-2 and M-1 on each invalidation.
12. **Fields actually used:** Event payloads already contain identifiers/version and score updates; most changes can patch one record or invalidate one precise resource.
13. **Current request/query count:** Public tournament normally 3 initial GETs + 3 connect GETs = 6 data requests, plus PadelNav `/auth/me` and socket handshake. Judge/match/notifications normally 2 identical initial GETs each.
14. **Estimated payload:** Local public tournament duplicate transfers ~23 KB uncompressed on connect before headers; current broad shapes amplify every live event.
15. **Recommended solution:** Create one app-level socket/provider; do not invalidate on first connect when initial data is fresh; subscribe only to relevant event names; apply event payload patches (`matchId,scoreA,scoreB,status,version`) or precisely refetch one resource. On reconnect after an actual disconnect, reconcile once with exponential backoff and document visibility behavior.
16. **Proposed contract:** Event-specific payloads remain small and versioned. Client reducer updates `matches[matchId]`; bracket/schedule publication invalidates only the corresponding query key.
17. **Required database changes:** None.
18. **Expected improvement:** Initial public tournament data requests 6 → 3 immediately; score event follow-up 3 GETs → 0 in the normal case; one socket per browser tree.
19. **Risk of change:** Medium-high because dropped events/reconnects require a safe version reconciliation path.
20. **Tests required:** Single initial load, reconnect reconciliation, duplicate event delivery, version gaps, unmount cleanup, hidden-tab behavior, anonymous/public authorization, and partial cache updates.

### H-6 — Match history search is incomplete and pagination metadata is absent

1. **Finding title:** Browser search operates on an undisclosed 50-row server window.
2. **Severity:** High.
3. **Category:** Search / missing pagination / oversized list DTO.
4. **Frontend file and line:** `frontend/src/components/tournament/MatchHistoryClient.tsx:26-73,79-109`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/matches/matches.routes.ts:57-81`.
7. **Service/database file and line:** `backend/src/modules/matches/matches.service.ts:147-160`; broad `matchInclude` at `:7-15`.
8. **Endpoint and HTTP method:** `GET /api/matches`, `/api/me/matches`, `/api/players/:id/matches`, `/api/clubs/:id/matches`.
9. **Current behaviour:** Backend clamps `take` to 100 but returns no cursor/`hasMore`. UI defaults to 50 and filters player/club/round text locally. Public event selector is populated from `/api/public/events`, which exposes only one upcoming and six previous events, so older results are unreachable from the general history UI.
10. **Why inefficient/incorrect:** Search results are incomplete, users cannot reach later pages, and every row carries the huge detail graph.
11. **Fields returned:** Full match graph listed in C-2.
12. **Fields actually used:** Compact history fields listed in C-2 item 12.
13. **Current request/query count:** 2 requests for general history (event options, then dependent selected-event matches); 1 for player/club history. The dependency is genuine, but the event-options endpoint is the wrong contract.
14. **Estimated payload:** Local 3 matches 24,512 → 1,501 bytes (−93.9%). At 50 similar rows the current response is roughly 400 KB before compression.
15. **Recommended solution:** Backend `q,eventId,clubId,playerId,cursor,limit`; cursor `(completedAt,id)`; compact list DTO; dedicated paginated event selector; 250–300 ms debounce, min 2 characters, AbortController, stable query key.
16. **Proposed contract:** `{ items:[MatchHistoryItem], nextCursor:null|string, hasMore:boolean }`; event options `{items:[{id,title,date}],nextCursor,hasMore}`.
17. **Required database changes:** Add `Match(status,completedAt,id)`; snapshot participant/club indexes exist but query plans should be checked for relation filters. Add event public/history index from M-6.
18. **Expected improvement:** Correct complete search; bounded 20-row pages; ~94% per-row payload reduction; old events become reachable.
19. **Risk of change:** Medium due search semantics and cursor encoding.
20. **Tests required:** Search across page boundaries, debounce/abort race, cursor tie timestamps, public-result visibility, byes, empty query, max limit, load-more states.

### H-7 — Bracket, schedule reorder, and fan-out notification writes contain N+1 query loops

1. **Finding title:** Tournament commands execute per-match, per-entry, per-queue-row, and per-recipient queries inside transactions.
2. **Severity:** High.
3. **Category:** N+1 database writes / transaction duration.
4. **Frontend file and line:** Bracket commands `frontend/src/components/admin/AdminBracketClient.tsx:85-116`; schedule actions `AdminScheduleClient.tsx:55-85`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/brackets/brackets.routes.ts:11-30`; `backend/src/modules/scheduling/scheduling.routes.ts:60-65`.
7. **Service/database file and line:** bracket graph `backend/src/modules/brackets/brackets.service.ts:65-92,94-145,156-180,183-200`; reorder/remove `backend/src/modules/scheduling/scheduling.service.ts:95-104,128-139`; notification fan-out `backend/src/common/domain-events.ts:17-68`.
8. **Endpoint and HTTP method:** Bracket generate/lock/publish; schedule reorder/remove; event status/publication commands with recipient notification loops.
9. **Current behaviour:** A 16-slot graph creates up to 15 matches sequentially and updates assignments row-by-row. Locking reads then inserts a snapshot per participant. Reorder makes `2N` updates. Every email recipient invokes notification, delivery, email-outbox, and websocket-outbox upserts separately.
10. **Why inefficient:** Network round trips and locks remain inside interactive transactions; latency and lock duration scale linearly with entries/recipients.
11. **Fields returned:** Command responses also include broad bracket/match graphs, but the main issue is write count.
12. **Fields actually used:** Command UI needs the updated bracket/version or can accept an acknowledgement then precisely refresh/patch.
13. **Current request/query count:** Generate/no pairing is roughly 35–40 top-level DB operations for 16 entries. Snapshot portion of lock is 32 operations for 16 participants. Reorder is `2N + ~3` (about 35 at N=16). Publishing to 32 players can add about 128 notification-related upserts.
14. **Estimated payload:** Secondary to DB work; broad command DTO can still be narrowed.
15. **Recommended solution:** Precompute IDs and use `createMany`/`createManyAndReturn` where supported; batch entry reads and snapshot `createMany`; use one/two SQL `UPDATE ... CASE` statements for reorder; bulk notification/outbox inserts with dedupe constraints; keep transactions atomic.
16. **Proposed contract:** Commands return `{ id,version,status,publishedAt }` or a narrow updated resource; client updates/invalidates only that resource.
17. **Required database changes:** Existing uniqueness constraints support batch dedupe. No new index required; migration/raw SQL may be required for safe bulk reorder.
18. **Expected improvement:** Generate ~40 → ~10–12 operations (≈70%); snapshot 32 → 2 operations (94%); 16-row reorder ~35 → ~5 (86%); shorter locks.
19. **Risk of change:** High because bracket graph order, byes, idempotency, and notifications are domain-critical.
20. **Tests required:** Existing bracket suite plus 2/4/8/16 sizes, pair constraints, retries/idempotency, concurrent commands, lock snapshots, queue uniqueness, rollback, and notification dedupe.

## Medium findings

### M-1 — Generic serializers and `include` trees over-fetch list/detail/reference responses

1. **Finding title:** Complete records are selected then mostly discarded or spread.
2. **Severity:** Medium (Critical public cases are separately C-1/C-2).
3. **Category:** API over-fetching / Prisma projection.
4. **Frontend file and line:** Event consumers `frontend/src/app/events/page.tsx:50-84`, `AdminOverviewClient.tsx:122-174`; clubs `AdminClubsClient.tsx:138-182`; notifications `NotificationsClient.tsx:15-23`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** events `events.routes.ts:108-130,201-207`; clubs `clubs.routes.ts:25-34,62-66`; notifications `notifications.routes.ts:8-16`.
7. **Service/database file and line:** `backend/src/common/includes.ts:1-27`; `serializers.ts:20-88,167-239`; `notifications.service.ts:4-13`.
8. **Endpoint and HTTP method:** Event lists/details, admin clubs, categories, notifications, admin users/registrations.
9. **Current behaviour:** Full `Event`, `Category`, `User`, `Club`, `EventRegistration`, and `Notification` rows are loaded via `true` includes. Serializers sometimes remove fields, but database/network work remains; notifications return the raw model.
10. **Why inefficient:** List pages need summaries; mutations need only next-state fields; large description/metadata/dedup/audit columns need not travel.
11. **Fields returned:** Event DTO always includes payment and all publication flags; notification includes recipient/entity IDs, metadata, expiry, dedupe key; admin club query loads complete users; category relation loads creator/timestamps that serializer drops.
12. **Fields actually used:** Public event list uses `id,title,description,date,location,status,categories{id,name}`; home additionally uses arrival and fee, but not IBAN/receiver; notifications use `id,title,message,actionPath,readAt,createdAt`; public club detail uses names/role titles only.
13. **Current request/query count:** Generally one top-level data query per endpoint, but with excessive columns/relations.
14. **Estimated payload:** Public event local 867 → 433 bytes (−50%); admin registration/user savings measured in executive summary. Notification metadata can dominate unpredictably.
15. **Recommended solution:** List/detail/payment/admin DTO separation and explicit Prisma `select`; no raw model response. Serve payment details only to an authenticated eligible registration flow.
16. **Proposed contract:** `PublicEventListItem`, `PublicEventDetail`, `RegistrationPaymentDetails`, `AdminEventDetail`, `NotificationListItem`, `ClubOption`, and `AdminClubDetail` as separate allow-listed shapes.
17. **Required database changes:** None.
18. **Expected improvement:** 45–75% for measured generic lists, larger when metadata/text is populated; reduced accidental exposure risk.
19. **Risk of change:** Medium; every consumer listed in the endpoint matrix must migrate before fields are removed.
20. **Tests required:** DTO allow-list tests, all child/mobile consumers, mutation response tests, payment authorization, and TypeScript build.

### M-2 — Admin schedule loads all users and overlapping full bracket/schedule graphs

1. **Finding title:** Schedule workspace composes four broad endpoints plus four shell endpoints.
2. **Severity:** Medium (request fan-out is counted in H-2).
3. **Category:** Workflow over-fetching / duplicated nested data.
4. **Frontend file and line:** `frontend/src/components/admin/AdminScheduleClient.tsx:29-53,140-169`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** scheduling `scheduling.routes.ts:18-21`; brackets `brackets.routes.ts:33-36`; users `users.routes.ts:56-65`.
7. **Service/database file and line:** `scheduling.service.ts:6-27`; `brackets.service.ts:7-17`; `users.service.ts:139-143`.
8. **Endpoint and HTTP method:** Four GETs: event, schedule, brackets, all users.
9. **Current behaviour:** Schedule and bracket both carry full match/participant graphs; all users are loaded to obtain judge options; client derives unscheduled matches.
10. **Why inefficient:** The same matches and users are represented repeatedly and the page needs only queue rows, unscheduled match options, and judge options.
11. **Fields returned:** Full event, court/assignment/judge/schedule/match graphs, bracket graphs, all admin users.
12. **Fields actually used:** Event date/status/schedule publication; court queue summary; match option `id,round,matchNumber,status,team display names`; judge `id,fullName`.
13. **Current request/query count:** Page 4 requests plus shell 4 plus SSR session = 9 API calls; about 18 visible top-level Prisma/auth calls.
14. **Estimated payload:** Local schedule and bracket alone total ~22 KB before the event/users/shell responses.
15. **Recommended solution:** Purpose-specific `/api/admin/events/:id/schedule-workspace` with narrow related fields and judge options, or keep endpoints but replace them with narrow schedule/bracket/judge contracts and shared query cache.
16. **Proposed contract:** `{ eventSummary, courts:[QueueSummary], unscheduledMatches:[MatchOption], judgeOptions:[{id,fullName}] }`.
17. **Required database changes:** None beyond M-6 query indexes.
18. **Expected improvement:** 9 → 3 API calls with summary/workspace; ~80–90% payload reduction in the current sample.
19. **Risk of change:** Medium; do not turn it into a general “everything” endpoint—keep it schedule-specific.
20. **Tests required:** Schedule counts, duplicate match prevention, judge role/active filter, publication, completed-event read-only, empty states.

### M-3 — Public/reference data is forced `no-store`; authenticated data has no shared request cache

1. **Finding title:** Cache policy is uniformly pessimistic and query reuse is absent.
2. **Severity:** Medium.
3. **Category:** Caching strategy.
4. **Frontend file and line:** `frontend/src/lib/auth.ts:7-18`; `frontend/src/hooks/useClubOptions.ts:11-25`; `frontend/src/components/padel/home/hooks.ts:37-64`; public app fetches in `frontend/src/app/events/page.tsx:23-33`, clubs `:23-30`, players `:29-36`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:20-41`.
6. **Backend controller file and line:** Public routes do not set `Cache-Control`, `ETag`, or `Last-Modified`.
7. **Service/database file and line:** Public event/club/category/player services noted above.
8. **Endpoint and HTTP method:** Public events/clubs/categories/players; authenticated dashboard/admin resources.
9. **Current behaviour:** Nearly every caller explicitly uses `cache:'no-store'`; custom hooks use independent state. Static reference and public directory data is re-requested after navigation.
10. **Why inefficient:** Stable public/reference data misses browser/Next/CDN conditional reuse; authenticated same-resource calls cannot deduplicate. A blanket shared cache would be unsafe for user/capability data.
11. **Fields returned:** Endpoint-specific.
12. **Fields actually used:** Endpoint-specific.
13. **Current request/query count:** One new request per mount/navigation; duplicate admin calls quantified in H-2.
14. **Estimated payload:** Repeated full payload each navigation; exact production hit ratio unavailable.
15. **Recommended solution:** Public clubs/categories: `public, s-maxage=300, stale-while-revalidate=3600` with version/invalidation. Public event list: 15–30 s SWR. Live event/match: event-specific ETag plus socket updates, no long shared freshness. Authenticated/user/capability data: `private,no-store` at HTTP, but request/query cache keyed by user ID, role/capability set, endpoint, filters, and cursor. Admin reference options may use private 5-minute cache.
16. **Proposed contract:** Preserve JSON contracts; add cache headers/ETag and stable client query keys.
17. **Required database changes:** None. Invalidation events must be emitted on create/update/delete.
18. **Expected improvement:** Fewer repeat reads/navigation requests; potentially high CDN hit rate for directories. No cross-user cache leakage.
19. **Risk of change:** Medium-high if keys omit user/publication/capability scope.
20. **Tests required:** Cache headers, 304 flow, invalidation, published→unpublished transition, anonymous/auth role separation, two-user cache isolation.

### M-4 — Mutations reload whole collections even when the response can update local state

1. **Finding title:** Broad refetch-after-write patterns.
2. **Severity:** Medium.
3. **Category:** Mutation/refetching.
4. **Frontend file and line:** Notifications `NotificationsClient.tsx:18-19`; registration `usePlayerDashboard.ts:167-206`; event/admin loaders `AdminEventsClient.tsx:202-277`; schedule `AdminScheduleClient.tsx:55-85`; player opponent actions `PlayerTournamentEventClient.tsx:72-92`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:20-41` (first unsafe request also obtains CSRF token once per browser module lifetime).
6. **Backend controller file and line:** Corresponding mutation routes.
7. **Service/database file and line:** Corresponding service updates.
8. **Endpoint and HTTP method:** POST/PATCH/DELETE across notifications, registrations, events, requests, brackets, schedule.
9. **Current behaviour:** Successful action often discards the returned record or gets `{ok:true}`, then reruns all page GETs. Realtime publication can trigger another reload near the mutation’s manual reload.
10. **Why inefficient:** One row change multiplies into full list/workspace fetches and rerenders.
11. **Fields returned:** Often broad updated entity; sometimes no useful entity.
12. **Fields actually used:** Updated row/version/status, count delta, or deletion ID.
13. **Current request/query count:** Notification mark read: PATCH + GET (2; + initial CSRF only on first mutation). Player request action: mutation + 4 page GETs (5), potentially plus eligible GET and socket invalidation elsewhere.
14. **Estimated payload:** Depends on workflow; schedule reload includes the ~22 KB bracket/schedule sample.
15. **Recommended solution:** Return narrow updated DTO; direct state/query-cache update; precise invalidation only when server-side derived collections change. Deduplicate mutation-originated realtime events by version/command ID.
16. **Proposed contract:** `{item, affectedCounts}` or `{deletedId}`; notification PATCH returns `{notification:{id,readAt},unreadCount}`.
17. **Required database changes:** None.
18. **Expected improvement:** Common mutation 2–5 requests → 1; less UI flicker and render work.
19. **Risk of change:** Medium; optimistic updates should be reserved for reversible/simple changes and reconciled by version.
20. **Tests required:** Success/error/409 rollback, count updates, realtime echo dedupe, delete, loading and stale-state behavior.

### M-5 — API compression and conditional responses are not guaranteed by checked-in production config

1. **Finding title:** Large JSON is served without application compression middleware or explicit Nginx gzip/Brotli policy.
2. **Severity:** Medium.
3. **Category:** Payload/transport.
4. **Frontend file and line:** All API consumers; largest are C-2.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/index.ts:15-31` has JSON parsing/security/CORS but no compression or validators.
7. **Service/database file and line:** N/A.
8. **Endpoint and HTTP method:** All JSON GETs.
9. **Current behaviour:** `deploy/nginx.conf:95-147` proxies API but declares no `gzip`, `gzip_types application/json`, Brotli, or conditional-response configuration. Express has no compression dependency/middleware.
10. **Why inefficient:** Oversized JSON consumes bandwidth and transfer latency. Repository evidence cannot prove a host-global Nginx config is absent, so deployment state outside this file remains suspected; the checked-in supported config itself does not guarantee compression.
11. **Fields returned:** All response fields.
12. **Fields actually used:** As above.
13. **Current request/query count:** Unchanged; transport bytes only.
14. **Estimated payload:** Text JSON commonly compresses 70–90%, but projection must happen first; compressing exposed/unneeded data is not a substitute for C-1/C-2.
15. **Recommended solution:** Enable Nginx gzip (and Brotli if installed) for JSON/text with `Vary: Accept-Encoding`; add ETag/Last-Modified for safe public GETs; verify with production `curl --compressed -I`.
16. **Proposed contract:** No JSON shape change; correct encoding/cache validators.
17. **Required database changes:** None.
18. **Expected improvement:** Likely 70–90% transfer-byte reduction after DTO narrowing.
19. **Risk of change:** Low; avoid compressing already-compressed binaries and verify proxy buffering/timeouts.
20. **Tests required:** Integration response headers, compressed body decode, Vary, 304, WebSocket upgrade unaffected, CPU/load test.

### M-6 — Growth-path queries lack supporting compound indexes

1. **Finding title:** Pagination/filter indexes do not match actual query predicates/order.
2. **Severity:** Medium.
3. **Category:** Database query efficiency.
4. **Frontend file and line:** Consumers in H-1/H-3/H-4/H-6 and notifications.
5. **API client file and line:** N/A.
6. **Backend controller file and line:** Corresponding list routes.
7. **Service/database file and line:** Queries at `events.service.ts:9-19,272-286`; `dashboard.service.ts:23-27`; `users.service.ts:146-154`; `matches.service.ts:147-160`; `notifications.service.ts:4-13`; worker `outbox.worker.ts:49-73`. Schema indexes at `backend/prisma/schema.prisma:295,352-355,527-529,548-550,650-651,674,694`.
8. **Endpoint and HTTP method:** All growth lists and background due-work queries.
9. **Current behaviour:** Event index is `(date,isPublished)`, while public queries use equality on `isPublished` then date range/order. Personal registration OR branches lack owner/teammate-leading history indexes. Notification all-list order cannot fully use `(recipientUserId,readAt,createdAt)` when `readAt` is unconstrained. Expiry worker lacks `(status,expiresAt)`.
10. **Why inefficient:** Database must scan/sort more rows as tables grow; proposed backend filtering/pagination needs deterministic tie-breakers.
11. **Fields returned:** N/A.
12. **Fields actually used:** N/A.
13. **Current request/query count:** Same count, higher scan/sort cost.
14. **Estimated payload:** None; latency/CPU improvement depends on cardinality and query plan.
15. **Recommended solution:** Add only indexes listed in the database matrix below; validate using `EXPLAIN (ANALYZE, BUFFERS)` against production-like cardinality; remove superseded indexes only after observation.
16. **Proposed contract:** Cursor contracts use the indexed order and `id` tie-breaker.
17. **Required database changes:** See matrix.
18. **Expected improvement:** Index scans and removal of large sorts; magnitude unknown without production plans.
19. **Risk of change:** Low-medium; extra storage/write amplification, migration lock considerations.
20. **Tests required:** Migration on production-size clone, EXPLAIN plans, cursor correctness, write throughput, duplicate timestamp ordering.

### M-7 — External Google/Resend calls lack explicit timeouts; worker processes outbox rows serially

1. **Finding title:** External latency can block OAuth requests and outbox batches.
2. **Severity:** Medium.
3. **Category:** External API usage / timeout / retry behaviour.
4. **Frontend file and line:** OAuth initiated from auth UI; no browser direct credential call.
5. **API client file and line:** N/A for server external calls.
6. **Backend controller file and line:** Google callback `backend/src/modules/auth/auth.routes.ts:608-653`.
7. **Service/database file and line:** Resend call `backend/src/common/email.ts:34-64`; worker `backend/src/workers/outbox.worker.ts:11-36,49-69,85-91`.
8. **Endpoint and HTTP method:** Google token/profile calls; Resend email send; internal OAuth callback.
9. **Current behaviour:** Token then profile requests are genuinely dependent and correctly sequential, but neither has an AbortSignal timeout. Resend has no app-level deadline. Up to 25 outbox rows are claimed/processed one-by-one; email retries use exponential backoff to 8 attempts.
10. **Why inefficient/risky:** A stalled provider can occupy an HTTP request or block later outbox rows. Retry cost is bounded but worst-case eight sends per delivery; SDK/provider retry behavior is not documented here, so multiplication above eight is unknown.
11. **Fields returned:** Google token response and full requested `openid email profile`; userinfo fields used are ID/email/verified/name components.
12. **Fields actually used:** OAuth identity and names only; Resend result success/error.
13. **Current request/query count:** OAuth: 2 external requests by necessity. Email: 1 send per attempt, maximum 8 application attempts; outbox DB baseline 2 operations per row plus email-delivery operations.
14. **Estimated payload/cost:** Small payload; risk is latency and retry/provider cost.
15. **Recommended solution:** `AbortSignal.timeout(8_000–10_000)` for Google and provider calls where supported; classify retryable errors; cap concurrency (e.g. 4–8) while preserving per-message idempotency; atomically claim batches with `FOR UPDATE SKIP LOCKED`/returning; circuit-break sustained provider failure.
16. **Proposed contract:** No public contract change; map timeout to stable OAuth error and retain queued email for bounded retry.
17. **Required database changes:** Existing outbox `(status,availableAt)` index; consider adding `createdAt` as in matrix.
18. **Expected improvement:** Bounded tail latency and higher worker throughput; external request count unchanged in success path.
19. **Risk of change:** Medium; concurrency must not violate provider limits or duplicate sends.
20. **Tests required:** timeout, 429/5xx/non-retryable 4xx, eight-attempt cap, worker restart, lease recovery, concurrent workers, idempotency.

## Low findings

### L-1 — GETs continue after navigation and match-history responses can race

1. **Finding title:** Cancellation flags suppress some state updates but do not cancel network/database work.
2. **Severity:** Low.
3. **Category:** Error/cancellation/search race.
4. **Frontend file and line:** `MatchHistoryClient.tsx:26-61`; `usePlayerDashboard.ts:87-107`; `useAdminCounts.ts:22-63`; public hooks `padel/home/hooks.ts:37-64`.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41` accepts `signal` but callers do not supply one.
6. **Backend controller file and line:** Corresponding GET routes.
7. **Service/database file and line:** Corresponding services.
8. **Endpoint and HTTP method:** List/search GETs.
9. **Current behaviour:** Timers/booleans handle unmount, but requests continue. Rapid event selection may let an older match-history response overwrite a newer one.
10. **Why inefficient:** Wasted work after navigation and stale UI race.
11. **Fields returned / 12. used:** Endpoint-specific.
13. **Current request/query count:** One wasted request/query per superseded interaction.
14. **Estimated payload:** Endpoint-specific; match history can be large.
15. **Recommended solution:** AbortController per effect/query; cancel previous request before starting another; ignore AbortError; include stable request generation as a second guard.
16. **Proposed contract:** No backend change.
17. **Required database changes:** None.
18. **Expected improvement:** Eliminates superseded traffic and stale overwrite.
19. **Risk of change:** Low.
20. **Tests required:** rapid selector changes, unmount, aborted error suppression, newest response wins.

### L-2 — Session/user data is repeatedly fetched and auth queries select more columns than required

1. **Finding title:** Duplicate `/auth/me` and full-user auth lookup.
2. **Severity:** Low.
3. **Category:** Redundant authentication request / DB projection.
4. **Frontend file and line:** Server auth `frontend/src/lib/auth.ts:7-18`; Padel navigation `frontend/src/components/padel/home/chrome.tsx:42-67`; admin users additionally requests `/auth/me` at `AdminUsersClient.tsx:58-64` despite admin layout auth.
5. **API client file and line:** `frontend/src/lib/api/client.ts:30-41`.
6. **Backend controller file and line:** `backend/src/modules/auth/auth.routes.ts:374-377`.
7. **Service/database file and line:** `backend/src/modules/auth/auth.service.ts:186-247`.
8. **Endpoint and HTTP method:** `GET /api/auth/me`; every authenticated/capability route.
9. **Current behaviour:** Each request verifies JWT then queries full user plus club membership. Public navigation calls `/auth/me` on every mount. Admin users page calls it again only to obtain current user ID.
10. **Why inefficient:** Repeated user DB lookups and broad column selection; full removal is unsafe because session-version revocation currently requires DB validation.
11. **Fields returned:** Full public user DTO.
12. **Fields actually used:** Padel nav uses role/presence; admin users needs ID; server route guards use ID/role/status/sessionVersion and sometimes club.
13. **Current request/query count:** One DB user query per authenticated API request; admin users page has an avoidable extra `/auth/me`.
14. **Estimated payload:** Small individually; multiplied by H-2 fan-out.
15. **Recommended solution:** Pass current user ID from authenticated server layout/provider; add request-specific auth select; retain session-version checks. A short private session cache is optional only with revocation invalidation and user-scoped keys.
16. **Proposed contract:** Existing `/auth/me`; internal auth principal `{id,role,status,sessionVersion}` plus optional profile load.
17. **Required database changes:** None.
18. **Expected improvement:** Removes one request on admin users; narrower, cheaper auth query across all APIs.
19. **Risk of change:** Medium if revocation semantics are weakened; do not trust role solely from a long-lived client value.
20. **Tests required:** logout/revoke, role change, inactive user, club redirect, server/client hydration, two-user isolation.

## Informational / positive controls

- Frontend multi-resource loads in admin event, schedule, bracket, overview, and public tournament components use `Promise.all`; no independent frontend waterfall was found in those paths. OAuth token→profile, membership→club, and selected-event→matches are genuinely dependent.
- No repeated per-row browser API request was found. N+1 issues are database writes inside services, not table rows fetching detail endpoints.
- No polling loop was found. Live updates use Socket.IO; listener cleanup disconnects the socket on unmount.
- Unsafe requests obtain one cached CSRF token through the shared client. This is a legitimate first-mutation request, not a duplicate bug.
- Public assets are served as files rather than base64 JSON. No application download endpoint buffering binary files was found.
- Retry loops are bounded in the outbox worker; frontend `apiFetch` does not automatically retry validation/auth failures.
- Categories and club options are naturally small reference sets today. They should be cached/versioned, not necessarily paginated immediately.

## Endpoint usage matrix

| Endpoint | Consumers | Returned fields | Used fields | Unused/waste | Requests per page | Cache strategy | Finding |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| `GET /api/public/events` | home, `/events`, match event selector | Full event DTO + categories, up to 7 | List fields; home adds arrival/fee | IBAN/receiver, publication/version/timezone flags; selector needs only id/title/date | 1; repeated across navigation | Public 15–30s SWR, ETag | M-1/M-3 |
| `GET /api/public/events/:id` | public tournament | Full event DTO | id/title/date/location/description/status/category names | payment details, version/timezone/publication flags | 2 during normal initial socket connect cycle | Short SWR outside live; ETag/live patch | H-5/M-1 |
| `GET /api/events?scope=admin` | shell counts, overview, events, tool selectors | All full event DTOs | Varies; shell counts only | Most fields/rows for counts; unbounded | 1–2 on most admin pages | Private shared query or summary | H-2 |
| `GET /api/dashboard` | all player pages, event workspace | user + events + registrations + club members | Page-dependent subset | Whole unrelated sections per page | 1 | Private user-scoped query cache; page DTOs | H-4 |
| `GET /api/admin/registrations` | shell, overview, registration event index | All registration graphs | counts and small summaries | contacts/reasons/relations for counts; unbounded | 1–2 | Private; replace with summary/pages | H-1/H-2 |
| `GET /api/admin/events/:id/registrations` | event review | All global registrations then Node filter | review list fields | Cross-event rows and broad user/category fields | 1 | Private cursor query | H-1 |
| `GET /api/admin/users` | users page, schedule | All users, broad DTO | list fields or judge id/name | all non-judges on schedule; unused stats/profile fields | 1 | Private filtered cursor query | H-3/M-2 |
| `GET /api/admin/judges` | currently no frontend caller | Loads all users then filters | judge option fields | all non-judge DB rows/broad DTO | 0 | Private short option cache | H-3 |
| `GET /api/public/players` | `/players` | All active players + calculated stats | all returned card fields | Unbounded; stats materialize match graphs server-side | 1 | Public SWR + cursor | H-3 |
| `GET /api/public/clubs` | clubs page, forms/options | id/name/slug | all | None in response; repeated no-store | 1 per hook/page | Public 5–60 min versioned | M-3 |
| `GET /api/admin/clubs` | club admin, shell counts | All clubs + member profiles | admin page uses names/role; shell count | Full member graph for count; DB full user fields | 1–2 | Private list/summary split | H-2/M-1 |
| `GET /api/categories` | category/events admin, shell | id/name/description/eventCount | all on category page; event form id/name; shell count | description/count for event options; repeated | 1–2 | Public/versioned reference cache | H-2/M-3 |
| `GET /api/public/events/:id/brackets` | public tournament | Full bracket/match/registration/user graph | compact bracket and team names | personal/internal fields; ~88% local waste | 2 on connect cycle | Live ETag + socket patch | C-2/H-5 |
| `GET /api/admin/events/:id/brackets` | bracket/schedule admin | Full bracket graph | command board / match options | schedule needs compact options; full users/registration fields | 1 | Private event/version query | M-2 |
| `GET /api/public/events/:id/schedule` | public/player tournament | Full court/assignment/judge/match graph | court queue/display fields | judge/contact/full match data; ~89% waste | 2 on connect cycle for public page | Live ETag + socket patch | C-2/H-5 |
| `GET /api/judge/events/:id/courts/:id/queue` | judge queue | Full schedule item/match/entry/court | queue/status/round/team names | most match/registration/user fields | 2 initial | Private live patch | H-5/M-1 |
| `GET /api/judge/matches/:id` | judge scoring | Full match graph | live identity, teams, score, status, version, schedule link | winner/loser/event/payment/internal registration fields | 2 initial | Private live patch, no shared CDN | H-5/M-1 |
| `GET /api/matches*` | public/player/club history | Full match graph, max 50/100 | compact history fields | ~94% local waste; no cursor | 1 (+ event options for general) | Public short SWR/ETag; private own history | C-2/H-6 |
| `GET /api/notifications` | notifications page | Full Notification model + unread count | 7 list fields + count | recipient/entity IDs, metadata, expiry, dedupe key | 2 initial | Private user key; socket patch | H-5/M-1 |
| `GET /api/admin/audit` | no frontend consumer found | Up to 250 full audit rows including JSON/IP/internal reason | Unknown | Contract not exercised; contains query can scan | 0 | No shared cache; cursor when UI added | Informational/M-6 |
| `GET /api/admin/notifications/email-deliveries` | no frontend consumer found | Selected operations fields, max 250 | Unknown | No cursor | 0 | Private/no-store | Informational |

## Client-side filtering matrix

| Page | Dataset | Current client/controller operation | Backend parameters needed | Index needed | Severity |
| --- | --- | --- | --- | --- | --- |
| Event registrations | Global registrations | Controller `.filter(eventId)`, client `.filter(status)` | `eventId,status,cursor,limit` | `(eventId,status,createdAt,id)` | High |
| Admin users | All users | Search `includes`, role/disqualified filters | `q,role,status,disqualified,cursor,limit` | directory order + trigram/functional search | High |
| Admin schedule | All users | `.filter(role === JUDGE)` | `role=JUDGE&status=ACTIVE`, option shape | `(role,status,name,surname,id)` | High |
| Admin events | All events | bucket filter/sort/count | `bucket,isPublished,status,from,to,sort,cursor,limit` + counts | `(isPublished,date,id)`, status/date as needed | Medium |
| Admin overview/shell | Full events/registrations/clubs/categories | multiple filters/counts/slices | purpose-specific aggregate/limits | listed growth indexes | High |
| Player event workspace | Full dashboard | `.find/.filter(eventId/status)` | event-scoped player workspace | registration owner/teammate history indexes | High |
| Match history | First 50 matches | free-text `.includes` | `q,eventId,playerId,clubId,cursor,limit` | `(status,completedAt,id)` + search plan | High |
| Player entries | All personal history | status filter | `status,cursor,limit` when history grows | owner/teammate created indexes | Medium |

Bracket round grouping, schedule sorting already constrained by an event/16-slot bracket, queue readiness checks, and small static UI filters were reviewed and intentionally not flagged as business-data filtering.

## Request reduction matrix

Counts include the server-side session API call where present and normal connect invalidation. Query counts are visible top-level Prisma calls and are approximate.

| Page/workflow | Current requests | Proposed requests | Current queries | Proposed queries | Expected reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Admin overview | 7 | 2 | ~12 | ~5 | 71% requests / ~58% queries |
| Admin events | 7 | 3 | ~10–12 | ~6 | 57% requests |
| Admin schedule | 9 | 3 | ~18 | ~8 | 67% requests / ~56% queries |
| Admin bracket | 8 | 3 | ~16 | ~7 | 63% requests |
| Player overview | 2 | 1 | ~5 | ~3 | 50% requests |
| Player event workspace initial | 6 | 2 | ~9+ | ~5 | 67% requests; defer eligible query |
| Public tournament initial | 7 + socket | 2–3 + socket | ~9 | ~3–4 | 57–71% requests |
| Public score event | 3 GETs | 0 normal / 1 reconcile | ~4 | 0/1 | 67–100% |
| Notification mark-read | 2 (+ first CSRF) | 1 (+ first CSRF) | ~4 | ~2 | 50% requests |
| Player opponent mutation | 5 (+ first CSRF) | 1 (+ first CSRF) | many broad reads | mutation only | ~80% requests |
| Generate 16-entry bracket | 1 | 1 | ~35–40 | ~10–12 | ~70% query reduction |
| Lock 16 participant snapshots | 1 | 1 | 32 snapshot operations + command work | 2 snapshot operations + command work | 94% snapshot-query reduction |
| Reorder 16 queue items | 1 | 1 | ~35 | ~5 | ~86% query reduction |

## Largest payloads

| Endpoint | Current estimated size | Main waste | Proposed size | Expected reduction |
| --- | ---: | --- | ---: | ---: |
| `GET /api/matches` (local 3 rows) | 24,512 B | full event, four registration/user graphs, schedule/court, unused match scalars | 1,501 B | 93.9% |
| `GET /api/public/events/:id/brackets` (local) | 11,338 B | spread match/registration/user records, actor/timestamp fields | 1,389 B | 87.7% |
| `GET /api/public/events/:id/schedule` (local) | 10,988 B | judge assignments/full users/full matches | 1,208 B | 89.0% |
| `GET /api/admin/registrations` (local 3 rows) | 6,252 B | broad event/category/public-user DTOs | 1,627 B before pagination | 74.0% |
| `GET /api/admin/users` (local 10 rows) | 4,348 B | unused profile/stats/club columns | 2,372 B before pagination | 45.4% |
| `GET /api/dashboard` (local 1/1/2) | 4,255 B | page-irrelevant sections and repeated user | page dependent, typically <1–2 KB | ~50–80% |

All sizes are UTF-8 uncompressed JSON body bytes from the current local data.

## Missing pagination

| Endpoint | Current limit | Growth risk | Recommended pagination | Maximum page size |
| --- | ---: | --- | --- | ---: |
| `/api/admin/registrations` | Unbounded | Installation-wide | Cursor `(createdAt,id)`, status/event filters | 50 |
| `/api/admin/events/:id/registrations` | Unbounded and globally loaded | Event registrations | Cursor `(createdAt,id)` | 50 |
| `/api/admin/users` / judges | Unbounded | All accounts | Cursor by stable directory order | 50 / 100 options |
| `/api/public/players` | Unbounded | Public accounts + stats | Cursor `(name,surname,createdAt,id)` | 24–48 |
| `/api/events?scope=admin` | Unbounded | Historical events | Cursor `(date,id)` + bucket filters | 50 |
| `/api/dashboard` registrations | Unbounded | Player lifetime history | Separate personal cursor endpoint | 25 |
| `/api/admin/clubs` | Unbounded including members | Clubs/rosters | Club page cursor; member count/list split | 50 clubs |
| opponent-request lists | Unbounded per event | Retry/history accumulation | Cursor `(createdAt,id)`, status/category | 50 |
| `/api/notifications` | 50/100, no metadata | User history | Cursor `(createdAt,id)`, no total | 50 |
| `/api/matches*` | 50/100, no metadata | Match history | Cursor `(completedAt,id)` | 50 |
| `/api/admin/audit` | 100/250, no metadata | Append-only | Cursor `(createdAt,id)` | 100 |
| email deliveries | 100/250, no metadata | Append-only | Cursor `(createdAt,id)` + status | 100 |

Categories, public club options, one event’s bracket (max 15 matches per generation), and one event’s active courts can remain bounded reference/event resources for now, but admin club/member detail should not embed unbounded rosters indefinitely.

## Database index recommendations

| Model/table | Fields in order | Query supported | Why order matters / expected benefit | Trade-off |
| --- | --- | --- | --- | --- |
| `Event` | `(isPublished, date, id)` | public event list/history, public selector | equality first, then range/order and cursor tie-breaker; current `(date,isPublished)` cannot use publication equality as efficiently after date range | overlaps current index; extra writes/storage until old index evaluated |
| `EventRegistration` | `(eventId, status, createdAt, id)` | event review pages | event/status equality then descending cursor | registration write overhead |
| `EventRegistration` | `(ownerId, createdAt, id)` | personal registration branch | owner equality and history order | two history indexes increase write/storage |
| `EventRegistration` | `(teammateId, createdAt, id)` | teammate personal branch | teammate equality and history order | same |
| `User` | `(role, status, name, surname, createdAt, id)` | public/admin directory and judge options | equality scopes then display order/cursor | name updates maintain index; nullable ordering must be specified |
| `Match` | `(status, completedAt, id)` | completed match history | status equality then history cursor | match status/complete writes update index |
| `Notification` | `(recipientUserId, createdAt, id)` | all-notification pages | avoids unbound `readAt` between recipient and order; existing index remains useful for unread queries | extra append index |
| `OpponentRequest` | `(status, expiresAt, id)` | worker expiry scan | due status then expiry range | request status changes update index |
| `OutboxMessage` | `(status, availableAt, createdAt, id)` | worker due batch | due predicate then deterministic order/claim | high-write queue index overhead; benchmark against current index |
| `AuditLog` | `(action, createdAt, id)` only if action becomes exact/prefix | audit filter | current `contains` cannot use B-tree; prefer exact/prefix or add trigram only with demonstrated need | extra audit write cost; trigram is larger |

For admin contains-search across name/email, a real query supports either (a) normalized prefix search with functional B-tree indexes or (b) a `pg_trgm` GIN expression index. Do not add both before measuring.

## Cache classification

| Data class | Examples | Recommended policy |
| --- | --- | --- |
| Public static/reference | categories, club options | Browser/Next/CDN cache, versioned ETag, 5–60 minute freshness, explicit invalidation |
| Public frequently changing | event list, public directories | CDN SWR 15–300 seconds depending resource, ETag |
| Authenticated user-specific | dashboard, own entries, notifications | HTTP `private,no-store`; shared client query cache keyed by user + filters; socket/direct updates |
| Permission-sensitive admin | users, reviews, drafts, audit | HTTP `private,no-store`; short in-memory client stale time, capability/user-scoped key; precise invalidation |
| Live competition | score, bracket/schedule state | No long shared freshness; initial SSR/GET + centralized socket partial updates; version reconciliation |
| Expensive reports/exports | none implemented | When added: async job + user/capability-scoped object storage; never cache across users by URL alone |
| External identity/email | Google OAuth, Resend | No response cache; timeouts, bounded retry/circuit breaking, provider idempotency |

## Prioritized implementation plan

### Immediate fixes

| Change | Complexity | Regression risk | Request reduction | Payload reduction | Query reduction | Tests required |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Replace raw opponent-request responses with role DTOs/selects | Medium | Medium | mutation 2→1 when patched locally | 60–85% estimated | lower relation column load | security allow-list + role contracts |
| Replace public bracket/schedule/match spreads with explicit selects/DTOs | Medium-high | Medium-high | none initially | 88–94% measured | fewer relation/column reads | public allow-list + all consumers |
| Fix event registration `where` and add max/cursor | Medium | Medium | unchanged per load | up to >99% at scale | global query→event page | isolation/pagination |
| Remove socket `connect` duplicate initial reload | Low | Low | 50% initial live-page data GETs | same | 50% initial read queries | connect/reconnect tests |
| Add `/api/admin/navigation-summary` | Medium | Low-medium | 4 GETs→1; overview 7→2 total | >95% for counts | ~7→5 or ~2 with one aggregate | count/invalidation/isolation |
| Stop returning raw Notification models | Low | Low | none | metadata-dependent | narrower select | response allow-list |

### Short-term fixes

| Change | Complexity | Regression risk | Request reduction | Payload reduction | Query reduction | Tests required |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Page-specific player dashboard/entries/event-workspace endpoints with SSR initial data | High | Medium | overview 2→1; workspace 6→2 | 50–80% | ~40–55% | per-page E2E/contracts |
| User/player/judge backend filtering and cursor pagination | High | Medium | schedule can use workspace/option query | 45%+ plus page bound | materialized match rows→aggregate | search/abort/stats/cursor |
| Match history compact DTO + server search/cursor | High | Medium | unchanged, bounded | ~94% per current sample | smaller relation query | search/public visibility/cursor |
| Precise mutation cache/state updates | Medium | Medium | 2–5→1 per mutation | avoids full reload | avoids broad reads | 409/error/realtime echo |
| Enable verified JSON compression + ETag/SWR headers | Low-medium | Low | conditional GETs avoid bodies | 70–90% compressed transfer after projection | 304 avoids reads if served at edge/cache | proxy/header/load tests |
| Add and validate growth indexes | Medium | Low-medium | none | none | lower scans/sorts | migration + EXPLAIN |
| External API timeouts and worker concurrency cap | Medium | Medium | unchanged success path | none | better batch throughput | timeout/retry/multiworker |

### Larger refactors

| Change | Complexity | Regression risk | Request reduction | Payload reduction | Query reduction | Tests required |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Central Socket.IO provider with versioned resource reducers | High | High | score events 3 GETs→0 | eliminates repeated bodies | eliminates read bursts | reconnect/gaps/authorization |
| Batch bracket graph/snapshot/reorder/notification writes | High | High | HTTP unchanged | narrow command DTO | 70–94% affected operations | exhaustive domain/concurrency/idempotency |
| Unified typed request/response DTO layer (list/detail/option/public/admin) | High | Medium | enables dedup | systemic | systemic narrower selects | contract generation/consumer builds |
| Production performance telemetry | Medium | Low | measurement only | measurement only | identifies real hot plans | payload bytes, route latency, Prisma query count, cache hit, socket events |

## Recommended execution order

1. **Security and cost containment:** C-1, C-2, event registration DB scoping, socket duplicate-load removal.
2. **Largest request reduction:** admin navigation/overview summary, schedule workspace, player page-specific loading.
3. **Largest payload reduction:** match-history/list DTOs, schedule/bracket public DTOs, notifications.
4. **Database changes:** add indexes only with the new query contracts and verify plans.
5. **API contract migration:** publish parallel v2/named DTOs or migrate every listed consumer atomically; do not silently remove shared broad fields.
6. **Caching/transport:** add safe public SWR/ETag, private user-scoped query cache, then compression.
7. **Architecture:** centralized realtime partial updates and batched tournament writes.

## Completion criteria for the implementation phase

- Public/player JSON allow-list tests prove credential, session, internal note, legal, phone, and review fields are absent unless explicitly authorized and required.
- Every growth list has validated filters, maximum limit, deterministic cursor metadata, and matching UI loading/empty/error/load-more behavior.
- Admin overview and schedule page request budgets are enforced in browser tests.
- Realtime pages make one initial data load and do not refetch full state for a score event.
- Payload budgets are recorded for representative 16-entry brackets, multi-court schedules, 50-row history pages, and admin review lists.
- Database query-count budgets cover bracket generation/lock/reorder and notification fan-out.
- Cache tests demonstrate user/capability/publication isolation and invalidation.
- Production proxy verification confirms compression, validators, and WebSocket upgrades.
