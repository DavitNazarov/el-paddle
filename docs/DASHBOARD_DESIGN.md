# Dashboard design system

This is the design brief for El Padel's authenticated screens — admin, organiser,
and player. It exists so anyone picking up the redesign can continue it
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

- **Leads with:** whatever answers today's question. Before the event: countdown
  plus their entry path inside the same card. On match day: court, time, and
  opponent (`nextMatch`) outrank the countdown. After: the result.
- **For you strip:** anything waiting on the *player* — needs-changes entries,
  opponent requests to answer — sits at the top of home and disappears when
  empty. Silence is not "all clear"; an empty strip is.
- **Then:** their record as a slim four-number strip. It is context, not the
  headline — it must not compete with the event.
- **Then:** their club's entries, each showing the path to playing (Entry
  submitted → Approved → In the draw) rather than a bare status word. The third
  stop is honest: it lights only when the entry appears in a *published* draw.
- **Draw page** (`/dashboard/events/[eventId]/draw`): published brackets only,
  with the player's own team marked so they can trace their path.
- **My matches:** personal record (streaks, best finish, partners, milestones)
  above the match list; cards say "You won" / "You lost", never Side A / Side B.
- **Never:** operational vocabulary. A player does not know what a "bracket
  generation" or a "schedule item" is. Say "the draw", "your match".
