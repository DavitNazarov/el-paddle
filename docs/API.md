# API Reference

This document lists the HTTP API surface by audience. The route source under `backend/src/modules/*/**.routes.ts` remains authoritative; when this document and the code disagree, trust the code and fix the document.

## Conventions

- API base URL: `http://localhost:4000` in local development.
- JSON requests use `Content-Type: application/json`. The body parser rejects payloads above 100 KB.
- Authentication uses an HTTP-only session cookie (`elpadel_session`) containing a signed JWT. The token names a `Session` row, so signing out revokes that one device. It also embeds the user's `sessionVersion`; a password change, a password reset, disqualification, judge deactivation, and an explicit "log out of all devices" bump the version and invalidate every outstanding token at once. The session row is read as part of the existing user lookup, so per-device revocation costs no extra query.
- When the site and API use sibling hosts (for example `elpadell.com` and `api.elpadell.com`), the cookie `Domain` is the shared parent so Next.js SSR and browser requests share the session.
- Unsafe requests (POST/PATCH/DELETE) require a CSRF cookie plus a matching `x-csrf-token` header and an allowed `Origin`.
- Tournament commands commonly require a client-generated `commandId` (idempotency) and `expectedVersion` (optimistic concurrency).
- Validation errors use `400`, authentication failures `401`, authorization failures `403`, missing resources `404`, and version/state conflicts `409`. Resources the viewer may not see return `404` rather than `403`.
- Auth endpoints are rate limited (registration bursts and login/verify attempts per window).
- Anonymous public GETs (`/api/public/*`) send a short `Cache-Control: public, max-age=…, stale-while-revalidate=…`; authenticated and mutable responses stay uncached.
- Event bank details (`bankAccountIban`, `bankAccountReceiver`) are omitted from list payloads and public single-event responses; they appear only on authenticated `GET /api/events/:id` and admin event responses. The register modal fetches them on demand.
- Match-history lists (`/api/matches`, `/api/me/matches`, `/api/players/:id/matches`, `/api/clubs/:id/matches`) return `{ matches, events }`: the shared event is hoisted once into a de-duplicated `events` array and each match references it by `bracket.eventId` instead of embedding a copy.
- Reads that produce a desk copy — the entry list, the court sheet, final results, the audit log — also answer CSV, through `?format=csv` or `Accept: text/csv`. The file is UTF-8 with a BOM so Georgian names open correctly in Excel, and any cell beginning `=`, `+`, `-` or `@` is prefixed with an apostrophe so a spreadsheet reads it as text rather than a formula.

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
| GET | `/health` | Process liveness — touches nothing else, so a database blip never restarts a healthy API |
| GET | `/health/ready` | Readiness: database reachability with latency, plus the outbox backlog (`pending`, `failed`). `503` when the database is unreachable, so a deploy gate can read the status code alone |
| GET | `/api/meta/version` | Deployed `version`, `commit`, `environment`, and process start time, from the build environment |
| GET | `/api/auth/csrf` | Issue CSRF cookie and token |
| POST | `/api/auth/login` | Create a session |
| POST | `/api/auth/logout` | Sign out this device only; revokes its `Session` row |
| POST | `/api/auth/logout-all` | Sign out every device, including this one; bumps `sessionVersion` |
| POST | `/api/auth/password-reset` | Request a reset link; the response never reveals whether the address has an account |
| POST | `/api/auth/password-reset/complete` | Redeem a single-use link and set a new password; signs every device out |
| GET | `/api/auth/password-reset/validate?token=…` | Whether a reset link is still usable (`valid`, plus `MISSING` / `UNKNOWN` / `USED` / `EXPIRED`). Read-only — it never consumes the link, so the form can refuse a dead link before a password is typed |
| GET | `/api/auth/me` | Current user (or `null`) |
| POST | `/api/auth/invite/complete` | Complete a teammate/club-mate/admin-created invitation (token, profile, password, club when required) |
| GET | `/api/auth/google` | Start Google OAuth (requires prior legal consent cookie) |
| GET | `/api/auth/google/callback` | Complete Google OAuth |
| POST | `/api/admin/bootstrap` | Create the first production admin; requires the `x-bootstrap-token` header matching `FIRST_ADMIN_BOOTSTRAP_TOKEN` |

