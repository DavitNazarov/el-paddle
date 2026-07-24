# Tournament Management Feature Implementation Plan

> **Historical document.** This is the original design plan written before the tournament system was built. The implementation has since shipped and evolved past several details recorded here — for example, brackets now size dynamically to 2–16 approved entries (2/4/8/16 slots), each club fields at most one team per event, and completed events can be explicitly reopened. For the current system, read [docs/BUSINESS_OVERVIEW.md](docs/BUSINESS_OVERVIEW.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), and [docs/TOURNAMENT_OPERATIONS.md](docs/TOURNAMENT_OPERATIONS.md).

## 1. Executive Summary

This repository is an Express 4 + Prisma 7/PostgreSQL backend and a Next.js 16/React 19 frontend. It is not NestJS, and it currently has no bracket, match, court, schedule, persistent notification, queue/worker, transactional outbox, or WebSocket implementation. The safest implementation is therefore an incremental extension of the existing modules and UI shells, not a parallel tournament subsystem.

The confirmed competition entry is `EventRegistration`: one approved registration represents a two-player pair (`ownerId` + `teammateId`) in one event category. A `Club` is display, authorization, notification, and history context, but is not the bracket participant. Both players are currently required by service logic to share one club, and each user has at most one `ClubMember` row. Multiple different registrations from the same club may compete in the same event/category, so all tournament records and controls must use registration/entry IDs and show player names in addition to club names.

Recommended core design:

- Add explicit event lifecycle state while retaining `Event.isPublished` solely for event-page discoverability.
- Extend the registration state machine and make `EventRegistration` the stable competition-entry FK.
- Add category-scoped `OpponentRequest`, `Bracket`, `Match`, `Court`, judge assignment, schedule, score-event, notification, email-delivery, outbox, command-deduplication, and persistent audit records.
- Add `JUDGE` and a server-side capability guard. The high-risk override is protected by `OPPONENT_REQUEST_OVERRIDE`, not merely hidden in the UI.
- Perform every state change plus audit/notification/outbox creation in one database transaction; send email and WebSocket messages only from committed outbox records.
- Keep HTTP commands authoritative. WebSockets only invalidate/refetch or deliver committed projections.
- Derive match history from immutable completed matches and captured participant/club snapshots. Stop treating mutable `User.matchesPlayed/wins/losses` as the historical source of truth.

## 2. Existing System Findings

### Architecture and reusable code

| Area | Existing implementation | Reuse/extension decision |
|---|---|---|
| Backend | Express routers mounted in `backend/src/routes.ts`; business logic in `*.service.ts`; Prisma client in `backend/src/database/prisma.ts` | Follow the existing router/service convention. Do not introduce NestJS modules, controllers, DTO decorators, guards, or policies. Add plain validation functions and reusable authorization helpers. |
| Authentication | Cookie JWT with `sessionVersion`; `getCurrentUser`, `requireUser`, and `requireAdmin` in `backend/src/modules/auth/auth.service.ts` | Reuse cookie auth and session revocation. Extend the serialized/session user shape for `JUDGE`; add `requireCapability` and assignment/entry ownership checks. |
| Roles | `UserRole.USER` and `UserRole.ADMIN`; admins may also be elevated by verified email in `ADMIN_EMAILS` | Add one `JUDGE` role. Preserve `ADMIN_EMAILS` behavior for admins, but never use it to infer judge or entry authority. |
| Clubs | `Club`, `ClubMember`; database uniqueness permits one club membership per user; public/admin serializers already separate sensitive fields | Reuse. Add entry-scoped authorization; do not grant every club member control over every club entry. Capture club snapshot on bracket lock/match resolution. |
| Events | `Event` has details and `isPublished`; `EventCategory` supports multiple categories | Add lifecycle and independent tournament publication settings. `isPublished` remains event listing/detail visibility, not registration or bracket state. |
| Registrations | `EventRegistration` is a pair with event/category/owner/teammate and `PENDING`, `APPROVED`, `DECLINED`; unique indexes and a PostgreSQL trigger prevent a player appearing in multiple registrations in one event | Reuse as competition entry. Extend status/version/reason fields and transition logic. Existing uniqueness is compatible with multiple entries per club, but intentionally prevents a player entering multiple categories in one event. |
| Registration UI | Admin page loads all registrations and directly switches among three states; player dashboard registers and shows entries | Extend existing pages/components. Replace unrestricted state switching with valid actions, reasons, expected version, and event gates. |
| Email | Resend wrapper and templates in `backend/src/common/email.ts` and `backend/src/common/notifications.ts`; dev console fallback | Keep provider wrapper/template conventions, but stop sending business email inline. Move tournament delivery through outbox/worker. Auth/invite emails can migrate afterward or in the same infrastructure phase. |
| Audit | `auditLog` writes structured stdout lines; only a few routes call it | Retain stdout operational log, but add durable `AuditLog` rows for business decisions and corrections. |
| Public UI | Homepage consumes `/api/public/events`; public club page exists | Add an event detail route and published bracket/schedule/live/results sections. Reuse current API URL helpers and UI primitives. |
| Frontend data | Client hooks use `apiFetch`, local `useState`, and reload-after-mutation; no query library | Continue this pattern initially. Add shared tournament hooks/event-stream client rather than introducing a query library only for these features. |
| Deployment | Docker Compose/PostgreSQL/Express/Next.js; Nginx already forwards upgrade headers; migrations run manually | Add worker service and WebSocket process support to existing deployment files. Use PostgreSQL-backed outbox so Redis is not required initially. |

### Missing systems and conflicts

- No event lifecycle exists. `isPublished` currently doubles as discoverability and registration eligibility; `createRegistration` accepts any published event regardless of date or lifecycle.
- Registration status update uses one unrestricted `PATCH`, sends email after the database update but in the HTTP request, sends on no-op updates, and has no in-app notification, version, durable audit, idempotency, or transaction spanning side effects.
- `DECLINED` is the existing equivalent of requested `REJECTED`. Retaining its database name avoids an unnecessary enum rename; present it as “Rejected” in product copy if desired.
- `backend/src/common/notifications.ts` contains email functions, not persistent notifications.
- `backend/src/common/audit.ts` is not a searchable audit history.
- No tenant or organization model exists. This is a single-tenant system today. Do not add meaningless `organizationId` columns; if multi-tenancy becomes a requirement, it needs a separate root-domain migration and mandatory scoping across every existing table.
- No club-owner/admin concept exists. `ClubMember.roleTitle` is presentation text, not authorization. Initially, only an entry’s owner or teammate may act for that entry; club-wide delegation requires a real club membership role/capability.
- Existing users have mutable aggregate stats. Those fields can temporarily be retained as a cache, but completed `Match` records are authoritative and a reconciliation job must be able to rebuild aggregates.
- There are no tests or test dependencies in either workspace. Test infrastructure is a prerequisite, not an optional final step.
- There is no WebSocket package/server, worker command, scheduler, or outbox. Nginx is ready for upgrade headers but nothing consumes them.
- The task’s suggested routes omit the repository’s `/api` convention. All backend routes below include `/api`.

## 3. Confirmed Business Flow

1. Admin creates an event, links categories, publishes the event page, and explicitly opens registration.
2. A non-admin, non-judge player with a club submits one two-player `EventRegistration`. The pair is the competition entry; its club is obtained from both players and must match.
3. Admin reviews the entry using a valid registration transition. The same transaction stores state/history, persistent notifications, email deliveries/outbox messages, and audit data.
4. Admin closes registration. Only approved, eligible entries are candidates for opponent requests and brackets.
5. For each event category, admin may open a first-round request window. Entry A requests eligible entry B. Entry B’s owner or teammate accepts or refuses. Acceptance awaits admin; refusal remains reviewable and may be explicitly overridden.
6. Admin resolves conflicts, approves/rejects requests, then generates a draft category bracket. Approved/overridden requests constrain only first-round pairing. Remaining entries are seeded deterministically and byes are assigned.
7. Admin reviews, locks, and separately publishes the bracket. Locking freezes entry membership and first-round request changes.
8. Admin creates event courts, assigns judges for non-overlapping time windows, schedules matches, and publishes the schedule independently.
9. During `ONGOING`, an assigned active judge starts the ready match and submits score commands. The server validates assignment, court state, match version, score bounds, and command ID.
10. The score command reaching 6 completes the match and advances the winner in one transaction. Non-standard outcomes and post-completion corrections use explicit admin commands with reasons.
11. Public and private clients receive committed WebSocket signals and refetch authorized projections. Published controls determine public visibility.
12. Admin completes the event only after all required category brackets are final. Results and match history remain queryable; corrections require capability, reason, immutable audit, and controlled downstream recomputation.

## 4. Assumptions and Product Decisions

