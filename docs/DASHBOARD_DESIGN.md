# Dashboard design system

This is the design brief for El Padel's authenticated screens — admin, organiser,
judge, and player. It exists so anyone picking up the redesign can continue it
without re-deriving the reasoning, and so the remaining screens end up feeling
like the ones already done rather than like a second product bolted on.

Public marketing and tournament pages are out of scope here.

---

## 1. The one rule

**Every screen answers a question its reader arrived with. Build the screen
around the answer, not around the data model.**

The failure mode this replaced: every screen was a vertical stack of identical
panels, each holding a list, each list a faithful rendering of a database table.
That is why it read as machine-generated. The tables were correct and told the
reader nothing.

A concrete example. The event workspace used to show a five-cell grid whose
fifth cell orphaned a grey block, then the sentence "Registration open". A reader
still had to work out: is that early or late? what comes next? what is stopping
it? The redesign draws the whole lifecycle as a rail with the current stop marked
— same data, and now the question is answered before anyone reads a word.

Apply this test before writing a screen: **write down the sentence the reader
would say out loud when they open it.** If your layout does not answer that
sentence in the first screenful, the layout is wrong.

---

## 2. Who is reading, and what they actually want

Five audiences. They are not five skins on one dashboard — their jobs have
different shapes, and the screens should too.

### Player — "when do I play, and am I in?"

A competitor on a phone, usually between other things. They check the app maybe
twice a week, and for about twenty seconds.

- **Leads with:** the next event, a countdown in days, and *their own entry
  inside that same card*. Two questions, one object. Never split them into two
  cards the reader has to mentally join.
- **Then:** their record as a slim four-number strip. It is context, not the
  headline — it must not compete with the event.
- **Then:** their entries, each showing the path to playing (Entry submitted →
  Approved → In the draw) rather than a bare status word.
- **Never:** operational vocabulary. A player does not know what a "bracket
  generation" or a "schedule item" is. Say "the draw", "your match".
- **Honesty rule:** entries that left the path — declined, withdrawn, cancelled —
  get **no rail**. A rail implies progress toward a place they do not have. Show
  the badge, tint the card border, and state the reason plainly.

### Judge — "which match is in front of me right now?"

Standing at a court, on a phone, often in sunlight, frequently interrupted. The
highest-stress reader in the product and the one previously served worst.

- **Leads with:** the one match they can open. Not a list of assignments — the
  console decides, because exactly one match is ever openable across every court
  a judge holds (the running one, else the first ready one).
- **Both pairs get the largest type on the page.** These names get checked
  against the actual people walking onto the court. Nothing outranks them.
- **Then:** each court's queue as a progress meter — "4 of 11 played".
- **Freshness matters.** Scores land from other devices. The judge console
  refreshes on a timer *and* on tab focus, and stays quiet while hidden.
- **Never** offer a second openable match. The server refuses out-of-order
  starts; offering the action invites a failure the judge will read as a bug.

### Organiser — "which of my events needs me?"

Runs events handed to them. Holds no global power at all.

- **Leads with:** their events, ordered by urgency, each showing lifecycle
  position and what it is waiting on.
- **Never shows:** platform totals, club directories, account management, the
  draft-publishing queue, first-run setup. They cannot act on any of it, and
  showing-then-refusing is worse than hiding.
- Organisers share the admin routes. Branch on `viewer?.role === 'ORGANISER'`
  and drop sections, rather than building parallel screens.

### Admin — "what is stuck, and where?"

Runs the platform. Wants triage, not totals.

- **Leads with:** the same events board as the organiser. Before any aggregate
  number, the reader wants to know which event is running and which is stuck.
- **Then:** the cross-event decision queue — entries awaiting review, pairings
  awaiting approval.
- **Then, and only then:** platform counts and drafts.
- Individual entries are listed one by one (they are decided in place).
  Pairings are counted per event (the decision is taken inside that event).
  Match the grain to where the action happens.

### Public visitor

Out of scope for this document, but note the constraint it imposes: the six
public surfaces of an event (roster, bracket, schedule, live scores, results —
and the event page itself) publish **independently**. Any admin screen touching
publication must state all of them, not just the switches that screen owns.

---

## 3. Screen archetypes

Six shapes cover every dashboard screen. Pick one deliberately; do not invent a
seventh without a reason.

