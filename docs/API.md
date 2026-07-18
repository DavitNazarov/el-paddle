# API Reference

This document lists the API surface by domain. The route source remains authoritative.

## Conventions

- API base URL: `http://localhost:4000` in local development.
- JSON requests use `Content-Type: application/json`.
- Authentication uses an HTTP-only session cookie.
- Unsafe requests require a CSRF cookie and matching `x-csrf-token` header.
- Tournament commands commonly require `commandId` and `expectedVersion`.
- Validation errors use `400`, authorization failures `401` or `403`, missing resources `404`, and version/state conflicts `409`.

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
| POST | `/api/auth/register` | Register a player |
| POST | `/api/auth/verify` | Verify an account |
| POST | `/api/auth/login` | Create a session |
| POST | `/api/auth/logout` | Clear the session |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/invite/complete` | Complete teammate invitation |
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Complete Google OAuth |
| POST | `/api/admin/bootstrap` | Create the first production admin |

## Public data

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/clubs` | Club directory |
| GET | `/api/public/clubs/:slug` | Club profile |
| GET | `/api/public/events` | Published events |
| GET | `/api/public/events/:id` | Published event detail |
| GET | `/api/public/events/:eventId/registered-teams` | Approved teams when the event roster is published |
| GET | `/api/public/events/:eventId/brackets` | Published brackets |
| GET | `/api/public/events/:eventId/schedule` | Published schedule |
| GET | `/api/matches` | Published match history; admins may inspect unpublished results |
| GET | `/api/matches/:matchId` | Scheduled, live, or completed match detail subject to publication and viewer visibility |
| GET | `/api/players/:playerId/matches` | Published player history |
| GET | `/api/clubs/:clubId/matches` | Published club history |

## Player endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Player dashboard summary, including every registration owned by the player's club |
| GET | `/api/account/club-details` | Current club profile, roster, and leader-only pending join requests |
| GET | `/api/account/club-requests/current` | Current player's pending club request |
| POST | `/api/account/club-requests` | Request membership in an existing club |
| GET | `/api/account/club/members/:id/removal-impact` | List unfinished registrations and eligible replacements before member removal; club leader only |
| DELETE | `/api/account/club/members/:id` | Resolve every unfinished registration, then remove a member transactionally; club leader only |
| PATCH | `/api/account/club/join-requests/:id` | Approve or reject a join request; club leader only |
| POST | `/api/registrations` | Enter one club team in an event; returns `409` when the club already has an entry |
| PATCH | `/api/registrations/:id/lineup` | Replace one registered participant with another eligible club member; club leader only |
| GET | `/api/events/:id` | Event detail visible to the current user |
| GET | `/api/events/:eventId/brackets` | Player-visible bracket state |
| GET | `/api/events/:eventId/opponent-request-state` | Request window and own requests |
| GET | `/api/events/:eventId/eligible-opponents` | Eligible target entries |
| POST | `/api/events/:eventId/opponent-requests` | Create a request |
| PATCH | `/api/events/:eventId/opponent-requests/:requestId` | Edit a pending request |
| DELETE | `/api/events/:eventId/opponent-requests/:requestId` | Withdraw a request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/accept` | Accept a received request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/refuse` | Refuse a received request |
| GET | `/api/me/matches` | Own match history |
| GET | `/api/notifications` | Notification history |
| GET | `/api/notifications/unread-count` | Unread total |
| PATCH | `/api/notifications/:id/read` | Mark one notification read |
| POST | `/api/notifications/read-all` | Mark all notifications read |

## Judge endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/judge/assignments` | Active and upcoming court assignments |
| GET | `/api/judge/events/:eventId/courts/:courtId/queue` | Ordered court queue |
| GET | `/api/judge/matches/:matchId` | Assigned match detail |
| POST | `/api/judge/matches/:matchId/start` | Start the next ready match |
| POST | `/api/judge/matches/:matchId/score` | Increment or decrement one side |
| POST | `/api/judge/matches/:matchId/complete` | Record walkover or withdrawal |

Score command example:

```json
{
  "side": "A",
  "action": "INCREMENT",
  "expectedVersion": 4,
  "commandId": "c3eb31ed-91d5-4e44-8d0a-1ec8c61e5fd6"
}
```

## Administrator endpoint groups

### Event and registration administration

- `POST /api/events`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `PATCH /api/admin/events/:id/status`
- `PATCH /api/admin/events/:id/tournament-publication`
- `GET /api/admin/events/:eventId/registrations`
- `PATCH /api/admin/events/:eventId/registration-roster-publication`
- `PATCH /api/admin/events/:eventId/registrations/:id/status`

### Opponent requests and brackets

- `POST /api/admin/events/:eventId/categories/:categoryId/opponent-requests/open`
- `POST /api/admin/events/:eventId/categories/:categoryId/opponent-requests/close`
- `GET /api/admin/events/:eventId/opponent-requests`
- `POST /api/admin/events/:eventId/opponent-requests/:requestId/approve`
- `POST /api/admin/events/:eventId/opponent-requests/:requestId/reject`
- `POST /api/admin/events/:eventId/opponent-requests/:requestId/override`
- `POST /api/admin/events/:eventId/brackets`
- `POST /api/admin/events/:eventId/brackets/:bracketId/generate`
- `POST /api/admin/events/:eventId/brackets/:bracketId/lock`
- `PATCH /api/admin/events/:eventId/brackets/:bracketId/publication`
- `GET /api/admin/events/:eventId/brackets`

### Schedule and courts

- `GET /api/admin/events/:eventId/schedule`
- `POST /api/admin/events/:eventId/courts`
- `PATCH /api/admin/events/:eventId/courts/:courtId`
- `DELETE /api/admin/events/:eventId/courts/:courtId`
- `POST /api/admin/events/:eventId/courts/:courtId/judge-assignments`
- `POST /api/admin/events/:eventId/schedule/items`
- `PATCH /api/admin/events/:eventId/schedule/items/:itemId`
- `DELETE /api/admin/events/:eventId/schedule/items/:itemId`
- `POST /api/admin/events/:eventId/schedule/reorder`
- `PATCH /api/admin/events/:eventId/schedule/publication`

### Results and operations

- `POST /api/admin/matches/:matchId/complete`
- `POST /api/admin/matches/:matchId/corrections`
- `GET /api/admin/audit`
- `GET /api/admin/notifications/email-deliveries`
- `POST /api/admin/notifications/email-deliveries/:id/retry`

User, judge, club, and category administration is exposed under `/api/admin/users`, `/api/admin/judges`, `/api/admin/clubs`, and `/api/categories`.

## Realtime subscriptions

Socket.IO uses the same backend origin and session cookie.

Client events:

- `subscribe:event` with an event ID
- `subscribe:match` with a match ID

The gateway admits public viewers only when the relevant data is published. Private access requires an administrator, registered participant, or assigned judge relationship.

Committed outbox topics include lifecycle, registration, opponent request, bracket, schedule, match start, score, completion, and correction changes. Clients should treat an event as an invalidation signal and refetch the authoritative API record.
