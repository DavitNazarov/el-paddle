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
| Player | `athlete001@example.com` … `athlete036@example.com` |

Players are distributed two per club across the seeded clubs.

## Main workflows

### Administrator

1. Create categories, clubs, users, and an event (fee, bank details, categories).
2. Publish the event and review club team registrations.
3. Publish the approved roster, close registration, and open per-category opponent-request windows.
4. Approve accepted pairings, reject them, or override refusals.
5. Generate, review, lock, and publish each category bracket (2–16 entries; bracket sized 2/4/8/16 with byes).
6. Create courts, queue matches, and publish the schedule.
7. Move the event to ongoing, optionally enable public live scoring, and monitor scores and deliveries.
8. Complete the event and publish final results; reopen explicitly if a correction is needed.

### Player

1. Register with email verification (or complete an invite), then create or join a club.
2. Enter the club's team in a published event with a teammate from the same club.
3. Request a preferred first-round opponent when the category window opens.
4. Accept, refuse, edit, or withdraw opponent requests.
5. Follow the published bracket, schedule, live scores, notifications, and match history.

### Club leader

1. Create the club and invite club mates.
2. Approve or reject join requests.
3. Replace a registered player when needed (entry returns to review).
4. Resolve affected registrations before removing a member.

### Match control (admin & organiser)

1. Open **Match control** for the event: every match with its court, its planned time, both pairs and their clubs, in draw order.
2. Set or adjust a planned start time in place, until the match starts.
3. Start the next ready match on a court — earlier queue positions must be finished first. Starting it freezes the match's set format. Several courts can run at once.
4. After each set, press the button for the side that won it and confirm in the dialog. The match completes automatically once a side reaches the required set wins, and the winner moves into the next round.
5. Use "Finish early" for a walkover or a retirement, with a reason.
6. To correct a set recorded for the wrong side, reopen the match from the bracket page (administrators only).

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

- Session cookies are HTTP-only JWTs validated against a per-user session version; logout and sensitive changes revoke outstanding sessions.
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
- [Production deployment](DEPLOY.md)

## Deployment

For a Docker Compose deployment behind Nginx and HTTPS, follow [DEPLOY.md](DEPLOY.md). Apply database migrations explicitly after deploying a release:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

`NEXT_PUBLIC_API_URL` is compiled into the frontend bundle. Rebuild the frontend whenever this value changes.
