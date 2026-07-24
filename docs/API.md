# API Reference

This document lists the HTTP API surface by audience. The route source under `backend/src/modules/*/**.routes.ts` remains authoritative; when this document and the code disagree, trust the code and fix the document.

## Conventions

- API base URL: `http://localhost:4000` in local development.
- JSON requests use `Content-Type: application/json`. The body parser rejects payloads above 100 KB.
- Authentication uses an HTTP-only session cookie (`elpadel_session`) containing a signed JWT. The token embeds the user's `sessionVersion`; logout, password change, disqualification, and judge deactivation bump the version and invalidate outstanding sessions.
- When the site and API use sibling hosts (for example `elpadell.com` and `api.elpadell.com`), the cookie `Domain` is the shared parent so Next.js SSR and browser requests share the session.
- Unsafe requests (POST/PATCH/DELETE) require a CSRF cookie plus a matching `x-csrf-token` header and an allowed `Origin`.
- Tournament commands commonly require a client-generated `commandId` (idempotency) and `expectedVersion` (optimistic concurrency).
- Validation errors use `400`, authentication failures `401`, authorization failures `403`, missing resources `404`, and version/state conflicts `409`. Resources the viewer may not see return `404` rather than `403`.
- Auth endpoints are rate limited (registration bursts and login/verify attempts per window).

Obtain a CSRF token before a manual unsafe request:

```bash
curl -c /tmp/elpadel-cookies http://localhost:4000/api/auth/csrf
```

Send the returned token with the cookie jar:

```bash
curl -b /tmp/elpadel-cookies \
  -H 'content-type: application/json' \
  -H 'x-csrf-token: RETURNED_TOKEN' \
  -X POST http://localhost:4000/api/auth/login \
  -d '{"email":"admin@example.com","password":"Password123!"}'
```

The frontend `apiFetch` helper handles this automatically.

## Health and authentication

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process health |
| GET | `/api/auth/csrf` | Issue CSRF cookie and token |
| POST | `/api/auth/register` | Register (name, surname, phone, email, password, legal + eligibility consent); emails a verification code |
| POST | `/api/auth/verify` | Verify the emailed code and create a session |
| POST | `/api/auth/login` | Create a session |
| POST | `/api/auth/logout` | Clear the session and revoke outstanding tokens |
| GET | `/api/auth/me` | Current user (or `null`) |
| POST | `/api/auth/invite/complete` | Complete a teammate/club-mate/admin-created invitation (token, profile, password, club when required) |
| GET | `/api/auth/google` | Start Google OAuth (requires prior legal consent cookie) |
| GET | `/api/auth/google/callback` | Complete Google OAuth |
| POST | `/api/admin/bootstrap` | Create the first production admin; requires the `x-bootstrap-token` header matching `FIRST_ADMIN_BOOTSTRAP_TOKEN` |

Registration and invite completion record versioned acceptance of the Terms of Use, Privacy Policy, and age-eligibility confirmation. `ADMIN_EMAILS` elevation is applied only after the email address is verified.

## Account and club self-service

All endpoints require a session. Club write operations are restricted to players (`USER` role); admins and judges do not belong to clubs.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/account/club` | Create a club and become its leader (players without a club) |
| POST | `/api/account/club/mate` | Add or invite a club mate by email; active accounts must join by themselves |
| GET | `/api/account/club-details` | Own club profile, roster, and (leader only) pending join requests |
| GET | `/api/account/club-requests/current` | Current player's pending join request |
| POST | `/api/account/club-requests` | Request membership in an existing club |
| PATCH | `/api/account/club/join-requests/:id` | Approve or reject a join request; club leader only |
| GET | `/api/account/club/members/:id/removal-impact` | Unfinished registrations affected by removing a member plus eligible replacements; leader only |
| DELETE | `/api/account/club/members/:id` | Remove a member after resolving every affected registration (replace or withdraw); leader only |
| DELETE | `/api/account` | Delete own account (the last remaining admin cannot be deleted) |

## Public data

No session required. Public routes only ever return explicitly published data.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/clubs` | Club directory (id, name, slug) |
| GET | `/api/public/clubs/:slug` | Club profile and roster |
| GET | `/api/public/players` | Active player directory with public match statistics |
| GET | `/api/public/players/:id` | Public player profile |
| GET | `/api/public/events` | Next upcoming published event plus recent past events |
| GET | `/api/public/events/:id` | Published event detail |
| GET | `/api/public/sitemap-events` | Lightweight published-event index for the SEO sitemap |
| GET | `/api/public/events/:eventId/registered-teams` | Approved teams once the registration roster is published |
| GET | `/api/public/events/:eventId/brackets` | Published brackets |
| GET | `/api/public/events/:eventId/schedule` | Published schedule |
| GET | `/api/matches` | Completed match history (published results); admins may inspect unpublished results |
| GET | `/api/matches/:matchId` | Match detail subject to publication and viewer visibility; unpublished results are redacted |
| GET | `/api/players/:playerId/matches` | Published player history |
| GET | `/api/clubs/:clubId/matches` | Published club history |
| GET | `/api/categories` | Category list |

