# Tournament Operations

This runbook describes the intended tournament sequence and the checks administrators should perform at each stage.

## Roles

- Administrator: approves club requests, configures and publishes the competition, approves entries, hands events to organisers, and resolves exceptional results.
- Organiser: runs an event an administrator handed them — bracket, schedule, courts, opponent requests, lifecycle, and scoring. They cannot create or edit events, review registrations, correct a finished result, reopen a completed event, or manage accounts and clubs.
- Club leader: creates the club, manages its roster, and can edit the club's registered team.
- Player: enters as a two-person club team, negotiates a preferred first-round opponent, and views published information.
- Judge: a server-side role only. It still exists and its API still works, but it has no screens: administrators and organisers run matches from **Match control**.

## 0. Prerequisites: clubs and players

New clubs arrive as requests. An applicant confirms their email, names their club and optional group mate, and waits; nothing exists in the system until an administrator approves it under **Club requests**. Approving creates the account, the club, and the group mate's invitation together. Rejecting deletes the request and frees the email address to apply again, so a rejection is recoverable — ask the applicant to reapply rather than trying to restore anything.

Players cannot register for events without a club. An existing player without one requests to join an established club; the club leader approves join requests. Each club can field exactly one team per event, so multiple pairs from one club cannot enter the same tournament.

## 1. Prepare the event

Create the required categories and confirm participating clubs and users exist. Create the event with its title, date, location, description, optional arrival time, categories, participation fee (GEL), and the bank transfer details (Georgian IBAN and receiver name) shown to players.

Before publication, confirm:

- date, arrival time, and timezone are correct;
- every intended category is attached;
- the fee and bank details are correct — players pay by bank transfer outside the platform;
- the public description contains participant-facing rules.

Publish the event page when registration should become discoverable.

## 2. Review registrations

A player enters their club's team as an owner/teammate pair, accepting the participation terms, refund policy, and risk acknowledgement. Both players must already have accepted their club invitation — an entry cannot be created around someone who has not. A captain whose teammate is still pending sees them greyed out in the picker; chase the invitation, then register. Administrators review each entry and move it to the appropriate status:

- `PENDING`: awaiting review;
- `APPROVED`: eligible for opponent requests and the bracket;
- `NEEDS_CHANGES`: player action required (public reason mandatory);
- `WAITLISTED`: valid but outside current capacity (public reason mandatory);
- `DECLINED`: rejected with a mandatory public reason;
- `WITHDRAWN` or `CANCELLED`: no longer participating.

Use a clear public reason whenever the player must understand or act on the decision. Internal review notes must not contain secrets or unnecessary sensitive information.

A club leader can replace one player in the team while the entry is still editable (not after the bracket locks or the event starts); the entry then returns to `PENDING` for re-review.

When the approved list is ready, publish the registered teams from the event Registrations page. The public roster contains only player names, club, and category; contact and review details remain private. This publication control is independent from the event page, bracket, schedule, live scoring, and results.

Each bracket category needs 2–16 approved entries. The bracket size adapts to the entry count (2, 4, 8, or 16 slots), so byes only appear when the count is between the two nearest sizes.

### Handing the event to an organiser

Once the entries are approved, an administrator can hand the event to an organiser with **Send to organiser** — available on the event workspace and at the top of the event's registrations screen. The organiser is emailed and, from then on, runs this event's bracket, schedule, courts, opponent requests and lifecycle, and can start and score its matches. Everything else stays with administrators, including registration decisions, result corrections, reopening the event, and accounts and clubs. Revoke the assignment from the same panel to take the event back.

Administrators and organisers are not tied to one court, so they can run several matches at once. The physical rules still hold for everyone: a court's queue is played in order, and only one match runs on a court at a time.

## 3. Close registration and open opponent requests

Close event registration, then open the opponent-request window separately for each category (optionally with a deadline; expired requests are closed automatically).

During the window:

- an approved entry may request one other eligible approved entry in its category;
- the target can accept or refuse (with an optional reason);
- the requester may edit, retarget, or withdraw while the request is still pending or accepted;
- acceptance does not finalize the pairing — administrator approval is always required;
- the administrator approves an accepted request, rejects it, or explicitly overrides a refusal (public reason required for reject/override);
- accepting one request automatically marks conflicting requests for the same entry as conflicted;
- an approval is refused when either entry is already committed to another approved pairing — the message names the pairing that holds it;
- an approved pairing can be released (**Release pairing**, public reason required) until it is applied to the bracket, which frees both entries for a different pairing.