There is no direct registration endpoint. Every new signup goes through the reviewed club-application flow below, and the only other ways an account comes into existence are an invitation and the first-admin bootstrap. Application and invite completion record versioned acceptance of the Terms of Use, Privacy Policy, and age-eligibility confirmation. `ADMIN_EMAILS` elevation is applied only after the email address is verified.

## Club applications

New signups are reviewed before they gain access. No `User`, `Club`, or `ClubMember` row exists until an admin approves; rejecting deletes the request outright, so the same email address can apply again immediately.

Applicant endpoints need no session. After the emailed code is verified, a short-lived `elpadel_application` cookie carries the request through the remaining steps. It is not a session and grants no account access.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/applications` | Start a request (name, surname, phone, email, password, legal + eligibility consent); emails a verification code |
| POST | `/api/applications/verify` | Verify the emailed code and issue the application cookie |
| POST | `/api/applications/resend-code` | Re-send the verification code (one send per address every 30 seconds) |
| GET | `/api/applications/current` | Status of the request this browser is filling in (or `null`) |
| PATCH | `/api/applications/current` | Save the club details and the optional group mate |
| POST | `/api/applications/current/submit` | Hand the finished request to the admins |
| POST | `/api/applications/current/abandon` | Clear the application cookie |

Admin review requires `CLUB_APPLICATION_REVIEW`, which organisers never receive.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/club-applications` | Requests awaiting a decision |
| GET | `/api/admin/club-applications/:id` | One request plus the emails already sent to the applicant |
| POST | `/api/admin/club-applications/:id/approve` | Create the account, club, leader membership, and group-mate invite, then delete the request |
| POST | `/api/admin/club-applications/:id/reject` | Delete the request and email the applicant the reason (a reason is required) |
| POST | `/api/admin/club-applications/:id/message` | Send the applicant a free-text email (subject, body) |

## Account and club self-service

