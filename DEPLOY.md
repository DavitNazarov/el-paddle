# Production Deployment

## Legal launch gate

Before exposing registration publicly, set every `NEXT_PUBLIC_LEGAL_*` value in the frontend environment, especially the registered legal entity name, legal form, identification number, legal address, and working privacy/contact email. Confirm the event-specific fee, cancellation deadlines, media practices, age rules, and participation wording with Georgian counsel. The site deliberately displays a launch warning on legal pages while `NEXT_PUBLIC_LEGAL_ENTITY_ID` is unset.

Deploy the `20260717170000_legal_acceptance` migration before the application version that enforces legal acceptance. Keep the policy version constants aligned between `backend/src/common/legal.ts` and `frontend/src/lib/legal.ts` whenever a material policy update requires renewed acceptance.

This repository is a separated full-stack app:

- `frontend/`: Next.js UI, built as a standalone Node server.
- `backend/`: Express API, Prisma, PostgreSQL access, auth, Resend email, Google OAuth.
- `postgres`: PostgreSQL 16 container managed by Docker Compose.
- `worker`: PostgreSQL-backed transactional outbox processor for email delivery and scheduled expiry work.

The backend uses Socket.IO for committed tournament updates; the API process handles realtime outbox topics because it owns the Socket.IO server. The worker handles email outbox topics. The existing Nginx upgrade headers carry realtime connections without an additional public port.

## 1. Clone On The VPS

SSH into the Ubuntu 24.04 VPS:

```bash
ssh root@YOUR_SERVER_IP
```

Clone the repo:

```bash
mkdir -p /var/www
cd /var/www
git clone YOUR_REPO_URL el-paddle
cd el-paddle
```

## 2. Create Production Environment

Create the real `.env` from the example:

```bash
cp .env.example .env
nano .env
```

Required values:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `FRONTEND_URL`
- `BACKEND_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL` (canonical SEO origin; defaults to `https://elpadell.com` in Docker build if unset)
- `JWT_SECRET`
- `ADMIN_EMAILS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional values:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Bootstrap-only value:

- `FIRST_ADMIN_BOOTSTRAP_TOKEN` - set temporarily to create the first production admin, then remove it after the admin exists.

# Public URLs. Replace with your real domains.
# FRONTEND_URL accepts a comma-separated list; the first entry is used for email/OAuth redirects.
FRONTEND_URL=https://elpadell.com,https://www.elpadell.com
BACKEND_URL=https://api.elpadell.com
NEXT_PUBLIC_API_URL=https://api.elpadell.com
GOOGLE_REDIRECT_URI=https://api.elpadell.com/api/auth/google/callback
# Canonical public site origin for SEO (robots.txt Sitemap, sitemap.xml, Open Graph, canonical URLs).
# Prefer this over FRONTEND_URL when www and apex both appear in FRONTEND_URL.
NEXT_PUBLIC_SITE_URL=https://elpadell.com
POSTGRES_USER=elpadel_app
POSTGRES_PASSWORD=GENERATED_UNIQUE_PASSWORD
POSTGRES_DB=elpadel_prod
DATABASE_URL=postgresql://elpadel_app:GENERATED_UNIQUE_PASSWORD@postgres:5432/elpadel_prod?schema=public
```

Use a brand-new production database name, user, password, and Docker volume. Do not point production at a development, staging, demo, restored-from-local, or seeded database. The mock seed script is guarded and must not be run in production.

