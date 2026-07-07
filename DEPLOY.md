# Production Deployment

This repository is a separated full-stack app:

- `frontend/`: Next.js UI, built as a standalone Node server.
- `backend/`: Express API, Prisma, PostgreSQL access, auth, Resend email, Google OAuth.
- `postgres`: PostgreSQL 16 container managed by Docker Compose.

No NestJS or Socket.IO/WebSocket server was detected. The Nginx config still includes `Upgrade`/`Connection` proxy headers because they are harmless and keep the proxy ready if WebSockets are added later.

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
- `JWT_SECRET`
- `ADMIN_EMAILS`

Optional values:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Example production domain setup:

```dotenv
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://api.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback
DATABASE_URL=postgresql://elpadel:YOUR_DB_PASSWORD@postgres:5432/elpadel?schema=public
```

Generate a strong `JWT_SECRET`:

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

## 5. Logs

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

## 6. Update After Git Pull

From the project directory:

```bash
cd /var/www/el-paddle
git pull
docker compose up -d --build
docker compose exec backend npm run prisma:migrate:deploy
docker compose ps
```

If only environment variables changed:

```bash
docker compose up -d --force-recreate
```

If `NEXT_PUBLIC_API_URL` changed, rebuild the frontend:

```bash
docker compose up -d --build frontend
```

## 7. Nginx Reverse Proxy

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

## 8. HTTPS With Certbot

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

## 9. Existing System PostgreSQL Alternative

The default production compose uses a PostgreSQL container with a named volume:

```yaml
el_paddle_postgres_data
```

If you intentionally want to use the VPS system-level PostgreSQL instead:

1. Remove or comment out the `postgres` service from `docker-compose.yml`.
2. Remove `backend.depends_on.postgres`.
3. Set `DATABASE_URL` in `.env` to the reachable PostgreSQL connection string.

On Linux, containers do not always have `host.docker.internal` by default, so using the bundled Postgres container is the simpler and more repeatable production setup.

## 10. Production Notes / TODOs

- Backend has a real health endpoint at `/health` and the backend Docker image uses it.
- Frontend healthcheck hits `/`.
- Docker images use Node 22 because this project uses Prisma 7.8, whose dependency tree expects Node 22+.
- No Socket.IO/WebSocket server was detected in the codebase.
- Resend is optional in code, but production email delivery requires `RESEND_API_KEY`.
- Gmail login is disabled unless `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` are configured.
- Keep `.env` out of Git.

## 11. Vercel Frontend-Only Deploy

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

For auth cookies, prefer deploying the frontend and API on sibling subdomains of the same parent domain, for example `app.example.com` and `api.example.com`. If the frontend remains on a `*.vercel.app` domain while the API is on another domain, browser cookie rules can block session cookies on API requests.
