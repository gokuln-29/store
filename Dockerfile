# Production image for the store. Targets:
#   runner (default)  the web server: docker build -t store .
#   tools             prisma migrate deploy, pnpm setup:store, seeding: docker build --target tools
#
# NEXT_PUBLIC_* values are compiled into the browser code, so pass them as build args.
# Everything else (secrets, DATABASE_URL, Razorpay keys…) is read at runtime from the environment.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies (cached until the lockfile changes) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# The metadata cache (~500 MB) isn't needed after install.
RUN pnpm install --frozen-lockfile && rm -rf /root/.cache/pnpm

# ---- Build ----
# Pages are prerendered against a throwaway, empty Postgres inside this stage: the image never
# needs network access to a database and never contains a real store's data. The prerendered
# pages are discarded when the container starts (docker/app/clear-prerendered.mjs).
FROM deps AS builder
RUN apk add --no-cache postgresql17 postgresql17-contrib
COPY . .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=
ARG NEXT_PUBLIC_ENABLE_SW=false
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
# Optional, only to upload source maps. Build args of this stage never reach the final image.
ARG SENTRY_AUTH_TOKEN=
ENV NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT} \
    NEXT_PUBLIC_ENABLE_SW=${NEXT_PUBLIC_ENABLE_SW} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT}
RUN set -e; \
    export PGDATA=/tmp/pgdata; \
    mkdir -p "$PGDATA" /run/postgresql && chown postgres "$PGDATA" /run/postgresql; \
    su postgres -c "initdb -U build -A trust >/dev/null && pg_ctl -w -o '-k /run/postgresql -h 127.0.0.1' start >/dev/null"; \
    export DATABASE_URL="postgresql://build@127.0.0.1:5432/postgres"; \
    export AUTH_SECRET="build-only-not-a-secret"; \
    pnpm prisma migrate deploy; \
    pnpm build; \
    su postgres -c "pg_ctl -w stop >/dev/null"; \
    rm -rf "$PGDATA"

# ---- Tools: migrations, store setup and seeding (full dependencies and source) ----
FROM deps AS tools
COPY . .
CMD ["pnpm", "prisma", "migrate", "deploy"]

# ---- Runtime ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
    && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --chown=nextjs:nodejs docker/app/clear-prerendered.mjs docker/app/entrypoint.sh ./docker/
USER nextjs
EXPOSE 3000
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