Generate a strong `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Generate a one-time first-admin bootstrap token:

```bash
openssl rand -base64 48
```

Important: `NEXT_PUBLIC_API_URL` is baked into the frontend image at build time. If you change it, rebuild the frontend image with `docker compose up -d --build frontend`.

## 3. Build And Start

Build and start the full Docker stack:

```bash
docker compose up -d --build
```

Check container status:

```bash
docker compose ps
```

Run the non-mutating production readiness check:

```bash
npm run readiness:check
```

The compose file publishes only localhost ports for Nginx:

- Frontend: `127.0.0.1:3000`
- Backend API: `127.0.0.1:4000`

Backend health endpoint:

```bash
curl http://127.0.0.1:4000/health
```

## 4. Run Prisma Migrations

Run migrations after the containers are up:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

Migration strategy note:

- This project uses a manual migration command.
- This is safer than running migrations automatically in the container entrypoint because every restart or every future scaled backend replica would try to run migrations.
- The tradeoff is that deployers must remember to run `prisma:migrate:deploy` after pulling code that includes new Prisma migrations.
- The production backend image does not include TypeScript dev tooling, so the local `db:seed` script is not intended to run inside the production container.
- Verify both `backend` and `worker` are healthy/running after each migration. Failed email deliveries remain retryable through the admin delivery API.

## 5. Create The First Admin

Use this only while the production database has no admin users. The endpoint requires `FIRST_ADMIN_BOOTSTRAP_TOKEN` and returns `409` after the first admin exists.

```bash
CSRF_TOKEN=$(curl -s -c /tmp/elpadel-cookies "$BACKEND_URL/api/auth/csrf" | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -b /tmp/elpadel-cookies -X POST "$BACKEND_URL/api/admin/bootstrap" \
  -H "content-type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "x-bootstrap-token: YOUR_FIRST_ADMIN_BOOTSTRAP_TOKEN" \
  -d '{
    "email": "you@example.com",
    "name": "Your",
    "surname": "Name",
    "password": "Use-a-long-unique-password"
  }'
```

After it succeeds, remove `FIRST_ADMIN_BOOTSTRAP_TOKEN` from `.env` and recreate the backend container:

```bash
docker compose up -d --force-recreate backend
```

## 6. Logs

Tail all logs:

```bash
docker compose logs -f
```

Tail backend logs:

```bash
docker compose logs -f backend
```

Tail frontend logs:

```bash
docker compose logs -f frontend
```

Tail Postgres logs:

```bash
docker compose logs -f postgres
```

## 7. Update After Git Pull

From the project directory:

```bash
cd /var/www/el-paddle
git pull
docker compose up -d --build
docker compose exec backend npm run prisma:migrate:deploy
docker compose ps
```

Take a database backup before every production migration:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/elpadel-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

If only environment variables changed:

```bash
docker compose up -d --force-recreate
```

If `NEXT_PUBLIC_API_URL` changed, rebuild the frontend:

```bash
docker compose up -d --build frontend
```

## 8. Nginx Reverse Proxy

The provided config is:

```bash
deploy/nginx.conf
```

It proxies:

- `app.example.com` -> `127.0.0.1:3000` -> frontend container
- `api.example.com` -> `127.0.0.1:4000` -> backend container

Copy and edit it:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/el-paddle
sudo nano /etc/nginx/sites-available/el-paddle
```

Replace:

