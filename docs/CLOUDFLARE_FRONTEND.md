# Frontend on Cloudflare Workers

The Next.js site runs on **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). The API, worker, and Postgres stay on the Raspberry Pi behind Cloudflare Tunnel — see [`deploy/raspberry-pi/RASPBERRY_PI.md`](../deploy/raspberry-pi/RASPBERRY_PI.md).

Worker name: `el-paddle` (`frontend/wrangler.jsonc`).

## Cloudflare dashboard (Workers Builds)

Use these settings so CI does **not** run interactive `wrangler` / OpenNext migrate:

| Setting | Value |
| --- | --- |
| Root directory | repository root (empty / `.`) |
| Install command | `npm ci` |
| Build command | `npm run cf-build --workspace frontend` |
| Deploy command | `cd frontend && npx wrangler deploy` |

Do **not** set deploy to bare `npx wrangler deploy` from the repo root without a prior OpenNext build and without `frontend/wrangler.jsonc` on the path Wrangler reads. That path triggers migrate and hangs in non-interactive CI.

### Environment variables (build)

Set these under **Workers Builds → Build variables and secrets** (not only runtime Variables & Secrets). `NEXT_PUBLIC_*` are inlined during `next build`; a runtime-only value will not fix browser CSRF/login calls.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api-pi.elpadell.com` (**origin only** — no trailing `/api`) |
| `NEXT_PUBLIC_SITE_URL` | `https://elpadell.com` |
| `NEXT_PUBLIC_LEGAL_*` | legal launch gate values |

Request paths already start with `/api/...` (e.g. `/api/auth/csrf`). If you set `…/api` on `NEXT_PUBLIC_API_URL`, the client strips that suffix, but prefer the origin form above.

After changing any of these, **redeploy** the Worker. A missing `NEXT_PUBLIC_API_URL` fails the production build on purpose so localhost is never baked into production again.

### Custom domains

Attach `elpadell.com` and `www.elpadell.com` to the Worker. Keep the API hostname on the tunnel (separate Worker/hostname for the Pi).

## Local commands

From the repo root:

```bash
npm run cf:build          # OpenNext adapt → frontend/.open-next
npm run cf:deploy         # build + deploy (needs `wrangler login` or API token)
```

From `frontend/`:

```bash
npm run cf-build
npm run preview           # Workers runtime locally
npm run deploy
```

Normal `npm run dev` still uses the Node Next.js server. `initOpenNextCloudflareForDev` in `next.config.ts` only wires bindings for local Cloudflare-aware work.

## Pi / cookie notes

`FRONTEND_URL` on the API must list every browser origin that serves the site (apex and `www`). The API hostname must share the registrable domain with the Worker so session cookies work.
