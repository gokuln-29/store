# BUILD_WORKFLOW.md — Claude Code Workflow for the Universal E-commerce Template

A step-by-step build guide. Each phase has a **copy-paste prompt**, **deliverables**, and **acceptance checks**.
Estimated total: ~10–12 weeks solo with Claude Code (faster if you review quickly).

---

## 0. How to work with Claude Code (read once)

**Setup**
1. Create an empty folder `ecom-template/`, run `git init`, open a terminal there and start `claude`.
2. Copy `CLAUDE.md` and this file into the project root.
3. Have accounts ready: PostgreSQL (local Docker or Supabase/Neon), Razorpay (test mode), Cloudinary, Resend.

**Golden loop for every phase**
1. `/clear` to start with fresh context (CLAUDE.md is reloaded automatically).
2. Switch to **Plan Mode** (Shift+Tab) and paste the phase prompt. Review the plan and correct it.
3. Approve, let Claude implement. Ask it to **commit in small steps**.
4. Run the acceptance checks yourself (browser + `pnpm lint typecheck test`).
5. Ask Claude: *"Review your own diff for bugs, security issues, and missing translations, then fix them."*
6. Merge the branch and move to the next phase.

**Tips**
- One phase per session. Long sessions drift; `/clear` between phases.
- If Claude goes off-plan, say: *"Stop. Re-read CLAUDE.md section 5 and redo this following the rules."*
- Keep prompts specific. Point to files: *"Follow the pattern in `lib/services/order.service.ts`."*
- Use `/compact` if a phase gets long.
- For tricky bugs: *"Write a failing test first, then fix."*

**Optional custom slash commands** (create in `.claude/commands/`)

`.claude/commands/review.md`
```
Review the current git diff as a senior engineer. Check: security (authz, injection, secrets), money handling (paise, server-side totals), validation (zod), missing i18n keys, missing tests, N+1 queries, accessibility. List issues by severity, then fix the critical and high ones.
```

`.claude/commands/new-admin-page.md`
```
Create a new admin page for: $ARGUMENTS
Follow existing admin patterns: permission check, zod validation, service layer, data table with pagination/search, loading/empty/error states, i18n keys in en/ta/kn, tests.
```

`.claude/commands/translate.md`
```
Find every user-facing string added in the current diff that is not in src/messages/*.json. Add keys to en, ta, and kn (natural, everyday Tamil and Kannada). Report any keys you were unsure about.
```

---

## Phase 0 — Project scaffold & tooling
**Branch:** `chore/phase-0-scaffold`

**Prompt**
```
Read CLAUDE.md fully. Scaffold the project exactly per the tech stack and folder structure:
- Next.js App Router + TypeScript strict + Tailwind + shadcn/ui, using pnpm
- ESLint, Prettier, Husky + lint-staged, Vitest, Playwright configured
- Prisma + PostgreSQL connection, docker-compose.yml for local Postgres
- next-intl with [locale] routing (en, ta, kn), empty message files
- .env.example with all variables from CLAUDE.md, a README with setup steps
- A base layout with a placeholder header/footer and a health check route /api/health
Do not build features yet. Propose a plan first.
```
**Deliverables:** running app, `pnpm dev/lint/typecheck/test` all pass, README.
**Accept:** `/en`, `/ta`, `/kn` load; `/api/health` returns OK; Postgres connects.

---

## Phase 1 — Database schema & seed
**Branch:** `feat/phase-1-database`

**Prompt**
```
Design the Prisma schema for the domain model in CLAUDE.md section 9. Requirements:
- Money as Int (paise). Enums for OrderStatus, PaymentStatus, PaymentMethod, Role, CouponType.
- StoreSettings singleton: name, logo, favicon, colors (primary/secondary), fonts, contact info, GST number, currency, supported locales, default locale, COD enabled, min order value, social links.
- Flexible products: Category has AttributeDefinitions (type: text|number|select|color, options, filterable). Product stores attribute values as JSON. ProductVariant has SKU, price, compareAtPrice, stock, option values.
- Orders keep a snapshot of product name, price, and address at purchase time.
- ShippingRule (by pincode prefix/state, flat or weight-based, free-shipping threshold).
- Indexes on slug, sku, orderNumber, status, createdAt.
Then write prisma/seed.ts that creates: 1 owner admin, StoreSettings, 3 categories with different attribute sets (e.g. Clothing, Food, Electronics), 12 sample products with variants and images, 3 coupons, 2 shipping rules.
Show me the ERD as a mermaid diagram in docs/erd.md.
```
**Accept:** `migrate dev` and `db seed` succeed; ERD reviewed by you.