Requests affect only the first round. Close every request window before generating the final draft.

## 4. Generate and lock brackets

Create one bracket per category and generate its draft, passing the approved pairing requests to honor. The generator places approved pairings first, distributes the remaining entries across the first-round slots, and leaves unmatched slots as byes.

Review:

- every approved entry appears exactly once;
- approved opponent requests are represented in the first round;
- bye placement is acceptable;
- later-round progression links are complete.

Rearrange a draft draw by dragging an entry onto another first-round set, or with the move button on each pair. Dropping on an occupied set swaps the two entries. If a move separates a pairing that came from an approved opponent request, the request returns to the approved list and the page says so — regenerate or place the pair yourself before locking.

Regenerating a draft rebuilds the match graph; nothing is final until the bracket is locked. Locking freezes the draw, snapshots participant identity for history, and automatically advances bye winners, after which placement can no longer change. Publish only after the review is complete — a draft bracket cannot be published.

### Set format

Each match is decided over 1, 2, or 3 set wins. Set the default per round in the bracket header, and override an individual match from its card when the draw calls for a longer or shorter contest. The effective value is the match override, else the round default, else one.

Set settings are editable until the match starts. Starting the match snapshots the format onto it, so later changes to a round default never affect a match already under way, and the server rejects an override on a started match.

## 5. Build and publish the schedule

There is no judge pool to manage. The endpoints still exist for API clients, but nothing in the product assigns a judge, and no court needs one before its matches can be played.

Create the physical courts, then add matches to their queues with optional planned start/end times. A match whose participants are not both known yet stays `TENTATIVE` and becomes `READY` automatically when both sides resolve. Planned times can also be edited later, one match at a time, on **Match control**.

Reorder a queue by dragging a match within its court, or drag it onto another court to move it there. Keyboard and touch users get the same result from the move up/down buttons and the "Move to court" picker on each row. Three rules constrain every move, on the server as well as in the UI:

- started and finished matches keep their queue position and cannot be dragged;
- nothing can be placed above the match currently in progress on a court;
- a court whose matches are all completed or cancelled is finished and can no longer be changed.

A reorder submits the court's complete order with each item's version, so a queue that changed underneath you is rejected with a conflict rather than silently reshuffled. Refresh and repeat the move.

Operational checks:

- every ready first-round match has a court;
- court queue order matches the intended sequence;
- later-round matches remain tentative until both participants advance;
- no court has two active matches;
- no judge has two active matches.

Publish the schedule independently from the bracket.

## 6. Start the event and score matches

Move the event to ongoing only when at least one bracket is locked and operational scheduling is ready. Optionally enable public live scoring (available only while the event is ongoing).

This is what **Match control** (`/admin/events/:eventId/control`) is for. It is the one screen the event is run from, and it answers the only question that matters on the day: what is happening on which court, between whom, and where does the winner go. Each match card carries its court, its planned time, both pairs with their clubs, the set tally, and the controls — the same card in the "on now and up next" list and in the draw below it, so there is one card to learn rather than two screens to reconcile.

Bracket and Courts & schedule remain the setup tools: seeding, generating and locking draws, creating courts, and building queues. Match control changes only what moves on the day.

Whoever runs the event processes each court queue strictly from top to bottom:

1. Confirm the displayed players, clubs and match number against the four people on court.
2. Start the match (earlier queue positions must be finished first, and the match must be on a court). Starting the match freezes its set format.
3. When the match finishes, write the result: the sets each side won, in the two number fields marked A and B — the same letters that mark the two pairs on the card. "Record result" stays off until the two numbers form a finished tally, and the dialog names the winning pair before the result is written.
4. Recording the result completes the match and moves the winner into the next round.
5. For a walkover or a retirement, use "Finish early", choose the side that advances, and give a reason.

Several matches can run at once, one per court: administrators and organisers are not bound to a single match the way a judge is.

Planned start times are editable in place on each card, until the match starts — a started or finished match keeps the time it was played at.

There is no undo on this screen. To correct a result recorded the wrong way round, reopen the match from the bracket page (see §7); that requires `MATCH_RESULT_CORRECT`, which organisers do not hold.

