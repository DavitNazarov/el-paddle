# El Padel backend on Raspberry Pi 4

Runbook for hosting **postgres + migrate + api + worker** on a single Pi 4
(~1.8 GiB RAM, SD card), exposed through **Cloudflare Tunnel**. The frontend
stays on Vercel. This hostname is a **separate staging API**
(`<PI_API_HOSTNAME>`); cutover from Render is a manual step you do later.

Everything here is under `deploy/raspberry-pi/`. Do not edit `render.yaml`,
the root `docker-compose.yml`, or `frontend/` for this path.

---

## 0. Prerequisites (your Mac / GitHub)

### Build arm64 images (no builds on the Pi)

**CI (preferred):** push to `main` (paths under `backend/**`) or run the
`Backend arm64 image` workflow. It pushes:

```text
ghcr.io/davitnazarov/elpadel-backend:<git-sha>
```

**Local (Apple Silicon, native arm64):**

```bash
cd /path/to/el-paddle
SHA=$(git rev-parse HEAD)
docker buildx build --platform linux/arm64 \
  -f backend/Dockerfile \
  -t "ghcr.io/davitnazarov/elpadel-backend:${SHA}" \
  --load .
# Optional push (requires docker login ghcr.io):
# docker push "ghcr.io/davitnazarov/elpadel-backend:${SHA}"
```

Expected: build completes; `docker images` shows the tag. Report image size
with `docker image inspect … --format '{{.Size}}'`.

The repo is public. GHCR packages may be public **if no secrets are in the
image** (`.dockerignore` excludes `.env*`). To keep the package private, create
a PAT with `read:packages` only and on the Pi:

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### Cloudflare Tunnel (dashboard, once)

1. Zero Trust → Networks → Tunnels → Create → **Cloudflared** → Docker.
2. Copy the **tunnel token** into `.env` as `TUNNEL_TOKEN` (never commit it).
3. Public hostname: `<PI_API_HOSTNAME>` → service `http://api:4000`
   (compose DNS name `api` on the Docker network).
4. Ensure the zone has **WebSockets** enabled (default on current Cloudflare
   zones). Socket.IO uses WebSocket + polling; both must work through the tunnel.

### Hostname / cookies

`<PI_API_HOSTNAME>` must share the **same registrable domain** as the Vercel
frontend (e.g. `api-pi.elpadell.com` + `elpadell.com`) so session cookies with
`SameSite=Lax` and an optional shared `COOKIE_DOMAIN` work. List every browser
origin in `FRONTEND_URL`.

---

## 1. First-time setup on the Pi

SSH in over **Tailscale** (or LAN). Expected: shell as your user.

```bash
# Copy the repo (or at least deploy/raspberry-pi) onto the Pi, e.g.:
sudo mkdir -p /srv/elpadel/app
sudo chown "$USER:$USER" /srv/elpadel/app
# From your Mac:
#   rsync -a deploy/raspberry-pi/ pi@100.x.y.z:/srv/elpadel/app/deploy/raspberry-pi/
```

Run bootstrap (installs Docker from Docker’s Debian bookworm arm64 apt repo,
2G swap, swappiness=10, NTP, unattended-upgrades, dirs, ufw):

```bash
cd /srv/elpadel/app/deploy/raspberry-pi
sudo ./scripts/bootstrap-pi.sh
```

Expected output (abridged):

```text
… Installing base packages
… Raising dphys-swapfile CONF_SWAPSIZE to 2048   # or /swapfile path
… Setting vm.swappiness=10
… Installing Docker Engine + compose plugin …
… Adding <user> to docker group
… Creating /srv/elpadel/{pgdata,backups,state}
… Configuring ufw …
… Bootstrap complete.
```

Then **log out and back in** (or `newgrp docker`) so `docker` works without sudo.

```bash
docker version
free -h
swapon --show
timedatectl status
```

Expected: Client/Server version printed; swap ~2G; NTP synchronized.

Install systemd backup timer:

