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

### When a club has no leader

Leadership is always a swap: handing it on makes the outgoing leader an ordinary member in the same write, because a club with two leaders and a club with none are both broken. A leader cannot leave the club without handing it on first; an ordinary member can leave on their own, resolving the same entries a removal would.

A club can still end up **leaderless** — a membership row written without naming a role takes the database default of member. Those clubs are stuck: nobody can edit the profile, review a join request, or change a registered team. **Clubs → Leaderless** lists them, and an administrator with `CLUB_MANAGE` appoints one. This is the only route back; the member-facing transfer cannot rescue such a club, because it needs an existing leader to do the handing over.

Deleting a club is refused while one of its teams is entered in an unfinished event. Once it goes, past entries survive with their club field emptied, every member is notified that they now have no club, and the `club.deleted` audit row — written before the delete — is the only surviving record.

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

A club can also **pull its own team out**, on the same terms: while the leader can still act on the entry (`PENDING`, `APPROVED`, `NEEDS_CHANGES`, `WAITLISTED`), and never once the draw is locked or the event has started. From there the only way out is a walkover an administrator records. The entry lands on `WITHDRAWN`, which is the team's own word for leaving; `CANCELLED` is the organiser's. Both are terminal — neither can be moved back, so re-entering means a new registration while registration is still open.

When the approved list is ready, publish the entry list from the event's Entries screen. The public roster contains only player names, club, and category; contact and review details remain private. This publication control is independent from the event page, bracket, schedule, live scoring, and results.

Entries are reviewed as a queue: the filters above it carry the count in each state, and each row is the pair, their club and their category, with the contact details beneath for the decisions that need a phone call. Approving or declining reports back by name — "Approved Ana Beridze / Nino Chkheidze" — so an outcome is checkable without re-reading the row.

Each bracket category needs 2–32 approved entries. The bracket size adapts to the entry count (2, 4, 8, 16, or 32 slots), so byes only appear when the count is between the two nearest sizes. A 32-slot draw opens with a round of 32 and runs 31 matches over five rounds; plan court time accordingly.

### Handing the event to an organiser

Once the entries are approved, an administrator can hand the event to an organiser with **Send to organiser**, on the event workspace. The organiser is emailed and, from then on, runs this event's bracket, schedule, courts, opponent requests and lifecycle, and can start and score its matches. Everything else stays with administrators, including registration decisions, result corrections, reopening the event, and accounts and clubs. Revoke the assignment from the same panel to take the event back.

Administrators and organisers are not tied to one court, so they can run several matches at once. The physical rules still hold for everyone: a court's queue is played in order, and only one match runs on a court at a time.

### The event workspace

Every event opens on its workspace, which answers three questions in order: which event this is and how far along it is, what is waiting on the operator, and which screen resolves it.

**What needs you** is the part to read first. It ranks the event's open queues by what they are costing and states the most expensive one outright — a court standing free with matches queued on it outranks every review queue, because it is the only one losing time while it is being read. Anything else waiting is listed beneath it as links. When nothing is waiting the band says so, and says what the current stage is now waiting for instead.

Below it, the five stages each carry their live count rather than a description, and **What the public can see** lists the five surfaces with their state. Live scores and final results are switched there; the entry list, the draws and the schedule are published from the screen that produces them, and the row links to it rather than growing a second switch for the same command.

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

A team with no opponent is marked **BYE** on the draw and the next round already shows its name: the draft reads exactly the way the locked draw will, in every round, so nothing about the walk-through is a surprise after locking. If a rearrangement leaves a match no team can reach, the draw says so on that card — move an entry back into it before locking, or accept that the team above it walks through twice.

Rearrange a draft draw by dragging an entry onto another first-round set, or with the move button on each pair. Dropping on an occupied set swaps the two entries. If a move separates a pairing that came from an approved opponent request, the request returns to the approved list and the page says so — regenerate or place the pair yourself before locking.

An event with more than one category shows one draw at a time; the tabs above the draw carry each category's progress, so which draw needs opening is readable without opening it.

Regenerating a draft rebuilds the match graph; nothing is final until the bracket is locked. Locking freezes the draw, snapshots participant identity for history, and advances every bye, after which placement can no longer change. A bye that only becomes possible later — where a team wins into a round whose other side is empty — is applied as soon as that match is recorded. Publish only after the review is complete — a draft bracket cannot be published.