| Archetype | Question | Shape | Built |
|---|---|---|---|
| **Console** | "what do I do *right now*?" | One hero object + supporting meters | Judge home, judge queue |
| **Board** | "where does everything stand?" | Rows, one per entity, each with position + pending work | Admin/organiser home, event pickers |
| **Queue** | "what is waiting on my decision?" | Progress meter + spined rows + only-available actions | Registration review, opponent requests |
| **Workspace** | "how do I drive this one thing forward?" | Lifecycle hero + stage cards + state board | Event workspace |
| **Directory** | "find and manage many similar things" | Filters + table/cards + row actions | *Not yet redesigned* |
| **Form** | "change these values" | Grouped fields + explicit save + inline errors | *Not yet redesigned* |

### Console
The hero object fills the first screenful. Everything else is subordinate and
can be scrolled to. Used when the reader has exactly one job at this moment.

### Board
One row per entity. Each row must carry **position** (how far along) and
**pending work** (what it needs). A row that only carries a name is a link, not
a board — and a list of links is what we are replacing. Sort by urgency, not
alphabetically or by creation date.

### Queue
Leads with a progress meter, because "how much is left" is the question. Rows
still needing a decision get an **amber spine** (`box-shadow: inset 3px 0 0`).
Render only the transitions the current state actually allows.

### Workspace
Lifecycle hero (ring + rail + primary action + metadata strip), then numbered
stage cards each carrying its own live count, then a state board of every
publishable surface.

---

## 4. Non-negotiable rules

1. **Colour is never the only signal.** Every tone pairs with an icon and a
   word. Spines and dots survive greyscale; a red tint alone does not.
2. **Never invent a zero.** A count that has not loaded renders a loading label
   or a skeleton — never `0`. `null` means "not known"; `0` means "none".
3. **Show state, not just controls.** If a screen offers Open and Close buttons,
   it must say which one is currently in force. (This was a real bug on the
   opponent-requests screen: two buttons, no state.)
4. **Only render available actions.** Three buttons where two are permanently
   disabled reads as broken, not constrained.
5. **Loading shows shape, not the word "Loading".** Skeletons sized like the
   content that replaces them, so the layout does not jump.
6. **44px minimum touch target**, and no page-level horizontal overflow at
   375px. Verify both, every time.
7. **Both locales, always.** New copy goes into `en` *and* `ka` in the same
   edit. `tournamentCopy` is the safe home — `en.ts`/`ka.ts` have drifted before.
8. **No legacy dark-theme classes.** `text-[var(--padel-ivory)]`,
   `rgba(213,201,177,…)`, `var(--padel-gold)` only render through a
   compatibility shim in `DashboardStyles`. Use `--dash-*` tokens.

### The StatusLabel trap

`StatusLabel` infers tone from the *wording* via regex. `"Not published"`
contains `publish`, so it renders **green**. Any label you pass gets scored —
check it. Prefer wording that cannot collide (`Hidden` over `Not published`).

---

## 5. The component vocabulary

Reach for these before writing anything new.

### `components/shared/dashboard/DashboardSignals.tsx`
- `StageRail` — a fixed sequence with done/current/upcoming stops. Vertical on
  phones, horizontal from 48rem. Use for lifecycles and approval paths.
- `StageDots` — the rail compressed into a list row: dots + the stage's own
  name. The name is the signal; the dots say how far along it sits.
- `SignalCard` / `SignalGrid` — a destination that states its own workload.
  Icon, ordinal, title, detail, live count, optional amber flag, optional focus.
- `StateRow` / `ManageLink` — one controllable surface per line: what it is,
  whether it is live, and the control (or a link to where the control lives).
- `QueueMeter` — progress through a finite queue. Bar plus literal numbers.

### `components/shared/dashboard/Feedback.tsx`
- `Notice` — four tones (info/success/warning/error), each with icon, optional
  title, body, actions, dismiss. Errors get `role="alert"`; the rest `status`.
- `PageNotice` — the same with a coloured spine; scrolls itself into view.
- `Skeleton` / `SkeletonRows` / `SkeletonCards` — shaped loading placeholders.
  One `aria-busy` region per block, not a dozen chattering placeholders.

`InlineNotice` (TournamentUI) and `FeedbackBanner` (DashboardUI) are thin
wrappers over these — improving `Feedback` improves every call site at once.

### `components/tournament/TournamentUI.tsx`
`TournamentPanel`, `TournamentSectionHeader`, `StatusLabel`, `CommandButton`,
`EmptyTournamentState`, `BackLink`, `ResponsiveDataList`.

### Data hooks
- `useEventOperations()` — per-event counts for every event the viewer runs,
  keyed by id, from one grouped read (`GET /api/admin/events/operations`).
- `useEventWorkspaceSignals(eventId)` — the four stage counts for one event.
- `useAdminCounts()` — platform totals, shared with the sidebar.

