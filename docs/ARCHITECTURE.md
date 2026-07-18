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

- public landing, club, event, bracket, schedule, and match-history pages;
- player dashboards for entries, events, opponent requests, notifications, and history;
- judge assignment, court queue, and scoring screens;
- administrative event, registration, bracket, schedule, user, club, category, and operations screens.

The shared API client uses credentialed requests. Before unsafe requests it retrieves `/api/auth/csrf` and sends the token in `x-csrf-token`.

### API

Express mounts feature routers from `backend/src/routes.ts`. Route modules validate transport input, resolve the authenticated actor, and call feature services. Services own transactions and business rules.

Important cross-cutting modules:

- `common/capabilities.ts`: administrator capability authorization
- `common/commands.ts`: idempotent command receipts and payload hashes
- `common/csrf.ts`: token issuance and unsafe-request protection
- `common/domain-events.ts`: audit, notifications, email delivery, and outbox enqueueing
- `realtime/gateway.ts`: Socket.IO authentication and room authorization

### Outbox worker

Tournament transactions write an `OutboxMessage` in the same commit as the domain change. The worker leases pending records, performs email or realtime delivery, and records success or retry state.

This provides two important guarantees:

- no notification is published for a transaction that rolled back;
- transient delivery failures do not require repeating the domain command.

Docker runs the worker separately with `RUN_OUTBOX_IN_API=false`. A local single-process API may run it in-process.

## Domain boundaries

| Module | Responsibility |
| --- | --- |
| `auth` | registration, verification, login, logout, invitation completion, Google OAuth |
| `users` | user and judge administration, activation, disqualification |
| `clubs` | club directory, explicit leadership, roster changes, and membership requests |
| `categories` | competition categories |
| `events` | event configuration, lifecycle, and publication |
| `registrations` | team entry and review history |
| `opponent-requests` | first-round opponent negotiation and approval |
| `brackets` | draw generation, locking, publication, and progression graph |
| `scheduling` | courts, queues, judge assignments, timing, publication |
| `matches` | start, scoring, completion, correction, snapshots, history |
| `notifications` | in-app notification inbox and read state |
| `operations` | audit inspection and email-delivery retry |

## Consistency patterns

### Optimistic concurrency

Mutable tournament records carry a `version`. Clients submit `expectedVersion`; a mismatch returns a conflict and requires a refresh. This prevents one operator from silently overwriting another operator’s work.

### Command idempotency

State-changing tournament commands accept `commandId`. The server hashes the command payload and stores a receipt. Repeating the same ID and payload returns the existing result; reusing the ID with a different payload is rejected.

### Historical snapshots

Matches store participant snapshots alongside registration references. Names and clubs shown in historical results therefore remain stable if profile or club data changes later.

### Audit history

Privileged transitions create append-only audit records. Registration and event lifecycle changes also maintain specific status histories for operational review.

## Authorization

Roles are `USER`, `JUDGE`, and `ADMIN`.

- Public users receive only explicitly published event, bracket, schedule, live-score, and result data.
- Players receive their own registration/request data plus published tournament data.
- Judges receive assigned court queues and matches.
- Administrators require the relevant capability for privileged operations.

Realtime subscriptions use the same boundaries. Authentication alone is insufficient to join an unpublished event or match room.

## Publication model

Publication is deliberately separated:

- event page visibility;
- bracket publication;
- schedule publication;
- public live-scoring enablement;
- completed result publication.

This lets administrators prepare later stages privately without exposing drafts.

## Deployment topology

The supported production topology is Docker Compose behind host-level Nginx:

- frontend on loopback port 3000;
- backend on loopback port 4000;
- worker with no public port;
- PostgreSQL on the internal Compose network.

See `DEPLOY.md` for environment setup, migrations, HTTPS, backups, updates, and first-admin bootstrapping.
