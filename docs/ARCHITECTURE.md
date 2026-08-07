# Architecture

## System overview

El Padel is a TypeScript monorepo with separate frontend, API, worker, and PostgreSQL processes.

```text
Browser
  ├─ HTTPS → Next.js frontend
  ├─ HTTPS → Express API
  └─ WebSocket/polling → Socket.IO gateway
                         │
Express API ─────────────┼── PostgreSQL
                         │       │
Outbox worker ───────────┘       └─ domain data, command receipts,
                                    audit, notifications, outbox jobs
```

The API owns authorization and domain invariants. The frontend is a presentation and interaction layer; its visibility rules are not security boundaries.

## Runtime components

### Frontend

The Next.js App Router application provides:

- a public marketing landing page plus club, player, event, bracket, schedule, and match-history pages with SEO metadata, sitemap, and structured data;
- player dashboards for the club, entries, events, opponent requests, notifications, match history, and account settings;
- the match control console: court, time, draw, and scoring on one screen;
- administrative screens for events, registrations, opponent requests, brackets, schedules, match control, users, clubs, categories, settings, and operations.

The UI is bilingual (English and Georgian) via the shared i18n provider. The shared API client (`frontend/src/lib/api/`) sends credentialed requests and automatically retrieves `/api/auth/csrf` before unsafe requests, sending the token in `x-csrf-token`.

### API

Express mounts feature routers from `backend/src/routes.ts`. Route modules validate transport input, resolve the authenticated actor, and call feature services. Services own transactions and business rules.

Important cross-cutting modules:

- `common/capabilities.ts`: capability authorization; admins hold every capability by default, per-user `UserCapabilityGrant` rows (ALLOW/DENY) override the role default, and `requireEventCapability` grants an organiser their event-running capabilities on one event at a time
- `common/commands.ts`: idempotent command receipts keyed by actor, action, and command ID with payload hashes
- `common/csrf.ts`: double-submit token issuance and unsafe-request protection
- `common/domain-events.ts`: audit, in-app notifications, email delivery jobs, and outbox enqueueing inside domain transactions
- `common/legal.ts`: versioned consent constants and validators for account and participation consent
- `common/rateLimit.ts`: per-key request throttling for authentication endpoints
- `common/serializers.ts`: allow-listed DTO serialization so raw Prisma records never leave the API
- `realtime/gateway.ts`: Socket.IO authentication, room authorization, and socket rate limiting

Sessions are stateless JWTs stored in an HTTP-only cookie. Each token embeds the user's `sessionVersion`; logout, password changes, disqualification, and judge deactivation bump the version so outstanding tokens stop working. When the site and API run on sibling hosts, the session cookie uses the shared parent domain so SSR can read it.

### Outbox worker

Tournament transactions write an `OutboxMessage` in the same commit as the domain change. The worker leases pending records, performs email or realtime delivery, and records success or exponential-backoff retry state. It also expires overdue opponent requests.

This provides two important guarantees:

- no notification is published for a transaction that rolled back;
- transient delivery failures never require repeating the domain command.

In production, Docker runs the worker as a separate service (`RUN_OUTBOX_IN_API=false` on the API, which then only relays realtime topics). A local single-process API runs the full worker in-process. Email is delivered through Resend with retries capped at 8 attempts.

## Domain boundaries

| Module | Responsibility |
| --- | --- |
| `auth` | registration with email verification codes, login, logout, invite completion, Google OAuth, first-admin bootstrap, self-service club creation and club-mate invites |
| `users` | account administration, invites, disqualification, activation, public player directory, account deletion |
| `clubs` | club directory, leader-managed rosters, join requests, and member removal with registration resolution |
| `categories` | competition categories |
| `events` | event configuration (including fee and bank details), lifecycle, and publication controls |
| `registrations` | club team entries, review workflow, lineup replacement, roster publication |
| `opponent-requests` | first-round opponent negotiation windows, player responses, and admin decisions |
| `brackets` | draw generation, first-round placement, set defaults, locking, publication, and the single-elimination progression graph |
| `scheduling` | courts, queues and their ordering, timing, publication, court queue reads (judge assignment endpoints remain but have no UI) |
| `matches` | start, set scoring, completion, correction, reopening, snapshots, history, and visibility rules |
| `notifications` | in-app notification inbox and read state |
| `dashboard` | player dashboard aggregate, admin summary counts, and platform statistics (bucketed aggregates behind a 60 s in-process cache; pure bucket and delta maths in `statsModel.ts`) |
| `operations` | audit inspection and email-delivery retry |
| `health` | process health |

## The club model

Clubs are central to participation:

- every player belongs to exactly one club; a player without a club must create one (becoming its **leader**) or request to join an existing club before registering for events;
- each club fields **one team per event** (`@@unique([eventId, clubId])`); the team is an owner/teammate pair from the same club;
- the club leader can replace a registered player with another eligible club member (the entry returns to `PENDING` review) and reviews join requests;
- removing a member requires explicitly resolving every unfinished registration that includes them (replace the player or withdraw the team); removal is blocked while an event is ongoing or a bracket is locked;
- a leader cannot leave for another club, and the leader cannot be removed;
- admins and judges never belong to clubs; promoting a user to admin removes their athlete links.

