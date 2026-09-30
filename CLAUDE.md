# CLAUDE.md — Universal E-commerce Template (Single Store)

> Place this file in the project root. Claude Code reads it automatically at the start of every session.

## 1. What we are building
A **single-store, white-label e-commerce template** (website + PWA + admin panel) that can be deployed for **any product type** (fashion, food, electronics, services, etc.).
Each client gets their own deployment. Nothing may be hard-coded to one product or brand: store name, logo, colors, languages, home page sections, product attributes and shipping rules all come from the **database (Store Settings)** and are editable from the admin panel.

Target market: India (INR, GST, UPI, COD, pincode shipping). Languages: **English, Tamil, Kannada**.

## 2. Tech stack (do not change without asking)
| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| Styling / UI | Tailwind CSS + shadcn/ui + lucide-react |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js (NextAuth): admin/staff = email + password; customer = phone OTP (+ optional email) |
| Validation | Zod (shared between client and server) |
| Forms | React Hook Form |
| Client state | Zustand (cart) + TanStack Query where needed |
| Payments | Razorpay (UPI, cards, netbanking) + Cash on Delivery |
| Images | Cloudinary (upload + transforms) |
| i18n | next-intl (en, ta, kn) |
| PWA | Serwist (service worker), Web App Manifest, web-push (VAPID) |
| Email / SMS / WhatsApp | Provider adapters behind an interface (Resend for email; SMS/WhatsApp pluggable) |
| Testing | Vitest (unit), Playwright (e2e) |
| Lint / format | ESLint + Prettier, Husky + lint-staged |
| Deploy | Docker; Vercel or VPS |

## 3. Folder structure
```
src/
  app/
    [locale]/
      (store)/            # customer-facing pages
      (account)/          # logged-in customer pages
      admin/              # admin panel (role protected)
    api/                  # route handlers, webhooks (razorpay, push)
  components/
    ui/                   # shadcn primitives
    store/  admin/  shared/
  lib/
    db.ts                 # prisma client singleton
    auth.ts  permissions.ts
    validators/           # zod schemas
    services/             # business logic (orders, cart, pricing, coupons, shipping)
    providers/            # payment/, notify/, storage/ adapters
    utils/
  messages/               # en.json, ta.json, kn.json
  styles/
prisma/
  schema.prisma  seed.ts  migrations/
public/                   # icons, manifest assets
tests/  e2e/
docs/                     # decisions, API notes
```

## 4. Commands
```
pnpm dev                 # start dev server
pnpm build && pnpm start # production build
pnpm lint && pnpm typecheck
pnpm test                # vitest
pnpm test:e2e            # playwright
pnpm prisma migrate dev  # create/apply migration
pnpm prisma db seed      # seed demo data
```

## 5. Coding rules
1. **TypeScript strict**, no `any`. Validate every external input with Zod (forms, API bodies, webhooks, query params).
2. **Business logic lives in `lib/services/*`**, never inside components or route handlers. Handlers only parse, authorize, call a service, respond.
3. **Money is stored as integers in paise** (never floats). Format only at the UI layer.
4. **Prices, totals, stock and coupons are always recalculated on the server.** Never trust client-sent prices.
5. **Every admin route and API is permission-checked** (`lib/permissions.ts`): roles `OWNER`, `STAFF`, `CUSTOMER`.
6. **No hard-coded user-facing strings.** Use next-intl keys; add keys to all three language files.
7. **No hard-coded branding.** Read from `StoreSettings`.
8. Use server components by default; client components only when needed.
9. Use DB transactions for order creation, stock decrement, coupon usage.
10. Payment webhooks must verify signatures and be **idempotent**.
11. Never commit secrets. Keep `.env.example` up to date.
12. Accessibility: semantic HTML, labels, keyboard support, color contrast. Mobile-first layouts.
13. Performance: `next/image`, lazy loading, pagination on all lists, indexes on query fields.

## 6. Git workflow
- Branch per phase/feature: `feat/phase-3-admin-products`.
- Small commits, Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Before each commit: `pnpm lint && pnpm typecheck && pnpm test`.

## 7. Definition of done (every task)
- [ ] Works on mobile and desktop
- [ ] Types, lint, and tests pass
- [ ] Inputs validated, permissions enforced
- [ ] Strings translated (en/ta/kn)
- [ ] Empty, loading, and error states handled
- [ ] Docs/README/.env.example updated if needed

## 8. Environment variables (keep in `.env.example`; the full list lives there)
```
DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
SMS_PROVIDER=            # msg91 in production (see docs/sms.md)
MSG91_AUTH_KEY=
CRON_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## 9. Domain model (summary)
`StoreSettings` (singleton), `User`, `Address`, `Category`, `Product`, `ProductVariant`, `ProductImage`, `AttributeDefinition`, `Cart`/`CartItem`, `Order`, `OrderItem`, `Payment`, `Coupon`, `CouponUsage`, `Review`, `WishlistItem`, `Banner`, `HomeSection`, `ShippingRule`, `PushSubscription`, `Notification`, `AuditLog`.
Product attributes are flexible: category-level `AttributeDefinition`s (text, number, select, color) stored per product as JSON, so any product type can be modeled without code changes.

## 10. Working agreements for Claude
- Work on **one phase at a time** from `BUILD_WORKFLOW.md`. Do not jump ahead.
- Start each phase by **proposing a short plan** and listing files you will create or change; wait for approval on big decisions.
- Ask before adding new dependencies or changing the stack.
- After finishing, summarize what changed, how to test it, and what is left.
- If something is ambiguous, ask instead of guessing.