- **Competition entry:** `EventRegistration` is the canonical entry. API responses may call it `entry`, but database FKs reference `EventRegistration.id`; no duplicate `CompetitionEntry` table is needed.
- **Entry authority:** either player in the registration can create/withdraw an outgoing request and respond when their entry is targeted. This is safer than granting all club members authority. A future `ClubMemberRole` can add club manager delegation.
- **Recipients:** active owner and teammate are the default entry contacts. Deduplicate identical addresses/user IDs. Relevant admins receive in-app notifications; admin email is opt-in via notification preferences, not broadcast to every admin.
- **Categories:** every bracket and opponent-request window is category-scoped. Event-level controls aggregate category state but never mix categories.
- **Round of 16 meaning:** opponent requests apply to the earliest played round in a bracket whose configured size is 16. If fewer than nine entries produce a smaller bracket, requests should be disabled unless product explicitly chooses “first round regardless of label.” Recommended default: require bracket size 16 for this feature and allow byes.
- **Registration states:** retain `DECLINED`; add `NEEDS_CHANGES`, `WAITLISTED`, `WITHDRAWN`, and `CANCELLED`. `PENDING` and `APPROVED` remain. `WITHDRAWN` is participant initiated; `CANCELLED` is admin/system initiated.
- **Rollback:** routine backward lifecycle transitions are blocked. An admin with `EVENT_STATE_CORRECT` may perform exceptional rollback only before dependent state makes it unsafe, with confirmation, reason, version check, and audit. Completed-event correction does not reopen normal scoring.
- **Publication:** `Event.isPublished`, bracket publication, schedule publication, public live scoring, and results publication are separate controls.
- **Scoring:** normal matches end exactly when either score becomes 6. A decrement from 6 cannot occur because completion is atomic; corrections use a dedicated admin correction workflow.
- **Time:** store UTC, show event-local time. Add `Event.timeZone` because server/process time zone is not a reliable event time zone.
- **Single tenancy:** enforce resource relationships and IDOR prevention now. Do not claim organization isolation until an organization root exists.

## 5. Event State Machine

| Current | Actor/capability | Action | Next | Preconditions | Effects |
|---|---|---|---|---|---|
| `REGISTRATION_OPEN` | Admin / `EVENT_STATUS_MANAGE` | Close registration | `REGISTRATION_CLOSED` | No write already in progress; expected version matches | Blocks new entries and normal entry edits; notifies approved/pending contacts as configured |
| `REGISTRATION_CLOSED` | Admin / `EVENT_STATUS_MANAGE` | Start event | `ONGOING` | At least one locked bracket; unresolved matches are schedulable; confirmation | Blocks request/bracket regeneration, enables judge start/score, emits committed event update |
| `ONGOING` | Admin / `EVENT_STATUS_MANAGE` | Complete event | `COMPLETED` | All required brackets final, no active match, results internally consistent | Blocks normal scoring/scheduling/bracket changes; publishes nothing automatically |

Invalid normal transitions are all skips, reversals, and same-state commands. Same-state commands return the current representation with `idempotent: true` and create no notification/outbox/audit-success duplicate. Creation defaults to `REGISTRATION_OPEN` only if product wants immediate registration; recommended default is `REGISTRATION_CLOSED`, followed by an explicit “Open Registration” confirmation. Existing events are backfilled in migration as described below.

Action gates:

- `REGISTRATION_OPEN`: create registrations; admin registration decisions allowed; opponent requests, bracket generation, scoring blocked.
- `REGISTRATION_CLOSED`: new registration blocked; final admin decisions allowed until an entry is bracket-locked; request window and draft bracket actions allowed.
- `ONGOING`: judge scoring and schedule execution allowed; registration/request and draft generation blocked.
- `COMPLETED`: read-only except privileged correction commands.

Each transition atomically increments `Event.version`, writes `EventStatusHistory`/`AuditLog`, creates notifications/outbox rows, and records actor/time/reason. Confirmation is required for close/start/complete and all exceptional rollback. Opening/closing registration, starting, completing, or exceptional rollback produces recipient-specific notifications; public clients only receive state allowed by publication controls.

## 6. Registration State Machine

| Current | Actor | Allowed action | New state | Reason rule |
|---|---|---|---|---|
| none | Entry owner | Submit during open registration | `PENDING` | none |
| `PENDING` | Admin | Approve / reject / request changes / waitlist / cancel | `APPROVED` / `DECLINED` / `NEEDS_CHANGES` / `WAITLISTED` / `CANCELLED` | public reason required except approval; internal note optional |
| `NEEDS_CHANGES` | Entry owner/teammate | Resubmit corrected entry | `PENDING` | changed fields recorded |
| `NEEDS_CHANGES`, `WAITLISTED` | Admin | Approve / reject / cancel | `APPROVED` / `DECLINED` / `CANCELLED` | public reason required for negative states |
| `APPROVED` | Admin | Reject an approved entry | `DECLINED` | public reason required |
| `APPROVED` | Entry owner/teammate | Withdraw before bracket lock | `WITHDRAWN` | confirmation; optional public reason |
| `PENDING`, `NEEDS_CHANGES`, `WAITLISTED` | Entry owner/teammate | Withdraw | `WITHDRAWN` | confirmation |
| any non-terminal, pre-lock | Admin | Cancel | `CANCELLED` | public reason required |

`DECLINED`, `WITHDRAWN`, and `CANCELLED` are terminal in routine flow. Restoring one requires `REGISTRATION_CORRECT`, an admin reason, eligibility revalidation, and no locked bracket dependency. Approval verifies both users are active, not currently disqualified, still in the same club, category belongs to event, registration is closed/open as policy permits, and neither player overlaps another registration.

Status update transaction: lock/update with `where id + version`, persist previous/new state and public/internal reasons, audit actor, create in-app notifications, one email-delivery record per recipient, outbox messages, and command receipt. Email/WS occurs after commit. `commandId` and unchanged-state handling prevent duplicates.

## 7. Opponent Request State Machine

Each request belongs to one event/category and two distinct approved registration entries. Window state is stored per `EventCategory` (or an `OpponentRequestWindow` record), not only on `Event`.

| Current Status | Actor | Action | New Status | Email Recipients | Dashboard Recipients | Admin Override Allowed |
|---|---|---|---|---|---|---|
| none | Requesting entry member | Create | `PENDING_RESPONSE` | Target entry contacts | Target contacts; relevant admins | No |
| `PENDING_RESPONSE` | Requesting entry member | Change target/message | `PENDING_RESPONSE` with new version | Old target if withdrawn; new target | Both affected entries; admins | No |
| `PENDING_RESPONSE` | Requesting entry member | Withdraw | `WITHDRAWN_BY_REQUESTER` | Target contacts | Both entries; admins | No |
| `PENDING_RESPONSE` | Target entry member | Accept | `ACCEPTED_BY_OPPONENT` | Requester contacts | Both entries; admins | No |
| `PENDING_RESPONSE` | Target entry member | Refuse | `REFUSED_BY_OPPONENT` | Requester contacts | Both entries; admins | Yes |
| `PENDING_RESPONSE` | Worker | Expire after deadline | `EXPIRED` | Both entries if configured | Both entries; admins | No |
| pending/accepted | Conflict resolver | Mark competing assignment | `CONFLICTED` | affected entries if material | affected entries; admins | No; resolve first |
| `ACCEPTED_BY_OPPONENT` | Admin / `OPPONENT_REQUEST_DECIDE` | Approve | `APPROVED_BY_ADMIN` | Both entries | Both entries; admins | No |
| accepted/refused/conflicted | Admin / `OPPONENT_REQUEST_DECIDE` | Reject | `REJECTED_BY_ADMIN` | Both entries | Both entries; admins | No |
| `REFUSED_BY_OPPONENT` | Admin / `OPPONENT_REQUEST_OVERRIDE` | Override with reason | `OVERRIDDEN_BY_ADMIN` | Both entries | Both entries; admins | Yes |
| approved/overridden | Admin / `BRACKET_MANAGE` | Apply atomically to draft | `APPLIED_TO_BRACKET` | Both entries when pairing confirmed | Both entries; admins | No |

Deterministic conflict rules:

1. One active outgoing request per entry and one active provisional/approved pairing per entry. Partial unique indexes enforce these rules where Prisma cannot.
2. A mutual A→B and B→A request is normalized under a canonical pair key (`least(entryId), greatest(entryId)`). The second create returns the existing request to the authorized actor rather than creating a duplicate; the target may respond normally.
3. Multiple entries may target B while pending, but accepting one atomically marks other pending requests involving B `CONFLICTED`. Admin may reject/reopen them if the accepted request is later rejected. Recommended stricter alternative is one active incoming request; product should decide.
4. Responses use expected version and a row/advisory lock over both sorted entry IDs. Respond/withdraw races yield one winner and `409 VERSION_CONFLICT` for the loser.
5. Entry withdrawal, disqualification, category change, or registration loss of approval invalidates all non-final requests involving it and creates audit records. Category changes after approval should normally be blocked rather than cascading silently.
6. Closing the window blocks new/change/withdraw/response actions but leaves admin decisions available. A worker expires unanswered requests at the configured deadline.
7. Bracket generation may proceed with unresolved requests only after explicit confirmation; unresolved requests become expired/rejected in the same transaction and are never silently applied.
8. Applying a request writes the two entry IDs into one first-round match under locks, verifies neither is elsewhere, then sets request to `APPLIED_TO_BRACKET`. It is idempotent for the same match and conflicts for another match.

