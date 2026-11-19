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

Set on the Worker / build, same names as before:

- `NEXT_PUBLIC_API_URL` — Pi tunnel hostname, e.g. `https://api.elpadell.com`
- `NEXT_PUBLIC_SITE_URL` — `https://elpadell.com`
- `NEXT_PUBLIC_LEGAL_*` — legal launch gate values

`NEXT_PUBLIC_*` are inlined at build time; changing them requires a redeploy.

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
