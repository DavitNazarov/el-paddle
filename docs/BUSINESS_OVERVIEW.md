# Business Overview

El Padel is a padel club and tournament management platform built for the Georgian padel community. It takes a tournament from event setup through registration, opponent negotiation, bracket play, court scheduling, live scoring, and published results — with clubs, not individuals, as the unit of competition.

```text
event setup → registration → opponent requests → bracket → schedule → judging → results
```

## Audiences

| Audience | What they do |
| --- | --- |
| Public visitors | Search and browse clubs, players, events, published rosters, brackets, schedules, live scores, and final results |
| Players | Create or join a club, enter events as a two-person club team, negotiate first-round opponents, follow their matches, leave their club |
| Club leaders | Edit the club profile, manage the roster, approve join requests, edit or withdraw the club's registered team, hand leadership on |
| Organisers | Run one event at a time, on the events an admin hands them: bracket, schedule, match control, opponent requests, lifecycle, and live scoring |
| Administrators | Approve who joins the platform, configure events, review entries, hand events to organisers, resolve exceptions, publish each surface |

## The club-centric model

Clubs are the organizing principle of participation:

- Every player belongs to exactly one club. A new player must create a club (becoming its **leader**) or request to join one before entering events.
- A club fields **one team per event**: an owner/teammate pair from the same club. A second pair from the same club cannot enter.
- The leader has real responsibilities: editing the club profile (renaming it moves its public page), approving join requests, replacing a registered player with another eligible member (which sends the entry back to admin review), withdrawing the club's team, and resolving affected registrations before removing a member. Removal is blocked mid-tournament, because both ways of resolving an entry — replace or withdraw — are refused once the event is ongoing or the draw is locked.
- **Leaving is a member's own decision**, on the same terms as being removed: resolve the affected entries, and the membership goes. A leader cannot simply leave — they hand leadership to another member first, in a single swap that makes the outgoing leader an ordinary member. A club that ends up with no leader at all can only be rescued by an administrator appointing one.
- Admins and organisers are staff, not athletes — they never belong to clubs, cannot be teammates, and hold no player statistics. (A legacy `JUDGE` role still exists in the database and API but has no screens.)
- Deleting a club is refused while one of its teams is entered in an unfinished event. Once it goes, past entries survive with no club attached, and every member is told they now have none.

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
2. **Registration** — club teams enter per category; admins review each entry (`PENDING → APPROVED / DECLINED / NEEDS_CHANGES / WAITLISTED …`) with public reasons players can act on, one at a time or in bulk. A club can also pull its own team out while its leader can still act on the entry, and never once the draw is locked or the event has started — the way out from there is a walkover an admin records. `WITHDRAWN` is the team's word for leaving and `CANCELLED` the organiser's; both are final. The approved roster can be published separately.
3. **Opponent requests** — after registration closes, admins open a per-category window in which an approved team may request one preferred first-round opponent. The target accepts or refuses; the admin has the final word (approve, reject, or explicitly override a refusal). Pairings only ever affect the first round.
4. **Bracket** — one single-elimination bracket per category, sized 2, 4, 8, 16, or 32 to fit the 2–32 approved entries, with byes filling the gap. Approved pairings are placed first. Locking the bracket freezes the draw and snapshots every participant's name and club for permanent history; only a locked bracket can be published.
5. **Schedule** — admins create physical courts and queue matches per court. The schedule publishes independently of the bracket.
6. **Live play** — admins and organisers run the event from **Match control**, which is organised the way the day is: by court. One lane per court shows what is on it, what it starts next, and the queue behind that; the same matches can also be read as a run order or as the draw. Each court queue is played strictly in order, one active match per court, but several courts can run at once. A match is decided in sets: the administrator sets how many set wins it takes (1, 2, or 3) per round or per match, and the operator picks the finished tally from the list of results that format allows — "one two", not an account of who took which set. Recording it completes the match and advances the winner automatically; an administrator can reopen a completed match with a reason. Walkovers and retirements require a winner and a reason. Public live scoring is a separate opt-in switch. Events played before the set format keep their historical 0–6 scores.
7. **Results** — completed finals complete the bracket; once every match is finished the event completes and final results can be published. The standings are the draw read backwards rather than a stored record: the final's winner and loser, then the two teams the semifinals eliminated, who share third because it is not played. Completed events are read-only unless an authorized admin explicitly reopens them to make corrections.

Each public surface — event page, roster, bracket, schedule, live scoring, results — has its own independent publication switch, so admins can prepare later stages privately.

## Trust and safety mechanics

- **Capability-based administration**: every admin action checks a fine-grained capability (e.g. `BRACKET_PUBLISH`, `MATCH_RESULT_CORRECT`); per-user grants can allow or deny individual capabilities beyond the role default.
- **Idempotent, versioned commands**: tournament writes carry a client `commandId` and `expectedVersion`, so retries never double-apply and concurrent operators cannot silently overwrite each other.
- **Audit everywhere**: privileged changes record actor, before/after state, and a public reason where players deserve one; registrations and events keep dedicated status histories.
- **Transactional outbox**: notifications, emails (via Resend), and realtime invalidations commit in the same database transaction as the domain change and are delivered by a background worker with retries.
- **Historical accuracy**: locked brackets snapshot player and club identity per match, so past results survive roster changes, renames, and club moves. The snapshot's club may legitimately be empty — a club can be deleted while its teams are still playing, and recording "no club" is more honest than blocking the draw.
- **Disqualification**: admins can disqualify a player until a date with a reason; disqualified players cannot register, be added as teammates, or hold eligible entries.
- **Account control**: players can see the devices they are signed in on and end any of them, change their email address through a code sent to the new one, reset a forgotten password, and delete the account outright. A deletion leaves one audit row carrying a hashed email and nothing else.
- **Desk copies**: the reads an organiser has to take off the screen — the entry list, the court sheet, final results, the audit log — also answer CSV, encoded so Georgian names open correctly in Excel and no cell can be read as a spreadsheet formula.
- **Legal compliance**: bilingual (English/Georgian) legal documents with versioned consent for account terms, privacy, participation terms, refund policy, and risk acknowledgement.

## Product surfaces

- **Public site** (`/`, `/clubs`, `/players`, `/events`, `/matches`): marketing landing page plus SEO-optimized public tournament data (sitemap, robots, structured data), and one search across players, clubs, and published events that returns only what those three directories already publish.
- **Player dashboard** (`/dashboard/*`): club, entries, events with opponent-request flows and their draw, match history, profile, notifications, settings.
- **Admin console** (`/admin/*`): the events board and per-event workspace with its tools (registrations, opponent requests, bracket, schedule, match control), users, clubs, categories, club applications, settings, operations (audit, outbox, email deliveries), and platform statistics.

## Where to go deeper

- [Architecture](ARCHITECTURE.md) — components, consistency patterns, authorization, publication model.
- [API reference](API.md) — the full endpoint surface with capability requirements.
- [Tournament operations](TOURNAMENT_OPERATIONS.md) — the stage-by-stage operator runbook.