## Player endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Player dashboard: visible events, every registration owned by the player's club, club members, and membership role |
| GET | `/api/events` | Published upcoming events (`?scope=admin` returns all events for admins) |
| GET | `/api/events/:id` | Event detail visible to the current user |
| POST | `/api/registrations` | Enter one club team (owner + teammate) in an event category; requires participation, refund, and risk consent; `409` when the club already has an entry |
| PATCH | `/api/registrations/:id/lineup` | Replace one registered player with another eligible club member; club leader only; resets the entry to `PENDING` |
| GET | `/api/events/:eventId/brackets` | Player-visible bracket state |
| GET | `/api/events/:eventId/opponent-request-state` | Own requests for the event |
| GET | `/api/events/:eventId/eligible-opponents?requestingEntryId=…` | Eligible target entries in the same category |
| POST | `/api/events/:eventId/opponent-requests` | Create a request |
| PATCH | `/api/events/:eventId/opponent-requests/:requestId` | Retarget or edit a pending request |
| DELETE | `/api/events/:eventId/opponent-requests/:requestId` | Withdraw a pending or accepted request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/accept` | Accept a received request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/refuse` | Refuse a received request (optional reason) |
| GET | `/api/me/matches` | Own match history |
| GET | `/api/notifications` | Notification history |
| GET | `/api/notifications/unread-count` | Unread total |
| PATCH | `/api/notifications/:id/read` | Mark one notification read |
| POST | `/api/notifications/read-all` | Mark all notifications read |

## Judge endpoints

Judges see only courts with an active, unrevoked assignment covering the current time.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/judge/assignments` | Active and upcoming court assignments |
| GET | `/api/judge/events/:eventId/courts/:courtId/queue` | Ordered court queue |
| GET | `/api/judge/matches/:matchId` | Assigned match detail |
| POST | `/api/judge/matches/:matchId/start` | Start the next ready match in the queue |
| POST | `/api/judge/matches/:matchId/score` | Increment or decrement one side (0–6; reaching 6 completes the match) |
| POST | `/api/judge/matches/:matchId/complete` | Record a walkover, withdrawal, or disqualification with a reason |

Score command example:

```json
{
  "side": "A",
  "action": "INCREMENT",
  "expectedVersion": 4,
  "commandId": "c3eb31ed-91d5-4e44-8d0a-1ec8c61e5fd6"
}
```

## Administrator endpoints

Every admin route checks a specific capability, not just the `ADMIN` role. Per-user `UserCapabilityGrant` rows (ALLOW or DENY) override the role default.

### Overview and events

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/summary` | `DASHBOARD_READ` |
| POST | `/api/events` | `EVENT_MANAGE` |
| PATCH | `/api/events/:id` | `EVENT_MANAGE` |
| DELETE | `/api/events/:id` | `EVENT_MANAGE` (completed events must be reopened first) |
| PATCH | `/api/admin/events/:id/status` | `EVENT_STATUS_MANAGE`; reopening a completed event additionally requires `EVENT_STATE_CORRECT` |
| PATCH | `/api/admin/events/:id/tournament-publication` | `EVENT_PUBLISH` (live scoring, final results) |

Event create/update payloads include the participation fee in GEL, a Georgian IBAN (`GE` + 20 characters), and the receiver name shown to players for bank transfers.