## 8. Admin Override Rules

- Only an active user with `OPPONENT_REQUEST_OVERRIDE` can see and invoke override. Default role mapping grants it to `ADMIN`; persisted capability denial/grant allows future separation of duties.
- Override is valid only from `REFUSED_BY_OPPONENT`, with a required public explanation, optional internal note, confirmation flag, `expectedVersion`, and unique `commandId`.
- In one transaction: lock request and both entries in sorted order; revalidate event/category/window/bracket state, registration approval, active/non-disqualified players, distinct entries, and absence of another locked pairing; update status/version/actor/timestamps/reasons; write durable audit; create notifications/email deliveries/outbox/command receipt.
- Public explanation is included in both clubs’ notifications. Internal note is stored only in protected audit/request fields and is never returned by club/public serializers or templates.
- Override does not itself edit a bracket. It makes the request eligible for an explicit apply/generate step; the later action creates `APPLIED_TO_BRACKET`.
- Audit search supports event, category, request, actor, entry, action, and date. Audit is append-only to application roles.
- If either entry becomes ineligible after override and before apply, application fails and the request is marked conflicted/invalidated through a separate audited command; it is not silently paired.

## 9. Role and Capability Matrix

`CLUB_USER` below maps to the existing `USER` role plus entry membership. `PUBLIC_USER` is unauthenticated. Capabilities are enforced by backend helpers; UI visibility is only a convenience.

| Action | ADMIN | CLUB_USER | JUDGE | PUBLIC_USER |
|---|---|---|---|---|
| Manage event lifecycle/publication | `EVENT_STATUS_MANAGE` / `EVENT_PUBLISH` | No | No | No |
| Review registration | `REGISTRATION_REVIEW` | No | No | No |
| Submit/edit/withdraw own entry | No athlete participation | Yes, when owner/teammate and state allows | No | No |
| Create/respond to own entry requests | Review only unless acting via admin decision | Yes, entry-scoped | No | No |
| Decide request | `OPPONENT_REQUEST_DECIDE` | No | No | No |
| Override refusal | `OPPONENT_REQUEST_OVERRIDE` | No | No | No |
| Generate/lock/publish bracket | `BRACKET_MANAGE` / `BRACKET_PUBLISH` | No | No | Published read only |
| Manage judges/courts/schedule | `JUDGE_MANAGE`, `SCHEDULE_MANAGE`, `SCHEDULE_PUBLISH` | No | Own assignment read only | Published read only |
| Start/score match | Correction only | No | Yes only when active, assigned to match/court, and match ready | No |
| Non-standard completion | `MATCH_RESULT_ADMIN` or assigned judge only for explicitly enabled result types | No | Capability/assignment constrained | No |
| Correct completed result | `MATCH_RESULT_CORRECT` + reason | No | No | No |
| Read notifications | Own | Own | Own | No |
| Read audit/internal notes | `AUDIT_READ` | No | No | No |
| Read history | All; private details capability-gated | Own and published club/player records | Assigned/published | Published fields only |

All resource checks validate linked event/category/entry IDs in the same query/transaction. Entry commands require `ownerId=user.id OR teammateId=user.id`; club membership alone is insufficient. Judge commands require `User.role=JUDGE`, active status, a current assignment whose court and event match the scheduled match, and no other active court match. Notification reads require `recipientUserId=user.id`. WebSocket joins repeat these checks. Because no tenant exists, “tenant isolation” is documented as not applicable; future tenancy must add a mandatory organization FK and compound unique/index scope everywhere.

## 10. Data Model Changes

### Existing models to extend

- `User`: add `JUDGE` enum value; add capability grants relation. Keep aggregate stats temporarily as cache/deprecated fields.
- `Event`: `status`, `version`, `timeZone`, `registrationClosedAt`, `startedAt`, `completedAt`, `schedulePublishedAt`, `publicLiveScoringEnabled`, `resultsPublishedAt`. Keep `isPublished` as event-page publication.
- `EventCategory`: add request-window fields (`opponentRequestsOpenAt`, `...CloseAt`, deadline/version) or relation to an `OpponentRequestWindow`. A separate window record is preferred if reopening history is required.
- `EventRegistration`: add `version`, `publicStatusReason`, `internalReviewNote`, `withdrawnAt`; retain `declineReason` for migration then replace it after backfill. This row is the entry FK.
- `ClubMember`: no authorization change in this scope. `roleTitle` must not be treated as a capability.

### New models

- `UserCapabilityGrant(userId, capability, effect, grantedById, createdAt)`: optional overrides on role defaults; unique user/capability.
- `EventStatusHistory(eventId, fromStatus, toStatus, actorId, reason, commandId, createdAt)`.
- `RegistrationStatusHistory(registrationId, fromStatus, toStatus, actorId, publicReason, internalNote, commandId, createdAt)`.
- `OpponentRequest`: event/category, requester/target registration IDs, status, message/reasons, responder/admin actors/timestamps, canonical pair key, expiry, version, applied match ID, timestamps.
- `Bracket`: event/category, size, status (`DRAFT`,`LOCKED`,`COMPLETED`), generation/version, locked/published/completed timestamps, actor IDs; unique active bracket per event/category.
- `Match`: bracket, round enum, round position/match number, A/B entry IDs, scores, winner/loser entry IDs, next match/slot, status, result type, version, schedule/court/judge pointers where appropriate, timestamps, and snapshot JSON/normalized snapshot rows.
- `MatchParticipantSnapshot`: match/side, entry ID, owner/teammate user IDs and display names, club ID/name, category/event labels at lock/completion. This prevents current club changes rewriting history.
- `Court`: event, name, description/location, active flag, version; unique name per event.
- `CourtJudgeAssignment`: court/judge, start/end, assignedBy, active/revoked timestamps. Exclusion/transaction checks prevent overlaps.
- `ScheduleItem`: match unique FK, court, queue position, planned start/end estimate, status, version, publication metadata. Unique court/queue position.
- `ScoreEvent`: match, judge, side, action, before/after values, matchVersion, commandId, createdAt; unique command ID per actor/match or globally.
- `Notification`: recipient, type, event/entity context, safe action path, payload, readAt, deduplication key, timestamps.
- `EmailDelivery`: notification/outbox relation, recipient, template, safe payload, status, attempts, provider ID/error, next attempt/sent timestamps, deduplication key.
- `OutboxMessage`: topic, aggregate type/id, payload, status, attempts, availableAt/lockedAt/processedAt/error, deduplication key.
- `CommandReceipt`: command ID, actor, scope/action, response snapshot/hash, status, created/expiry; unique actor/action/command ID.
- `AuditLog`: action, actor, event/entity IDs, before/after safe JSON, public reason, internal reason, IP/request metadata, createdAt. Never store secrets or email template tokens.

Important indexes/constraints: request event/category/status and canonical active pair; entry active outgoing/provisional pairing partial unique indexes; notification recipient/read/created and unique dedup key; email/outbox status/available time and unique dedup key; bracket event/category/generation; match bracket/round/position unique, next-slot winner placement unique, status/court; schedule unique match and court/order; judge/time queries; score-event command unique; audit event/action/date and entity/date; history player/club/event/category/date via snapshot indexes.

## 11. Database Migration Plan

1. Add enum values and nullable columns/models/indexes without changing current behavior. PostgreSQL enum additions should be committed separately if required by deployment transaction constraints.
2. Backfill `Event.status`: future/current events require product review; recommended safe mapping is published future events → `REGISTRATION_OPEN`, unpublished future events → `REGISTRATION_CLOSED`, past events → `COMPLETED`. Produce a dry-run query and require admin confirmation before production migration because date alone cannot prove lifecycle.
3. Backfill registration `publicStatusReason` from `declineReason`; retain `DECLINED`. Set versions to 0 and create synthetic history/audit rows marked `MIGRATION_BACKFILL` if historical traceability is required.
4. Backfill event time zone with an explicitly configured default (likely `Asia/Tbilisi`) only after product confirmation.
5. Add new FKs with `ON DELETE RESTRICT` for historical tournament records. Existing event/registration cascade deletes conflict with history; once tournament dependencies exist, replace destructive deletion with archival and restrict event/registration/user deletion.
6. Add partial unique indexes and optional PostgreSQL exclusion constraints in SQL migrations. Prisma schema alone cannot express all active-state or time-overlap constraints.
7. Deploy code that dual-reads old/new reason/stat fields, then switch writes to new models. Validate counts and FK integrity.
8. Make required columns non-null after backfill. Regenerate Prisma client. Never edit generated files manually.
9. Rollback is forward-fix: new tournament rows are preserved. Do not down-migrate by dropping completed match/audit/history data.