## Consistency patterns

### Optimistic concurrency

Mutable tournament records (events, registrations, requests, brackets, matches, courts, schedule items, request windows) carry a `version`. Clients submit `expectedVersion`; a mismatch returns `409` and requires a refresh. Critical transitions additionally use conditional `updateMany` writes so the row must still match its expected state inside the transaction.

### Command idempotency

State-changing tournament commands accept `commandId`. The server hashes the payload and stores a `CommandReceipt`. Repeating the same ID with the same payload returns the existing result; reusing an ID with a different payload is rejected.

### Set scoring

`Match.scoringMode` selects the engine: `POINTS` for events played before the set format, `SETS` for everything since. A set match races to `Match.setCount` set wins, capped at `2 * setCount - 1` sets so a decider always exists; the rules live as pure functions in `backend/src/modules/matches/set-engine.ts`.

`MatchSet` holds the current decided sets and is the row an undo deletes. `SetEvent` is the append-only history of every decision and withdrawal, and its `@@unique([actorId, commandId])` is the idempotency anchor, mirroring `ScoreEvent` in the legacy engine. `Match.scoreA`/`scoreB` denormalize the tally so every existing read path — serializers, public boards, match history — keeps working unchanged; they are rewritten from the `MatchSet` rows inside the same transaction.

The format is resolved once, when the match starts: the per-match `setCountOverride`, else the `BracketRoundConfig` row for that round, else one. The resolved value is written to `Match.setCount`, which is what makes later configuration changes safe during live play.

### Queue ordering

A court queue is `ScheduleItem.queuePosition`, unique per court, always renumbered to 1..n. Reorders submit the court's complete order with per-item versions and are validated by the pure `validateQueueReorder` in `backend/src/modules/scheduling/queueOrdering.ts`: started and completed items must keep their exact position, a fully finished court is immutable, and any stale item version rejects the whole request. Cross-court moves park the row on a negative position so neither renumber pass collides with the `(courtId, queuePosition)` unique index.

### Advisory locks

Registration creation, lineup replacement, and member removal serialize on PostgreSQL advisory locks keyed by event/player and event/club, closing race windows that unique constraints alone cannot express.

### Historical snapshots

Locking a bracket creates `MatchParticipantSnapshot` rows (player names, club) for each first-round side, and winners' snapshots are copied forward round by round. Historical results therefore remain stable even if profiles, rosters, or clubs change later.

### Audit history

Privileged transitions create append-only `AuditLog` records with actor, before/after state, and public/internal reasons. Registration and event lifecycle changes also maintain dedicated status-history tables.

## Authorization

Roles are `USER` (player), `JUDGE`, `ORGANISER`, and `ADMIN`.

- Public users receive only explicitly published event, roster, bracket, schedule, live-score, and result data.
- Players receive their own club/registration/request data plus published tournament data.
- Judges receive court queues and matches only for courts with an active, unrevoked time-boxed assignment.
- Organisers hold **no global capability**. Every power they have is checked against an `EventOrganiser` link by `requireEventCapability`, so it applies to the events an admin handed them and to nothing else. They may not create, edit, publish, or delete an event, review registrations, correct a finished result, reopen a completed event, or touch accounts, clubs, and club requests.
- Administrators require the specific capability for each privileged operation; capabilities can be individually granted or denied per user.
- `ADMIN_EMAILS` elevation applies only after the email address is verified.

Realtime subscriptions use the same boundaries: authentication alone is insufficient to join an unpublished event or match room. Because the event room's public gate (`isPublished`) is coarser than the per-match publication rules the REST reads apply, the room a subscriber lands in decides what they may hear: staff on the event join `event-staff:<id>` and receive full payloads, everyone else joins `event:<id>` and receives the topic with the payload stripped to the event id. A stripped topic is still a complete invalidation signal, because clients refetch the authoritative record rather than trusting a payload.

## Event lifecycle

```text
REGISTRATION_OPEN → REGISTRATION_CLOSED → ONGOING → COMPLETED
                                             ↑          │
                                             └──────────┘  (explicit reopen,
                                                            EVENT_STATE_CORRECT)
```

The lifecycle moves forward through explicit transitions. Reopening a completed event is the single backward transition and requires the `EVENT_STATE_CORRECT` capability; completed events are otherwise read-only (no edits, deletions, bracket, schedule, registration, or correction changes).

Guards: an event cannot start until at least one bracket is locked, and cannot complete while any match is neither completed nor cancelled.

## Publication model

Publication is deliberately separated per surface:

- event page visibility (`isPublished`);
- registration roster publication (approved team names only);
- bracket publication (per bracket, only after locking);
- schedule publication;
- public live-scoring enablement (only while ongoing);
- final result publication (only after completion).

This lets administrators prepare later stages privately without exposing drafts. Completed-match details are redacted for the public until results are published.

## Deployment topology

The supported production topology is Docker Compose behind host-level Nginx:

- frontend on loopback port 3000;
- backend on loopback port 4000;
- worker with no public port;
- PostgreSQL on the internal Compose network.

See `DEPLOY.md` for environment setup, migrations, HTTPS, backups, updates, and first-admin bootstrapping.
