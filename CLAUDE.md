# CLAUDE.md

This file gives coding agents the repository-specific context needed to work safely in El Padel.

## Project purpose

El Padel is a club and tournament management platform. The core tournament flow is:

```text
event setup → registration → opponent requests → bracket → schedule → judging → results
```

The system has four audiences in the UI: public visitors, players, organisers, and administrators. The `JUDGE` role still exists server-side and every `/api/judge/*` endpoint still works, but it has no frontend surface — admins and organisers run matches from the match control console.

## Workspace map

- `frontend/src/app/`: Next.js App Router pages
- `frontend/src/components/`: domain and shared UI components
- `frontend/src/components/tournament/TournamentUI.tsx`: shared tournament presentation primitives
- `frontend/src/components/shared/dashboard/`: shared role dashboard shell and styling
- `frontend/src/components/admin/control/`: match control console — the match-day screen, built court first, with filters over three layouts (courts, run order, draw) and one sheet holding every command
- `frontend/src/lib/api/`: browser API client; automatically obtains CSRF tokens
- `frontend/src/types/`: frontend DTO definitions
- `backend/src/modules/`: API routes and domain services, grouped by feature
- `backend/src/common/`: cross-cutting capabilities, commands, CSRF, audit, notification, and outbox helpers
- `backend/src/realtime/`: Socket.IO authorization and gateway
- `backend/src/workers/`: transactional outbox processor
- `backend/prisma/schema.prisma`: source of truth for database models and enums
- `backend/prisma/migrations/`: immutable production migrations

## Architecture rules

1. Keep HTTP parsing and response handling in `*.routes.ts`.
2. Keep domain rules and transactions in `*.service.ts`.
3. Do not combine unrelated tasks into one function. Extract small helpers with one reason to change.
4. Reuse shared UI components for repeated panels, headers, notices, status labels, commands, and responsive data lists.
5. Preserve the neutral tournament UI. Operational pages use charcoal surfaces and restrained ivory accents; color must never be the only status indicator.
6. Keep mobile controls at least 44px high and avoid page-level horizontal overflow.
7. Avoid duplicating Prisma DTO shapes in business logic. Use typed includes/selects and serializers.
8. All important state changes must be authorized on the server, not only hidden in the UI.

## Domain invariants