- **Honesty rule:** entries that left the path — declined, withdrawn, cancelled —
  get **no rail**. A rail implies progress toward a place they do not have. Show
  the badge, tint the card border, and state the reason plainly. Waiting states
  say who acts next ("nothing needed from you" vs "open the event to see the
  note").
- **My profile:** everything the platform holds about the reader on one page —
  identity, the details they may edit, role and account state, club standing,
  and their record. Settings keeps only what is not *about* them: password,
  language, deletion. The record here is the four counters; streaks, best
  finish, and partners stay on My matches beside the matches they are read
  from, so neither page repeats the other. Shape is **Console**: a player card
  carrying identity *and* record as one object (monogram on a padel court, club
  crest worn on it, name, club, contact, win-rate ring, then a Matches/Won/Lost
  band), then the recorded details *stated* with an Edit button that opens the
  form in a modal, then the three supporting panels. See the profile notes
  in §8.
- **Shell:** Home / Events / My entries / My matches, then My profile / My club /
  Notifications / Settings. The bell and the entries badge show counts that mean
  "you are being asked for something" — unread notifications and
  `NEEDS_CHANGES` only.

### Match control — "what is happening on which court, and where does the winner go?"

Standing at a court, on a phone, often in sunlight, frequently interrupted, and
responsible for the whole event rather than one match. The highest-stress reader
in the product. (This replaced a separate judge console; the judge role still
exists server-side but has no screens.)

- **Leads with:** the courts. A tournament day is not a bracket; it is a handful
  of surfaces each working through a queue. One lane per court — what is on it,
  what it starts next, the queue behind that, what it has played — is the layout
  a sixteen-entry draw across three categories survives and a wall of forty-five
  cards does not.
- **Three layouts, one set of rows.** Courts, run order (everything in the order
  it is due to be played) and draw (where each winner goes) are three questions
  about the same matches; switching layout never loses the filter.
- **Filtering is a first-class control, not a nicety.** Court, category, round,
  state and a free-text search over players, clubs and match numbers — the five
  ways a desk gets interrupted. What is chosen becomes a removable chip, so the
  current question is always one line.
- **Counts are navigation.** Each tile in the summary strip narrows the console
  to the matches behind it, because a number an operator cannot act on is a
  number they have to translate into a search.
- **One row everywhere, one place to act.** Every view is read-only; the row
  opens a sheet, and the sheet is the only surface carrying commands. Eight
  courts must not mean eight open score forms.
- **Both pairs carry the largest type,** with their club beneath. These names get
  checked against the four people walking onto the court. Nothing outranks them.
- **Freshness matters.** Scores land from other devices; the console refetches on
  every realtime topic that can change a match, and re-reads lateness on a clock
  of its own.
- **Never offer an action the server would refuse.** A match with no court says
  so instead of showing a Start button; a started match's time and its place in
  the queue read as locked rather than as inputs the API would reject.

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
- **Then:** one queue holding *everything* waiting on an administrator —
  pairings, entries, club requests, unpublished events — ordered by who is
  blocked. These were once three separate blocks plus a bare number with nothing
  to click; they are one job, so they are one list.
- **Then, and only then:** platform statistics.
- **No standalone count tiles.** They said what the queue and the board directly
  above them already said, and a lifetime "approved entries" total carries no
  action at all. Directory sizes live in the sidebar badges.
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
| **Console** | "what do I do *right now*?" | One hero object + supporting meters | Match control |
| **Board** | "where does everything stand?" | Rows, one per entity, each with position + pending work | Admin/organiser home, event pickers, court board |
| **Queue** | "what is waiting on my decision?" | Progress meter + spined rows + only-available actions | Registration review, opponent requests |
| **Workspace** | "how do I drive this one thing forward?" | Lifecycle hero + stage cards + state board | Event workspace |
| **Directory** | "find and manage many similar things" | Filters + table/cards + row actions | Users, clubs, categories, club requests |
| **Form** | "change these values" | Grouped fields + explicit save + inline errors; stepped when it asks more than one question | Event create/edit (stepped), account settings |

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

### `components/shared/dashboard/DashboardCharts.tsx`
- `TrendBars` — grouped vertical bars for one or two series over a fixed set of
  buckets. `ShareBar` — a 100% stacked bar for a distribution. `StatDelta` — a
  KPI tile wrapping `Metric` with a period-over-period reading.
- **A chart is always paired with its numbers.** The `<svg>` is `aria-hidden`
  (31 focusable bars would be a tab trap on a phone); the accessible
  representation is a real `<table>` inside `<details>`, and every series total
  appears in the legend as text. `ShareBar` is deliberately not SVG — flex divs
  cannot overflow — and its list names every segment, including ones too small
  to see.
- **A `null` point is "not tracked", never zero.** It renders as a hatched band
  and an em dash, so a period nobody measured never draws a flat zero line.
- Series two carries a **hatch as well as a hue**, so two series stay apart in
  greyscale. Note the trap: a stylesheet `fill` beats a `fill` attribute, so a
  pattern must go on an element with no CSS fill rule.
- Tick labels live **outside** the plot: the SVG is stretched to its container
  width, which would distort any text inside it. At most five are drawn.
- `StatDelta` takes `goodDirection`, because a direction alone cannot say
  whether the news is good — signups up is good, deletions up is not.

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
- `useAdminCounts()` — platform totals, shared with the sidebar. Note it seeds
  zeros, which breaks rule 2; `useAdminStats` does it correctly and the sidebar
  is the reason this one has not been changed yet.
- `useAdminStats()` — platform statistics for one range
  (`GET /api/admin/stats/platform`). Returns `null` until loaded and after a
  failure, and withholds the previous range's numbers while a new one is in
  flight, because last month's figures under a "last 7 days" heading would be a
  lie. `loading` is derived from which range actually loaded rather than set in
  the effect, which the `react-hooks/set-state-in-effect` lint rule requires.

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
is why `MatchLine`, `MatchSheet`, `CourtLane`, `AdminEventBoard`,
`PlayerEntryCard`, `AdminRegistrationCard`, `BracketDrawStrip`, `BracketTree`,
`CourtBoard`, `CourtDetail`, `AdminAttentionQueue` and `UnscheduledPool` are
separate files.
Keep doing that.

One caveat learned from `AdminAttentionQueue`: its item type carries React values
(an icon component, a badge node), so the list must be built inside a client
component. A server component passing it in gets "Only plain objects can be
passed to Client Components" — which is exactly what the throwaway preview route
caught.

The same split applies below the components. A redesigned screen ends up as a
client that owns state and requests, one `*Model.ts` holding the constants and
the pure reading (`bracketModel`, `scheduleModel`), presentational components
that take props, one CSS module per folder, and — where the logic has real
branches, like drop resolution — a unit test beside the model.

Then: `npm run lint && npm test && npm run build && git diff --check`.

---

## 8. Status

### Done
Event workspace · admin & organiser home · match control ·
player home · player entries · the four event-picker routes · registration
review · opponent requests · bracket · courts & schedule · users, clubs,
categories and club requests · platform statistics on the admin home ·
the whole message-state system.

**Platform statistics** sit last on the admin home, below the counts and drafts:
counts say how much exists now, statistics say how it is moving, which is one
step further from an action. The reader's sentence is "is the platform growing,
and is anything quietly rotting?", which is what earns each number its place —
review latency, players holding no club (they cannot enter anything), events past
their date, published events with no draw, and the outbox backlog are all
actionable; lifetime totals and engagement scores were cut. Organisers never see
the section, and the route refuses them rather than scoping. Two figures are
honest about their own limits: deletions are only recorded from the tracking
migration onward, so earlier buckets are `null`; and "signed in recently" carries
no delta, because `User.lastLoginAt` holds only the latest sign-in and the
previous period is genuinely unknowable.

**Bracket** notes, since the tree is unlike anything else here. The screen leads
with `BracketDrawStrip`: one card per category carrying draw stage
(Draft → Locked → Published as `StageDots`), a `QueueMeter` of matches played,
and the champion once there is one — so "which draws still need me?" is answered
before the first tree. `BracketTree` then draws the draw, with the champion's
route marked by an amber **spine** on every match they won and a matching
connector between them; the trophy sits on the winning row of the final, and a
legend names the path. The reseed drag now carries a visible grip inside the
handle, because a `cursor: grab` is invisible on the phones this is used from;
the move button remains the keyboard and touch path. Pure reading lives in
`bracket/bracketModel.ts`, so both components are prop-driven and previewable.

**Courts & schedule** notes. `ScheduleDayHeader` leads with the day as three
`QueueMeter`s — courts staffed, matches placed, matches played — plus whether
players can see any of it. Then a **board over a detail**, because a column per
court grew with its queue and an eight-court event ran to four screens before
the first question — *which court needs me?* — could be answered. `CourtBoard`
is one fixed-height tile per court: state word (`courtState`: done · live ·
idle · ready), a progress bar, and the only two matches
worth naming (`courtFocus` — what is on court, what is next); the rest is a
count. The two states that mean *you* are being asked for something —
`unstaffed`, `idle` — carry the amber spine, and the board heading totals them.
On phones the tile is a row, so eight courts cost about a screen and a half.
`CourtDetail` then expands exactly one court, so the page is the same length
whether the event runs on two courts or ten, and that one queue scrolls inside
its own panel. A court is on screen twice, so it needs two droppable ids —
`court:` for the tile, `queue:` for the open panel — both resolving to the same
court in `targetCourtOf`. Dragging a queued match onto another court's tile is
still how it moves; the per-row court select remains the keyboard and touch
path. `UnscheduledPool` is the holding area the old dropdown
hid; it is a **drop target in both directions**, so dragging a queued match into
it unschedules (`DELETE /schedule/items/:id`, which the server already refused
for started matches) and dragging out of it places. Every drop resolves through
`resolveDrop` in `schedule/scheduleModel.ts` — a pure function returning an
intent, unit-tested in `scheduleModel.test.ts`, so the frozen-item and
finished-queue rules live in one place rather than inside a drag handler. Forms
moved to `ScheduleDialogs.tsx` and own their fields, resetting during render
rather than in an effect.

**Directory** notes, covering users, clubs, categories and club requests. The
pattern is built once in `admin/directory/` and applied four times: every screen
is a client that owns state and requests, over `DirectoryToolbar` (search +
facet chips) and `DirectoryTable` (shaped loading, empty state, shared
`DataTable`), with `EditorModal` and `ConfirmModal` for the writes. All the pure
reading — `filterRows`, `facetOptions`, and each screen's facet reader — lives in
`directory/directoryModel.ts` and is unit-tested in `directoryModel.test.ts`.

Three things worth keeping. **Facet counts are taken from the search-filtered
rows**, so a chip never promises more than clicking it would show, and the count
line is the only thing telling a reader a filter is hiding rows. **The empty
state knows why it is empty** — nothing yet versus nothing matching gets
different words and a *Show all* escape, which is why `DirectoryTable` takes both
the filtered rows and the unfiltered total. **Row actions opt up to 44px** via
`rowActionClassName`, because the shared `sm` button is 36px and every one of
these screens was below the touch-target rule.

Club requests are a directory that is also a *queue*. It leads with a
`QueueMeter` of what can actually be decided — approving or rejecting deletes the
request, so "decided" is not knowable from this list, but "ready to decide" is —
and the amber spine (`rowAttention` on `DataTable`, new and available to any
future queue table) marks only rows in `SUBMITTED`. A request still awaiting the
applicant's email confirmation gets **no spine and no decision buttons**: the
server refuses both `approve` and `reject` until then, so offering either would
invite a failure. Messaging stays available, because that is how you chase it.

**Form** notes, since it is the last archetype and two screens now share it.
`shared/dashboard/DashboardForm.tsx` holds it: `FormSection` groups fields under
the question they answer, `Field` takes the control as a **render prop** so
`aria-invalid` and `aria-describedby` cannot drift from the message actually on
screen, and `FormActions` states what is unsaved before the reader commits.

The rule that shaped it: **the save is never disabled**. Both screens used to
grey out save until everything validated, which left a dead button and no clue
which of eight fields was wrong. Now the first press reveals every error at
once, each against its own field, and errors stay hidden until then so a fresh
form is not a wall of red. `validateEventForm` and `validatePassword` return
error *codes*, not sentences, so they are testable without a locale and the
client owns every word.

**Stepped forms.** When a form asks more than one question — the event form asks
four: what it is, when and where, entry fee, categories — it is walked one step
at a time rather than shown as one scrolling wall in which the required fields
are indistinguishable from the optional ones. `shared/dashboard/FormStepper.tsx`
is the rail; `StepperEditorModal` in `admin/directory/DirectoryModals.tsx` wires
it to the modal, and `EVENT_STEPS` in `events/eventsModel.ts` says which fields
answer which step, so a step reports its own state without knowing the rest.

Three rules keep it from becoming a maze. **The rail is navigation, not a gate**:
every step stays clickable, including ones behind an unfinished answer, so an
admin editing a single field never walks the whole form again. **Leaving a step
is what reveals its state** — a step is ticked or flagged only after the reader
has been through it, which keeps a fresh form clear of red while never letting
something already passed stay quietly broken. **Save is still never disabled**:
pressing it with errors reveals all of them and lands the reader on the first
step that needs work. State is never colour alone — a finished step carries a
tick, an unfinished one a warning triangle, and the caption spells out "Step 3
of 4" in words. Enter and the primary button mean *continue* until the last
step, where they mean save.

Account settings gained a **Preferences** group holding the language switch.
It has no save button, and says so: the switch applies at once and is stored on
the device, not the account. Faking a save there would be exactly the silent
autosave the archetype forbids.

**Match control** notes. The one screen where a UI mistake corrupts a result.
Both pair names carry the largest type, above the set tally, because they are
what the operator checks against the four people walking onto the court; each
carries its club beneath, since two clubs can field similar names.

The screen is built court-first. `MatchLine` is the only match row in the
product's match-day surfaces and it is read-only everywhere; `MatchSheet` is the
only place a match is commanded. That split is what keeps a big draw usable: a
console that put a score form on every card would put eight of them on screen at
a four-court event and forty-five in a three-category draw.

The logic is split so each piece has one reason to change: `setEngine.ts` mirrors
the server's set race, `matchModel.ts` decides what the console may *offer*
(`canStart`, `canRecordResult`, `canFinishEarly` mirror the server, so a control
that would be refused is never shown), `controlModel.ts` reads one match's court,
time and lateness, `runBoard.ts` turns brackets plus courts into lanes and the
day's numbers, and `controlFilters.ts` is the whole narrowing vocabulary.
`useControlConsole.ts` holds the fetch and every command, so the console and the
single-court screen (`/admin/events/:eventId/control/courts/:courtId`, a lane
given the whole width for a tablet parked at the desk) share one of each.

**Order is the schedule's, never the console's.** Lanes are drawn in
`queuePosition` order and the run order sorts by planned time first, so a change
made on Courts & schedule shows up here immediately. The nudges send that same
reorder command; a started or finished match shows a lock instead, because the
order a match was played in is a fact rather than a setting. Lateness follows
from the same source — a match still waiting more than `LATE_AFTER_MINUTES` past
its planned start is flagged, and "behind schedule" is a filter, not just a count.

There is no undo here. Correcting a recorded result is an administrator act with
a reason, on the bracket page — deliberately slower than recording one.

**Player event** notes. Ordered as the competitor asks: am I in
(`PlayerEntryCard`, the same entry path as the player home), who am I playing
(their requests), when do I play (their matches). `playerMatches` in
`event/playerEventModel.ts` keeps only the matches they are actually in and
attaches the court and time; the old page rendered every match in every draw,
which is the tournament's view of the event rather than the competitor's.
Unknown court or time stays `null` rather than becoming a placeholder.

**My profile** notes. It was five equally-weighted panels in one column, which
meant the reader's own name was set at the same size as their phone number and
their record sat last on the page. It is now a **player card** —
`profile/ProfilePassport.tsx` — carrying identity and record as one object,
because on this screen the record *is* part of identity rather than context
beside an event.

Three decisions worth keeping. **The ring is decoration; the band is the data.**
The win-rate ring is `aria-hidden`, its percentage is ordinary DOM text in the
hole rather than SVG `<text>` (selectable, unscaled by the viewBox, read as a
sentence), and the counts it is drawn from are stated underneath — with a dot
tying "Won" and "Lost" to their arc, so the colour is never the signal.
`recordArcs` derives the losing share from what is left rather than from
`losses`, so the ring always closes. **The card carries at most one exception
chip:** a pending account and an unverified address are two readings of the same
fact, and the account panel states both anyway. **A link is offered only where it
resolves** — `/players/:id` serves active players only, so `hasPublicPlayerPage`
gates the public-profile link rather than opening a doorway into a 404.

Below the card, the recorded details are **stated, not laid out as a form**. The
page is read far more often than it is edited, so four permanently-open inputs
made every visit look like unfinished paperwork; now `ProfileDetailsPanel` shows
the values with an Edit button that opens them in a `DashboardModal`. Two rules
keep that honest: the card behind the modal renders `editor.saved`, never what is
currently typed, so cancelling by any route (button, Escape, overlay) leaves no
trace; and a value the platform actually needs and does not have — a player
without a phone number — carries the amber spine rather than sitting as a blank
cell. The save itself lives in `useProfileEditor` in `shared/account/
AccountProfile.tsx`, shared with the always-open settings card, so the modal and
that screen cannot drift apart.

Then three supporting panels laid out by available room rather than a breakpoint
list (`repeat(auto-fit, minmax(17.5rem, 1fr))`): account standing (three stated
facts, amber spine on the ones asking something of the reader), the club, and
*The rest of your account* — two doorways to My matches and Settings, which is
what killed the orphan button that used to end the page. Pure reading lives in
`profile/profileModel.ts` with its own test.

**Notifications** notes. Unread rows are lifted out of the timeline entirely
rather than tinted where they sit — something from three days ago that still
needs the reader outranks this morning's notice that does not. Each day heading
carries its own unread count, and each row states where it leads, so the page
reads as a set of doorways rather than a log.

### Remaining, with direction

Nothing. Every dashboard screen and all six archetypes are built.

The next person here is maintaining the system rather than extending it, so the
job changes shape: when a screen needs a new behaviour, check §5 and the four
model files (`directoryModel`, `eventsModel`, `matchModel`, `playerEventModel`)
before adding anything, and keep the split — client owns state and requests, one
`*Model.ts` per screen folder for the pure reading, prop-driven presentational
components, one CSS module, a unit test beside the model.

One known wart, pre-existing and not introduced by the redesign: `formatDate`
renders through `I18nProvider`, which reads the stored locale in an effect after
mount. Any page showing a date therefore logs a React hydration mismatch in dev
(server renders `1 Sept 2026`, the client re-renders `1 სექ. 2026`). It is
visible on untouched public pages too. Fixing it means moving the locale into a
cookie the server can read at render time.

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
