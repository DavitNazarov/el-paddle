# Tournament Operations

This runbook describes the intended tournament sequence and the checks administrators should perform at each stage.

## Roles

- Administrator: configures and publishes the competition, approves entries and pairings, schedules matches, and resolves exceptional results.
- Club leader: creates the club, manages its roster, and can edit the club's registered team.
- Player: enters as a two-person club team, negotiates a preferred first-round opponent, and views published information.
- Judge: works only assigned courts within assigned time windows and records match outcomes.

## 0. Prerequisites: clubs and players

Players cannot register for events without a club. A new player either creates a club (becoming its leader) or requests to join an existing one; the club leader approves join requests. Each club can field exactly one team per event, so multiple pairs from one club cannot enter the same tournament.

## 1. Prepare the event

Create the required categories and confirm participating clubs and users exist. Create the event with its title, date, location, description, optional arrival time, categories, participation fee (GEL), and the bank transfer details (Georgian IBAN and receiver name) shown to players.

Before publication, confirm:

- date, arrival time, and timezone are correct;
- every intended category is attached;
- the fee and bank details are correct — players pay by bank transfer outside the platform;
- the public description contains participant-facing rules.

Publish the event page when registration should become discoverable.

## 2. Review registrations

A player enters their club's team as an owner/teammate pair, accepting the participation terms, refund policy, and risk acknowledgement. Teammates without an account receive an email invitation; the entry can proceed while the invitation is pending. Administrators review each entry and move it to the appropriate status:

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

## 3. Close registration and open opponent requests

Close event registration, then open the opponent-request window separately for each category (optionally with a deadline; expired requests are closed automatically).

During the window:

- an approved entry may request one other eligible approved entry in its category;
- the target can accept or refuse (with an optional reason);
- the requester may edit, retarget, or withdraw while the request is still pending or accepted;
- acceptance does not finalize the pairing — administrator approval is always required;
- the administrator approves an accepted request, rejects it, or explicitly overrides a refusal (public reason required for reject/override);
- accepting one request automatically marks conflicting requests for the same entry as conflicted.

Requests affect only the first round. Close every request window before generating the final draft.

## 4. Generate and lock brackets

Create one bracket per category and generate its draft, passing the approved pairing requests to honor. The generator places approved pairings first, distributes the remaining entries across the first-round slots, and leaves unmatched slots as byes.

Review:

- every approved entry appears exactly once;
- approved opponent requests are represented in the first round;
- bye placement is acceptable;
- later-round progression links are complete.

Regenerating a draft rebuilds the match graph; nothing is final until the bracket is locked. Locking freezes the draw, snapshots participant identity for history, and automatically advances bye winners. Publish only after the review is complete — a draft bracket cannot be published.

## 5. Build and publish the schedule

Create the physical courts, then assign a judge to each court for a defined time interval (overlapping judge intervals are rejected). Add matches to court queues and set optional planned start/end times. A match whose participants are not both known yet stays `TENTATIVE` and becomes `READY` automatically when both sides resolve.

Operational checks:

- every ready first-round match has a court;
- court queue order matches the intended sequence;
- later-round matches remain tentative until both participants advance;
- no court has two active matches;
- no judge has two active matches.

Publish the schedule independently from the bracket.

## 6. Start the event and score matches

Move the event to ongoing only when at least one bracket is locked and operational scheduling is ready. Optionally enable public live scoring (available only while the event is ongoing).

Judges process the court queue strictly from top to bottom:

1. Open the assigned court.
2. Confirm the displayed players and match number.
3. Start the first ready match (earlier queue positions must be finished first).
4. Increment or decrement Side A or Side B as points are recorded.
5. A side reaching six completes a normal match automatically.
6. For a walkover, withdrawal, or disqualification, select the winner and provide a reason.

Every score command is versioned and idempotent, and each change is stored as a `ScoreEvent`. If the screen reports a conflict, refresh before continuing rather than repeating with a new assumption.

Completion automatically:

- stores the result and participant history snapshots;
- updates player win/loss statistics;
- advances the winner to the linked next match;
- makes the next match (and its schedule item) ready when both sides are known;
- completes the bracket when the final finishes;
- queues notifications and realtime invalidations.

## 7. Correct exceptional results

Administrators can correct a completed match with a mandatory reason. A correction may change winner, loser, and scores; it reverses player statistics and updates an unresolved downstream slot.

The correction command is intentionally blocked when the dependent match has already started. At that point, stop play and use a controlled bracket-repair procedure rather than rewriting history through the standard UI.

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

Refresh the judge match, verify the score history, and apply only the missing action. Do not repeatedly submit a stale version.

### Judge cannot open a match

Confirm the user has role `JUDGE` and is active, the assignment covers the current time and is not revoked, the court and event match, and the requested match is next in the queue with no earlier unfinished item.

### Club leader cannot remove a member

Member removal requires resolving every unfinished registration involving that member (replace or withdraw) and is blocked while an event is ongoing or a bracket is locked. Use the removal-impact view to see what is blocking.

### Notification or email missing

First verify the domain action succeeded. Then inspect admin email deliveries and the worker logs. Retry failed email deliveries from the operations API/UI; do not repeat the tournament command.

### Public data appears stale

Confirm the specific publication control is enabled, then inspect the outbox worker. Realtime events are invalidation messages; a client refresh should always read the authoritative database state.

### Migration failure during deployment

Stop the rollout, preserve the database, inspect the failed Prisma migration and PostgreSQL logs, and follow `DEPLOY.md`. Do not mark a failed migration as applied without confirming its SQL effects.