- New club signups are applications. Nothing exists in `User`, `Club`, or `ClubMember` until an admin approves; rejection deletes the `ClubApplication` outright, so the same email may apply again. Approval materialises the account, club (applicant as LEADER), and group-mate invite in one transaction, then deletes the application.
- A club edit covers name, slug, description, and logo; changing the slug moves the public club page. Two routes reach the same write: an admin with `CLUB_MANAGE` on any club, and a club's own leader on theirs. Leadership moves as one swap (the outgoing leader becomes a member), because a club with two leaders and a club with none are both broken. A leaderless club is reachable — a membership row written without naming `membershipRole` takes the schema default of MEMBER — so `CLUB_MANAGE` can list those clubs and appoint a leader; the member-facing transfer cannot rescue one, because it needs a leader to do the handing over. A member may leave on their own, resolving the same entries a removal would; a leader may not, and hands leadership on first. Deleting a club is refused while one of its teams is entered in an unfinished event. Otherwise memberships and join requests cascade, past entries keep their row with `clubId` nulled, every member is notified that they now have no club, and the `club.deleted` audit row written before the delete is the only surviving record.
- Organisers hold no global capability. Every power is checked against an `EventOrganiser` link via `requireEventCapability`, and their capability set is pinned by a test. They cannot create or edit events, review registrations, correct results, reopen events, or manage accounts, clubs, and club requests.
- A judge may only be assigned to an event in that event's `EventJudge` pool. An actor with global `JUDGE_MANAGE` gets the link created implicitly; an organiser is confined to the pool they built.
- Scoring authorization is per match: judges through their court assignment, admins always, organisers on events handed to them. Only a judge is bound to one match at a time; the court queue order and one-match-per-court rules bind everyone.
- Event lifecycle moves forward through explicit allowed transitions; the only backward transition is an explicit reopen of a completed event, which requires the `EVENT_STATE_CORRECT` capability.
- Registration, bracket, match, schedule, and request writes use optimistic `version` checks where supported.
- Retried commands must include a stable `commandId`; command receipts prevent duplicate application.
- Deleting an account writes an `AuditLog` row (`user.deleted`) inside the same transaction, before the delete. Cascades leave nothing else behind, so that row is the only surviving record and the source for deletion statistics. It carries a sha256 `emailHash` and never an email, name, or phone.
- A user whose registration appears in a recorded match cannot be deleted: registrations cascade from the user, but `Match` restricts its participants. The refusal surfaces as a 409 naming the cause, not a foreign-key 500.
- `User.lastLoginAt` is written best-effort at the five sign-in points only, never awaited, and never from a cookie re-issue such as a password change. It holds the latest sign-in, so it can answer "seen recently" and can never answer "seen last month".
- Players belong to exactly one club; each club fields at most one team (owner + teammate from the same club) per event. A team may withdraw itself while its club leader can still act on the entry — `PENDING`, `APPROVED`, `NEEDS_CHANGES`, `WAITLISTED` — and never once the draw is locked or the event has started, where the way out is a walkover an admin records. `WITHDRAWN` is the team's word for leaving and `CANCELLED` the organiser's; both are terminal.
- Both players must already be active accounts at registration time. Registration never creates a user, never issues an invite token, and never joins anyone to a club — it refuses a teammate who is unknown, still invited, or unverified, naming them in the message. Invitations belong to the club (and to admin account creation); registration only reads their result. The club invitation email states this, and the saved-teammate picker shows a pending mate as disabled rather than hiding them.
- Opponent requests apply only to the first bracket round and require final admin approval. An approved, overridden, or applied pairing claims both of its entries, so approval is refused while either entry belongs to another such pairing; releasing (rejecting) an approved pairing frees them again, and a pairing already applied to the bracket is undone on the bracket instead.
- A draft draw can be discarded, which releases the pairings it applied back to the approved queue. A locked draw can be unlocked by an admin holding `EVENT_STATE_CORRECT`, with a reason — the mirror of the completed-event reopen. Unlocking returns every team to its first-round slot, clears the derived byes and deletes the snapshots, and is refused once any match has been played or while the draw is published or on the schedule. Publication is never cleared as a side effect: it is taken down first, by the person who decided to.
- Brackets support 2–32 approved entries; the single-elimination graph sizes to 2, 4, 8, 16, or 32 slots and fills the gap with byes. Size is the only input to the shape: `roundPlan` derives which rounds exist, how many matches each holds, and their match numbers, so nothing else may hard-code a round list. `MatchRound` is declared in playing order (`ROUND_OF_32` first) and the three ordered arrays that mirror it — `bracketModel.rounds`, `PublicEventSections.roundOrder`, and the `common.rounds` labels — must stay in that order and stay complete.
- A bye is read off the draw's shape, never off one round: a slot no team can arrive at decides the match beside it, so the team standing there advances without playing, and advances again if the branch feeding the next round is empty too. `planByes` derives it and `applyByes` writes it — on lock, and again after every advancement, since a bye above a played match is only knowable once that match has a winner. A match no team can reach is cancelled. The admin draw projects the same reading onto a draft, so an unlocked draw already reads BYE where the locked one will.
- A locked bracket snapshots participant identity for historical accuracy. Identity travels with the team through every advancement, byes included, so `carryParticipantSnapshot` is the only way a participant reaches a later match. It falls back to the registration when the match it comes from holds no snapshot, and `applyByes` backfills every occupied side that is missing one, so a draw locked under older code repairs itself instead of failing mid-event. The snapshot's club is the club the team *entered* under and may be null: a club can be deleted while its teams are still playing, and recording "no club" is the honest answer rather than a reason to stop the draw.
- Judges can score only assigned matches and must process a court queue in order. Admins and organisers are unbound scorers: authorized on every match of their event and able to run several courts at once, still subject to the court queue order and one live match per court.
- Matches are decided in sets: `setCount` is the number of set wins to race to (1, 2, or 3), and at most `2 * setCount - 1` sets are ever played, so a decider always exists. A set records only which side won it; there is no game score.
- For `SETS` matches `Match.scoreA`/`scoreB` hold the set-win tally and must always equal the `MatchSet` rows. `MatchSet` is current state; `SetEvent` is the append-only history.
- The match control console scores by writing the whole result as a tally, not set by set: two numbers, one command, one completed match. The tally must be a finished result for the frozen `setCount` and may never fall below sets already recorded — that is an undo. The `MatchSet` rows it is made of are derived, loser's sets first so the decider belongs to the winner, and one such command writes one `SetEvent`. Recording a single set stays available to a courtside judge through `POST /api/judge/matches/:id/sets`.
- The set format resolves as match override, then bracket round default, then one. It is snapshotted onto the match when it starts and is immutable from then on.
- Undo removes only the last set, and only while the match is in progress. Reopening a completed match is admin-only, requires a reason, and is refused when the downstream match has started or the court is busy. Undo has no control on the match control console: correcting a recorded result goes through the bracket page's reopen.
- Filling the courts automatically is the same command as placing one match, repeated: matches in playing order, dealt round robin, appended to each queue. It never reorders or retimes what is already placed, so it cannot disturb a queue in progress, and a court whose queue is finished is skipped rather than refused.
- Time and court order belong to the schedule; the match control console reflects them and never invents an order of its own. Court lanes read `queuePosition`, the run order sorts by planned start first, and both the console's queue nudges and its planned-time field issue the schedule module's own commands. A started or finished schedule item is frozen: it cannot be reordered or retimed, and the console shows a lock rather than a control the server would refuse.
- Every view of the console is read-only and every command lives in the match sheet, so a large draw never puts more than one score form on screen. The single exception is starting the match a court is waiting on.
- A result is chosen from the finishes the match's own set format allows, never typed as two free numbers. `finishedTallies` derives them, so the format is stated by the options rather than explained in a hint, and a tally that would take back a recorded set is offered as unavailable rather than hidden.
- The outcome of a command is reported in the message layer (`pushToast`), not as a banner on the page. Commands are sent from inside dialogs, where a banner behind the dialog is a refusal nobody reads. Page-level load failures stay inline — they describe the screen itself. The server's own reason is always the message when it gives one.
- A failure names the action that did not happen and, when it describes the screen rather than a command, how to recover. A success names the specific thing that changed — "Match 4 is on Court 2", not "Saved" — because an operator who looked away has to be able to tell which of several commands landed. An empty state says why it is empty and what fills it.
- The event workspace states what is waiting before it states where the event has reached. `eventAgenda` ranks the queues by what they cost — an idle court outranks every review queue, because it is the only one losing time as it is read — and the workspace leads with that one item. Stage cards carry live counts, never instructions: the explanation is read once and the number is read every time.
- `eventAgenda` is the only vocabulary for "what needs you". `AdminEventBoard` feeds it the grouped `/api/admin/events/operations` counts through `operationsAsSignals`, so a season row and the workspace behind it can never describe one event two different ways. That includes matches with no court: the grouped read counts them itself, under the same rule the drag-and-drop pool uses — no schedule item, and neither completed nor cancelled.
- Every sidebar step under Tournament operations has an event picker behind it, and they are all one component (`AdminEventToolIndexClient`) over one board. A step that needs its own picker design is a step that has drifted.
- Match control leads with `controlFocus`: the one court standing free and the command for it. Four of the five counts it replaced were reports; the filter bar still narrows by state, so nothing was lost but the arithmetic.
- The draws page shows one draw at a time behind `BracketSwitcher`. A per-category summary above per-category panels is the same list twice, and a three-category event was three bracket trees deep before the last one could be reached.
- Courts & schedule is one column per court plus a waiting column, because the job is assignment: a match moves by being dragged from one visible queue to another. Each court is one drop target (`courtDroppableId`), the strip scrolls inside itself so the page never scrolls sideways, and a nudge that would cross a started or finished match is disabled rather than refused.
- Dialogs and the message layer are portalled to `<body>`, outside `.dash-app`. Any styling they rely on must be scoped to `.dashboard-dialog-content` / `.dashboard-portal-surface` as well, or its `var(--dash-*)` lookups resolve to nothing.
- Historical matches keep `scoringMode = POINTS` with scores between zero and six, where six completes the match.
- `Match.nextMatchSlot` means the side of the next match a winner advances into — never a scoring set. "Slot" survives in exactly three non-scoring senses: this field, first-round bracket placement, and the owner/teammate roster slot. Everything else that was a "slot" is now a "set".
- Completed result corrections must not overwrite a downstream match that has already started.
- Final standings are the draw read backwards, never a stored record: the final's winner and loser, then the teams the semifinals eliminated. Third place is not played, so both losing semifinalists hold it jointly. Identity comes from the participant snapshot, so a result survives a rename or a deleted club.
- Public event page, registration roster, bracket, schedule, live scoring, and final results have independent publication controls.

