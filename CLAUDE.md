# CLAUDE.md

This file gives coding agents the repository-specific context needed to work safely in El Padel.

## Project purpose

El Padel is a club and tournament management platform. The core tournament flow is:

```text
event setup → registration → opponent requests → bracket → schedule → judging → results
```

The system has five audiences: public visitors, players, judges, organisers, and administrators.

## Workspace map

- `frontend/src/app/`: Next.js App Router pages
- `frontend/src/components/`: domain and shared UI components
- `frontend/src/components/tournament/TournamentUI.tsx`: shared tournament presentation primitives
- `frontend/src/components/shared/dashboard/`: shared role dashboard shell and styling
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
- Organisers hold no global capability. Every power is checked against an `EventOrganiser` link via `requireEventCapability`, and their capability set is pinned by a test. They cannot create or edit events, review registrations, correct results, reopen events, or manage accounts, clubs, and club requests.
- A judge may only be assigned to an event in that event's `EventJudge` pool. An actor with global `JUDGE_MANAGE` gets the link created implicitly; an organiser is confined to the pool they built.
- Scoring authorization is per match: judges through their court assignment, admins always, organisers on events handed to them. Only a judge is bound to one match at a time; the court queue order and one-match-per-court rules bind everyone.
- Event lifecycle moves forward through explicit allowed transitions; the only backward transition is an explicit reopen of a completed event, which requires the `EVENT_STATE_CORRECT` capability.
- Registration, bracket, match, schedule, and request writes use optimistic `version` checks where supported.
- Retried commands must include a stable `commandId`; command receipts prevent duplicate application.
- Players belong to exactly one club; each club fields at most one team (owner + teammate from the same club) per event.
- Opponent requests apply only to the first bracket round and require final admin approval.
- Brackets support 2–16 approved entries; the single-elimination graph sizes to 2, 4, 8, or 16 slots and fills the gap with byes.
- A locked bracket snapshots participant identity for historical accuracy.
- Judges can score only assigned matches and must process a court queue in order.
- Matches are decided in slots: `slotCount` is the number of slot wins to race to (1, 2, or 3), and at most `2 * slotCount - 1` slots are ever played, so a decider always exists.
- For `SLOTS` matches `Match.scoreA`/`scoreB` hold the slot-win tally and must always equal the `MatchSlot` rows. `MatchSlot` is current state; `SlotEvent` is the append-only history.
- The slot format resolves as match override, then bracket round default, then one. It is snapshotted onto the match when it starts and is immutable from then on.
- Undo removes only the last slot. A judge may undo while the match is in progress; reopening a completed match is admin-only, requires a reason, and is refused when the downstream match has started or the court or judge is busy.
- Historical matches keep `scoringMode = POINTS` with scores between zero and six, where six completes the match.
- `Match.nextMatchSlot` means the side of the next match a winner advances into — never a scoring slot.
- Completed result corrections must not overwrite a downstream match that has already started.
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

Production migrations are applied manually with:

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
- `DEPLOY.md`: production deployment and recovery

