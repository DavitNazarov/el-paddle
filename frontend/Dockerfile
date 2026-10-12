# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root=false

FROM deps AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL=https://elpadell.com
ARG NEXT_PUBLIC_LEGAL_ENTITY_NAME
ARG NEXT_PUBLIC_LEGAL_ENTITY_FORM
ARG NEXT_PUBLIC_LEGAL_ENTITY_ID
ARG NEXT_PUBLIC_LEGAL_ADDRESS
ARG NEXT_PUBLIC_LEGAL_EMAIL
ARG NEXT_PUBLIC_LEGAL_PHONE
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_LEGAL_ENTITY_NAME=${NEXT_PUBLIC_LEGAL_ENTITY_NAME}
ENV NEXT_PUBLIC_LEGAL_ENTITY_FORM=${NEXT_PUBLIC_LEGAL_ENTITY_FORM}
ENV NEXT_PUBLIC_LEGAL_ENTITY_ID=${NEXT_PUBLIC_LEGAL_ENTITY_ID}
ENV NEXT_PUBLIC_LEGAL_ADDRESS=${NEXT_PUBLIC_LEGAL_ADDRESS}
ENV NEXT_PUBLIC_LEGAL_EMAIL=${NEXT_PUBLIC_LEGAL_EMAIL}
ENV NEXT_PUBLIC_LEGAL_PHONE=${NEXT_PUBLIC_LEGAL_PHONE}
ENV NEXT_TELEMETRY_DISABLED=1

COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/" >/dev/null || exit 1

CMD ["node", "frontend/server.js"]
