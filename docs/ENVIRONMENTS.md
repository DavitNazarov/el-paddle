# Environments & Deployment Workflow

Production is **Render**, in Frankfurt, from [`render.yaml`](../render.yaml). The app is already aimed at the production domains. Adding them in the Render dashboard, and creating the DNS records Render shows, is what connects the site.

| Render service | Serves | Domain you add |
| --- | --- | --- |
| `elpadel-web` | Next.js | `elpadell.com`, `www.elpadell.com` (www redirects to the apex) |
| `elpadel-api` | Express + Socket.IO | `api.elpadell.com` |
| `elpadel-worker` | Email outbox | none |
| `elpadel-db` | Postgres 16, private | none |

`www` and the API share `.elpadell.com` with the apex, so the session cookie set by the API is sent on site requests, server-rendered fetches, CSV downloads, and Socket.IO. The `*.onrender.com` hostnames stay Render's defaults and are not a login origin.

Leave Cloudflare DNS-only if the zone is still there. An orange-cloud proxy hides the visitor address and presents a different certificate than Render's.

## Deployment workflow

**Changes reach production by merging to `main`.** Render auto-deploys that branch. Do not edit code or env on a server by hand.

1. Develop locally. Author any Prisma migration locally (`prisma migrate dev`); migration files are committed and travel with the branch.
2. Merge to `main`.
3. Render builds `elpadel-web`, `elpadel-api`, and `elpadel-worker`. The API and the worker run `prisma migrate deploy` before the new release starts.
4. Verify at `https://elpadell.com`. `GET https://api.elpadell.com/health/ready` is the deploy check (database plus outbox). `/health` only means the process is up.

The API stays at **one instance**. A second copy would split Socket.IO with no shared adapter.

`NEXT_PUBLIC_API_URL` is `https://api.elpadell.com` at image build. Changing it, or any `NEXT_PUBLIC_LEGAL_*` value, means redeploying `elpadel-web`.

There is no second hosted environment in this blueprint. The old staging stack is retired with the VPS below.

## Seeding

`backend/prisma/seed.ts` builds fixtures (categories, athletes, judges, and events across lifecycle statuses). It is **guarded against production** (`NODE_ENV=production` refuses; requires `ALLOW_DEVELOPMENT_SEED=true`). Do not point it at `elpadel-db`.

### Seeding a local development database

```bash
cd backend && ALLOW_DEVELOPMENT_SEED=true npx tsx prisma/seed.ts
```

The seed resets every user's win/loss tallies and rebuilds its own `seed_event_*` rows, so hand-made local fixtures under other ids survive but player statistics do not. Apply migrations first — the seed writes set columns that only exist after `20260727120000_slot_scoring` (which introduced them, under their original slot names) and `20260805120000_rename_slot_to_set` (which renamed them in place).

Logins after seeding: `admin@example.com`, `judge1..5@example.com`, `athlete001..154@example.com` — all password `Password123!`. The athlete pool is 154 players in 77 clubs, two players per club (owner + teammate). Events draw distinct clubs from that pool.

Completed and in-progress fixtures are scored in sets: quarterfinals race to one set win, semifinals to two, finals to three.

## Local gotchas

- **The local development database is a Docker container.** `el-padel-postgres-dev` (`postgres:16-alpine`) publishes `5433:5432`, which is what `backend/.env`'s `DATABASE_URL` points at. The repository `docker-compose.yml` is the retired VPS stack and deliberately publishes no host port for Postgres, so it is not the source of 5433. If Prisma reports `P1001: Can't reach database server at localhost:5433`, Docker Desktop is not running — start it and the container restarts itself (`restart: unless-stopped`).
- **Resend rejects the seeded `@example.com` addresses.** With a real `RESEND_API_KEY` in `backend/.env`, every outbox notification to seed users fails with `422 validation_error — Invalid 'to' field`, and the worker retries each one up to eight times. Comment out `RESEND_API_KEY` for local work: outside production `sendEmail` then logs `[email:dev]` instead of sending (`backend/src/common/email.ts`). Production still refuses to start without it.
- **Every migration directory needs its `migration.sql`.** An empty directory under `backend/prisma/migrations/` aborts `prisma migrate deploy` with "Could not find the migration file at migration.sql", which blocks the Render pre-deploy.

## Retired: Contabo VPS

Not the host. Kept so traffic can be pointed back.

- One server, `194.163.143.231`, two compose projects: production `/root/el-paddle` (`main`, ports 3000 and 4000) and staging `/root/el-paddle-staging` (`develop`, ports 3100 and 4100), each with its own Postgres volume.
- Cloudflare proxied the site hostnames and left `api.elpadell.com` and `api.staging.elpadell.com` DNS-only, because the free Universal SSL cert did not cover the three-level staging API name.
- Staging sat behind Cloudflare Access. Promotion was `develop` → staging verify → merge `main` → production compose rebuild, with `prisma migrate deploy` run by hand and a `pg_dump` taken first.
- Rollback of the site alone, from the even older Vercel host, was a DNS change back to the Vercel CNAME. That project is not the current recovery path. Recovery is the compose stacks on `194.163.143.231`, or a Render database restore.

`docker-compose.yml` still describes that VPS stack and still builds the images Render uses.