All endpoints require a session. Profile and password endpoints are open to every signed-in role. Club write operations are restricted to players (`USER` role); admins and judges do not belong to clubs.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/account/profile` | Own editable account fields plus `hasPassword` (never the hash) |
| PATCH | `/api/account/profile` | Update own name, surname, and phone; role and status are not self-editable, and the email address has its own verified flow below |
| POST | `/api/account/password` | Change own password. Requires the current password unless the account has none (Google-only). Revokes every other session and re-issues a cookie for the calling device |
| POST | `/api/account/email` | Start an email change. Requires the current password when the account has one; mails a code to the **new** address. Refused when the address is taken or would change the account's role (an `ADMIN_EMAILS` address) |
| POST | `/api/account/email/verify` | Redeem the code (`email` + `code`) and move the account to the new address. Signs every device out and re-issues a cookie for this one |
| GET | `/api/account/sessions` | Signed-in devices: `id`, `createdAt`, `expiresAt`, `current`. No device name or address is recorded against a session, so none is reported |
| DELETE | `/api/account/sessions/:id` | End one session. Revoking the calling device clears its cookie and answers `signedOut: true` |
| POST | `/api/account/club` | Create a club and become its leader (players without a club) |
| PATCH | `/api/account/club` | Edit own club name, slug, description, and logo; club leader only. Changing the slug moves the public club page |
| POST | `/api/account/club/mate` | Add or invite a club mate by email; active accounts must join by themselves |
| POST | `/api/account/club/members/:id/invite/resend` | Re-send a club-mate invitation with a fresh token; retires the previous link. Leader only, `INVITED` members only |
| DELETE | `/api/account/club/members/:id/invite` | Withdraw an unaccepted invitation and free the address. Leader only; refused once the invitee appears in an entry |
| PATCH | `/api/account/club/members/:id/role` | Hand leadership to another active member (a swap — the caller becomes a member); leader only |
| GET | `/api/account/club-details` | Own club profile, roster (each member with `status`), and (leader only) pending join requests |
| GET | `/api/account/club-requests/current` | Current player's pending join request |
| POST | `/api/account/club-requests` | Request membership in an existing club |
| DELETE | `/api/account/club-requests/current` | Withdraw own pending join request. The row is deleted, not rejected, so the player can ask again without carrying a refusal |
| PATCH | `/api/account/club/join-requests/:id` | Approve or reject a join request; club leader only |
| GET | `/api/account/club/members/:id/removal-impact` | Unfinished registrations affected by removing a member plus eligible replacements; leader only |
| DELETE | `/api/account/club/members/:id` | Remove a member after resolving every affected registration (replace or withdraw); leader only |
| GET | `/api/account/club/departure-impact` | The same impact read for the caller's own membership, before leaving |
| POST | `/api/account/club/leave` | Leave the club, resolving every affected registration the same way. A leader must hand leadership on first |
| DELETE | `/api/account` | Delete own account (the last remaining admin cannot be deleted) |

## Public data

No session required. Public routes only ever return explicitly published data.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/search?q=&limit=` | One query across players, clubs, and published events. Returns nothing new — only what the three directories already publish — for queries of two characters or more |
| GET | `/api/public/clubs` | Club directory (id, name, slug) |
| GET | `/api/public/clubs/:slug` | Club profile and roster |
| GET | `/api/public/clubs/:slug/stats` | Club record over published results: members, events entered, played/won/lost, titles. Read from participant snapshots, so it reflects the club each team *entered* under |
| GET | `/api/public/players` | Active player directory with public match statistics |
| GET | `/api/public/players/:id` | Public player profile |
| GET | `/api/public/players/:id/stats` | The public twin of `/api/me/stats` — streak, best finish, partner records — narrowed to events that published their results |
| GET | `/api/public/players/:id/versus/:opponentId` | Head-to-head record between two players over published results |
| GET | `/api/public/events` | Public calendar: `upcoming` (nearest published event), `scheduled` (up to 12 published future events), `previous` (up to 24 past events) |
| GET | `/api/public/events/:id` | Published event detail |
| GET | `/api/public/sitemap-events` | Lightweight published-event index for the SEO sitemap |
| GET | `/api/public/events/:eventId/registered-teams` | Approved teams once the registration roster is published |
| GET | `/api/public/events/:eventId/brackets` | Published brackets |
| GET | `/api/public/events/:eventId/schedule` | Published schedule |
| GET | `/api/public/events/:eventId/results` | Final standings per category: champion, runner-up, both losing semifinalists (joint third), and the matches they were decided in. Gated on `resultsPublishedAt`; `?format=csv` returns the same as a file |
| GET | `/api/matches` | Completed match history (published results); admins may inspect unpublished results |
| GET | `/api/matches/:matchId` | Match detail subject to publication and viewer visibility; unpublished results are redacted |
| GET | `/api/players/:playerId/matches` | Published player history |
| GET | `/api/clubs/:clubId/matches` | Published club history |
| GET | `/api/categories` | Category list |

