# El Padel

El Padel is a full-stack padel club and tournament platform for the Georgian padel community. Clubs — not individuals — are the unit of competition: players belong to one club, each club fields one two-person team per event, and tournaments run from registration through opponent requests, single-elimination brackets, court scheduling, live scoring, and published results.

See [docs/BUSINESS_OVERVIEW.md](docs/BUSINESS_OVERVIEW.md) for the full product story.

## Technology

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, bilingual UI (English/Georgian)
- Backend: Express, TypeScript, Prisma, PostgreSQL
- Realtime: Socket.IO
- Background work: PostgreSQL-backed transactional outbox worker
- Authentication: HTTP-only JWT session cookies, email/password with verification codes, optional Google OAuth
- Legal compliance: bilingual policies, permanent legal links, versioned account/invite consent, and versioned tournament/refund/risk acknowledgement
- Email: Resend
- Tests: Vitest and Testing Library

## Repository layout

```text
frontend/                     Next.js application
backend/                      Express API and background worker
backend/prisma/               Prisma schema, migrations, and seed data
deploy/                       Nginx deployment configuration
docs/                         Business, architecture, API, and operational guides
docker-compose.yml            PostgreSQL, API, worker, and frontend services
CLAUDE.md                     Repository instructions for coding agents
DEPLOY.md                     Production VPS deployment runbook
```

## Quick start

Requirements:

- Node.js 20 or newer
- npm
- PostgreSQL 16, either locally or through Docker

Install dependencies:

```bash
npm install
```

Copy the environment template and adjust local values:

```bash
cp .env.example .env
```

Start PostgreSQL, apply migrations, and seed development data:

```bash
docker compose up -d postgres
npm run prisma:migrate
npm run db:seed
```

Start the frontend and backend together:

```bash
npm run dev
```

Local endpoints:

- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

The API starts an in-process outbox worker in local development. Production Docker Compose runs the worker as a separate service.

## Development accounts

After seeding, every account uses the password `Password123!`:

| Role | Email |
| --- | --- |
| Administrator | `admin@example.com` |
| Player | `athlete001@example.com` … `athlete154@example.com` |

Players are distributed two per club across the seeded clubs — 154 players in 77 clubs.

## Main workflows

### Administrator

1. Create categories, clubs, users, and an event (fee, bank details, categories).
2. Publish the event and review club team registrations.
3. Publish the approved roster, close registration, and open per-category opponent-request windows.
4. Approve accepted pairings, reject them, or override refusals.
5. Generate, review, lock, and publish each category bracket (2–32 entries; bracket sized 2/4/8/16/32 with byes).
6. Create courts, queue matches, and publish the schedule.
7. Move the event to ongoing, optionally enable public live scoring, and monitor scores and deliveries.
8. Complete the event and publish final results; reopen explicitly if a correction is needed.

The entry list, court sheet, final results, and audit log also answer `?format=csv` for a desk copy.

### Player

1. Register with email verification (or complete an invite), then create or join a club.
2. Enter the club's team in a published event with a teammate from the same club.
3. Request a preferred first-round opponent when the category window opens.
4. Accept, refuse, edit, or withdraw opponent requests.
5. Follow the published bracket, schedule, live scores, notifications, and match history.
6. Manage the account: signed-in devices, a verified email change, password, and deletion.

### Club leader

1. Create the club, edit its profile, and invite club mates.
2. Approve or reject join requests; resend or withdraw an outstanding invitation.
3. Replace a registered player when needed (entry returns to review), or withdraw the team before the draw locks.
4. Resolve affected registrations before removing a member.
5. Hand leadership to another member — a swap, and the only way a leader can then leave.

### Match control (admin & organiser)

1. Open **Match control** for the event. It opens on the courts: one lane per court showing what is on it, what it starts next, the queue behind that, and what it has played. Two other layouts cover the same matches — **Run order** (everything in the order it is due to be played) and **Draw** (where each winner goes).
2. The header states the one thing the day needs next — the court standing free, the match it is waiting on, and **Start** where the server would allow it — because an idle court is the only state on this screen that costs time as it is read.
3. Narrow the screen by court, category, round or state, or search a player, a club or a match number. The filter follows you between layouts.
4. Start the next ready match on a court from its "up next" row — earlier queue positions must be finished first. Starting it freezes the match's set format. Several courts can run at once.
5. Select any match to open its sheet: court, queue position and planned time; both pairs with their clubs and set tallies; where the winner goes; and every command for that match.
6. When a match ends, pick the result from the finishes its set format allows — two options for a race to one set, six for a race to three, each showing the tally and the pair it gives the match to. There is nothing to type. The dialog names the winning pair before the result is recorded, and recording it advances the winner.
7. Use "Finish early" for a walkover or a retirement, with a reason.
8. Reorder a court's remaining queue with the up/down controls on its rows; a started or finished match is locked in place. Planned times can be changed from the match sheet until the match starts.
9. Park a tablet on one court with its own page, reached from the lane's "Open court" link.
10. To correct a recorded result, reopen the match from the bracket page (administrators only). There is no undo on this screen.

## Commands

```bash
npm run dev                 # Run API and frontend
npm run dev:backend         # Run only the API
npm run dev:frontend        # Run only Next.js
npm run lint                # Frontend lint and backend TypeScript validation
npm test                    # Backend and frontend unit tests (no database needed)
npm run build               # Production builds
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Apply a local development migration
npm run prisma:studio       # Open Prisma Studio
npm run db:seed             # Seed development records
npm run audit               # Report high-severity dependency vulnerabilities
```

The DB-backed suite runs separately. It truncates every table between tests and
therefore refuses to run unless the database name contains `test`:

```bash
DATABASE_URL='postgresql://elpadel:elpadel@localhost:5433/elpadel_test?schema=public' \
  npm run test:integration --workspace backend
```

Run the compiled worker independently:

```bash
npm run build --workspace backend
npm run worker --workspace backend
```

## Security model

- Session cookies are HTTP-only JWTs naming a `Session` row, so signing out revokes one device; they also carry a per-user session version that a password change, email change, reset, disqualification, or "log out everywhere" bumps to revoke every device at once.
- Unsafe API requests require a double-submit CSRF token and an allowed origin.
- Admin operations use fine-grained capability checks (with per-user allow/deny grants), not UI visibility.
- Commands that change tournament state use command IDs and optimistic versions; hot paths add PostgreSQL advisory locks.
- Public routes and realtime rooms only ever expose explicitly published data; DTO serializers keep raw database records out of responses.
- Audit entries, notifications, email jobs, and realtime events commit in the same database transaction as the domain change.

## Documentation

- [Documentation index](docs/README.md)
- [Business overview](docs/BUSINESS_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Tournament operations](docs/TOURNAMENT_OPERATIONS.md)
- [Dashboard design system](docs/DASHBOARD_DESIGN.md)
- [Environments & deployment workflow](docs/ENVIRONMENTS.md)
- [Production deployment](DEPLOY.md)

## Deployment

Production runs on Render. Follow [DEPLOY.md](DEPLOY.md). `render.yaml` already points the site at `https://elpadell.com` and the API at `https://api.elpadell.com`. Adding those domains in the Render dashboard is the connection step. Migrations run before each API and worker deploy.

`NEXT_PUBLIC_API_URL` is compiled into the frontend bundle. A change to that URL needs a frontend rebuild.
