# Production Deployment

Production is split:

| Piece | Host | Domain |
| --- | --- | --- |
| Next.js site | Cloudflare Workers (OpenNext) | `elpadell.com`, `www.elpadell.com` |
| Express + Socket.IO + outbox worker + Postgres | Raspberry Pi + Cloudflare Tunnel | API hostname on the same registrable domain (e.g. `api.elpadell.com`) |

Frontend wiring: [`docs/CLOUDFLARE_FRONTEND.md`](docs/CLOUDFLARE_FRONTEND.md).  
Pi runbook: [`deploy/raspberry-pi/RASPBERRY_PI.md`](deploy/raspberry-pi/RASPBERRY_PI.md).

Login, live scoring, server-rendered pages, CSV downloads, and email links all use the API host. The Worker and the tunnel hostname must share `.elpadell.com` so session cookies work.

## Legal launch gate

Before exposing registration publicly, set every `NEXT_PUBLIC_LEGAL_*` value on the Cloudflare Worker build, especially the registered legal entity name, legal form, identification number, legal address, and working privacy/contact email. Those values are baked in at build time, so save them and redeploy the Worker once. Confirm the event-specific fee, cancellation deadlines, media practices, age rules, and participation wording with Georgian counsel. The site displays a launch warning on legal pages while `NEXT_PUBLIC_LEGAL_ENTITY_ID` is unset.

Keep the policy version constants aligned between `backend/src/common/legal.ts` and `frontend/src/lib/legal.ts` whenever a material policy update requires renewed acceptance.

## What runs where

| Service | Role |
| --- | --- |
| Cloudflare Worker `el-paddle` | Next.js via OpenNext. Build with `npm run cf-build --workspace frontend`. |
| Pi `api` | Express, Prisma, Socket.IO. Health check `/health`. One instance. |
| Pi `worker` | Email outbox (or outbox in API if configured). |
| Pi `postgres` | Postgres 16 on the Pi compose network. |

The API stays at one instance: Socket.IO lives in that process.

On the Pi, set:

- `FRONTEND_URL=https://elpadell.com,https://www.elpadell.com`
- `BACKEND_URL` / `GOOGLE_REDIRECT_URI` to the tunnel API hostname
- `NEXT_PUBLIC_API_URL=https://api-pi.elpadell.com` on the Worker **build** variables (origin only, no `/api` suffix)

The cookie domain is derived as `.elpadell.com`. Do not set `COOKIE_DOMAIN` unless you know you need it.

## Frontend deploys (Cloudflare)

1. Connect the Git repo to a Cloudflare Workers project.
2. Use the build/deploy commands in [`docs/CLOUDFLARE_FRONTEND.md`](docs/CLOUDFLARE_FRONTEND.md) — never bare `npx wrangler deploy` without OpenNext config.
3. Set `NEXT_PUBLIC_*` build env vars, including the Pi API URL.
4. Attach `elpadell.com` and `www.elpadell.com` to the Worker.

Local deploy (after `wrangler login` or with `CLOUDFLARE_API_TOKEN`):

```bash
npm run cf:deploy
```

## API deploys (Pi)

Follow the Pi runbook: build/push the arm64 backend image, update the tag on the Pi, `docker compose up -d`, migrations via the migrate service. Confirm with `GET https://<API_HOST>/health/ready`.

## First admin

Use this only while the database has no admin. The endpoint returns `409` after one exists.

```bash
CSRF_TOKEN=$(curl -s -c /tmp/elpadel-cookies "https://<API_HOST>/api/auth/csrf" | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -b /tmp/elpadel-cookies -X POST "https://<API_HOST>/api/admin/bootstrap" \
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

Then remove `FIRST_ADMIN_BOOTSTRAP_TOKEN` from the Pi env and recreate the API container. Production refuses to start if that token remains set after an admin exists.

## Retired: Render

`render.yaml` and the Render Docker frontend path are no longer the production host. Prefer Cloudflare Workers + Pi. The Dockerfiles remain useful for the Pi backend image and for an emergency frontend container.

## Retired: Contabo VPS

Previous host, kept only so DNS can be pointed back if needed. Server `194.163.143.231`. See git history of this file for the old compose/nginx notes.