```bash
sudo cp systemd/elpadel-backup.service systemd/elpadel-backup.timer /etc/systemd/system/
# Edit WorkingDirectory/User in the .service if your paths differ
sudo systemctl daemon-reload
sudo systemctl enable --now elpadel-backup.timer
systemctl list-timers | grep elpadel
```

Expected: `elpadel-backup.timer` listed with a next run time.

---

## 2. Create `.env` (secrets on the Pi only)

```bash
cd /srv/elpadel/app/deploy/raspberry-pi
cp .env.pi.example .env
chmod 600 .env
```

Generate secrets (paste into `.env`; do not log them):

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD (and matching DATABASE_URL password)
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # FIRST_ADMIN_BOOTSTRAP_TOKEN (first boot only)
```

Fill at least:

| Variable | Notes |
|----------|--------|
| `IMAGE_TAG` | Git SHA of a pushed arm64 image |
| `POSTGRES_*` / `DATABASE_URL` | Same random password; host `postgres` |
| `FRONTEND_URL` | Vercel origins, `https://…` |
| `BACKEND_URL` | `https://<PI_API_HOSTNAME>` |
| `JWT_SECRET` | ≥32 chars |
| `RESEND_API_KEY` | Required in production |
| `TUNNEL_TOKEN` | From Cloudflare |
| `PG_DATA_DIR` | Default `/srv/elpadel/pgdata` |

**Never** use the local-dev password `elpadel:elpadel`. **Never** run
`npm run db:seed` against this database (known seed passwords; refused in
production anyway).

Validate compose:

```bash
docker compose -f docker-compose.pi.yml config >/dev/null && echo OK
```

Expected: `OK`

---

## 3. First deploy

```bash
cd /srv/elpadel/app/deploy/raspberry-pi
./scripts/deploy.sh YOUR_GIT_SHA
```

Expected (abridged):

```text
… Deploying IMAGE_TAG=…
… Pulling images
… Postgres not running yet; skipping pre-migrate dump (first deploy).
… Ensuring postgres is up
… Recreating api and worker
… Deploy succeeded. last-good=…
```

Check:

```bash
docker compose -f docker-compose.pi.yml ps
./scripts/healthcheck.sh
```

Expected: `postgres`, `api`, `worker`, `cloudflared` running; `healthcheck OK`.

Public check (from any machine):

```bash
curl -fsS "https://<PI_API_HOSTNAME>/health"
curl -fsS "https://<PI_API_HOSTNAME>/health/ready"
```

Expected: `{"ok":true}` and a readiness JSON with `"database":{"ok":true,…}`.

---

## 4. Create the first admin (existing bootstrap flow)

Only while no admin exists. Production **exits on boot** if
`FIRST_ADMIN_BOOTSTRAP_TOKEN` remains set after an admin exists.

```bash
CSRF_TOKEN=$(curl -s -c /tmp/elpadel-pi-cookies \
  -H "Origin: https://elpadell.com" \
  "https://<PI_API_HOSTNAME>/api/auth/csrf" \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -b /tmp/elpadel-pi-cookies \
  -X POST "https://<PI_API_HOSTNAME>/api/admin/bootstrap" \
  -H "content-type: application/json" \
  -H "Origin: https://elpadell.com" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "x-bootstrap-token: YOUR_FIRST_ADMIN_BOOTSTRAP_TOKEN" \
  -d '{
    "email": "you@example.com",
    "name": "Your",
    "surname": "Name",
    "password": "Use-a-long-unique-password"
  }'
```

Expected: `201` / admin payload (not `401`/`403`). Then:

1. Remove `FIRST_ADMIN_BOOTSTRAP_TOKEN` from `.env`.
2. `docker compose -f docker-compose.pi.yml up -d --force-recreate api`

---

## 5. Updating

```bash
./scripts/deploy.sh NEW_GIT_SHA
```

This pulls the image, runs a **pre-migration `pg_dump`**, runs `migrate`,
recreates `api`/`worker`, waits for `/health/ready`, and **rolls back to the
previous tag** if readiness fails. Last-good tag:
`/srv/elpadel/state/last-good-image-tag`.

