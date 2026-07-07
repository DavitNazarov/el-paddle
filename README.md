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

Run backend:

```bash
npm run dev:backend
```

Run frontend:

```bash
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