Backward compatibility: old clients can continue reading current event/registration fields during a compatibility release. Status responses add values, so frontend types must deploy before admins use new transitions. `UserRole.JUDGE` requires all redirect/navigation code to handle a third role before judge accounts are created.

## 12. Backend Endpoint Matrix

All routes use current `/api` convention, JSON, cookie auth, stable error codes, `expectedVersion` for mutable aggregates, and `commandId` for commands. List responses are paginated where collections can grow. `Service` names below are new files unless identified as extensions.

| Method | Route | Actor | Capability | Request | Response | Validation | Service | Transaction | WebSocket Event | Frontend Caller | Tests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PATCH | `/api/admin/events/:eventId/status` | Admin | `EVENT_STATUS_MANAGE` | status, reason, confirmation, expectedVersion, commandId | event + enabled actions | state edge, dependencies | extend `events.service.ts` | event/history/audit/notifications/outbox | `event.status.updated` | admin event detail | transitions, no-op, rollback denial |
| GET | `/api/admin/events/:eventId/registrations` | Admin | `REGISTRATION_REVIEW` | filters/page | entries/page | event scope | extend registrations service | No | none | admin event registrations | scope/pagination |
| PATCH | `/api/admin/events/:eventId/registrations/:registrationId/status` | Admin | `REGISTRATION_REVIEW` | status, publicReason, internalNote, expectedVersion, commandId | entry | linked event, transition, eligibility | extend registrations service | Yes | `registration.status.updated` | registrations client | all transitions/dedup/privacy |
| GET | `/api/admin/events/:eventId/approved-entries` | Admin | `BRACKET_MANAGE` | category/page | entry projections | approved/eligible | registrations service | No | none | request/bracket admin | eligibility |
| POST | `/api/admin/events/:eventId/categories/:categoryId/opponent-requests/open` | Admin | `OPPONENT_REQUEST_MANAGE` | deadline, expectedVersion, commandId | window | event closed, entries, no lock | `opponent-requests.service.ts` | Yes | `opponent-request.window.updated` | admin request page | gates/idempotency |
| POST | `/api/admin/events/:eventId/categories/:categoryId/opponent-requests/close` | Admin | same | confirmation, expectedVersion, commandId | window | open window | same | Yes | same | admin request page | race/unanswered |
| GET | `/api/admin/events/:eventId/opponent-requests` | Admin | `OPPONENT_REQUEST_DECIDE` | category/status/conflict/page | requests/page | event scope | same | No | none | admin request review | filters/privacy |
| GET | `/api/events/:eventId/opponent-request-state` | Club user | authenticated | category | own sent/received + window | entry membership | same | No | none | dashboard event detail | ownership |
| GET | `/api/events/:eventId/eligible-opponents` | Club user | authenticated | requestingEntryId | safe entry options | own entry, approval/category/window | same | No | none | choose-opponent form | exclusion rules |
| POST | `/api/events/:eventId/opponent-requests` | Club user | authenticated | requesterEntryId, targetEntryId, message, expectedVersion, commandId | request | ownership/eligibility/conflicts | same | Yes | `opponent-request.created` | dashboard event detail | IDOR/duplicate/races |
| PATCH | `/api/events/:eventId/opponent-requests/:requestId` | Requester | authenticated | target/message, expectedVersion, commandId | request | pending/window/open/unlocked | same | Yes | `opponent-request.updated` | sent request modal | target notification |
| DELETE | `/api/events/:eventId/opponent-requests/:requestId` | Requester | authenticated | expectedVersion, commandId | withdrawn request | pending/window/unlocked | same | Yes | `opponent-request.withdrawn` | sent request actions | race/idempotency |
| POST | `/api/events/:eventId/opponent-requests/:requestId/accept` | Target entry | authenticated | expectedVersion, commandId | request | target ownership/pending/eligible | same | Yes | `opponent-request.accepted` | received requests | double response/conflict |
| POST | `/api/events/:eventId/opponent-requests/:requestId/refuse` | Target entry | authenticated | publicReason, expectedVersion, commandId | request | same; reason policy | same | Yes | `opponent-request.refused` | refusal modal | privacy/race |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/approve` | Admin | `OPPONENT_REQUEST_DECIDE` | reason?, expectedVersion, commandId | request | accepted, entries free | same | Yes | `opponent-request.admin-approved` | admin request review | conflict/dedup |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/reject` | Admin | same | publicReason, internalNote, version, commandId | request | decidable state | same | Yes | `opponent-request.admin-rejected` | admin review | privacy |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/override-refusal` | Admin | `OPPONENT_REQUEST_OVERRIDE` | required public reason, internal note, confirmed, version, commandId | request | refused, eligible/free | same | Yes | `opponent-request.admin-overridden` | override modal | capability/audit/email |
| POST | `/api/admin/events/:eventId/brackets` | Admin | `BRACKET_MANAGE` | categoryId, size, commandId | draft bracket | closed event, approved entries | `brackets.service.ts` | Yes | `bracket.created` | admin bracket page | uniqueness |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/generate` | Admin | same | seed, applyRequestIds, expectedVersion, commandId | bracket/matches/warnings | category/eligibility/conflicts | same | Yes | `bracket.generated` | admin bracket page | determinism/byes |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/lock` | Admin | same | confirmation, version, commandId | locked bracket | complete valid draft | same | Yes | `bracket.locked` | admin bracket page | invalid slots/race |
| PATCH | `/api/admin/events/:eventId/brackets/:bracketId/publication` | Admin | `BRACKET_PUBLISH` | published, version, commandId | bracket | locked to publish | same | Yes | `bracket.published` | admin bracket page | public gate |
| GET | `/api/public/events/:eventId/brackets` | Public | none | category | published brackets | event/bracket published | same | No | none | public event page | unpublished 404 |
| POST/GET/PATCH | `/api/admin/judges` and `/api/admin/judges/:judgeId` | Admin | `JUDGE_MANAGE` | reuse user invite/profile DTO | judge(s) | role/status/email | extend users service | invite uses outbox | `judge.updated` | admin users/judges | role restrictions |
| POST | `/api/admin/judges/:judgeId/activate` or `/deactivate` | Admin | same | reason, commandId | judge | no unsafe active match on deactivate | users service | Yes | `judge.updated` | judge admin | session revoke/assignment |
| POST/GET/PATCH/DELETE | `/api/admin/events/:eventId/courts[/:courtId]` | Admin | `SCHEDULE_MANAGE` | court DTO/version/command | court(s) | event/name/unused delete | `scheduling.service.ts` | mutations Yes | `schedule.updated` | admin schedule | uniqueness/delete gates |
| POST | `/api/admin/events/:eventId/courts/:courtId/judge-assignments` | Admin | same | judgeId, start/end, commandId | assignment | judge active/no overlap | same | Yes | `court.assignment.updated` | admin schedule | overlap/race |
| GET | `/api/admin/events/:eventId/schedule` | Admin | same | filters | courts/items | event scope | same | No | none | admin schedule | projections |
| POST/PATCH/DELETE | `/api/admin/events/:eventId/schedule/items[/:itemId]` | Admin | same | match/court/time/order/version/command | item | unique match, readiness, no overlap | same | Yes | `court.queue.updated` | admin schedule | double schedule/race |
| POST | `/api/admin/events/:eventId/schedule/reorder` | Admin | same | courtId, ordered item IDs, versions, commandId | queue | complete same-court set | same | Yes | `court.queue.updated` | admin schedule | atomic ordering |
| PATCH | `/api/admin/events/:eventId/schedule/publication` | Admin | `SCHEDULE_PUBLISH` | published, commandId | event schedule state | valid schedule | same | Yes | `schedule.published` | admin schedule | public gate |
| GET | `/api/public/events/:eventId/schedule` | Public | none | date/court | published safe schedule | publication | same | No | none | public event | privacy |
| GET | `/api/judge/assignments` | Judge | authenticated | date/page | own assignments | judge role/status | scheduling service | No | none | judge dashboard | own-only |
| GET | `/api/judge/events/:eventId/courts/:courtId/queue` | Judge | assigned | none | authorized queue | assignment/event/court | same | No | none | judge court page | cross-court denial |
| GET | `/api/judge/matches/:matchId` | Judge | assigned | none | scoring projection | current assignment | `matches.service.ts` | No | none | judge match | privacy |
| POST | `/api/judge/matches/:matchId/start` | Judge | assigned | expectedVersion, commandId | match | ongoing, ready, first queue, court idle | same | Yes | `match.started` | judge match | concurrent starts |
| POST | `/api/judge/matches/:matchId/score` | Judge | assigned | side, action, expectedVersion, commandId | match + score event | bounds/status/assignment | same | Yes, including completion/advance | `match.score.updated`, possibly completion/advance | scoring controls | bounds/conflict/dedup |
| POST | `/api/judge/matches/:matchId/complete` | Judge/admin | assignment or `MATCH_RESULT_ADMIN` | resultType/winner/reason/version/command | completed match | supported outcome/authority | same | Yes | `match.completed` | outcome modal | outcome permissions |
| POST | `/api/admin/matches/:matchId/corrections` | Admin | `MATCH_RESULT_CORRECT` | corrected result, reason, confirmation, version, command | corrected graph | downstream impact validation | same | Yes | `match.corrected`, bracket updates | admin match detail | audit/recompute |
| GET/PATCH/POST | `/api/notifications`, `/unread-count`, `/:id/read`, `/read-all` | Auth user | own | page/filter or commandId | notifications/count | recipient ownership | `notifications.service.ts` | mutations Yes | `notification.read` | global notification UI | ownership/dedup |
| GET/POST | `/api/admin/notifications/email-deliveries` and `/:id/retry` | Admin | `DELIVERY_MONITOR` | filters/retry command | delivery | failure/retry state | outbox service | retry enqueue Yes | none | admin delivery page | capability/idempotency |
| GET | `/api/matches`, `/api/matches/:matchId` | Public/auth | published/authorized | filters/page | safe history/detail | results publication or participant/admin | `history.service.ts` | No | none | history pages | privacy/pagination |
| GET | `/api/players/:playerId/matches`, `/api/clubs/:clubId/matches`, `/api/me/matches` | Public/auth | publication/own | filters/page | derived records/summary | snapshot/publication scope | same | No | none | public club/player, dashboard history | historical club correctness |

Use structured errors such as `INVALID_TRANSITION`, `VERSION_CONFLICT`, `ENTRY_INELIGIBLE`, `BRACKET_LOCKED`, `MATCH_NOT_ASSIGNED`, and `COMMAND_REPLAY_MISMATCH`, with HTTP 400/403/404/409/422 as appropriate. Do not expose whether an unauthorized cross-scope ID exists.

## 13. Email Event Matrix

| Trigger | Recipient | Email Template | In-App Notification | WebSocket Event | Deduplication Key | Action Link |
|---|---|---|---|---|---|---|
| Registration submitted | entry contacts/admin preference | `registration-pending` | `REGISTRATION_PENDING` | `registration.status.updated` | `reg:{id}:PENDING:v{version}:user:{id}` | `/dashboard/entries?entry={id}` |
| Approved/rejected/needs changes/waitlisted/withdrawn/cancelled | active entry contacts | template per status | matching registration type | same | `reg:{id}:{status}:v{version}:user:{id}` | same |
| Request created | target contacts; admin in-app | `opponent-request-created` | `OPPONENT_REQUEST_CREATED` | `opponent-request.created` | `opp:{id}:created:v{version}:user:{id}` | `/dashboard/events/{eventId}?request={id}` |
| Accepted/refused/withdrawn/expired | affected opposite entry; admins per preference | status template | matching type | matching event | `opp:{id}:{status}:v{version}:user:{id}` | event dashboard |
| Admin approved/rejected/overridden | both entry contacts | decision template; override explicitly states prior refusal and explanation | matching type | admin decision event | same pattern | event/bracket dashboard |
| Applied/published bracket | both entries or all approved participants as appropriate | `bracket-pairing-confirmed` / optional publication digest | `OPPONENT_REQUEST_APPLIED_TO_BRACKET`, `BRACKET_PUBLISHED` | bracket events | `bracket:{id}:{event}:v{version}:user:{id}` | `/events/{eventId}` or private dashboard |
| Schedule published/rescheduled | affected entry contacts and assigned judge | schedule template | `SCHEDULE_PUBLISHED`, `MATCH_SCHEDULED/RESCHEDULED` | schedule event | `match:{id}:schedule:v{version}:user:{id}` | event/assignment page |
| Match started/completed | affected contacts; started email off by default | match template | `MATCH_STARTED/COMPLETED` | match event | `match:{id}:{status}:v{version}:user:{id}` | match detail |

Templates receive an allowlisted safe payload, not raw database objects. Registration templates include event, entry players, category, previous/new status, public reason, next action, and secure application link. Internal notes are excluded by type and serializer. Links contain normal authenticated resource IDs; no email addresses, tokens, or private identifiers in query strings. A missing/invalid/deactivated recipient produces a `SKIPPED` delivery with reason while the in-app notification remains.

## 14. In-App Notification Design

- Persist one notification per recipient, not one shared mutable row. Store a machine type, small safe payload, entity IDs, relative `actionPath`, dedup key, `readAt`, and timestamps; localize title/body at render time or freeze locale-specific safe text by explicit product choice.
- Recipient resolution is centralized: entry contacts, assigned judge, and users with relevant admin capability/preferences. Do not email or notify all club members by default.
- List endpoints paginate newest first and support unread/type/event filters. Mark-read uses ownership in the update predicate. `read-all` records a cutoff so concurrently created notifications are not accidentally read.
- Notification creation is in the business transaction. An outbox message then emits `notification.created` and `notification.unread-count.updated` after commit.
- Action paths are validated against an allowlist and re-authorized on navigation. The notification itself never grants access.
- Admin delivery view exposes queued/sent/skipped/failed state and sanitized errors, not provider secrets or full private payloads.

## 15. Transactional Outbox and Retry Design

Extend `sendEmail` as the `ResendEmailProvider`; add a provider interface returning provider message ID. Business services never call it directly.

1. In the domain transaction, create notification, `EmailDelivery(QUEUED)`, and `OutboxMessage(EMAIL_SEND or WS_PUBLISH)` with unique dedup keys.
2. A separate worker command claims rows using `FOR UPDATE SKIP LOCKED`, sets lease metadata, commits, performs external work, then marks success/failure. Add a worker service/container to `docker-compose.yml` so web restarts do not lose work.
3. Retry transient failures (timeouts, network, 429, provider 5xx) with exponential backoff plus jitter, e.g. 1m, 5m, 20m, 1h, 6h, capped at 8 attempts/24h. Treat invalid address/provider 4xx as permanent unless specifically retryable.
4. Worker restart reclaims expired leases. Unique delivery/outbox keys and provider idempotency header where supported prevent duplicates. A successful delivery is never resent by routine retry.
5. Development provider logs safe metadata and marks delivery sent; tests use an in-memory fake. Production fails startup/health readiness for the worker if required email config is missing.
6. Add metrics/logs: pending age, attempts, permanent failures, send latency, WebSocket publish failures, lease recovery, and dead-letter count. Alert on oldest pending age and failure rate.
7. Environment additions: worker poll/lease/batch settings, retry limits, optional WebSocket origin, instance ID; retain `RESEND_API_KEY`/`RESEND_FROM_EMAIL`. Document them in both env examples and `DEPLOY.md`.

WebSocket publication uses the same outbox. If publication fails after the business commit, retry; clients also refetch on reconnect, so missed transient pushes do not corrupt state.

## 16. WebSocket Contract

Add Socket.IO or standards-based `ws`; Socket.IO is recommended for authenticated reconnect/rooms and delivery sequencing. Create the HTTP server explicitly in `backend/src/index.ts`, initialize the gateway, authenticate the cookie JWT with session version, and authorize every room join.

| Event | Trigger | Rooms | Safe payload | Frontend behavior |
|---|---|---|---|---|
| `registration.status.updated` | committed status change | `user:{contact}`, authorized `event-admin:{event}` | event/entry ID, status, version | refetch entries/counts |
| opponent request events | committed request state | affected `user:*`, `event-admin:*` | request/event/category IDs, status/version | refetch request state |
| `notification.created/read/unread-count.updated` | committed notification/read | `user:{id}` | notification ID/type/count/version | prepend/refetch/count |
| bracket generated/locked/published | committed bracket command | `event:{id}` for published data; admin room for drafts | bracket/category/status/version | refetch authorized bracket |
| schedule/court queue events | committed schedule command | `event:{id}` if published; `court:{id}`, `judge:{id}`, admin room | event/court/item IDs/version | refetch queue/schedule |
| `match.started/score.updated/completed` | committed match command | `match:{id}`, `court:{id}`, authorized/published `event:{id}` | scores/status/version only when visible | apply only newer version, otherwise refetch |
| `bracket.participant.advanced` | completion transaction | authorized/published event room | source/next match IDs and bracket version | refetch bracket |

Private room joins verify user/entry/assignment/admin capability at connect and on explicit subscription. Public event/match rooms verify publication and public-live flag. Payloads contain no email, phone, internal note, or unneeded user ID. Clients track entity version/event ID, ignore duplicates/older events, refetch after gaps, and fully refetch subscriptions after reconnect. HTTP commands remain the only mutation path.

## 17. Bracket Generation and Advancement Algorithm

1. Select approved eligible registrations for one event/category under an advisory lock. Refuse generation if another active generation/decision transaction holds conflicting locks.
2. Choose the smallest supported power-of-two bracket size at least entry count, capped/configured for the event. For the requested R16 flow, use size 16 for 9–16 entries. Fewer entries require the product decision in Section 4.
3. Validate selected admin-approved/overridden requests form a disjoint matching. Place each pair in a first-round match; never use request data for later rounds.
4. Order remaining entries deterministically using explicit seed number if present, otherwise a persisted random seed plus stable entry ID ordering. Persist seed and algorithm version so regeneration is reproducible.
5. Place remaining entries according to standard single-elimination seed positions. Allocate byes so no entry receives an avoidable second bye and requested pairs stay intact. A bye is represented explicitly; advancing it is a system result with audit, not a fake score.
6. Pre-create all round matches with `nextMatchId` and `nextMatchSlot`. Enforce unique bracket/round/position and unique upstream source per next slot.
7. Draft regeneration creates a new generation or replaces only draft rows while preserving prior generation audit. Once locked, regeneration requires explicit privileged rebuild; if any match started, create a superseding bracket/correction plan rather than deleting history.
8. Lock snapshots entry players and clubs, resolves byes transactionally, and blocks request/registration/category edits that affect the bracket.
9. Match completion locks current and next match, verifies version/status/result, writes final score/winner/loser/result/timestamps and score/audit, and conditionally fills exactly one next slot. A unique winner-advancement record/constraint plus command receipt makes replay return the prior result without double advancement.
10. Withdrawals before start become walkover/system outcomes. Disqualification, withdrawal, and admin decision require a result type and reason. If both sides are absent, admin resolves or marks no-contest according to a product decision; never guess a winner.

## 18. Court and Scheduling Logic

- Courts belong to an event. Deleting is allowed only when no schedule/history references exist; otherwise deactivate/archive.
- Judge assignment is time-bounded and historical. Replacing a judge closes the previous assignment and creates a new row; completed matches retain assigned judge snapshot.
- Each match has at most one active `ScheduleItem`. A schedule item belongs to one court, has an integer queue position and planned time, and can exist for a later unresolved match as `TENTATIVE`; it cannot become `READY` or start until both sides resolve.
- Schedule mutations lock affected court queues and renumber atomically. Moving between courts locks court IDs in sorted order. Planned overlap uses configured duration or planned end; database exclusion constraint or serializable transaction rejects overlapping judge assignments.
- Court invariant: at most one `IN_PROGRESS` match. Judge invariant: at most one active match. Start requires event `ONGOING`, first ready court item, resolved participants, assigned active judge, no other active match for court/judge, and expected versions.
- Publishing validates court names, assignment coverage, no duplicate match, coherent queue positions, and safe public projections. Unpublishing hides public schedule but does not delete it or stop an already active match.
- Completing a match marks schedule item complete and exposes the next currently eligible queue item. If an upstream result makes a tentative item ready, emit a court queue update.

## 19. Judge Scoring State Machine

`SCHEDULED/READY → IN_PROGRESS → COMPLETED`; administrative paths include `WALKOVER`, `DISQUALIFICATION`, `WITHDRAWAL`, `ADMIN_DECISION`, and controlled correction. `CANCELLED/VOID` should be added only if product defines downstream behavior.

Normal score command processing:

1. Authenticate active `JUDGE`; verify current assignment, court, event, match, queue, and event state.
2. Resolve `commandId`. Exact replay returns stored response; same ID with different payload returns conflict.
3. Atomically update `Match` only where `id`, `version=expectedVersion`, and `status=IN_PROGRESS` match.
4. Calculate server-side next score. Reject decrement below 0 and increment above 6. Insert immutable `ScoreEvent` with before/after values and actor.
5. If next score is 6, complete and advance in the same transaction. A tie at 6 is impossible because the first score reaching 6 closes the match.
6. Create audit/outbox records; commit; then emit. Return new match/version.

Multiple tabs use optimistic versioning: the first valid command wins; the other receives `409 VERSION_CONFLICT` and refetches. Completed matches reject normal score changes. Judge decrement is auditable and allowed only before completion. Completed-match corrections require admin capability, required reason/confirmation, impact preview for downstream matches, immutable before/after audit, and recomputation or explicit block if downstream matches already started.

## 20. Match History Design

Completed non-void matches are authoritative. Queries join `Match`, bracket/event/category/court, and `MatchParticipantSnapshot`; they do not look up a player’s current club to describe the past.

History row fields: event/title/date, category, round, match number, court, both pair/player snapshots and clubs, final score, winner/loser, result type, planned/actual start/completion, and publication state. Player summaries derive matches played/wins/losses/opponents/scores/events/stage reached/represented club. Club summaries derive entries/players/opponents/scores/events/stages using captured club IDs.

Keep current `User.matchesPlayed`, `wins`, and `losses` temporarily as a denormalized cache only. Update it in the same completion transaction or asynchronously from an outbox projection, and add a reconciliation command that recomputes from matches. Prefer removing these columns after all readers use history-derived aggregates.

Routes consistent with this app: public `/matches` and `/matches/[matchId]`, public club history embedded at `/clubs/[slug]`, private `/dashboard/matches`, and judge match pages. A public player route should be added only if player profiles and privacy policy are approved. Pagination uses stable `(completedAt,id)` cursor and allowlisted filters.

## 21. Frontend Routes and Components

| Page | Route | Actor | Data Source | Buttons | Visibility Rules | WebSocket Subscription | Files to Change |
|---|---|---|---|---|---|---|---|
| Admin event list/detail | `/admin/events`, new `/admin/events/[eventId]` | Admin | event/status summary endpoints | open/close registration, start/complete, publication | capability + enabledActions from API | admin event room | extend `AdminEventsClient.tsx`; add app page and event detail component |
| Admin registrations | `/admin/events/[eventId]/registrations` (retain `/admin/registrations` aggregate) | Admin | scoped registrations | approve, reject, request changes, waitlist, cancel | transition/capability/lock | registration events | extend existing registration client; new scoped page/component |
| Admin requests | `/admin/events/[eventId]/opponent-requests` | Admin | request/window endpoints | open/close, approve/reject/override/choose/apply | category/window/status/capability | request admin room | new app page/client |
| Admin bracket | `/admin/events/[eventId]/bracket` | Admin | bracket endpoints | create/generate/regenerate/apply/bye/edit/lock/publish | draft/lock/status/capability | bracket admin room | new page/client/components |
| Admin schedule | `/admin/events/[eventId]/schedule` | Admin | courts/schedule/judges | requested court/judge/match/reorder/publication controls | state/capability/conflict | court/event admin rooms | new page/client/components |
| Judge management | `/admin/judges` or users filter | Admin | user/judge endpoints | create/edit/activate/deactivate/assign/resend invite | `JUDGE_MANAGE` | judge updates | extend users client or add dedicated page |
| Club/player event detail | `/dashboard/events/[eventId]` | Entry contacts | entry/request/bracket/schedule projections | choose/change/withdraw, accept/refuse, view bracket | own entry + window/lock/state | user and authorized event | new page/client; extend player shell |
| Entries | `/dashboard/entries` | Player | dashboard/registration endpoints | resubmit/withdraw/view status | own entry/transition | registration events | extend `PlayerEntriesClient.tsx`, types/hook |
| Notifications | `/dashboard/notifications` and shell control | Auth user | notification endpoints | mark read/all, open | own only | user room | shared notification components; both shells |
| Judge dashboard | `/judge`, `/judge/events/[eventId]/courts/[courtId]`, `/judge/matches/[matchId]` | Judge | assignment/queue/match endpoints | open/start/score/next/return | role + assignment + match state | judge/court/match | new layout/pages/clients |
| Public event/live | `/events/[eventId]` | Public | public event/bracket/schedule/live/results | view only | per publication flag | published event/match rooms | new page/client; link from homepage |
| Match history/detail | `/matches`, `/matches/[matchId]`, `/dashboard/matches` | Public/participant | history endpoints | filters/clear/view | results publication or own/admin | optional match completion | new pages/clients; club page extension |

Every page includes skeleton/loading, meaningful empty state, retryable error state, 403/404 handling, disabled action explanation, confirmation for destructive/high-risk commands, and conflict refetch. Server layout redirects support three roles: admin → `/admin`, judge → `/judge`, user → `/dashboard`. Add English/Georgian keys to both existing dictionaries without embedding business rules in translations.

## 22. Page and Button Visibility Matrix

| Control | Visible when | Disabled/hidden reason |
|---|---|---|
| Open/Close Registration | admin has capability and transition is valid | hide for non-admin; disable with dependency message |
| Registration decisions | admin capability, entry not bracket-locked, transition valid | invalid state/version/ineligibility |
| Open/Close Opponent Requests | event closed, category has approved entries, bracket unlocked | otherwise disabled with prerequisite |
| Choose/Change/Withdraw Opponent | user owns requester entry, window open, request mutable, bracket unlocked | no eligible opponents or locked/final request |
| Accept/Refuse | user owns target entry and request pending/window open | final/expired/conflicted/version changed |
| Approve/Reject request | admin decision capability and status decidable | entry conflict/ineligible/locked |
| Override Refusal and Approve | override capability and status refused | reason/confirmation required; conflict blocks |
| Generate/Regenerate/Apply | bracket manager; draft; inputs valid | locked/started/unresolved warning requires explicit resolution |
| Lock Bracket | complete valid draft | missing/duplicate entry or unresolved invalid slot |
| Publish/Unpublish bracket | publish capability; locked to publish | draft cannot publish |
| Court/judge/schedule controls | schedule manager; event not completed | referenced court cannot delete; overlaps block save |
| Publish Schedule | complete validated schedule | unresolved errors shown |
| Open/Start/Continue Match | assigned active judge; correct court/queue/event | another active match, unresolved sides, not first ready |
| Score buttons | assigned judge; in progress; version current | boundary button disabled at 0; all blocked after completion |
| Notifications/read controls | authenticated owner | never show another user’s notification |
| History filters/detail | data published or actor authorized | private fields omitted server-side |

The backend returns `enabledActions` plus reason codes in detail projections so the frontend does not duplicate the state machine. It still revalidates every mutation server-side.

## 23. Validation and Security Requirements

- Validate request bodies with reusable schemas (Zod is a reasonable addition) and reject unknown/oversized fields; continue the existing 100 KB body limit.
- Resolve every nested resource through its parent (`eventId`, category, bracket, match) to prevent cross-event/category ID substitution. Return generic 404 for unauthorized cross-scope access.
- Entry ownership is owner/teammate, not submitted club ID. Derive club from locked entry/player memberships.
- Require active, verified users; judge deactivation revokes sessions by incrementing `sessionVersion` and prevents new starts. Define handling for a judge deactivated mid-match: admin must reassign before further scoring.
- Store public and internal reasons separately at type, persistence, serializer, template, and test levels.
- Sanitize email HTML with existing escaping; allowlisted templates only. Validate redirect/action paths as same-origin relative URLs.
- Apply rate limits to score, request, notification, invite, and admin decision commands. Add CSRF protection for cookie-authenticated state changes (same-site cookie alone is insufficient defense-in-depth); verify allowed Origin and use CSRF token for browser commands.
- WebSocket authentication uses the cookie and session version, strict CORS/origin, authorization per subscription, payload minimization, and periodic reauthorization or disconnect on role/session change.
- Audit high-risk denied attempts as well as success without logging sensitive payloads. Protect audit/delivery endpoints with capabilities.
- Archive referenced users/events/entries instead of cascading deletion once history exists. Database FK actions must reflect this.
- Score and bracket rules are server-only. Never accept final scores/winner/next slot from normal judge clients.

## 24. Concurrency and Idempotency Strategy

Use optimistic `version` columns for event, registration, request, bracket, match, court, and schedule items. Use unique `commandId` receipts for all commands and immutable score events. Lock multi-entity resources in sorted ID order to avoid deadlocks.

Atomic transaction boundaries:

- registration transition + history + audit + notifications + email/outbox + command receipt;
- request create/change/respond/withdraw/admin decision + conflict updates + audit/notifications/outbox;
- bracket generation/apply/lock + match graph + request application + snapshots + audit/outbox;
- schedule move/reorder/assignment + all affected queue versions + audit/outbox;
- score change + score event + optional match completion + winner advancement + next-match readiness + history/stat projection event + notifications/outbox;
- correction + impacted bracket graph/result history + audit/notifications/outbox.

Race handling: conditional updates produce `409` and current version; clients refetch. Advisory locks keyed by event/category and sorted entry IDs serialize bracket/request membership. Database unique/partial/exclusion constraints are the final defense for duplicate pairings, schedules, active court matches, judge overlaps, command IDs, email keys, and advancement. Outbox workers use leased `SKIP LOCKED` rows. Duplicate WebSocket events are harmless due to entity version checks and refetch-on-gap.

## 25. File-by-File Change Plan

### Existing files to extend

- `backend/prisma/schema.prisma`: enums, relations, models, versions, indexes expressible in Prisma.
- `backend/prisma/migrations/<new_timestamp>_tournament_core/migration.sql` and subsequent focused migrations: backfills, partial indexes, exclusion/trigger constraints. These paths are planned new migration files, not existing files.
- `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.routes.ts`: third-role serialization/redirect-safe auth and capability helpers; avoid removing athlete links for judges.
- `backend/src/modules/users/users.service.ts`, `users.routes.ts`: judge creation/status/invite and capability-aware management.
- `backend/src/modules/events/events.service.ts`, `events.routes.ts`: lifecycle, publication fields, singular event reads, enabled actions.
- `backend/src/modules/registrations/registrations.service.ts`, `registrations.routes.ts`: transition machine, event-scoped routes, entry eligibility/ownership helpers, outbox writes; remove inline status email.
- `backend/src/modules/dashboard/dashboard.service.ts`, `dashboard.routes.ts`: participant-specific tournament summaries.
- `backend/src/modules/clubs/clubs.service.ts`, `clubs.routes.ts`: history projection endpoints and safe club context; retain public/admin serializer split.
- `backend/src/common/email.ts`, `backend/src/common/notifications.ts`: provider abstraction/templates/recipient helpers; rename or split the misleading notification module during implementation.
- `backend/src/common/audit.ts`: keep stdout logging and add durable audit service calls.
- `backend/src/common/http.ts`, `backend/src/common/includes.ts`, `backend/src/common/serializers.ts`: structured conflict errors, new includes, safe actor-specific projections.
- `backend/src/config/env.ts`, `backend/src/index.ts`, `backend/src/routes.ts`: worker/WS config, HTTP server/gateway setup, router mounts.
- `backend/package.json`, root `package.json`, `package-lock.json`: validation/test/WS/worker dependencies and scripts.
- `.env.example`, `backend/.env.example`, `docker-compose.yml`, `deploy/nginx.conf`, `DEPLOY.md`, `README.md`: worker/WS/config/deploy/operational docs. Nginx already has upgrade support; verify rather than duplicate it.
- `frontend/src/types/auth.ts`, `frontend/src/types/admin.ts`, `frontend/src/types/dashboard.ts`: JUDGE and tournament DTO/state unions.
- `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/index.ts`: structured API errors/idempotent command helper.
- `frontend/src/lib/auth.ts`: role routing support.
- `frontend/src/hooks/usePlayerDashboard.ts`, `useAdminCounts.ts`: expanded statuses/counts; split tournament-specific hooks before the existing hook becomes too broad.
- `frontend/src/components/admin/AdminEventsClient.tsx`, `AdminRegistrationsClient.tsx`, `AdminUsersClient.tsx`, `AdminShell.tsx`: entry points, valid controls, judge/admin navigation.
- `frontend/src/components/dashboard/PlayerEventsClient.tsx`, `PlayerEntriesClient.tsx`, `PlayerOverviewClient.tsx`, `PlayerShell.tsx`: request/status/history/notification navigation.
- `frontend/src/components/clubs/ClubClient.tsx`: published club history.
- `frontend/src/components/shared/dashboard/DashboardUI.tsx`: reusable version-conflict, confirmation, table/status primitives as needed.
- `frontend/src/app/login/page.tsx`, `register/page.tsx`, `invite/page.tsx`: JUDGE post-auth destinations where applicable.
- `frontend/src/app/admin/layout.tsx`: retain admin protection; add separate judge layout.
- `frontend/src/lib/i18n/en.ts`, `frontend/src/lib/i18n/ka.ts`, `frontend/src/lib/i18n/types.ts`: all new copy/types.

### Planned new backend files

Follow existing `backend/src/modules/<name>/<name>.routes.ts|service.ts` convention for `opponent-requests`, `brackets`, `scheduling`, `matches`, `notifications`, `history`, and optionally `audit`. Add `backend/src/realtime/` gateway/authorization and `backend/src/workers/` outbox processor/provider adapters. Exact subfile splitting should be chosen during phase implementation; these are planned paths, not claims of existing files.

### Planned new frontend files

Add the route pages listed in Section 21 and colocated clients under the existing `frontend/src/components/admin`, `dashboard`, and new `judge`, `events`, `matches`, and `notifications` areas. Add a shared real-time hook/client under `frontend/src/hooks` or `frontend/src/lib`. Reuse current UI components and shells.

### Tests

Add backend test configuration and tests adjacent to modules or under a new documented test directory; add frontend Testing Library/Playwright configuration. No test files currently exist, so no existing test path is asserted.

## 26. Test Plan

Backend unit tests cover every transition table, eligibility predicate, pairing algorithm, recipient resolver, template safe payload, score reducer, and permission helper. Integration tests run against PostgreSQL because partial indexes, advisory locks, trigger behavior, and transaction races cannot be proven with mocks. HTTP tests validate actor/scoping/error contracts. Frontend component tests validate controls/states; Playwright covers admin→club→judge→public flows. Add migration tests against a production-shaped snapshot.

Required cases:

- Registration: approval/rejection/needs-changes create one email and in-app notification; public reason included; invalid/no-op/duplicate command sends nothing; internal note never serialized/template-rendered; lifecycle/lock gates.
- Request create: eligible same-event/category approved entry works; self/unapproved/withdrawn/cross-event/cross-category/locked rejected; target and admin notifications; canonical/mutual/duplicate idempotency; club IDOR denial.
- Accept/refuse: only target entry contacts; pending/version/window required; requester/admin informed; refusal persists and reason visibility is correct; simultaneous accept/refuse/withdraw has one winner.
- Override: capability and required confirmation/public reason; entry eligibility/free pairing; both clubs notified; internal note excluded; durable searchable audit; duplicate idempotency; apply succeeds only once.
- Bracket: approved/overridden constraints affect first round only; refused request ignored; deterministic generation; byes; no duplicate entries; lock gates; withdrawal/walkover; completion advances once; duplicate completion does not mutate next slot.
- Schedule: court CRUD gates, judge assignment, overlap rejection including concurrent inserts, match unique schedule, atomic reorder/move, unresolved match tentative, court/judge single active match.
- Scoring: assigned active judge only; correct court; bounds 0–6; first to 6 atomic completion; decrement audit; completed blocked; expected-version conflict; same command replay; multiple tabs; non-standard result capabilities.
- Notifications/outbox: unread counts, owner-only reads, missing/deactivated email skip, provider failure does not roll back domain, transient retry, permanent failure, worker lease recovery, duplicate worker no duplicate send, secure action link, cross-user leakage impossible.
- WebSocket: room join authorization, public publication gates, emit only after commit, rollback emits nothing, reconnect/refetch, duplicate/out-of-order version handling, session revocation disconnect/denial.
- History/correction: captured old club remains after membership change; filters/cursors; unpublished results private; correction audit and downstream protection; stat reconciliation.
- Lifecycle/publication: every valid/invalid transition, dependency checks, exceptional rollback, independent bracket/schedule/live/results visibility.

CI should run typecheck/lint, unit tests, PostgreSQL integration/migration tests, frontend component tests, and a small E2E critical path. Add load/race tests for scoring and request decisions before production launch.

## 27. Implementation Phases

| Phase | Backend / Database | Frontend | Tests | Dependencies / Risks / Definition of Done |
|---|---|---|---|---|
| 1. Domain confirmation | Document entry semantics, single tenancy, role/contact rules; add decision records | none | fixture audit | Product signs off on open questions; no schema yet |
| 2. Event/registration rules | Add lifecycle/status/version/history/capability foundations and backfill migration | Update types/admin/player actions | state/transition/migration tests | Risk: backfill ambiguity; done when old events reconcile and registration uses server enabled actions |
| 3. Request state machine/schema | Add request window/model/constraints/services without UI exposure | types only | unit + DB concurrency | Depends phase 2; done when API state machine and audits pass |
| 4. Notification/outbox | Add notification/email/outbox/worker/provider and deployment | notification center foundation | retries/dedup/failure tests | Risk operational worker; done when failure never rolls back domain and monitoring works |
| 5. Registration notifications | Route registration transitions through outbox | status UI/read state | required registration cases | Depends phase 4; remove inline business email |
| 6. Club request flows | Create/eligible/change/withdraw/respond APIs | event detail, choose/refuse dialogs | IDOR/races/E2E A↔B | Done when both entry contacts see consistent committed state |
| 7. Admin request review/override | Decision/override/conflict/apply-preparation APIs | filters/details/override confirmation | capability/privacy/audit | Done when refusal cannot be silently overridden |
| 8. Bracket core | Bracket/match graph, deterministic generation/byes/lock/publication | admin/public/private bracket views | algorithm/property/integration | Risk correction complexity; done with reproducible locked graph |
| 9. Judge role/capabilities | Add JUDGE, invite/status/session behavior | judge management/navigation | auth/role regressions | Must deploy role-aware redirects before creating judges |
| 10. Courts/scheduling | Models/constraints/APIs | admin schedule/queue | overlap/reorder/publication | Depends bracket/judge; done with validated published schedule |
| 11. Scoring/advancement | score events, commands, atomic completion/advancement | judge match controls/conflict UX | concurrency/idempotency/load | Highest integrity risk; done when duplicate completion cannot advance twice |
| 12. Realtime | gateway/auth/outbox publisher | subscriptions/reconnect/refetch | room/security/order | Depends stable projections; done when HTTP remains correct with WS disabled |
| 13. Live/public/private views | safe projections/publication gates | public event live and dashboard detail | privacy/publication E2E | Done when each actor sees only allowed sections |
| 14. History/corrections | snapshot queries, reconciliation, correction commands | match/club/player history | snapshot/correction tests | Done when current club changes cannot rewrite history |
| 15. Hardening/launch | metrics, dead letters, backup/restore, archival, runbooks | accessibility/resilience pass | full CI/E2E/race/rollback drills | Launch gate: monitoring, migration rehearsal, recovery and security review pass |

Each phase ships behind server capability/feature flags where partial UI would be unsafe. Database additions precede code that writes them; new role values and frontend role routing are deployed in compatible order. Every phase includes backend/frontend/database work only where applicable, tests, dependency review, documented risks, and the definition of done shown above.

## 28. Risks and Edge Cases

- Existing event publication is currently registration eligibility. Separating lifecycle may surprise users; migration and UI messaging must be explicit.
- Current cascade deletes would destroy tournament history. Archive/restrict before production matches exist.
- Admin email allowlist can dynamically elevate a user. Capability evaluation must consistently incorporate that behavior without accidentally granting athlete/judge relations.
- A player changing club between approval and bracket lock can make a pair invalid. Revalidate at request decisions, generation, and lock; snapshot only at lock. After lock, membership change must not alter tournament representation.
- Multiple entries from one club are valid; club-name-only selectors are ambiguous. Always display pair/player identity and entry ID-safe label.
- Requests with fewer than nine entries need a product rule because “Round of 16” may contain mostly byes or not exist.
- Admin correction after the winner has played downstream can invalidate an entire subtree. Provide impact preview and block simple correction; require a structured bracket repair procedure.
- Judge device loss/network retry can replay commands. Command receipts and visible current version are mandatory; offline queued scoring is not recommended initially.
- PostgreSQL outbox keeps infrastructure simple but needs vacuum/index/retention management. Archive processed rows and monitor oldest pending.
- Public live traffic may exceed one backend instance. Socket.IO multi-instance later needs a shared adapter or PostgreSQL notification/broker; start with sticky single realtime instance and document scaling limit.
- Email provider delivery does not prove reading. “Delivered” should mean provider status only if webhook verification is implemented; otherwise use `SENT`.
- Event/category edits after requests or bracket generation are dangerous. Block them once dependent records exist rather than cascade automatically.
- Waitlisted auto-promotion is not specified. Keep it manual initially.
- Existing frontend has no query cache; many WebSocket signals can cause refetch storms. Debounce/coalesce invalidations per entity.

## 29. Open Questions

1. For fewer than nine approved entries, should opponent requests still apply to the first played round, or be disabled because no Round of 16 exists?
2. May multiple pending requests target the same entry, or should the database allow only one incoming pending request? The plan supports multiple pending but only one accepted/provisional pairing.
3. Is refusal reason optional or required, and is it visible to both players in the requesting entry or only designated contacts?
4. Should either player in a pair control requests (recommended), or is one registration owner the sole contact? Is a future club-manager role required?
5. Which admins receive email versus in-app-only notifications, and do per-user notification preferences need to launch in phase 4?
6. What default event time zone should backfill existing events, and can future events choose different zones?
7. What seeding rule is required beyond accepted requests: random draw, admin seeds, ranking, or standard Olympic seeding? The algorithm must persist its version and seed.
8. Which non-standard outcomes may an assigned judge complete without admin approval?
9. What is the policy when both entries withdraw or are disqualified from the same match?
10. Should public match/player history expose player names by default, and what retention/privacy policy applies?
11. Must schedule items reserve explicit end times/durations, or is queue order plus planned start sufficient?
12. Do completed results publish automatically when the event completes, or only through the separate `Publish Results` control (recommended)?
13. Is multi-organization tenancy planned? If yes, it must be designed as a prerequisite across the existing schema rather than added only to new tournament tables.
14. Are current user aggregate stats used outside this repository? Confirm before deprecating/removing them after match-derived history launches.