---

## 6. Rollback

Automatic on failed deploy. Manual:

```bash
./scripts/deploy.sh "$(cat /srv/elpadel/state/last-good-image-tag)"
# or an older known-good SHA
./scripts/deploy.sh OLD_GIT_SHA
```

---

## 7. Backup and tested restore

### Backup now

```bash
./scripts/backup.sh
ls -la /srv/elpadel/backups/daily/
```

Expected: a new `elpadel-*.dump` file; optional warning if `BACKUP_OFFSITE_CMD`
is unset (set it — same-SD backups are not disaster recovery).

### Restore test (destructive to the current DB)

Prefer a throwaway machine or accept downtime. Take a fresh backup first.

```bash
./scripts/backup.sh
./scripts/restore.sh --i-understand-this-overwrites-the-database \
  /srv/elpadel/backups/daily/elpadel-TIMESTAMP.dump
./scripts/healthcheck.sh
```

Without the confirmation flag the script **refuses** to run.

---

## 8. Move Postgres to a USB SSD

1. Stop the stack:

```bash
cd /srv/elpadel/app/deploy/raspberry-pi
docker compose -f docker-compose.pi.yml stop
```

2. Mount the SSD (example `/mnt/ssd`), create the data dir:

```bash
sudo mkdir -p /mnt/ssd/elpadel/pgdata
sudo rsync -aHAX --info=progress2 /srv/elpadel/pgdata/ /mnt/ssd/elpadel/pgdata/
```

3. Point `.env` at the new path:

```bash
# PG_DATA_DIR=/mnt/ssd/elpadel/pgdata
```

4. Start again and verify:

```bash
docker compose -f docker-compose.pi.yml up -d
./scripts/healthcheck.sh
```

5. Only after verification, remove or archive the old SD copy.

---

## 9. Private admin path (Tailscale)

- SSH: Tailscale IP only (ufw allows `100.64.0.0/10` and LAN for port 22).
- Inspect DB **without publishing 5432**:

```bash
docker compose -f docker-compose.pi.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

- Never publish Postgres or the API on the host. Docker-published ports bypass
  ufw — that is why this compose file publishes none.

---

## 10. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| OOM / killed containers | `dmesg \| grep -i kill`; `docker stats`; raise swap already at 2G; lower load; consider USB SSD + slightly higher Postgres `effective_cache_size` only after measuring |
| Throttling | `vcgencmd get_throttled` should stay `throttled=0x0`; improve cooling / PSU |
| Tunnel down | `docker compose … logs cloudflared`; confirm `TUNNEL_TOKEN`; Cloudflare dashboard tunnel status |
| Migration failure | Pre-migrate dump under `/srv/elpadel/backups/`; `docker compose … logs migrate`; fix forward migration or roll back image tag |
| API up but DB not | `curl …/health` vs `/health/ready`; postgres health; `DATABASE_URL` password match |
| Cookies / login from Vercel | Shared registrable domain; `FRONTEND_URL` includes the site origin; HTTPS `BACKEND_URL`; CSRF Origin header |
| Socket.IO fails | Cloudflare WebSockets on; tunnel service `http://api:4000`; browser Origin allowed |
| After reboot | `docker compose … ps` — `restart: unless-stopped` should bring services back; re-check tunnel |

---

## 11. Memory budget (reference)

| Component | mem_limit |
|-----------|-----------|
| OS + Docker + Tailscale | ~400 MB (host) |
| postgres | 384 MB |
| api | 320 MB (`NODE_OPTIONS=--max-old-space-size=192`) |
| worker | 192 MB (`--max-old-space-size=128`) |
| cloudflared | 96 MB |

Keep API and worker as **separate** processes (production realtime vs email
split). Do not run `npm ci` / `tsc` on the Pi.

---

## 12. Frontend reminder

`NEXT_PUBLIC_API_URL` is compiled into the Vercel bundle. Pointing production
(or a staging frontend) at the Pi requires a **frontend rebuild/redeploy**.
This runbook does not change the frontend.