### Set format

Each match is decided over 1, 2, or 3 set wins. Set the default per round in the bracket header, and override an individual match from its card when the draw calls for a longer or shorter contest. The effective value is the match override, else the round default, else one.

Set settings are editable until the match starts. Starting the match snapshots the format onto it, so later changes to a round default never affect a match already under way, and the server rejects an override on a started match.

## 5. Build and publish the schedule

Courts & schedule is a board: one column per court, with the matches that have nowhere to be played as the first column. Drag a match from **Waiting** onto a court, or between courts to even out two queues that have drifted apart — the queues sit side by side so that comparison can actually be made. Started and finished matches are pinned by the server: they keep their place, show a lock instead of a handle, and the reorder arrows beside a movable match stop at them rather than offering a move that would be refused. Dropping a queued match back into Waiting takes it off the schedule.

Every move can also be made without dragging: each card carries reorder arrows, a "move to court" picker, and a remove button, so the board works by keyboard and on a phone.

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

This is what **Match control** (`/admin/events/:eventId/control`) is for. It is the one screen the event is run from, and it is organised the way the day is: by court.

**Three layouts over the same matches**, chosen from the bar at the top:

| Layout | Answers |
| --- | --- |
| **Courts** (default) | "Court 3 just finished — what goes on next?" One lane per court: what is on it, what it starts next, the queue behind that, and what it has already played. A lane with nothing on it says so, because a free court is the thing that needs you. Matches with no court at all gather in a lane of their own. |
| **Run order** | "What happens next, anywhere?" Every match in the order it is due to be played, grouped by planned time, across all courts and categories. |
| **Draw** | "Who plays the winner of match 12?" Each category's rounds left to right. |

**Filter and search sit above all three.** Court, category, round and state are four dropdowns; the search box takes a player name, a club, or a match number. What you have chosen shows as removable chips, and the filter survives a change of layout — so "the women's quarter-finals on Court 2" stays asked while you look at it three ways.

The console opens with the one thing the day needs next: the court standing free, the match it is waiting on, and **Start** where the server would allow it. A court free while matches queue on it is the only state here that costs time as it is read, so it gets the headline; matches that are ready with no court at all are named there too, with a link to the schedule. Everything else — playing, ready, behind, played — is a filter in the bar below rather than a number to interpret.

**Every match reads the same everywhere and is acted on in one place.** A row is read-only: state, court and time, both pairs with their set tallies, and a flag if it is running late. Selecting it opens the match sheet, which is where every command lives — start, record the result, finish early, set the planned time. The only exception is **Start** on the up-next row of a lane, because a court waiting to be told to go should not need a second tap.

**A single court has its own screen** at `/admin/events/:eventId/control/courts/:courtId`, reachable from each lane's "Open court" link — the same lane given the full width, for a tablet parked at the desk or carried to the court, with the neighbouring courts one tap away.

Bracket and Courts & schedule remain the setup tools: seeding, generating and locking draws, creating courts, and building queues. Match control changes only what moves on the day.

**Time and order stay the schedule's.** Match control reflects them, so a planned start changed on Courts & schedule reorders this screen at once, and a time changed in the match sheet is the same change the schedule board makes. A match that has started or finished is pinned: it shows a lock instead of the up/down nudges, and its time is read-only. A match still waiting more than five minutes past its planned start is flagged as late, on its row, on its court's lane, and in the "behind schedule" count — which is also a filter, so the day's problem list is one press away.

Whoever runs the event processes each court queue strictly from top to bottom:

1. Confirm the displayed players, clubs and match number against the four people on court.
2. Start the match from the court's "up next" row, or from the match sheet (earlier queue positions must be finished first, and the match must be on a court). Starting the match freezes its set format.
3. When the match finishes, open it and pick the result. The sheet lists every finish this match can end on — two options for a race to one set, six for a race to three — each showing the set tally and the pair it gives the match to. There is nothing to type and nothing that does not finish the match, and the dialog names the winning pair before the result is written.
4. Recording the result completes the match and moves the winner into the next round.
5. For a walkover or a retirement, use "Finish early", choose the side that advances, and give a reason.