## Player endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Player dashboard: visible events (with `teamsIn` active-team counts), club registrations (each with `inDraw` when the entry appears in a published draw), club members, membership role, `nextMatch` (live or next scheduled), pending received opponent requests, `sentRequests` (the reader's own still-live requests), and `requestWindows` (whether their entries' categories accept requests right now) |
| GET | `/api/me/summary` | Shell badges: unread notification count and entries in `NEEDS_CHANGES` (waiting on the player) |
| GET | `/api/me/stats` | Personal record: streak, best finish, partner records, completed-match list (byes excluded) |
| GET | `/api/events` | Published upcoming events (`?scope=admin` returns all events for admins) |
| GET | `/api/events/:id` | Event detail visible to the current user |
| POST | `/api/registrations` | Enter one club team (owner + teammate) in an event category; requires participation, refund, and risk consent; the teammate must already be an active account in the same club, so `403` when they are unknown, still invited, or unverified; `409` when the club already has an entry |
| PATCH | `/api/registrations/:id/lineup` | Replace one registered player with another eligible club member; club leader only; resets the entry to `PENDING` |
| POST | `/api/registrations/:id/withdraw` | The club pulls its own team out (versioned, `commandId`, optional public reason). Club leader only. Refused once the draw is locked or the event has started — an admin records a walkover instead |
| GET | `/api/events/:eventId/brackets` | Published brackets only (same publication gate as the public route) |
| GET | `/api/events/:eventId/opponent-request-state` | Own requests for the event |
| GET | `/api/events/:eventId/eligible-opponents?requestingEntryId=…` | Eligible target entries in the same category; `409` naming the blocking player when the requesting entry is itself ineligible |
| POST | `/api/events/:eventId/opponent-requests` | Create a request |
| PATCH | `/api/events/:eventId/opponent-requests/:requestId` | Retarget or edit a pending request |
| DELETE | `/api/events/:eventId/opponent-requests/:requestId` | Withdraw a pending or accepted request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/accept` | Accept a received request |
| POST | `/api/events/:eventId/opponent-requests/:requestId/refuse` | Refuse a received request (optional reason) |
| GET | `/api/me/matches` | Own match history |
| GET | `/api/notifications` | Notification history; `?unread=true`, `?take=` (max 100) and `?cursor=` for the next page, answered with `nextCursor` |
| GET | `/api/notifications/unread-count` | Unread total |
| PATCH | `/api/notifications/:id/read` | Mark one notification read |
| PATCH | `/api/notifications/:id/unread` | Put one back as unread |
| DELETE | `/api/notifications/:id` | Remove the reader's own copy; the entity and its audit row are untouched |
| POST | `/api/notifications/read-all` | Mark all notifications read |

## Scoring endpoints

> These paths keep the `/api/judge` prefix. The `JUDGE` role still exists and these
> endpoints still serve it, but the judge role has no frontend surface: admins and
> organisers drive these same endpoints from the match control console
> (`/admin/events/:eventId/control`).

Judges see only courts with an active, unrevoked assignment covering the current time.

Admins and the event's organiser reach the same endpoints and are authorized per match instead: an organiser passes when the match belongs to an event handed to them. Unlike a judge they are not bound to one match at a time, so they can run several courts at once, and starting a match does not overwrite the judge named on the schedule item. The physical constraints hold for everyone: a court's queue is played in order, and only one match runs on a court at a time.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/judge/assignments` | Active and upcoming court assignments |
| GET | `/api/judge/home` | Each live court assignment with its queue, for the judge home screen |
| GET | `/api/judge/events/:eventId/courts/:courtId/queue` | Ordered court queue |
| GET | `/api/judge/matches/:matchId` | Assigned match detail |
| POST | `/api/judge/matches/:matchId/start` | Start the next ready match in the queue |
| POST | `/api/judge/matches/:matchId/sets` | Record the winner of the next set |
| POST | `/api/judge/matches/:matchId/result` | Record the whole result as a set tally, completing the match |
| POST | `/api/judge/matches/:matchId/sets/undo` | Withdraw the last set while the match is in progress |
| POST | `/api/judge/matches/:matchId/score` | Legacy point scoring, only for historical `POINTS` matches (0–6; reaching 6 completes the match) |
| POST | `/api/judge/matches/:matchId/complete` | Record a walkover, withdrawal, or disqualification with a reason |

Set command example. `setNumber` must be the next undecided set, so a stale retry fails with
409 instead of silently recording the following set:

```json
{
  "setNumber": 2,
  "winnerSide": "A",
  "expectedVersion": 4,
  "commandId": "c3eb31ed-91d5-4e44-8d0a-1ec8c61e5fd6"
}
```