## Security requirements

- Do not bypass `requireUser`, `requireCapability`, ownership checks, or judge-assignment checks.
- Unsafe `/api` requests must pass the CSRF guard. Frontend requests should use the shared `apiFetch` client.
- Never expose unpublished tournament data through public routes or realtime rooms.
- Do not log passwords, tokens, cookies, bootstrap secrets, or raw OAuth credentials.
- Keep `FIRST_ADMIN_BOOTSTRAP_TOKEN` temporary. Production must refuse to start when it remains set after an admin exists.
- Domain changes that require notification or realtime publication should enqueue outbox work inside the same Prisma transaction.
- Audit privileged changes with actor, entity, before/after state, and a public reason when applicable.

## Database changes

When changing `backend/prisma/schema.prisma`:

1. Generate a named migration; never edit a migration that has already shipped.
2. Review destructive operations and foreign-key behavior manually.
3. Run `npm run prisma:generate`.
4. Run backend lint, tests, and build.
5. Update documentation when models, enums, lifecycle rules, or public APIs change.

Production is Render (`render.yaml`). Migrations run as the pre-deploy command on `elpadel-api` and `elpadel-worker` (`npm run prisma:migrate:deploy` in the backend image). Apply them locally with:

```bash
npm run prisma:migrate:deploy --workspace backend
```

