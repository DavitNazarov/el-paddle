# El Padel

Separated full-stack app:

- `frontend/` - Next.js UI
- `backend/` - Node.js/Express API, Prisma, PostgreSQL access, auth, email
- `docker-compose.yml` - PostgreSQL and optional backend service

## Local Development

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Install dependencies:

```bash
npm install
```

Prepare database:

```bash
npm run prisma:migrate
npm run db:seed
```

Run the full app:

```bash
npm run dev
```

Or run each side in a separate terminal:

```bash
npm run dev:backend
npm run dev:frontend
```

Default URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Backend health: `http://localhost:4000/health`

If port `3000` is busy:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace frontend -- -p 3001
FRONTEND_URL=http://localhost:3001 npm run dev:backend
```

Mock login:

- Admin: `admin@example.com`
- Player: `nika.beridze@example.com`
- Password: `Password123!`

## Vercel Frontend Deploy

Set the Vercel project Root Directory to:

```bash
frontend
```

With that root directory, Vercel is already inside the frontend package. `vercel.json` uses frontend-local commands:

```bash
npm ci
npm run build
```

Set `NEXT_PUBLIC_API_URL` in Vercel to the deployed backend API URL, for example `https://api.example.com`.
