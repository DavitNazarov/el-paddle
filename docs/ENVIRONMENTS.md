# Environments & Deployment Workflow

El Padel runs **two isolated stacks on one Contabo VPS** (`194.163.143.231`),
both fronted by **Cloudflare**. Production was migrated off Vercel on
2026-07-26; the frontend is now served by the Contabo Docker container.

## Topology

| Host | Serves | Origin (localhost) | Cloudflare | Cert |
|------|--------|--------------------|------------|------|
| `elpadell.com` / `www` | Prod frontend | `el_paddle-frontend` `:3000` | **Proxied (orange)** | Cloudflare Origin |
| `api.elpadell.com` | Prod API | `el_paddle-backend` `:4000` | **DNS only (grey)** | Let's Encrypt |
| `staging.elpadell.com` | Staging frontend | `elpadel_staging-frontend` `:3100` | **Proxied + Access** | Cloudflare Origin |
| `api.staging.elpadell.com` | Staging API | `elpadel_staging-backend` `:4100` | **DNS only (grey)** | Let's Encrypt |

- **Prod** Compose project `el_paddle` in `/root/el-paddle`, branch `main`.
- **Staging** Compose project `elpadel_staging` in `/root/el-paddle-staging`, branch `develop`.
- Each stack has its own Postgres volume, secrets, and `.env`. `www` 301s to the apex.
- Nginx sites live in `/etc/nginx/sites-available/` (`elpadell.com`, `api.elpadell.com`, `el-paddle-staging`). The Cloudflare Origin cert is at `/etc/nginx/ssl/elpadell-origin.*` and covers `elpadell.com`, `*.elpadell.com`, `*.staging.elpadell.com`.
- Staging is private via **Cloudflare Access** (Zero Trust free plan) — an allow-list of emails on `staging.elpadell.com`.

## Deployment workflow

**All changes flow `develop → staging → main → prod`. Never edit code or config directly in production.**

1. **Develop** on `develop` locally. Author any Prisma migration locally
   (`prisma migrate dev`); migration files are committed and travel with the branch.
2. **Deploy to staging** (server `/root/el-paddle-staging`):
   ```bash
   git pull origin develop
   docker compose up -d --build
   docker compose exec backend npm run prisma:migrate:deploy   # if there are new migrations
   ```
3. **Verify** at `https://staging.elpadell.com` (behind the Access login).
4. **Promote:** merge `develop` → `main`.
5. **Deploy to prod** (server `/root/el-paddle`):
   ```bash
   # back up the DB first
   docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/elpadel-$(date -u +%Y%m%dT%H%M%SZ).dump"
   git pull origin main
   docker compose up -d --build
   docker compose exec backend npm run prisma:migrate:deploy   # if there are new migrations
   ```

Frontend changes are now shipped by rebuilding the Contabo container
(`docker compose up -d --build frontend`), **not** a Vercel push.
`NEXT_PUBLIC_API_URL` is baked at build time, so a frontend rebuild is required
if it changes.

## Production change policy

- Prod changes go through the workflow above — build on `develop`, verify on
  staging, merge to `main`, then deploy. Do **not** hand-edit files or config on
  the prod server or commit straight to `main`.
- Before any action that touches production directly, stop and confirm it is
  intended — direct prod edits bypass staging verification and have no safety net.

## Seeding staging with mock data

`backend/prisma/seed.ts` builds comprehensive fixtures (categories A/B/C/B+C,
athletes, judges, and events across every lifecycle status with brackets,
scores, and results). It is **guarded against production** (`NODE_ENV=production`
refuses; requires `ALLOW_DEVELOPMENT_SEED=true`). The prod backend image omits
`tsx`, so seeding uses the Dockerfile `builder` stage. On the staging server:

```bash
git pull origin develop
docker build --target builder -f backend/Dockerfile -t elpadel-staging-seed .
docker run --rm --network elpadel_staging_default -w /app/backend \
  -e NODE_ENV=development -e ALLOW_DEVELOPMENT_SEED=true \
  -e DATABASE_URL='postgresql://elpadel_staging:<password>@postgres:5432/elpadel_staging?schema=public' \
  elpadel-staging-seed npm run db:seed
```

The seed is idempotent (wipes/recreates only its own `seed_event_*` events) and
never touches the bootstrapped admin. Logins after seeding: `admin@example.com`,
`judge1..5@example.com`, `athlete001..036@example.com` — all password `Password123!`.

Completed and in-progress fixtures are scored in slots, matching the live product:
quarterfinals race to one slot win, semifinals to two, finals to three (so a final
can run to five slots and finish 3–2). Each decided slot gets a `MatchSlot` row plus
its `SlotEvent` history, and every bracket gets `BracketRoundConfig` rows for those
per-round defaults.

### Seeding a local development database

```bash
cd backend && ALLOW_DEVELOPMENT_SEED=true npx tsx prisma/seed.ts
```

The seed resets every user's win/loss tallies and rebuilds its own `seed_event_*`
rows, so hand-made local fixtures under other ids survive but player statistics do
not. Apply migrations first — the seed writes slot columns that only exist after
`20260727120000_slot_scoring`.

## Gotchas & rollback

- **The local development database is a Docker container.** `el-padel-postgres-dev`
  (`postgres:16-alpine`) publishes `5433:5432`, which is what `backend/.env`'s
  `DATABASE_URL` points at. The repository `docker-compose.yml` is the *production*
  stack and deliberately publishes no host port for Postgres, so it is not the
  source of 5433. If Prisma reports `P1001: Can't reach database server at
  localhost:5433`, Docker Desktop is not running — start it and the container
  restarts itself (`restart: unless-stopped`).
- **Resend rejects the seeded `@example.com` addresses.** With a real
  `RESEND_API_KEY` in `backend/.env`, every outbox notification to seed users fails
  with `422 validation_error — Invalid 'to' field`, and the worker retries each one
  up to eight times, flooding the log. Comment out `RESEND_API_KEY` for local work:
  outside production `sendEmail` then logs `[email:dev]` instead of sending
  (`backend/src/common/email.ts`). Production still refuses to start without it.
- **Every migration directory needs its `migration.sql`.** An empty directory under
  `backend/prisma/migrations/` aborts `prisma migrate deploy` with "Could not find
  the migration file at migration.sql", blocking every environment — including ones
  whose migrations would otherwise be up to date.
- **`api.staging.elpadell.com` and `api.elpadell.com` must stay DNS-only (grey).**
  Proxying `api.staging.…` breaks TLS — Cloudflare's free Universal SSL has no
  cert for that 3-level subdomain, so the frontend SSR throws
  `fetch failed / ssl/tls alert handshake failure (SSL alert 40)` and public
  pages show "A server error occurred". Fix: set it back to grey, then
  `resolvectl flush-caches` + `docker compose restart frontend` (DNS is cached).
- **Prod rollback to Vercel:** repoint `elpadell.com` + `www` DNS from
  `A 194.163.143.231` (proxied) back to `CNAME 6fad5b5de58a0f0a.vercel…` (grey).
  Traffic returns to Vercel within the TTL. The Vercel project is kept as a
  standby.
- **DNS is Cloudflare-managed** (account `D49512043@gmail.com`, free plan).
- The `worker` container always shows `unhealthy` — it reuses the API image's
  HTTP healthcheck but serves no HTTP. Cosmetic; the worker runs fine.
- Secrets live only in each stack's server-side `.env` (never in git).