- `app.example.com`
- `api.example.com`

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/el-paddle /etc/nginx/sites-enabled/el-paddle
```

If the certificates already exist, test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS With Certbot

Point DNS records to the VPS first:

- `app.example.com` A record -> VPS IP
- `api.example.com` A record -> VPS IP

Install Certbot if it is not already installed:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

First-time certificate setup matching the provided config's separate certificate paths:

```bash
sudo certbot --nginx -d app.example.com
sudo certbot --nginx -d api.example.com
```

Certbot can create or update SSL server blocks automatically. If you prefer one shared certificate for both domains, run `sudo certbot --nginx -d app.example.com -d api.example.com` and then point both HTTPS server blocks at the same generated `/etc/letsencrypt/live/...` certificate directory.

If you use the provided `deploy/nginx.conf` before certificates exist, the `ssl_certificate` paths will not exist yet and `nginx -t` will fail. In that case, either:

- run `certbot --nginx` against a temporary HTTP-only server block first, then copy the provided config, or
- comment out the HTTPS server blocks until Certbot has created certificates.

Renewal check:

```bash
sudo certbot renew --dry-run
```

## 10. Backups And Restore Drills

Create a compressed custom-format backup:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/elpadel-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Restore into a new database name first, never over the live database as a first step:

```bash
docker compose exec -T postgres createdb -U "$POSTGRES_USER" elpadel_restore_check
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d elpadel_restore_check --clean --if-exists < backups/YOUR_BACKUP.dump
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d elpadel_restore_check -c 'select count(*) from "User";'
```

Run a restore drill before launch and after every material schema change. Record the backup file, restore timestamp, command output, and operator in your ops log.

## 11. Existing System PostgreSQL Alternative

The default production compose uses a PostgreSQL container with a named volume:

```yaml
el_paddle_postgres_data
```

If you intentionally want to use the VPS system-level PostgreSQL instead:

1. Remove or comment out the `postgres` service from `docker-compose.yml`.
2. Remove `backend.depends_on.postgres`.
3. Set `DATABASE_URL` in `.env` to the reachable PostgreSQL connection string.

On Linux, containers do not always have `host.docker.internal` by default, so using the bundled Postgres container is the simpler and more repeatable production setup.

## 12. Production Notes / TODOs

- Backend has a real health endpoint at `/health` and the backend Docker image uses it.
- Frontend healthcheck hits `/`.
- Docker images use Node 22 because this project uses Prisma 7.8, whose dependency tree expects Node 22+.
- Socket.IO runs in the backend API process. Keep `RUN_OUTBOX_IN_API=true` in production so realtime outbox topics are emitted by the process with the live Socket.IO server.
- `RESEND_API_KEY` is required in production (`NODE_ENV=production`). Without it, auth emails fail closed (no console fallback that could mark users verified without delivery).
- After bootstrapping the first admin, remove `FIRST_ADMIN_BOOTSTRAP_TOKEN` from `.env` and recreate the backend container. In production the backend **refuses to start** if the token is still set while an admin already exists.
- Production account creation passwords must be at least 12 characters and no more than 72 UTF-8 bytes.
- Logout bumps `User.sessionVersion`, which invalidates outstanding JWTs for that account (stolen cookies stop working after logout).
- Security-relevant actions emit structured `[audit]` JSON lines to stdout (login success/failure, logout, bootstrap, disqualify, account delete).
- Gmail login is disabled unless `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` are configured.
- Keep `.env` out of Git.
- Nginx config in `deploy/nginx.conf` rate-limits `/api/auth/login`, `/register`, `/verify`, and `/api/admin/bootstrap`. The Express app also applies in-process limits.
- Postgres is not published on the host in `docker-compose.yml` (backend-only network access).
- CI runs lint, tests, build, and `npm audit --audit-level=high` on pull requests. Locally: `npm run lint && npm test && npm run build && npm run audit`.
- Known moderate advisories in transitive `next`/`postcss` and `prisma`/`@hono/node-server` currently require major downgrades or unreleased upgrades — do **not** run `npm audit fix --force`. Re-check after Next 16.3+ / Prisma 7.9+ land.

## 13. Vercel Frontend-Only Deploy

The backend is not a Vercel serverless app; it is an Express API intended to run from the Docker/VPS setup above.

Set the Vercel project Root Directory to:

```bash
frontend
```

With that root directory, Vercel is already inside the frontend package. `vercel.json` uses frontend-local commands:

```bash
npm ci
npm run build
```

Set this Vercel environment variable:

```dotenv
NEXT_PUBLIC_API_URL=https://api.example.com
```

For auth cookies, deploy the frontend and API on sibling hosts of the same parent domain, for example `elpadell.com` and `api.elpadell.com`. The backend then sets `Domain=.elpadell.com` (auto-derived, or override with `COOKIE_DOMAIN`) so Next.js SSR on the site origin can read the session cookie. If the frontend remains on a `*.vercel.app` domain while the API is on another domain, browser cookie rules can block session cookies on API requests.
