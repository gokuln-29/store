# Security, QA and performance checklist

What the template does to stay safe and fast, what was checked in the Phase 11 hardening pass,
and what each deployment must still do before going live.

## Go-live checklist (every client store)

- [ ] `AUTH_SECRET`, `CRON_SECRET` generated fresh for this store (`openssl rand -base64 32`);
      never reused between clients.
- [ ] `SEED_OWNER_PASSWORD` set, and the owner password changed after the first login.
- [ ] `NEXT_PUBLIC_APP_URL` is the real `https://` domain (canonical links, sitemap, emails).
- [ ] `PAYMENT_PROVIDER=razorpay` with live keys; `ALLOW_MOCK_PAYMENTS` unset.
      Webhook created in Razorpay with `RAZORPAY_WEBHOOK_SECRET` (see [payments.md](payments.md)).
- [ ] Database: a strong password, not reachable from the internet, daily backups.
      Serverless: pooled URL plus `DATABASE_POOL_MAX=1`–`3` (see [Database](#database)).
- [ ] `TRUSTED_PROXY_HOPS` matches the number of proxies in front of the app (see [Rate limits](#rate-limits)).
- [ ] VAPID keys generated once for this store ([pwa.md](pwa.md)).
- [ ] `SMS_PROVIDER=msg91` with the OTP template ([sms.md](sms.md)); customers can't sign in
      without it.
- [ ] Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` set, with a separate Sentry project per store.
- [ ] Run `pnpm audit --prod` and, against the deployed URL, the Lighthouse check in [Performance](#performance).
- [ ] If the store embeds a third-party service (chat widget, analytics), add its domains to the
      CSP in `next.config.ts`; otherwise the browser blocks it.

## Authentication and authorization

| Area             | Protection                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin pages      | The `admin/(panel)` layout redirects anyone without a staff role. Each page and server action also checks a specific permission with `can()` from `lib/permissions.ts`; the layout alone is never trusted. |
| Admin API routes | Every handler under `api/admin/*` checks session and permission before parsing the body.                                                                                                                   |
| Customer data    | Services always filter by the session user id (orders, addresses, wishlist, reviews); ids from the client are never trusted on their own.                                                                  |
| Passwords        | argon2; admin login rate limited per IP and per email.                                                                                                                                                     |
| OTP              | 6 digits, stored as an HMAC keyed with `AUTH_SECRET`, expires after 5 minutes, 5 attempts, 30 s resend cooldown.                                                                                           |
| Sessions         | Auth.js JWT in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` on HTTPS.                                                                                                                                    |

Audit result (Phase 11): every route handler and server action was reviewed. There was no
unauthenticated mutating endpoint, and no admin action without a permission check. Webhooks
(`api/webhooks/razorpay`) verify the HMAC signature and are idempotent. Cron routes need
`Authorization: Bearer $CRON_SECRET`.

## CSRF

- Server actions: Next.js rejects requests whose `Origin` does not match the host.
- JSON / multipart route handlers that change data (`api/cart`, `api/reviews/photos`,
  `api/admin/uploads`, `api/admin/products/import`) call `sameOriginGuard()` from `lib/csrf.ts`.
  It returns 403 when `Origin` is missing or points to another host.
- Webhooks and cron routes are exempt: they use signatures or bearer tokens, not cookies.
- New mutating route handlers must call `sameOriginGuard()` first (covered by
  `tests/unit/security.test.ts`).

## Rate limits

Stored in Postgres (`RateLimit` table), so they work across several server instances.

| Rule                             | Limit                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| Admin login per IP               | 20 / 15 min                                                |
| Admin login per email            | 5 / 15 min                                                 |
| OTP send per IP                  | 20 / 60 min                                                |
| OTP send per phone               | 5 / 60 min (stops SMS bombing of one number from many IPs) |
| Coupon checks per IP             | 30 / 10 min                                                |
| Reviews / review photos per user | 20 / 60 min                                                |

The client IP comes from `clientIpFromHeaders()` in `lib/request.ts`. It prefers `X-Real-IP`,
otherwise it takes the entry `TRUSTED_PROXY_HOPS` from the **right** of `X-Forwarded-For`,
because the left side can be forged by the client. Default: 1 hop (Vercel, or nginx directly in
front). Use 2 behind a CDN plus a load balancer. Any proxy in front must **overwrite**
`X-Real-IP`. Vercel does, and so does the Caddy config in `docker/Caddyfile`. With nginx, use
`proxy_set_header X-Real-IP $remote_addr;`.

## Security headers and CSP

Set for every response in `next.config.ts`:

- `Content-Security-Policy`: `default-src 'self'`. Scripts come only from our origin and
  `checkout.razorpay.com`. Images come from our origin, Cloudinary and Razorpay. Frames allow only
  Razorpay. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `Strict-Transport-Security` (2 years, production only), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: no camera, microphone, geolocation or topics; the Payment Request API
  only for our origin and Razorpay.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`, so Razorpay's UPI and 3-D Secure
  popups can report back.
- `X-Powered-By` removed.

**Why `'unsafe-inline'` for scripts.** Next.js inlines its bootstrap scripts. A nonce-based CSP
would make every page render dynamically, which loses static rendering, caching and the offline
cache. The risk is limited because:

- no user content is rendered as raw HTML without sanitizing (see [Input and output](#input-and-output));
- React escapes everything else;
- scripts cannot load from other hosts.

If a client needs a strict CSP, switch to nonces in `proxy.ts` and accept dynamic rendering.

## Input and output

- Every external input is validated with Zod: forms, API bodies, query strings, webhook payloads
  and CSV import rows.
- Prices, stock, coupons, shipping and tax are recalculated on the server for every quote and
  order. Order creation, stock decrement and coupon use run in one transaction.
- Rich text (product descriptions, home page text blocks) is cleaned with `sanitizeRichText()`
  before `dangerouslySetInnerHTML`. JSON-LD escapes `<`. There are no other raw HTML sinks.
- Uploads:
  - The file type is detected from its content (magic bytes); the file name and the declared
    type are ignored.
  - Allowed: JPEG, PNG, WebP, GIF, AVIF, plus ICO for branding only. SVG is refused, because it
    can carry script.
  - Maximum 4 MB.
  - Files are stored under random names.
- CSV exports escape cells that start with `= + - @` (spreadsheet formula injection).

## Secrets

- Only `NEXT_PUBLIC_*` variables reach the browser. The Razorpay key id is public by design; the
  key secret is not.
- Phase 11 check: after `pnpm build`, the values of `AUTH_SECRET`, `DATABASE_URL`,
  `VAPID_PRIVATE_KEY` and `CRON_SECRET` were searched for in `.next/static` and in the prerendered
  HTML/RSC. None were found.
  Repeat the check with:
  ```sh
  set -a; source .env; set +a
  grep -rlF -- "$AUTH_SECRET" .next/static .next/server/app --include='*.js' --include='*.html' --include='*.rsc'
  ```
- `.env` is git-ignored; `.env.example` lists every variable with no values.

## Dependencies

- `pnpm audit` reported 0 vulnerabilities after Phase 11. Vulnerable transitive packages
  (`mysql2`, `deepmerge-ts` and `browserslist`, pulled in by dev tooling) are pinned via
  `overrides` in `pnpm-workspace.yaml`.
- Run `pnpm audit` before each release, and `pnpm outdated` monthly.

## Error monitoring and logs

- `lib/logger.ts` writes one JSON object per line (`level`, `scope`, `msg`, `time`, fields).
  `LOG_LEVEL` sets the minimum level. Never log OTPs, secrets, card or UPI details, or full
  addresses.
- Sentry is optional: it is initialised only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is set.
  - Before an event is sent, `scrubEvent()` (`lib/sentry-scrub.ts`) does the following:
    - removes cookies, request bodies and all headers except user agent and referer;
    - reduces the user to their id;
    - masks phone numbers and email addresses in messages and breadcrumbs.
  - Browser events go through `/monitoring` on the store's own domain, so they are not blocked
    by ad blockers or the CSP.
  - Source maps upload only when `SENTRY_AUTH_TOKEN` is set at build time.

## Database

- Indexes exist for every list filter and search in the admin and storefront:
  - trigram GIN indexes for product search and for admin order search by number, customer and
    invoice;
  - B-tree indexes for status, dates and foreign keys.
- Measured with `EXPLAIN ANALYZE` on 50k products and 100k orders:
  - misspelled product search: 53 ms → 0.9 ms;
  - order search: 29 ms → 1 ms;
  - phone search: 75 ms → 15 ms.
- Lists are paginated. Relations are loaded with `include`/`select` or grouped queries, not per
  row (no N+1 queries were found in the review).
- Connection pool: `DATABASE_POOL_MAX` per server instance (default 10), and a
  `statement_timeout` of 15 s (`DATABASE_STATEMENT_TIMEOUT_MS`).
  - VPS / Docker: keep 10 unless you run several replicas. The total across replicas must stay
    below Postgres `max_connections` (default 100).
  - Vercel / serverless: every function instance has its own pool. Use the provider's pooled URL
    (PgBouncer in transaction mode, Supabase or Neon pooler) and set `DATABASE_POOL_MAX=1`–`3`.

## Performance

Measured with Lighthouse (mobile, simulated throttling) against a production build:

| Page     | Perf  | A11y | Best practices | SEO     |
| -------- | ----- | ---- | -------------- | ------- |
| Home     | 91    | 100  | 100            | 100     |
| Category | 92–93 | 100  | 100            | 100     |
| Product  | 90–92 | 100  | 100            | 100     |
| Search   | 88–95 | 100  | 100            | noindex |

SEO scores only reach 100 when `NEXT_PUBLIC_APP_URL` matches the URL being tested, because the
canonical links are built from it. Search, cart, checkout and account pages are deliberately
`noindex`.

What keeps it fast:

- Pages are static or cached where possible. Admin changes call `revalidatePath` for the pages
  they affect; settings are cached per request.
- Images go through `next/image` with AVIF/WebP, sized per breakpoint, and are cached for 30 days
  (uploads have unique names). Only the logo and the first products in a grid load eagerly.
- Translations sent to the browser are limited to the namespaces client components use
  (`i18n/client-namespaces.ts`). This cut home HTML from 214 KB to 181 KB (24 KB gzipped). The
  admin panel loads its own messages.
- The service worker caches the app shell and visited pages for offline use ([pwa.md](pwa.md)).

Known remaining items:

- LCP is about 3–3.5 s on throttled mobile. Most of that is render delay while client JavaScript
  (header, cart, locale switcher) loads. Turning more of the header into server components is
  the next improvement.
- The customer lifetime-value list in the admin aggregates orders on every request. It is fine up
  to tens of thousands of orders; beyond that, store totals on the customer row.

## Accessibility

- `tests/e2e/a11y.spec.ts` runs axe (WCAG 2.1 A/AA) on the storefront in all three languages,
  on login, cart, checkout, confirmation, account and the main admin pages. It fails on serious
  or critical issues.
- Fixed in Phase 11:
  - heading order on listing pages;
  - contrast of the phone prefix and of the selected checkout options;
  - a duplicate link in cart lines;
  - invalid `<dl>` content;
  - a visible label for the page-size select.

## Tests

- Unit (Vitest): services for pricing, coupons, shipping, orders, stock, rate limits, CSRF and
  client IP, Sentry scrubbing, and translation parity.
- End-to-end (Playwright, desktop and mobile):
  - the full journey: browse → cart → checkout with cash on delivery → admin packs, ships and
    delivers → invoice;
  - a Razorpay test-mode journey, which runs only with `PAYMENT_PROVIDER=razorpay` and
    `rzp_test_` keys;
  - PWA and offline behaviour, against a production server;
  - accessibility;
  - a check that an idle checkout stops sending requests (a regression test for a re-quote loop
    fixed in Phase 11).
- Before each commit: `pnpm lint && pnpm typecheck && pnpm test`. Before a release, also run
  `pnpm test:e2e`.