Several matches can run at once, one per court: administrators and organisers are not bound to a single match the way a judge is.

To reorder a court on the day, use the up/down controls on its queued rows; they send the same command the schedule board does, and they stop at the last started or finished match, which cannot be moved.

There is no undo on this screen. To correct a result recorded the wrong way round, reopen the match from the bracket page (see §7); that requires `MATCH_RESULT_CORRECT`, which organisers do not hold.

Scoring counts sets, not points. A match races to its configured set count: first to 1 (a single set), first to 2 (up to three sets, so 1–1 goes to a decider), or first to 3 (up to five sets). The match score is the set tally — 2–1, not 6–4. The console asks for that tally as a whole rather than set by set, because that is how a result reaches the desk: "one two", not an account of who took which set. The server derives the `MatchSet` rows the tally is made of, giving the decider to the winner, so the rows and `scoreA`/`scoreB` still agree.

A judge scoring courtside through the API still records sets one at a time. A result may only add to sets already recorded that way, never take one back; taking one back is an undo. Where a set is already on the match, the results that would drop below it are shown as unavailable rather than removed, so the reason the obvious option is off is visible.

Anything the server refuses appears as a message over the screen rather than as a banner behind the open sheet, and it carries the server's own words — "Court is busy", "A downstream match has already started" — because that sentence is what says which action to take instead.

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

The standings are **derived, not recorded**: the final's winner and loser, then the two teams the semifinals eliminated. Third place is not played, so both losing semifinalists hold it jointly. Names and clubs come from the participant snapshot taken when the draw locked, so a published result survives a rename, a club change, or a deleted club. Read the podium before publishing it at `GET /api/admin/events/:eventId/results`, which organisers may also read.

Results publication is independent of live scoring. Disabling public live scoring does not unpublish completed history.

### Taking a desk copy

Four reads also answer CSV, through `?format=csv` or `Accept: text/csv`: the entry list, the court sheet (in playing order), the final results, and the audit log. The file is UTF-8 with a byte-order mark so Georgian names open correctly in Excel, and any cell starting `=`, `+`, `-` or `@` is prefixed with an apostrophe so a spreadsheet reads it as text rather than a formula.

## 9. Reopening a completed event

A completed event is read-only: registrations, brackets, schedules, opponent requests, and match corrections are all blocked. An administrator holding the `EVENT_STATE_CORRECT` capability can explicitly move the event back to ongoing to make corrections, then complete it again. Every reopen is recorded in the status history and audit log — provide a reason.

## Incident checklist

### Score conflict

Refresh the match, verify the set history, and apply only the missing action. Do not repeatedly submit a stale version.

### A match will not start

Confirm the event is `ONGOING`, the match is `READY` with both participants known, it sits on a court, it is next in that court's queue with no earlier unfinished item, and no other match is already running on that court. An organiser must also still hold the event.

### Club leader cannot remove a member

Member removal requires resolving every unfinished registration involving that member, by replacing the player or withdrawing the team. Both resolutions are refused once the event is ongoing or that category's draw is locked, so removal is effectively blocked mid-tournament. Use the removal-impact view to see which entries are holding it. A member leaving on their own hits exactly the same wall, and a leader must hand leadership on before either.

### A draw was locked too early

An administrator holding `EVENT_STATE_CORRECT` can unlock it with a reason — the mirror of reopening a completed event. Unlocking returns every team to its first-round slot, clears the byes the lock derived, and deletes the participant snapshots. It is refused once any match has been played, or while the draw is published or sitting on the court schedule; take the publication down first, and clear the schedule, then unlock. A draw that was never locked is *discarded* instead, which releases the approved pairings it had applied back into the queue.

### Notification or email missing

First verify the domain action succeeded. Then inspect admin email deliveries and the worker logs. Retry failed email deliveries from the operations API/UI; do not repeat the tournament command.

### Public data appears stale

Confirm the specific publication control is enabled, then inspect the outbox worker. Realtime events are invalidation messages; a client refresh should always read the authoritative database state.

### Migration failure during deployment

Stop the rollout, preserve the database, inspect the failed Prisma migration and PostgreSQL logs, and follow `DEPLOY.md`. Do not mark a failed migration as applied without confirming its SQL effects.
