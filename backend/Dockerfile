# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend --include-workspace-root=false

FROM deps AS builder

ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public

COPY backend ./backend
WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend --omit=dev --include-workspace-root=false

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S nodejs && adduser -S backend -G nodejs

COPY --from=prod-deps --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package.json ./package.json
COPY --from=builder --chown=backend:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=backend:nodejs /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=backend:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=backend:nodejs /app/backend/prisma ./backend/prisma
COPY --from=builder --chown=backend:nodejs /app/backend/prisma.config.ts ./backend/prisma.config.ts

WORKDIR /app/backend
USER backend

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