### Registrations

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/registrations` | `REGISTRATION_REVIEW` |
| PATCH | `/api/admin/registrations/:id` | `REGISTRATION_REVIEW` (simple status change; decline requires a reason) |
| GET | `/api/admin/events/:eventId/registrations` | `REGISTRATION_REVIEW` |
| PATCH | `/api/admin/events/:eventId/registrations/:id/status` | `REGISTRATION_REVIEW` (versioned command with public reason and internal note) |
| PATCH | `/api/admin/events/:eventId/registration-roster-publication` | `EVENT_PUBLISH` |

### Opponent requests

| Method | Path | Capability |
| --- | --- | --- |
| POST | `/api/admin/events/:eventId/categories/:categoryId/opponent-requests/open` | `OPPONENT_REQUEST_MANAGE` (optional `deadline`) |
| POST | `/api/admin/events/:eventId/categories/:categoryId/opponent-requests/close` | `OPPONENT_REQUEST_MANAGE` |
| GET | `/api/admin/events/:eventId/opponent-requests` | `OPPONENT_REQUEST_DECIDE` (requests plus per-category windows) |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/approve` | `OPPONENT_REQUEST_DECIDE` (accepted requests only) |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/reject` | `OPPONENT_REQUEST_DECIDE` (public reason required) |
| POST | `/api/admin/events/:eventId/opponent-requests/:requestId/override-refusal` | `OPPONENT_REQUEST_OVERRIDE` (refused requests only; public reason required) |

### Brackets

| Method | Path | Capability |
| --- | --- | --- |
| POST | `/api/admin/events/:eventId/brackets` | `BRACKET_MANAGE` (one draft/locked bracket per event category) |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/generate` | `BRACKET_MANAGE` (accepts approved pairing `requestIds`) |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/lock` | `BRACKET_MANAGE` (snapshots participants, applies byes) |
| PATCH | `/api/admin/events/:eventId/brackets/:bracketId/publication` | `BRACKET_PUBLISH` |
| GET | `/api/admin/events/:eventId/brackets` | `BRACKET_MANAGE` |

### Schedule and courts

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/events/:eventId/schedule` | `SCHEDULE_MANAGE` |
| POST | `/api/admin/events/:eventId/courts` | `SCHEDULE_MANAGE` |
| PATCH | `/api/admin/events/:eventId/courts/:courtId` | `SCHEDULE_MANAGE` |
| DELETE | `/api/admin/events/:eventId/courts/:courtId` | `SCHEDULE_MANAGE` |
| POST | `/api/admin/events/:eventId/courts/:courtId/judge-assignments` | `SCHEDULE_MANAGE` (rejects overlapping judge intervals) |
| POST | `/api/admin/events/:eventId/schedule/items` | `SCHEDULE_MANAGE` (appends a match to a court queue) |
| PATCH | `/api/admin/events/:eventId/schedule/items/:itemId` | `SCHEDULE_MANAGE` |
| DELETE | `/api/admin/events/:eventId/schedule/items/:itemId` | `SCHEDULE_MANAGE` |
| POST | `/api/admin/events/:eventId/schedule/reorder` | `SCHEDULE_MANAGE` (full queue list per court) |
| PATCH | `/api/admin/events/:eventId/schedule/publication` | `SCHEDULE_PUBLISH` |

### Match results

| Method | Path | Capability |
| --- | --- | --- |
| POST | `/api/admin/matches/:matchId/complete` | `MATCH_RESULT_ADMIN` (walkover/withdrawal/disqualification/admin decision with reason) |
| POST | `/api/admin/matches/:matchId/corrections` | `MATCH_RESULT_CORRECT` (blocked once a downstream match has started) |

### Users, judges, clubs, categories

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/users` | `USER_MANAGE` |
| POST | `/api/admin/users` | `USER_MANAGE` (direct password or emailed invite; players require a club) |
| DELETE | `/api/admin/users/:id` | `USER_MANAGE` (last admin protected) |
| POST | `/api/admin/users/:id/disqualify` | `USER_MANAGE` (end date + reason; revokes sessions) |
| DELETE | `/api/admin/users/:id/disqualify` | `USER_MANAGE` |
| GET | `/api/admin/judges` | `JUDGE_MANAGE` |
| POST | `/api/admin/judges/:id/activate` | `JUDGE_MANAGE` |
| POST | `/api/admin/judges/:id/deactivate` | `JUDGE_MANAGE` (blocked while the judge has an active match) |
| GET | `/api/admin/clubs` | `CLUB_MANAGE` |
| POST | `/api/admin/clubs` | `CLUB_MANAGE` |
| POST | `/api/admin/clubs/:id/members` | `CLUB_MANAGE` (first member becomes leader) |
| POST | `/api/categories` | `CATEGORY_MANAGE` |
| PATCH | `/api/categories/:id` | `CATEGORY_MANAGE` |
| DELETE | `/api/categories/:id` | `CATEGORY_MANAGE` |

### Operations

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/audit` | `AUDIT_READ` (filter by `eventId`, `action`, `take` up to 250) |
| GET | `/api/admin/notifications/email-deliveries` | `DELIVERY_MONITOR` (filter by `status`) |
| POST | `/api/admin/notifications/email-deliveries/:id/retry` | `DELIVERY_MONITOR` (sent deliveries cannot be retried) |

## Realtime subscriptions

Socket.IO runs on the backend origin and authenticates with the same session cookie (anonymous connections are allowed for public data).

Client events:

- `subscribe:event` with an event ID
- `subscribe:match` with a match ID

Authorization mirrors the HTTP publication rules: public viewers join event rooms only for published events, and match rooms only when the match is publicly listed and live scoring is enabled. Private access requires an administrator, a registered participant, or an actively assigned judge. Sockets are rate limited and capped at 40 room subscriptions.

Outbox-driven topics include `event.status.updated`, `event.publication.updated`, `registration.status.updated`, `registration.lineup.replaced`, `registration-roster.publication.updated`, `opponent-request.*`, `bracket.generated` / `bracket.locked` / `bracket.published`, `schedule.updated` / `schedule.published`, `court.queue.updated`, `court.assignment.updated`, `match.started`, `match.score.updated`, `match.completed`, and `match.corrected`. Clients should treat any event as an invalidation signal and refetch the authoritative API record.