Result command example. This is how the match control console scores: two numbers, one command,
one completed match.

```json
{
  "setsA": 1,
  "setsB": 2,
  "expectedVersion": 4,
  "commandId": "9f1c0b6e-2a55-4b0c-9c4a-0f21c9f3f2ab"
}
```

The tally must be a finished result for the match's frozen `setCount` — the winner exactly at
`setsToWin`, the loser below it — and may not fall below sets already recorded, which is an undo
rather than a result. The `MatchSet` rows the tally is made of are derived: the loser's sets come
first, so the decider belongs to the winner. One command writes one `SetEvent` row.

A match is decided by a race to `setCount` set wins: 1 → first to 1 (one set), 2 → first to 2
(up to three sets), 3 → first to 3 (up to five sets). Reaching the required wins completes the
match and advances the winner. `MatchDto` carries `scoringMode`, `setCount`, `setsToWin`,
`maxSets`, and the decided `sets`; for set matches `scoreA` / `scoreB` are the set tallies,
not points. Historical matches keep `scoringMode: "POINTS"` and their 0–6 scores.

## Administrator endpoints

Every admin route checks a specific capability, not just the `ADMIN` role. Per-user `UserCapabilityGrant` rows (ALLOW or DENY) override the role default.

Routes marked **event-scoped** below use `requireEventCapability`, which also admits an `ORGANISER` holding an active `EventOrganiser` link for that event. Every other admin route stays global, so an organiser is refused: they cannot create, edit, publish, or delete an event, review registrations, correct a finished result, reopen a completed event, or manage accounts, clubs, and club requests.

An organiser's event-scoped capabilities are exactly `BRACKET_MANAGE`, `BRACKET_PUBLISH`, `SCHEDULE_MANAGE`, `SCHEDULE_PUBLISH`, `OPPONENT_REQUEST_MANAGE`, `OPPONENT_REQUEST_DECIDE`, `OPPONENT_REQUEST_OVERRIDE`, `EVENT_STATUS_MANAGE`, and `JUDGE_MANAGE`.

### Overview and events

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/summary` | `DASHBOARD_READ`; an organiser instead receives the same counts scoped to their events |
| GET | `/api/admin/events/operations` | `DASHBOARD_READ`; per-event operational counts, scoped to an organiser's events exactly like the summary. `schedule.unscheduled` counts playable matches with no court (neither completed nor cancelled), so the season board can name that queue instead of staying silent about it |
| GET | `/api/admin/stats/platform` | `DASHBOARD_READ`; platform statistics over `?range=7d\|30d\|90d\|12m` (default `30d`, unknown values are rejected with 400). Unlike the two rows above there is **no organiser scoping**: the payload is entirely platform totals an organiser holds no power over, so an organiser is refused. Buckets are Asia/Tbilisi days, weeks or months, and the response is cached in-process for 60 s (`generatedAt` says when it was computed) |
| GET | `/api/events?scope=admin` | Admins see every event; an organiser sees only the events handed to them |
| POST | `/api/events` | `EVENT_MANAGE` — admin only; organisers cannot create events |
| PATCH | `/api/events/:id` | `EVENT_MANAGE` — admin only |
| POST | `/api/events/:id/duplicate` | `EVENT_MANAGE` — copies title, venue, fee, IBAN, receiver and category list onto a new `date`. Entries, draws, courts, organisers and every publication flag stay with the original; the copy starts unpublished with registration open. `arrivalTime` is deliberately not carried across |
| DELETE | `/api/events/:id` | `EVENT_MANAGE` (completed events must be reopened first) — admin only |
| PATCH | `/api/admin/events/:id/status` | `EVENT_STATUS_MANAGE`, **event-scoped**; reopening a completed event additionally requires `EVENT_STATE_CORRECT`, which organisers never hold |
| PATCH | `/api/admin/events/:id/tournament-publication` | `EVENT_PUBLISH` (live scoring, final results) — admin only |
| GET | `/api/admin/organisers` | `USER_MANAGE`; organiser accounts an event can be handed to |
| GET | `/api/admin/events/:eventId/organisers` | Organisers assigned to the event (readable by those organisers) |
| POST | `/api/admin/events/:eventId/organisers` | `USER_MANAGE`; hand the event to an organiser and email them |
| DELETE | `/api/admin/events/:eventId/organisers/:userId` | `USER_MANAGE`; take the event back |

Event create/update payloads include the participation fee in GEL, a Georgian IBAN (`GE` + 20 characters), and the receiver name shown to players for bank transfers.

### Registrations

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/registrations` | `REGISTRATION_REVIEW` |
| PATCH | `/api/admin/registrations/:id` | `REGISTRATION_REVIEW` (simple status change; decline requires a reason) |
| GET | `/api/admin/events/:eventId/registrations` | `REGISTRATION_REVIEW`; `?format=csv` (or `Accept: text/csv`) returns the entry list as a file |
| PATCH | `/api/admin/events/:eventId/registrations/:id/status` | `REGISTRATION_REVIEW` (versioned command with public reason and internal note) |
| PATCH | `/api/admin/events/:eventId/registrations/status` | `REGISTRATION_REVIEW`; one decision applied to up to 100 `registrationIds`. Each entry is decided in its own transaction and the response reports `applied`, `total`, and a per-entry result, so one refusal never undoes the rest |
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

