# PWA and push notifications

| Concern                                | Where                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Web app manifest (from Store Settings) | `src/app/manifest.ts`, `src/lib/pwa/manifest.ts`                                |
| App icons from the logo                | `src/app/icons/[name]/route.ts`, `src/lib/pwa/icons.ts`                         |
| Service worker                         | `src/sw/sw.ts`, served at `/serwist/sw.js` by `src/app/serwist/[path]/route.ts` |
| Caching rules (unit-tested)            | `src/sw/routes.ts`                                                              |
| Install prompt, update toast           | `src/components/pwa/`                                                           |
| Push subscriptions, sending, campaigns | `src/lib/services/push.service.ts`                                              |
| Order updates by push                  | the `PUSH` channel in `notification.service.ts` (see [orders.md](orders.md))    |
| Admin                                  | `/admin/push` (push campaigns)                                                  |

## Setup

1. Generate VAPID keys **once per store**. Changing them later breaks every existing
   subscription.

   ```bash
   pnpm exec web-push generate-vapid-keys
   ```

   Put them in the environment as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and set
   `VAPID_SUBJECT=mailto:owner@yourstore.in`.

2. Serve the site over **HTTPS**. Service workers and push only work on HTTPS (or `localhost`).
3. Schedule `/api/cron/send-notifications` every 5 minutes (see [orders.md](orders.md)). It
   retries order pushes and continues campaigns that didn't finish.
4. Upload a square logo (at least 512×512, PNG or SVG) in **Store Settings → Branding**. The
   app icons are generated from it. Without a logo, a shopping-bag icon in the brand colour is
   used.

The service worker runs only in **production builds** (`pnpm build && pnpm start`), so cached
pages never hide code changes while developing. To try it with `pnpm dev`, set
`NEXT_PUBLIC_ENABLE_SW=true`, and unregister the worker afterwards in DevTools → Application.

## What gets cached

| Request                                                                                                   | Strategy                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Admin, account, login, checkout, payment and order pages; auth, admin, order, cart, webhook and cron APIs | **Never cached** (network only)                              |
| Home, product and category pages                                                                          | Served from cache instantly, refreshed in the background     |
| Cart, search, shop and other public pages                                                                 | Network first (4 s timeout), cache when offline              |
| Images (`/_next/image`, uploads, Cloudinary, icons)                                                       | From cache, refreshed in the background; 300 images, 30 days |
| JS/CSS build files, fonts                                                                                 | Pre-cached at install (files over 250 KB on first use)       |
| Anything else                                                                                             | Network only                                                 |
| A page that isn't available offline                                                                       | The offline page, in the visitor's language                  |

Prices and stock shown from cache can be out of date, but the server re-checks them at checkout,
so stale pages can never lead to a wrong charge.

**Offline cart:** the cart page is kept in the browser with the last prices the server returned.
Offline, it shows those prices with a notice and disables checkout. When the connection comes
back it re-prices automatically. A signed-in customer's cart changes are saved through
`POST /api/cart`. If that fails offline, the service worker queues the request (background
sync, kept for 24 hours) and sends it when the device is back online. Each save carries the
time of the change, so a late replay never overwrites a newer cart.

**Updates:** a new deployment installs a new worker in the background, and the page shows
"A new version of the store is available" with a **Reload** button. Nothing changes under the
customer until they reload.

## Installing

- **Android / Chrome / Edge:** from the second visit, a small banner offers **Install**,
  which opens the browser's install dialog. "Not now" hides it for 30 days.
- **iPhone / iPad (Safari):** there's no install dialog, so the banner shows the steps:
  Share → **Add to Home Screen**.
- It never shows inside the installed app.

## Push notifications

- **When we ask:** on the order confirmation page, after an order, never on page load. The card
  offers order updates, with a separate, unticked **"Also send me offers and news"** checkbox.
  Customers can change both, or turn push off for the device, under **My account → Profile →
  Notifications on this device**.
- **iPhone / iPad:** web push works only in the installed app (iOS 16.4 or later), so in
  Safari the card explains how to add the store to the Home Screen first.
- **Order updates:** placed, shipped, delivered, cancelled and returned go to every device of
  the customer with order updates switched on, in the language the customer ordered in.
  Tapping one opens the order.
- **Push campaigns** (Admin → Push campaigns, staff with the content permission):
  - Contents: a title (≤ 60 characters) and message (≤ 180) per language, an optional image
    and a link to a page on the store.
  - Only devices that **opted in to offers** receive them, each in its own language, with
    English as the fallback.
  - Sending happens in the background in batches. If it's interrupted it continues from where
    it stopped, and no device ever gets a campaign twice. The history shows delivered and
    failed counts.
- Subscriptions the browser has revoked (410/404 from the push service) are deleted
  automatically.

## Checking it (Lighthouse no longer has a PWA audit)

Automated (`tests/e2e/pwa.spec.ts`, run against a production build):

```bash
pnpm build && PORT=3100 ALLOW_MOCK_PAYMENTS=true pnpm start
PLAYWRIGHT_BASE_URL=http://localhost:3100 pnpm test:e2e
```

It checks:

- the manifest, and that every icon has the right size
- the service worker's headers
- offline product pages, the cart and the offline page in each language
- that private pages never enter the cache

Manual checklist for each client deployment (on the real HTTPS domain):

- [ ] **Chrome DevTools → Application → Manifest:** name, icons (including maskable) and no
      installability errors.
- [ ] **Application → Service workers:** `/serwist/sw.js` activated for scope `/`.
- [ ] **Android (Chrome):** visit twice and install from the banner. The app opens full screen
      with the store icon and colour.
- [ ] **iPhone (Safari):** Share → Add to Home Screen, then open the app from the icon.
- [ ] **Offline:** open a product, then turn on flight mode. The product and the cart still
      open, and an unvisited page shows the offline page.
- [ ] **Push:** place an order in the installed app and turn on notifications. Mark it shipped
      in the admin, and a notification arrives. Tapping it opens the order.
- [ ] **Campaign:** opt in to offers on a test phone and send a campaign. It arrives in the
      phone's language, and the admin history shows 1 delivered.
- [ ] **Update:** deploy again with the app open. "A new version is available" appears, and
      Reload switches to the new version.
- [ ] **Lighthouse** (Performance / Accessibility / Best Practices / SEO) on the home and
      product pages, in mobile mode.
