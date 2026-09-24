# E-commerce Template

A single-store, white-label e-commerce template (storefront + PWA + admin panel) for the Indian market.
Store name, branding, languages, home page sections, product attributes and shipping rules are all
configured from the database, so one codebase can be deployed for any product type.

- Project rules and architecture: [CLAUDE.md](CLAUDE.md)
- Build plan, phase by phase: [BUILD_WORKFLOW.md](BUILD_WORKFLOW.md)

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 + shadcn/ui · PostgreSQL + Prisma 7 ·
next-intl (English, Tamil, Kannada) · Vitest · Playwright · pnpm

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 11+ (`corepack enable` or `brew install pnpm`)
- Docker (Docker Desktop, OrbStack or Colima) for the local database, or any PostgreSQL 15+ URL

## Getting started

```bash
pnpm install                    # installs deps and generates the Prisma client
cp .env.example .env            # then fill in values (AUTH_SECRET: openssl rand -base64 32)
pnpm db:up                      # start PostgreSQL in Docker
pnpm db:migrate                 # apply migrations and generate the Prisma client
pnpm db:seed                    # demo store: owner, settings, 3 categories, 12 products
pnpm dev                        # http://localhost:3000 -> redirects to /en
```

The seed creates an owner admin: `owner@example.com` / `ChangeMe@123` unless you set
`SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` in `.env` (required in production).

### Logging in (development)

- **Admin:** <http://localhost:3000/en/admin/login> with the seeded owner account above.
- **Customer:** <http://localhost:3000/en/login>, enter any Indian mobile number (e.g. `98765 43210`).
  With `SMS_PROVIDER=console` the 6-digit code is printed in the `pnpm dev` terminal.

Roles and permissions are defined in `src/lib/permissions.ts` (OWNER, STAFF, CUSTOMER).

Check the app and database are up: <http://localhost:3000/api/health> should return
`{"status":"ok","db":"ok",...}`.

### Port 5432 already in use?

If another PostgreSQL is already running on your machine, pick a free port and set it in `.env`
(Docker Compose reads it from there):

```bash
POSTGRES_PORT=5440
DATABASE_URL="postgresql://ecom:ecom@localhost:5440/ecom?schema=public"
```

## Commands

| Command                    | What it does                                      |
| -------------------------- | ------------------------------------------------- |
| `pnpm dev`                 | Start the dev server                              |
| `pnpm build && pnpm start` | Production build and server                       |
| `pnpm lint`                | ESLint                                            |
| `pnpm typecheck`           | Generate route types and run `tsc`                |
| `pnpm format`              | Format with Prettier                              |
| `pnpm test`                | Unit tests (Vitest)                               |
| `pnpm test:e2e`            | End-to-end tests (Playwright; needs `pnpm db:up`) |
| `pnpm db:up` / `db:down`   | Start / stop the local PostgreSQL container       |
| `pnpm db:migrate`          | Create/apply migrations and regenerate the client |
| `pnpm db:seed`             | Seed demo data (safe to re-run)                   |
| `pnpm db:reset`            | Drop the database, re-apply migrations and seed   |
| `pnpm db:studio`           | Browse data in Prisma Studio                      |

First time running e2e tests: `pnpm exec playwright install chromium`.

A pre-commit hook (Husky + lint-staged) lints and formats staged files.

## Project structure

```
src/
  app/[locale]/        # localized pages: (store), (account), admin
  app/api/             # route handlers (health, webhooks later)
  components/          # ui/ (shadcn), store/, admin/, shared/
  i18n/                # next-intl routing, request config, navigation helpers
  lib/                 # db client, services (business logic), validators, providers
  messages/            # en.json, ta.json, kn.json
  styles/globals.css   # Tailwind + theme tokens
  proxy.ts             # locale detection and redirects (Next.js 16 "proxy", formerly middleware)
prisma/                # schema, migrations, seed (data model: docs/erd.md)
tests/unit, tests/e2e  # Vitest and Playwright tests
```

## Languages

Routes are always prefixed with the locale: `/en`, `/ta`, `/kn`. Add every new UI string to all three
files in `src/messages/`. A unit test fails if the files have different keys.