---

## Phase 2 — Authentication & roles
**Branch:** `feat/phase-2-auth`

**Prompt**
```
Implement authentication with Auth.js:
- Admin/staff login at /admin/login with email + password (bcrypt/argon2), rate limited.
- Customer login/registration with phone OTP (provider adapter interface in lib/providers/notify; include a console/dev provider that prints OTPs), optional email.
- Role-based permissions in lib/permissions.ts (OWNER, STAFF, CUSTOMER) and a middleware protecting /admin/** and /account/**.
- Session includes user id and role. Logout, session expiry, and OTP expiry/attempt limits.
- Customer account pages: profile, saved addresses (CRUD).
Write unit tests for permissions and OTP logic, and one e2e test for admin login.
```
**Accept:** non-admins cannot reach `/admin`; OTP flow works in dev; addresses CRUD works.

---

## Phase 3 — Admin panel foundation & catalog management
**Branch:** `feat/phase-3-admin-catalog`

**Prompt**
```
Build the admin panel shell and catalog management:
- Responsive admin layout: sidebar, topbar, breadcrumbs, language switcher, dark mode.
- Reusable DataTable (server-side pagination, search, sort, filters, bulk actions).
- Store Settings pages: general, branding (logo/colors/fonts with live preview), contact, GST, locales, payments toggles, shipping rules.
- Categories CRUD with attribute definitions builder.
- Products CRUD: multilingual name/description (en/ta/kn), category, dynamic attribute fields generated from the category, variants matrix (options -> SKUs, price, stock), multi-image upload to Cloudinary with reorder and alt text, SEO fields, draft/published status, slug auto-generation.
- CSV import/export for products with validation report.
- Inventory: low-stock indicator, quick stock edit.
- AuditLog entries for every admin mutation.
Follow CLAUDE.md rules. Include tests for services and one e2e for creating a product.
```
**Accept:** owner can create a product of any category with correct dynamic fields; CSV import of 50 rows works; theme changes reflect in the app.

---

## Phase 4 — Storefront (browse & discover)
**Branch:** `feat/phase-4-storefront`

**Prompt**
```
Build the customer storefront, mobile-first, driven entirely by StoreSettings:
- Home page composed of HomeSection blocks configurable in admin (hero banners, featured categories, product carousel, offer strip, testimonials, rich text). Add the admin UI for arranging/ordering sections.
- Category & listing pages: pagination or infinite scroll, sort, filters (price, category attributes marked filterable, in-stock), URL-synced.
- Search with debounce, suggestions, and Postgres full-text (or trigram) search across en/ta/kn fields.
- Product detail page: gallery with zoom, variant selector, price/compare-at, stock state, delivery pincode check, description tabs, related products, JSON-LD schema.
- SEO: metadata per page, sitemap.xml, robots.txt, canonical and hreflang.
- Skeletons, empty states, 404.
```
**Accept:** Lighthouse mobile >= 90 on home and product pages; filters work from URL; all three languages render.

---

## Phase 5 — Cart, checkout & pricing engine
**Branch:** `feat/phase-5-checkout`

**Prompt**
```
Implement cart and checkout:
- Cart: Zustand + localStorage for guests, DB cart for logged-in users, merge on login. Server validates stock and prices on every change.
- lib/services/pricing.service.ts: single source of truth computing subtotal, coupon discount, shipping (from ShippingRule + pincode), GST (inclusive/exclusive per settings, with breakup), total. All in paise. Heavy unit tests.
- Coupon service: percent/flat, min cart value, max discount, usage limits (total and per user), validity dates, category/product restrictions.
- Checkout: guest or logged-in, address form with pincode autofill/validation, shipping method, coupon input, order summary, payment method choice (Online/COD).
- Order creation in a DB transaction: re-price, check and reserve stock, create Order with snapshots, generate human-friendly orderNumber.
- Order confirmation page.
Do NOT integrate Razorpay yet; make the payment step a provider interface with a mock provider.
```
**Accept:** pricing test suite passes; tampering with client prices has no effect; stock cannot go negative under concurrent orders.