A match carries `snapshots[]`, the participant identity frozen when the draw locked. `clubId` and `clubName` are nullable: they name the club the team entered under, which is gone once that club is deleted.

| PUT | `/api/admin/events/:eventId/brackets/:bracketId/set-defaults` | `BRACKET_MANAGE` (full per-round map of set counts, 1–3) |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/placements` | `BRACKET_MANAGE` (move or swap a first-round entry; draft brackets only) |
| PATCH | `/api/admin/events/:eventId/brackets/:bracketId/publication` | `BRACKET_PUBLISH` |
| GET | `/api/admin/events/:eventId/brackets` | `BRACKET_MANAGE` |
| DELETE | `/api/admin/events/:eventId/brackets/:bracketId` | `BRACKET_MANAGE`; discards a **draft** draw. Applied pairings return to `APPROVED_BY_ADMIN` and can seed a new draw; entries are untouched |
| POST | `/api/admin/events/:eventId/brackets/:bracketId/unlock` | `EVENT_STATE_CORRECT` (admin only, reason required) — the mirror of the completed-event reopen. Returns every team to its first-round slot, clears the byes the lock derived, and deletes the participant snapshots. Refused once any match has been played, or while the draw is published or on the court schedule |

### Schedule and courts

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/events/:eventId/schedule` | `SCHEDULE_MANAGE`; `?format=csv` returns the court sheet in playing order |
| GET | `/api/admin/events/:eventId/schedule/unscheduled` | `SCHEDULE_MANAGE`; playable matches with no court yet |
| POST | `/api/admin/events/:eventId/schedule/auto-fill` | `SCHEDULE_MANAGE`; deals unplaced matches round-robin over the active courts, appending to each queue. `readyOnly` defaults to true (matches whose two teams are known). Never reorders or retimes what is already placed; reports `placed` and `skipped` |
| POST | `/api/admin/events/:eventId/courts` | `SCHEDULE_MANAGE` |
| PATCH | `/api/admin/events/:eventId/courts/:courtId` | `SCHEDULE_MANAGE` |
| DELETE | `/api/admin/events/:eventId/courts/:courtId` | `SCHEDULE_MANAGE` |
| POST | `/api/admin/events/:eventId/courts/:courtId/judge-assignments` | `SCHEDULE_MANAGE` (rejects overlapping judge intervals) |
| DELETE | `/api/admin/events/:eventId/courts/:courtId/judge-assignments/:assignmentId` | `SCHEDULE_MANAGE`; ends one assignment and clears the judge from that court's unfinished schedule items. Refused while a match is running on the court; already-revoked assignments answer success |
| POST | `/api/admin/events/:eventId/schedule/items` | `SCHEDULE_MANAGE` (appends a match to a court queue) |
| PATCH | `/api/admin/events/:eventId/schedule/items/:itemId` | `SCHEDULE_MANAGE` (accepts `courtId` and `queuePosition` to move a match; requires `commandId`) |
| DELETE | `/api/admin/events/:eventId/schedule/items/:itemId` | `SCHEDULE_MANAGE` |
| POST | `/api/admin/events/:eventId/schedule/reorder` | `SCHEDULE_MANAGE` (full queue list per court as `items: [{id, version}]`, plus `commandId`) |
| PATCH | `/api/admin/events/:eventId/schedule/publication` | `SCHEDULE_PUBLISH` |

