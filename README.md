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
| `pnpm test`                | Unit + integration tests (Vitest)                 |
| `pnpm test:unit`           | Unit tests only (no database needed)              |
| `pnpm test:integration`    | Service tests against the `*_test` database       |
| `pnpm test:e2e`            | End-to-end tests (Playwright; needs `pnpm db:up`) |
| `pnpm db:up` / `db:down`   | Start / stop the local PostgreSQL container       |
| `pnpm db:migrate`          | Create/apply migrations and regenerate the client |
| `pnpm db:seed`             | Seed demo data (safe to re-run)                   |
| `pnpm db:reset`            | Drop the database, re-apply migrations and seed   |
| `pnpm db:studio`           | Browse data in Prisma Studio                      |

First time running e2e tests: `pnpm exec playwright install chromium`.

**Integration tests** use a separate database (`DATABASE_URL_TEST`, must end in `_test`).
`docker-compose` creates `ecom_test` automatically on a fresh volume; with an existing volume run
`docker exec ecom-postgres psql -U ecom -c "CREATE DATABASE ecom_test"` once. Tables are emptied
before every test, and migrations are applied automatically.

**Image uploads** go to Cloudinary when `CLOUDINARY_*` is set, otherwise to `./uploads`
(served at `/uploads/...`). Uploaded files are checked by content, max 4 MB, SVG is not allowed.

A pre-commit hook (Husky + lint-staged) lints and formats staged files.

## Product CSV import / export

Admin → Products → **Export CSV** / **Import**. One row per variant; rows with the same `handle`
form one product and product-level columns come from its first row. Attribute columns are
`attr:<key>` (e.g. `attr:material`). **Check file** validates everything (including SKU clashes)
without saving; **Import** then saves each product separately, so one bad product doesn't block
the others. Image URLs must be `/uploads/...` or Cloudinary. Exports include a UTF-8 BOM so Excel
shows Tamil and Kannada correctly, and cells starting with `= + - @` are escaped.

## Cart and checkout

- The cart lives in the browser (item ids and quantities only) and is saved to the account
  for logged-in customers; a guest cart is merged into the account cart on login.
- **All prices, discounts, shipping, GST and totals are computed on the server**
  (`src/lib/services/pricing.ts`, the single source of truth, all amounts in paise).
- Checkout asks guests to verify their mobile number by OTP, then places the order in one
  database transaction: stock is reserved atomically (it can never go negative), coupon limits
  are enforced under a row lock, and order numbers come from a Postgres sequence.
- With `PAYMENT_PROVIDER=mock`, "Pay online" opens a local test page where you can simulate a
  successful or failed payment.

## Payments

Razorpay (UPI, cards, netbanking, wallets) and cash on delivery. Payments are confirmed by a
signature-verified browser callback **and** an idempotent webhook; unpaid orders expire and
release their stock; owners issue full or partial refunds from Admin → Payments.
Setup, local webhook testing and the expiry cron job: **[docs/payments.md](docs/payments.md)**.

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