### Backend pattern for new signals
Read-only aggregate endpoints, scoped exactly like `getAdminSummary`: organisers
see only events handed to them. Use `groupBy` counts, never list-then-count —
the cost must not grow with the roster. Fail soft on the client: a refused read
is a missing number, not an error banner.

---

## 6. Design tokens

Defined in `components/shared/dashboard/DashboardStyles.tsx`, available inside
`.dash-app`.

Surfaces `--dash-surface`, `--dash-border`, `--dash-border-strong`, `--dash-tint`,
`--dash-tint-strong` · Text `--dash-text`, `--dash-muted`, `--dash-faint` ·
Semantic `--dash-primary` (brand red), `--dash-teal` (live/published),
`--dash-amber` (needs a decision), `--dash-coral` (failed/declined),
`--dash-info` · each with a `-soft` fill.

Spacing `--space-1..8` · Radius `--radius-card|tile|control|pill`.

**Meaning of the accents:** amber = *you* are being asked for something. Red =
running now, or the primary forward action. Teal = live to the public, or
finished cleanly. Coral = refused. Do not use red for danger-as-decoration; in
this product red is the brand and it is loud.

---

## 7. Verification workflow

There is no local database, so screens cannot be driven with real data.

1. Write a throwaway route `frontend/src/app/zz-preview-*/page.tsx` that renders
   the presentational components with mock props inside
   `<main className="dash-app"><DashboardStyles />…`.
2. `preview_start` the `frontend` config; screenshot at **1280px and 375px**.
3. Check `document.documentElement.scrollWidth === window.innerWidth` at 375px.
4. **Delete the throwaway route** before finishing.

This forces presentational components to be extractable and prop-driven, which
is why `JudgeNowCard`, `JudgeQueueList`, `AdminEventBoard`, `PlayerEntryCard`
and `AdminRegistrationCard` are separate files. Keep doing that.

Then: `npm run lint && npm test && npm run build && git diff --check`.

---

## 8. Status

### Done
Event workspace · admin & organiser home · judge home · judge court queue ·
player home · player entries · the four event-picker routes · registration
review · opponent requests · the whole message-state system.

### Remaining, with direction

**Bracket** (`AdminBracketClient`, ~950 lines) — the biggest. Archetype:
*workspace*. A draw is a tree; the current screen renders it as nested boxes.
Lead with a per-category strip showing draw state (draft/locked/published) and
completion, then the tree itself with the champion path emphasised. The
drag-to-reseed interaction is genuinely good — keep it, but give it a visible
affordance and keep the keyboard move-button path.

**Courts & schedule** (`AdminScheduleClient`, ~580 lines) — archetype: *board*
of courts. Each court is a column with a judge, a queue meter, and its ordered
matches. Lead with the day: how many courts staffed, how many matches placed
versus unscheduled. The unscheduled pool deserves to be a visible holding area,
not a dropdown.

**Users / clubs / categories / applications** — archetype: *directory*. These
four are near-identical in shape; build **one** directory pattern (filters +
`DataTable` + row actions + a consistent create/edit modal) and apply it four
times. Applications additionally needs a *queue* treatment — it is a decision
surface, so give it the amber spine and a progress meter.

**Events list** (`AdminEventsClient`, ~670 lines) — archetype: *board* + *form*.
Reuse `AdminEventBoard` for the listing; the create/edit form is the first real
*form* archetype — establish it here: grouped fields, explicit save, inline
field errors, no silent autosave.

**Judge match** (`JudgeMatchClient`) — archetype: *console*. Slot scoring is the
most safety-critical interaction in the product. Huge targets, unmistakable
current slot, confirm before recording, undo obvious. Test on a phone.

**Player event workspace / events / matches / club** — archetype: *workspace*
and *board*. Reuse `PlayerNextEvent`'s vocabulary; a player's event page should
show their entry path, their opponent requests, and their matches, in that order.

**Settings screens (all roles)** — the *form* archetype. Currently thin wrappers.
Group into Profile / Security / Preferences, explicit save per group.

**Notifications** — archetype: *queue*. Unread first, grouped by day, each row
linking to the thing it is about.

---

## 9. Working notes

- The repo directory name **ends with a space** (`/Users/sn/ElPaddle `). Quote
  every path.
- Two dev servers cannot run from the same Next.js directory. If port 3000 is
  taken by another session, attach with `preview_start {url}` instead.
- Prefer editing `tournamentCopy` in `lib/i18n/tournament.ts` over
  `en.ts`/`ka.ts` for new dashboard copy — it is `satisfies Record<Locale, …>`
  and keeps both locales structurally in sync.
- Never change production directly; route work through `develop` → staging →
  `main`. See `docs/ENVIRONMENTS.md`.