Every row above is **event-scoped**. Assigning a judge to a court or a schedule item requires that judge to be in the event's pool; an admin holding global `JUDGE_MANAGE` has the link created automatically, while an organiser is confined to the pool they built. `judgeId` stays optional everywhere — a court or schedule item may be left without a judge. Nothing in the frontend assigns a judge any more, so in practice these arrive unset; the endpoints remain for API clients and are still enforced.

### Event judges

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/events/:eventId/judges` | `JUDGE_MANAGE`, **event-scoped**; the event's judge pool |
| POST | `/api/admin/events/:eventId/judges` | `JUDGE_MANAGE`, **event-scoped**; invites a new judge by email and admits them. An address already belonging to a player or admin is refused with 409 — changing a role stays an admin act under `USER_MANAGE` |
| DELETE | `/api/admin/events/:eventId/judges/:userId` | `JUDGE_MANAGE`, **event-scoped**; removes the judge from this event and revokes their live court assignments. The account itself is untouched |

### Match results

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/events/:eventId/matches` | `BRACKET_MANAGE`, read-only for organisers; every match of the event with `?status=` (comma-separated), `?round=`, `?categoryId=`, `?courtId=`, `?unscheduled=true` |
| POST | `/api/admin/matches/:matchId/complete` | `MATCH_RESULT_ADMIN` (walkover/withdrawal/disqualification/admin decision with reason) |
| POST | `/api/admin/matches/:matchId/corrections` | `MATCH_RESULT_CORRECT` (blocked once a downstream match has started) |
| POST | `/api/admin/matches/:matchId/sets/undo` | `MATCH_RESULT_CORRECT` (reason required; reopens a completed set match) |
| PATCH | `/api/admin/matches/:matchId/set-config` | `BRACKET_MANAGE` (per-match set override; locked once the match starts) |