---

## Phase 6 — Payments (Razorpay + COD)
**Branch:** `feat/phase-6-payments`

**Prompt**
```
Integrate Razorpay behind the payment provider interface:
- Create Razorpay order server-side from our Order total; open Checkout on the client; verify signature on success callback.
- Webhook endpoint /api/webhooks/razorpay: verify signature, idempotent handling of payment.captured, payment.failed, refund.processed; update Payment and Order status.
- Handle: payment failure and retry, abandoned payments (pending order expiry job that releases stock), duplicate webhook events.
- COD flow with optional COD fee and min/max limits from StoreSettings.
- Admin: view payments, initiate full/partial refunds.
- Document test-mode setup and how to test webhooks locally (ngrok or Razorpay CLI) in docs/payments.md.
Write tests for signature verification and webhook idempotency.
```
**Accept:** test payment succeeds, fails, and retries correctly; replaying a webhook changes nothing; refund updates status.

---

## Phase 7 — Orders, fulfillment & customer account
**Branch:** `feat/phase-7-orders`

**Prompt**
```
Build order management:
- Admin: orders list with filters (status, date, payment, search by number/phone), order detail, status transitions (placed -> confirmed -> packed -> shipped -> delivered; cancelled; returned) with allowed-transition rules, tracking number + courier link, internal notes, timeline.
- Invoices: GST-compliant PDF invoice and packing slip generation, downloadable by admin and customer.
- Customer: order history, order detail with timeline, cancel (if allowed), reorder, download invoice.
- Trigger notifications on status change through lib/providers/notify (email via Resend, SMS/WhatsApp adapters with a dev logger). Templates in en/ta/kn.
- Stock restore on cancellation/return.
Add tests for the status state machine.
```
**Accept:** full order lifecycle works; emails are sent on each status change; invoice PDF is correct.

---

## Phase 8 — PWA & push notifications
**Branch:** `feat/phase-8-pwa`

**Prompt**
```
Turn the storefront into a proper PWA using Serwist:
- Dynamic Web App Manifest generated from StoreSettings (name, colors, icons; generate icon sizes from the uploaded logo, including maskable).
- Service worker: precache app shell, runtime caching (stale-while-revalidate for product/category pages and images, network-first for API, never cache admin, auth, checkout or payment routes).
- Offline fallback page, offline cart viewing, and a background-sync retry for cart updates.
- Custom install prompt UI (Android + iOS instructions) and an "update available" toast.
- Web push: VAPID keys, permission prompt at a sensible moment (after first order, not on load), PushSubscription storage, and sending push for order status updates and admin-composed promotions.
- Admin: compose and send push campaigns (title, body, image, link).
Verify with Lighthouse PWA audit and document manual test steps.
```
**Accept:** installable on Android and iOS; works offline for browsed pages; push received on order status change.

---

## Phase 9 — Internationalization polish (en / ta / kn)
**Branch:** `feat/phase-9-i18n`

**Prompt**
```
Audit and complete i18n:
- Find every hard-coded string in src/ and move it to messages/{en,ta,kn}.json. Use natural, everyday Tamil and Kannada and list any keys you are unsure of in docs/i18n-review.md for me to verify.
- Localize numbers, currency (INR, Indian digit grouping), dates.
- Ensure fonts render Tamil and Kannada well (Noto Sans Tamil/Kannada with proper line-height).
- Product/category/banner content editable per language in admin, with fallback to default locale.
- Language switcher persists preference (cookie) and is reflected in emails and notifications.
- Add a CI script that fails if keys differ between language files.
```
**Accept:** switching language changes everything including emails and validation errors; no missing-key warnings.

---