## UI and UX standards

- Lead with the primary status, score, or next action.
- Use spacing, typography, borders, and grouping before adding color.
- Do not give adjacent panels competing colored backgrounds.
- Keep buttons explicit: “Publish bracket” is preferable to “Submit”.
- Pair icons with visible text for important state.
- Ensure keyboard focus is visible and interactive elements have accessible names.
- Use `TournamentPanel`, `TournamentSectionHeader`, `StatusLabel`, `InlineNotice`, `CommandButton`, and `ResponsiveDataList` before creating equivalents.
- Validate desktop and 375px mobile layouts after material UI changes.

## Verification

Before handing off a change, run the checks proportional to its scope. The full suite is:

```bash
npm run lint
npm test
npm run build
git diff --check
```

For Prisma changes, also run:

```bash
npm run prisma:generate
```

For UI changes, verify no horizontal overflow, readable empty/error states, keyboard focus, and 44px touch targets.

## Working-tree safety

- Preserve unrelated user changes in a dirty worktree.
- Do not use destructive Git commands to discard work.
- Do not commit `.env`, credentials, generated secrets, or local database data.
- Keep changes scoped to the requested feature and update nearby tests and documentation.

## Further reading

- `README.md`: setup and feature overview
- `docs/BUSINESS_OVERVIEW.md`: product model, audiences, and lifecycle
- `docs/ARCHITECTURE.md`: system structure and data flow
- `docs/API.md`: endpoint groups and request conventions
- `docs/TOURNAMENT_OPERATIONS.md`: end-to-end operational workflow
- `docs/DASHBOARD_DESIGN.md`: dashboard design system, screen archetypes, and per-role intent
- `docs/SECURITY.md`: current security posture, open items, and accepted risks
- `docs/ENVIRONMENTS.md`: staging/production topology and the `develop → staging → main` promotion path
- `DEPLOY.md`: production deployment and recovery

