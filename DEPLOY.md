# Production Deployment

Production is Render, declared in `render.yaml`. The site and the API are already aimed at the domains you add in the dashboard:

- `https://elpadell.com` and `https://www.elpadell.com` on the `elpadel-web` service (`www` redirects to the apex)
- `https://api.elpadell.com` on the `elpadel-api` service

Login, live scoring, server-rendered pages, CSV downloads, and email links all use that API host. Nothing else has to be pointed at the domain after DNS resolves. The `*.onrender.com` hostnames are Render's defaults, not the app origin, and will not share a login cookie.

## Legal launch gate

Before exposing registration publicly, set every `NEXT_PUBLIC_LEGAL_*` value on `elpadel-web`, especially the registered legal entity name, legal form, identification number, legal address, and working privacy/contact email. Those values are baked into the frontend image, so save them and redeploy `elpadel-web` once. Confirm the event-specific fee, cancellation deadlines, media practices, age rules, and participation wording with Georgian counsel. The site displays a launch warning on legal pages while `NEXT_PUBLIC_LEGAL_ENTITY_ID` is unset.

Keep the policy version constants aligned between `backend/src/common/legal.ts` and `frontend/src/lib/legal.ts` whenever a material policy update requires renewed acceptance.

## What Render runs

| Service | Kind | Role |
| --- | --- | --- |
| `elpadel-web` | Web | Next.js. Health check `/`. |
| `elpadel-api` | Web | Express, Prisma, Socket.IO. Health check `/health`. One instance. |
| `elpadel-worker` | Worker | Email outbox. No public port. |
| `elpadel-db` | Postgres 16 | Private network only. Frankfurt. |

All four are in Frankfurt so the API and worker use the internal database URL. The API stays at one instance: Socket.IO lives in that process, and Render does not pin a browser to one instance.

`elpadel-api` delivers realtime outbox topics (`RUN_OUTBOX_IN_API=true`). `elpadel-worker` delivers email. Both run `npm run prisma:migrate:deploy` before the new instance starts.

## 1. Apply the blueprint

In the Render dashboard, create a **Blueprint** from this repository's `main` branch. Render reads `render.yaml` and creates the web, API, worker, and database as Docker services.

Do not use **New Web Service** on the repo. That builds with Node (`npm install; npm run build`) from the repository root, which is one process and is not this app. A log line `Using Node.js version` means that service was created the wrong way. Delete it and create the Blueprint instead.

Fill the secrets it asks for:

- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` — required. Production refuses to start without the API key, so account email cannot pretend to send.
- `ADMIN_EMAILS`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — leave blank to keep Gmail login disabled.
- `FIRST_ADMIN_BOOTSTRAP_TOKEN` — set only for the first admin, then delete it. Generate with `openssl rand -base64 48`. Production refuses to start if it is still set after an admin exists.
- `JWT_SECRET` is generated once by the blueprint. Do not rotate it casually; existing sessions would stop verifying.

`NEXT_PUBLIC_LEGAL_*` on `elpadel-web` can be filled now or after the first boot. Empty values keep the in-code fallbacks, and an empty identification number leaves the launch warning up.

Do not run the mock seed against this database.

## 2. Add the domains

On `elpadel-web`, add `elpadell.com` and `www.elpadell.com`. On `elpadel-api`, add `api.elpadell.com`. Create the DNS records Render displays for each name.

If Cloudflare still holds the zone, leave the records DNS-only (grey). An orange-cloud proxy would present Cloudflare's certificate and hide the visitor address from the API's rate limits and audit log. Render terminates TLS itself.

No environment change and no rebuild follows this step. The blueprint already set:

- `FRONTEND_URL=https://elpadell.com,https://www.elpadell.com`
- `BACKEND_URL=https://api.elpadell.com`
- `NEXT_PUBLIC_API_URL=https://api.elpadell.com`
- `NEXT_PUBLIC_SITE_URL=https://elpadell.com`
- `GOOGLE_REDIRECT_URI=https://api.elpadell.com/api/auth/google/callback`

The cookie domain is derived as `.elpadell.com`. Do not set `COOKIE_DOMAIN`.

Gmail login also needs that callback URL added in Google Cloud. Password login does not.

## 3. First admin

Use this only while the database has no admin. The endpoint returns `409` after one exists.

```bash
CSRF_TOKEN=$(curl -s -c /tmp/elpadel-cookies "https://api.elpadell.com/api/auth/csrf" | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -b /tmp/elpadel-cookies -X POST "https://api.elpadell.com/api/admin/bootstrap" \
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

Then delete `FIRST_ADMIN_BOOTSTRAP_TOKEN` from the `elpadel-secrets` group and redeploy `elpadel-api`.

## 4. Deploys after this

A push to `main` deploys the three services. Migrations run before the API and the worker start serving the new release. Confirm with `GET https://api.elpadell.com/health/ready` (database reachable, outbox backlog). `/health` only means the process is up; Render uses it so a database blip does not restart the API. `GET /api/meta/version` reports the running version and commit when `APP_VERSION` and `GIT_COMMIT` are set.

Changing `NEXT_PUBLIC_API_URL` or any `NEXT_PUBLIC_LEGAL_*` value requires a redeploy of `elpadel-web`, because Next inlines them at image build. Changing the API's runtime env only needs an API redeploy.

## Backups

Render keeps backups of `elpadel-db`. Restore from the Render database dashboard, into a new database first. The old host's `scripts/backup-offsite.sh` cron does not run here.

## Retired: Contabo VPS

This is not the deploy path. It is the previous host, kept so DNS can be pointed back.

- Server `194.163.143.231`. Production compose project `el_paddle` in `/root/el-paddle` (branch `main`). Staging compose project `elpadel_staging` in `/root/el-paddle-staging` (branch `develop`).
- Nginx on the host proxied `elpadell.com` to `127.0.0.1:3000` and `api.elpadell.com` to `127.0.0.1:4000`. Config template: `deploy/nginx.conf`. TLS was a Cloudflare origin cert for the site and Let's Encrypt for the API. The API records were DNS-only.
- Update was `git pull`, `docker compose up -d --build`, then `docker compose exec backend npm run prisma:migrate:deploy`.
- `docker-compose.yml` in this repo still builds that stack. Render builds the same Dockerfiles.

To roll traffic back, point `elpadell.com`, `www`, and `api.elpadell.com` at `194.163.143.231` again and confirm the compose stacks there are the release you want. Take a fresh database backup before any such cut.
