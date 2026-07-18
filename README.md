# El Padel

El Padel is a full-stack padel club and tournament platform. It supports public club discovery, player registration, tournament administration, opponent requests, fixed Round-of-16 brackets, court scheduling, judge queues, live scoring, notifications, and historical results.

## Technology

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: Express, TypeScript, Prisma, PostgreSQL
- Realtime: Socket.IO
- Background work: PostgreSQL-backed transactional outbox worker
- Authentication: secure cookie sessions, email/password, optional Google OAuth
- Legal compliance: bilingual policies, permanent legal links, versioned account/invite consent, and versioned tournament/refund/risk acknowledgement
- Email: Resend
- Tests: Vitest and Testing Library

## Repository layout

```text
frontend/                     Next.js application
backend/                      Express API and background worker
backend/prisma/               Prisma schema, migrations, and seed data
deploy/                       Nginx deployment configuration
docs/                         Architecture, API, and operational guides
docker-compose.yml            PostgreSQL, API, worker, and frontend services
CLAUDE.md                     Repository instructions for coding agents
DEPLOY.md                     Production VPS deployment runbook
FEATURE_IMPLEMENTATION_PLAN.md Detailed feature and domain design
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

After seeding:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@example.com` | `Password123!` |
| Player | `nika.beridze@example.com` | `Password123!` |

Judge users can be created from Admin → Users.

## Main workflows

### Administrator

1. Create categories, clubs, users, and an event.
2. Publish the event and review registrations.
3. Close registration and open category opponent-request windows.
4. Review accepted requests and approve or reject pairings.
5. Generate, lock, and publish the Round-of-16 bracket.
6. Create courts, assign judges, order matches, and publish the schedule.
7. Move the event to ongoing and monitor scores and deliveries.
8. Complete the event and publish results.

### Player

1. Register or accept a teammate invitation.
2. Enter a published event with a teammate.
3. Request an eligible first-round opponent when the window opens.
4. Accept, refuse, edit, or withdraw an opponent request.
5. View the published bracket, schedule, notifications, and match history.

### Judge

1. Open assigned courts.
2. Process the court queue in order.
3. Start the next ready match.
4. Record scores from zero to six or complete a walkover/withdrawal with a reason.

## Commands

```bash
npm run dev                 # Run API and frontend
npm run dev:backend         # Run only the API
npm run dev:frontend        # Run only Next.js
npm run lint                # Frontend lint and backend TypeScript validation
npm test                    # Backend and frontend tests
npm run build               # Production builds
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Apply a local development migration
npm run prisma:studio       # Open Prisma Studio
npm run db:seed             # Seed development records
npm run audit               # Report high-severity dependency vulnerabilities
```

Run the compiled worker independently:

```bash
npm run build --workspace backend
npm run worker --workspace backend
```

## Security model

- Session cookies are HTTP-only and validated against a user session version.
- Unsafe API requests require a double-submit CSRF token and an allowed origin.
- Admin operations use capability checks rather than UI visibility alone.
- Commands that change tournament state use command IDs and optimistic versions.
- Private realtime rooms are restricted to administrators, event participants, or assigned judges.
- Audit entries, notifications, email jobs, and realtime events are committed in the same database transaction as domain changes.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Tournament operations](docs/TOURNAMENT_OPERATIONS.md)
- [Production deployment](DEPLOY.md)
- [Feature implementation plan](FEATURE_IMPLEMENTATION_PLAN.md)

## Deployment

For a Docker Compose deployment behind Nginx and HTTPS, follow [DEPLOY.md](DEPLOY.md). Apply database migrations explicitly after deploying a release:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

`NEXT_PUBLIC_API_URL` is compiled into the frontend bundle. Rebuild the frontend whenever this value changes.