### Users, judges, clubs, categories

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/users` | `USER_MANAGE` |
| POST | `/api/admin/users` | `USER_MANAGE` (direct password or emailed invite; players require a club) |
| DELETE | `/api/admin/users/:id` | `USER_MANAGE` (last admin protected) |
| POST | `/api/admin/users/:id/invite/resend` | `USER_MANAGE`; issues a fresh invitation token and retires the outstanding ones. `INVITED` accounts only |
| POST | `/api/admin/users/:id/disqualify` | `USER_MANAGE` (end date + reason; revokes sessions) |
| DELETE | `/api/admin/users/:id/disqualify` | `USER_MANAGE` |
| GET | `/api/admin/judges` | `JUDGE_MANAGE` |
| POST | `/api/admin/judges/:id/activate` | `JUDGE_MANAGE` |
| POST | `/api/admin/judges/:id/deactivate` | `JUDGE_MANAGE` (blocked while the judge has an active match) |
| GET | `/api/admin/clubs` | `CLUB_MANAGE` |
| POST | `/api/admin/clubs` | `CLUB_MANAGE` |
| PATCH | `/api/admin/clubs/:id` | `CLUB_MANAGE` (name, slug, description, logo; audited) |
| DELETE | `/api/admin/clubs/:id` | `CLUB_MANAGE` (refused while a team is entered in an unfinished event) |
| GET | `/api/admin/clubs/leaderless` | `CLUB_MANAGE`; clubs with no `LEADER` — nobody able to edit the club, review a join request, or change a registered team |
| PATCH | `/api/admin/clubs/:id/members/:memberId/role` | `CLUB_MANAGE`; appoint a club's leader. The escape hatch for a leaderless club, which the member-facing transfer cannot rescue because it requires an existing leader. Still a swap: any current leader stands down in the same transaction |
| POST | `/api/admin/clubs/:id/members` | `CLUB_MANAGE` (first member becomes leader) |
| POST | `/api/categories` | `CATEGORY_MANAGE` |
| PATCH | `/api/categories/:id` | `CATEGORY_MANAGE` |
| DELETE | `/api/categories/:id` | `CATEGORY_MANAGE` |

### Operations

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/api/admin/audit` | `AUDIT_READ` (filter by `eventId`, `action`, `take` up to 250); `?format=csv` returns the same rows as a file |
| GET | `/api/admin/events/:eventId/results` | `EVENT_PUBLISH`, readable by the event's organisers; the podium before it is published. `?format=csv` for the same as a file |
| GET | `/api/admin/outbox` | `DELIVERY_MONITOR`; the transactional outbox that carries every notification, email and realtime topic. Answers a `summary` (`pending` / `processing` / `processed` / `failed`, plus `oldestPendingAt`) and the messages themselves, failures first. Filter by `status` and `topic` |
| POST | `/api/admin/outbox/:id/retry` | `DELIVERY_MONITOR`; returns one message to `PENDING` and clears its error. Refused for delivered messages and for one a worker currently holds |
| GET | `/api/admin/notifications/email-deliveries` | `DELIVERY_MONITOR` (filter by `status`) |
| POST | `/api/admin/notifications/email-deliveries/:id/retry` | `DELIVERY_MONITOR` (sent deliveries cannot be retried) |

## Realtime subscriptions

Socket.IO runs on the backend origin and authenticates with the same session cookie (anonymous connections are allowed for public data).

Client events:

- `subscribe:event` with an event ID
- `subscribe:match` with a match ID

Authorization mirrors the HTTP publication rules: public viewers join event rooms only for published events, and match rooms only when the match is publicly listed and live scoring is enabled. Private access requires an administrator, a registered participant, or an actively assigned judge. Sockets are rate limited and capped at 40 room subscriptions.

`subscribe:event` picks the room from the subscriber's authorization; the caller cannot ask for one:

| Room | Who joins | Payload |
| --- | --- | --- |
| `event-staff:<id>` | Admin, an organiser of this event, a judge holding a live court assignment on it | Full — the only place unpublished scores, winners and registration decisions are broadcast |
| `event:<id>` | Everyone else who may listen: anyone on a published event, a registered participant on an unpublished one | Stripped to `{ eventId }` |

Nobody joins both, so a topic is never delivered twice to one socket. The public room is deliberately coarse: an anonymous socket clears it on `isPublished` alone, which is a far weaker gate than the per-match publication and redaction rules the REST reads apply, so the payload there carries no data of its own. Per-match detail continues to flow on `match:<id>`, which is gated on `publicLiveScoringEnabled` plus bracket or schedule publication.

Outbox-driven topics include `event.status.updated`, `event.publication.updated`, `registration.status.updated`, `registration.lineup.replaced`, `registration-roster.publication.updated`, `opponent-request.*`, `bracket.generated` / `bracket.locked` / `bracket.published`, `schedule.updated` / `schedule.published`, `court.queue.updated`, `court.assignment.updated`, `match.started`, `match.score.updated`, `match.set.decided`, `match.set.undone`, `match.reopened`, `match.config.updated`, `bracket.updated`, `match.completed`, and `match.corrected`. Clients should treat any event as an invalidation signal and refetch the authoritative API record.
