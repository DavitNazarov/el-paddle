# Business Overview

El Padel is a padel club and tournament management platform built for the Georgian padel community. It takes a tournament from event setup through registration, opponent negotiation, bracket play, court scheduling, live scoring, and published results — with clubs, not individuals, as the unit of competition.

```text
event setup → registration → opponent requests → bracket → schedule → judging → results
```

## Audiences

| Audience | What they do |
| --- | --- |
| Public visitors | Browse clubs, players, events, published rosters, brackets, schedules, live scores, and final results |
| Players | Create or join a club, enter events as a two-person club team, negotiate first-round opponents, follow their matches |
| Club leaders | Manage the club roster, approve join requests, edit the club's registered team |
| Organisers | Run one event at a time, on the events an admin hands them: bracket, schedule, match control, opponent requests, lifecycle, and live scoring |
| Administrators | Approve who joins the platform, configure events, review entries, hand events to organisers, resolve exceptions, publish each surface |

## The club-centric model

Clubs are the organizing principle of participation:

- Every player belongs to exactly one club. A new player must create a club (becoming its **leader**) or request to join one before entering events.
- A club fields **one team per event**: an owner/teammate pair from the same club. A second pair from the same club cannot enter.
- The leader has real responsibilities: approving join requests, replacing a registered player with another eligible member (which sends the entry back to admin review), and resolving affected registrations before removing a member. Removal is blocked mid-tournament (ongoing event or locked bracket).
- Admins and organisers are staff, not athletes — they never belong to clubs, cannot be teammates, and hold no player statistics. (A legacy `JUDGE` role still exists in the database and API but has no screens.)

Players are invited to a club by email and complete their profile through a tokenized invite link. A team entry cannot proceed while that invitation is pending: both players must have accepted before their club can enter them, so an entry always names two real players. Registration refuses an unknown, still-invited, or unverified teammate and says which player is holding it up.

## Money

There are no in-app payments. Each event defines a participation fee in GEL together with a Georgian IBAN and receiver name; players pay by bank transfer outside the platform, and administrators verify payment as part of registration review. Registration requires versioned acceptance of the participation terms, refund policy, and physical-risk acknowledgement.

## Joining the platform

Access is granted by a person, not by filling in a form. A newcomer applies: they confirm their email with a code, name the club they want to create, and optionally name a group mate. They then see a confirmation screen and receive an email saying the request is with an administrator.

Nothing is created in the meantime. The request is held on its own, outside the accounts, clubs, and membership tables, so:

- **Approved** — the account, the club (with the applicant as its leader), and the group mate's invitation are all created at once, and the applicant is emailed a link to sign in.
- **Rejected** — everything the applicant entered is deleted, and they are emailed the administrator's reason. The same email address is free to apply again straight away.

An administrator can also write directly to an applicant while the request is open, for anything that needs clearing up before a decision.

## The tournament lifecycle

1. **Event setup** — an admin creates the event (date, location, categories, fee, bank details) and publishes the event page when it should be discoverable.
2. **Registration** — club teams enter per category; admins review each entry (`PENDING → APPROVED / DECLINED / NEEDS_CHANGES / WAITLISTED …`) with public reasons players can act on. The approved roster can be published separately.
3. **Opponent requests** — after registration closes, admins open a per-category window in which an approved team may request one preferred first-round opponent. The target accepts or refuses; the admin has the final word (approve, reject, or explicitly override a refusal). Pairings only ever affect the first round.
4. **Bracket** — one single-elimination bracket per category, sized 2, 4, 8, 16, or 32 to fit the 2–32 approved entries, with byes filling the gap. Approved pairings are placed first. Locking the bracket freezes the draw and snapshots every participant's name and club for permanent history; only a locked bracket can be published.
5. **Schedule** — admins create physical courts and queue matches per court. The schedule publishes independently of the bracket.
6. **Live play** — admins and organisers run the event from **Match control**, one screen showing every match with its court, its time, both pairs and their clubs, in draw order. Each court queue is played strictly in order, one active match per court, but several courts can run at once. A match is decided in sets: the administrator sets how many set wins it takes (1, 2, or 3) per round or per match, and the operator confirms the winner of each set rather than counting points. Reaching the required set wins completes the match and advances the winner automatically; an administrator can reopen a completed match with a reason. Walkovers and retirements require a winner and a reason. Public live scoring is a separate opt-in switch. Events played before the set format keep their historical 0–6 scores.
7. **Results** — completed finals complete the bracket; once every match is finished the event completes and final results can be published. Completed events are read-only unless an authorized admin explicitly reopens them to make corrections.

Each public surface — event page, roster, bracket, schedule, live scoring, results — has its own independent publication switch, so admins can prepare later stages privately.

## Trust and safety mechanics

- **Capability-based administration**: every admin action checks a fine-grained capability (e.g. `BRACKET_PUBLISH`, `MATCH_RESULT_CORRECT`); per-user grants can allow or deny individual capabilities beyond the role default.
- **Idempotent, versioned commands**: tournament writes carry a client `commandId` and `expectedVersion`, so retries never double-apply and concurrent operators cannot silently overwrite each other.
- **Audit everywhere**: privileged changes record actor, before/after state, and a public reason where players deserve one; registrations and events keep dedicated status histories.
- **Transactional outbox**: notifications, emails (via Resend), and realtime invalidations commit in the same database transaction as the domain change and are delivered by a background worker with retries.
- **Historical accuracy**: locked brackets snapshot player and club identity per match, so past results survive roster changes, renames, and club moves.
- **Disqualification**: admins can disqualify a player until a date with a reason; disqualified players cannot register, be added as teammates, or hold eligible entries.
- **Legal compliance**: bilingual (English/Georgian) legal documents with versioned consent for account terms, privacy, participation terms, refund policy, and risk acknowledgement.

## Product surfaces

- **Public site** (`/`, `/clubs`, `/players`, `/events`, `/matches`): marketing landing page plus SEO-optimized public tournament data (sitemap, robots, structured data).
- **Player dashboard** (`/dashboard/*`): club, entries, events with opponent-request flows, match history, notifications, settings.
- **Admin console** (`/admin/*`): overview counts, events with per-event tools (registrations, opponent requests, bracket, schedule, match control), users, clubs, categories, settings, operations (audit, email deliveries).

## Where to go deeper

- [Architecture](ARCHITECTURE.md) — components, consistency patterns, authorization, publication model.
- [API reference](API.md) — the full endpoint surface with capability requirements.
- [Tournament operations](TOURNAMENT_OPERATIONS.md) — the stage-by-stage operator runbook.