Scoring counts sets, not points. A match races to its configured set count: first to 1 (a single set), first to 2 (up to three sets, so 1–1 goes to a decider), or first to 3 (up to five sets). The match score is the set tally — 2–1, not 6–4. The console asks for that tally as a whole rather than set by set, because that is how a result reaches the desk: "one two", not an account of who took which set. The server derives the `MatchSet` rows the tally is made of, giving the decider to the winner, so the rows and `scoreA`/`scoreB` still agree.

A judge scoring courtside through the API still records sets one at a time. A result may only add to sets already recorded that way, never take one back; taking one back is an undo.

Every command is versioned and idempotent, and each one is stored as a `SetEvent`. The confirmation dialog keeps one command id from the moment it opens, so retrying after a dropped connection replays the same command instead of recording a second result. If the screen reports a conflict, refresh before continuing rather than repeating with a new assumption.

Completion automatically:

- stores the result and participant history snapshots;
- updates player win/loss statistics;
- advances the winner to the linked next match;
- makes the next match (and its schedule item) ready when both sides are known;
- completes the bracket when the final finishes;
- queues notifications and realtime invalidations.

## 7. Correct exceptional results

Administrators can correct a completed match with a mandatory reason. A correction may change winner, loser, and scores; it reverses player statistics and updates an unresolved downstream set.

The correction command is intentionally blocked when the dependent match has already started. At that point, stop play and use a controlled bracket-repair procedure rather than rewriting history through the standard UI.

For set matches, a correction must land on a finished tally (for example 2–1, or 3–2 in a first-to-3 match). The recorded per-set winners are left untouched and stop being displayed once the result becomes an administrator decision, because they no longer add up to the official score. The original sequence stays in the audit trail.

### Reopening a completed set match

When the wrong side was recorded, reopen the match instead of correcting it: on the bracket card, choose "Reopen match" and give a reason. This withdraws the last set, retracts the winner from the next round, reverses the players' win/loss records, returns the match to in progress, and notifies the four players. The correct result can then be recorded. Reopening withdraws one set at a time, and a new result may not be lower than the sets that remain, so flipping a result the other way takes as many reopens as it takes to clear them.

Reopening is refused when:

- the downstream match has already started — use bracket repair instead;
- another match is already in progress on the same court, or the assigned judge is busy elsewhere, because the reopened match becomes active again;
- the result was a walkover, withdrawal, or disqualification — those go through a correction;
- the event is completed — reopen the event first.

## 8. Complete and publish results

After every final is completed:

- confirm category champions and final scores;
- inspect audit history for exceptional decisions;
- review failed email deliveries and retry transient failures;
- complete the event lifecycle (every match must be completed or cancelled);
- publish final results (available only after completion).

Results publication is independent of live scoring. Disabling public live scoring does not unpublish completed history.

## 9. Reopening a completed event

A completed event is read-only: registrations, brackets, schedules, opponent requests, and match corrections are all blocked. An administrator holding the `EVENT_STATE_CORRECT` capability can explicitly move the event back to ongoing to make corrections, then complete it again. Every reopen is recorded in the status history and audit log — provide a reason.

## Incident checklist

### Score conflict

Refresh the match, verify the set history, and apply only the missing action. Do not repeatedly submit a stale version.

### A match will not start

Confirm the event is `ONGOING`, the match is `READY` with both participants known, it sits on a court, it is next in that court's queue with no earlier unfinished item, and no other match is already running on that court. An organiser must also still hold the event.

### Club leader cannot remove a member

Member removal requires resolving every unfinished registration involving that member (replace or withdraw) and is blocked while an event is ongoing or a bracket is locked. Use the removal-impact view to see what is blocking.

### Notification or email missing

First verify the domain action succeeded. Then inspect admin email deliveries and the worker logs. Retry failed email deliveries from the operations API/UI; do not repeat the tournament command.

### Public data appears stale

Confirm the specific publication control is enabled, then inspect the outbox worker. Realtime events are invalidation messages; a client refresh should always read the authoritative database state.

### Migration failure during deployment

Stop the rollout, preserve the database, inspect the failed Prisma migration and PostgreSQL logs, and follow `DEPLOY.md`. Do not mark a failed migration as applied without confirming its SQL effects.
