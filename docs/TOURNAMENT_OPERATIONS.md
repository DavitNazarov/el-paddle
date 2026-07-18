# Tournament Operations

This runbook describes the intended tournament sequence and the checks administrators should perform at each stage.

## Roles

- Administrator: configures and publishes the competition, approves entries and pairings, schedules matches, and resolves exceptional results.
- Player: enters as a two-person team, negotiates a preferred first-round opponent, and views published information.
- Judge: works only assigned courts and records match outcomes.

## 1. Prepare the event

Create required categories and confirm all participating clubs and users exist. Create the event with its date, location, description, categories, and registration window.

Before publication, confirm:

- dates and timezone are correct;
- every intended category is attached;
- registration opening and closing times are accurate;
- the public description contains participant-facing rules.

Publish the event page when registration should become discoverable.

## 2. Review registrations

Players enter as owner/teammate pairs. Administrators review each entry and move it to the appropriate status:

- `PENDING`: awaiting review;
- `APPROVED`: eligible for opponent requests and the bracket;
- `NEEDS_CHANGES`: player action required;
- `WAITLISTED`: valid but outside current capacity;
- `DECLINED`: rejected with a reason;
- `WITHDRAWN` or `CANCELLED`: no longer participating.

Use a clear public reason whenever the player must understand or act on the decision. Internal review notes must not contain secrets or unnecessary sensitive information.

When the approved list is ready, use the event Registrations page to publish the registered teams. The public roster contains only player names, club, and category; contact and review details remain private. This publication control is independent from the event page, bracket, schedule, live scoring, and results.

Do not advance until each bracket category has 9–16 approved entries.

## 3. Close registration and open opponent requests

Close event registration, then open the opponent-request window separately for each category.

During the window:

- an entry may request another eligible approved entry;
- the target can accept or refuse;
- the requester may edit or withdraw while allowed;
- acceptance does not finalize the pairing;
- the administrator approves, rejects, or explicitly overrides the request.

Requests affect only Round of 16. Close every request window before generating the final draft.

## 4. Generate and lock brackets

Create one bracket per category and generate its draft. The generator places approved opponent pairings first, fills the remaining Round-of-16 slots, and adds byes when fewer than 16 entries participate.

Review:

- every approved entry appears once;
- approved opponent requests are represented in Round of 16;
- no entry is duplicated;
- bye placement is acceptable;
- later-round progression links are complete.

Locking a bracket freezes the draw and creates participant snapshots. Publish only after the review is complete.

## 5. Build and publish the schedule

Create the physical courts, then assign a judge to each court for a defined time interval. Add matches to court queues and set optional planned start/end times.

Operational checks:

- a judge is not assigned to overlapping court intervals;
- every ready first-round match has a court;
- court queue order matches the intended sequence;
- later-round matches remain tentative until both participants advance;
- no court has two active matches;
- no judge has two active matches.

Publish the schedule independently from the bracket.

## 6. Start the event and score matches

Move the event to ongoing only when the bracket is locked and operational scheduling is ready.

Judges process the court queue from top to bottom:

1. Open the assigned court.
2. Confirm the displayed players and match number.
3. Start the first ready match.
4. Increment or decrement Side A or Side B as points/games are recorded by the configured scoring model.
5. A side reaching six completes a normal match automatically.
6. For walkover or withdrawal, select the winner and provide a reason.

Every score command is versioned and idempotent. If the screen reports a conflict, refresh before continuing rather than repeating with a new assumption.

Completion automatically:

- stores the result and participant history;
- updates player statistics;
- advances the winner to the linked match;
- makes the next match ready when both sides are known;
- queues notifications and realtime invalidations.

## 7. Correct exceptional results

Administrators can correct a completed match with a reason. A correction may change winner, loser, score, statistics, and an unresolved downstream slot.

The normal correction command is intentionally blocked when a dependent match has already started. At that point, stop play and use a controlled bracket-repair procedure rather than rewriting history through the standard UI.

## 8. Complete and publish results

After every final is completed:

- confirm category champions and final scores;
- inspect audit history for exceptional decisions;
- review failed email deliveries and retry transient failures;
- complete the event lifecycle;
- publish final results.

Results publication is independent of live scoring. Disabling public live scoring does not unpublish completed history.

## Incident checklist

### Score conflict

Refresh the judge match, verify the audit/score history, and apply only the missing action. Do not repeatedly submit a stale version.

### Judge cannot open a match

Confirm the user has role `JUDGE`, the assignment is active and not revoked, the court and event match, and the requested match is next in the queue.

### Notification or email missing

First verify the domain action succeeded. Then inspect admin email deliveries and the worker logs. Retry failed email deliveries from the operations API/UI; do not repeat the tournament command.

### Public data appears stale

Confirm the specific publication control is enabled, then inspect the outbox worker. Realtime events are invalidation messages; a client refresh should always read the authoritative database state.

### Migration failure during deployment

Stop the rollout, preserve the database, inspect the failed Prisma migration and PostgreSQL logs, and follow `DEPLOY.md`. Do not mark a failed migration as applied without confirming its SQL effects.