## Phase 10 — Growth & engagement features
**Branch:** `feat/phase-10-growth`

**Prompt**
```
Add engagement features, each toggleable from StoreSettings:
- Wishlist (guest via localStorage, synced on login).
- Reviews and ratings: verified-purchase only, photo upload, admin moderation, rating aggregate on product cards and JSON-LD.
- Coupons admin UI (create/edit/disable, usage stats).
- Abandoned cart reminders (scheduled job -> email/WhatsApp/push).
- Recently viewed and related/cross-sell products.
- Admin dashboard: today/7d/30d revenue, orders, AOV, top products, low stock, conversion funnel (visits -> cart -> checkout -> paid), charts, CSV export of orders/customers.
- Basic customer list with order history and lifetime value.
```
**Accept:** each feature can be turned off in settings; dashboard numbers match DB queries.

---

## Phase 11 — Security, QA & performance hardening
**Branch:** `chore/phase-11-hardening`

**Prompt**
```
Do a hardening pass:
1. Security: verify authz on every route and server action, rate limiting on login/OTP/checkout/coupon endpoints, CSRF protection, security headers (CSP, HSTS, X-Frame-Options), file upload validation (type/size), input sanitization for rich text, no secrets in client bundle, dependency audit.
2. Data: DB indexes review with EXPLAIN on the slowest queries, N+1 detection, connection pooling config.
3. Tests: e2e coverage for browse -> add to cart -> checkout (COD and Razorpay test) -> admin fulfill; unit tests for services; fix flaky tests.
4. Performance: bundle analysis, image optimization, caching/revalidation strategy (ISR/tags), Core Web Vitals.
5. Accessibility audit (axe) and fixes.
6. Error monitoring (Sentry) and structured logging.
Produce docs/security-checklist.md and fix what you find. Use /review-style rigor.
```
**Accept:** e2e suite green; Lighthouse Performance/SEO/Accessibility/PWA >= 90; no critical audit findings.

---

## Phase 12 — Deployment & white-label handover
**Branch:** `chore/phase-12-deploy`

**Prompt**
```
Prepare deployment and client onboarding:
- Dockerfile (multi-stage) and docker-compose for VPS; also Vercel instructions. GitHub Actions CI: lint, typecheck, test, build; optional CD.
- Production checklist: env vars, migrations on deploy, seed only owner + settings (a `pnpm setup:store` interactive script that asks store name, owner email/password, currency, locales, GST and creates the initial data with no demo products).
- Backups (daily pg_dump to storage) and restore doc.
- Custom domain + SSL guide, Razorpay live-mode switch guide, webhook setup.
- docs/CLIENT_ONBOARDING.md: steps to spin up a new client store from this template in under 1 hour (fork/clone, env, setup script, branding, products import, go live).
- docs/ADMIN_GUIDE.md: simple guide for a non-technical store owner.
```
**Accept:** fresh clone -> `pnpm setup:store` -> live store on a test domain, following only the docs.

---

## Client customization checklist (per new store)
- [ ] Clone template, new database, new env values
- [ ] Run `pnpm setup:store`
- [ ] Upload logo, set colors and fonts, generate PWA icons
- [ ] Set categories and attribute definitions for the product type
- [ ] Import products via CSV
- [ ] Configure shipping rules, GST, COD
- [ ] Razorpay live keys + webhook
- [ ] Set up email/SMS/WhatsApp providers
- [ ] Custom domain + SSL
- [ ] Place a real test order end to end
- [ ] Hand over admin credentials + ADMIN_GUIDE

---

## Quick reference: prompts for common follow-ups
- **Bug:** *"Reproduce this bug with a failing test first: <describe>. Then fix it and explain the root cause."*
- **Refactor:** *"Refactor <file> to follow CLAUDE.md rule 2 (logic in services). Keep behavior identical; tests must pass."*
- **New product type:** *"Add a 'Jewellery' category with attributes (metal, purity, weight, making charges). No code changes should be needed. If any are, fix the design so they aren't."*
- **Before release:** *"Run the full checklist in docs/security-checklist.md and the definition of done in CLAUDE.md against the whole repo. Report gaps."*
