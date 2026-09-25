/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  BackgroundSyncPlugin,
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import {
  isImageUrl,
  isPrivatePath,
  offlinePath,
  pageRule,
  safeNotificationUrl,
  SW_LOCALES,
} from "./routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;
const origin = self.location.origin;
const isRsc = (request: Request) => request.headers.get("RSC") === "1";
const okOnly = () => new CacheableResponsePlugin({ statuses: [200] });

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Wait for the page to accept the update ("Update available" toast), then take over.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Private pages and APIs: never cached. Must stay first.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && isPrivatePath(url.pathname),
      handler: new NetworkOnly(),
    },
    // 2. Cart saves made offline are retried when the connection comes back.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/cart",
      method: "POST",
      handler: new NetworkOnly({
        plugins: [new BackgroundSyncPlugin("cart-sync", { maxRetentionTime: 24 * 60 })],
      }),
    },
    // 3. Build assets (also precached) and fonts.
    {
      matcher: ({ url, sameOrigin }) =>
        (sameOrigin &&
          (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/"))) ||
        url.hostname === "fonts.gstatic.com",
      handler: new CacheFirst({
        cacheName: "static",
        plugins: [okOnly(), new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * DAY })],
      }),
    },
    {
      matcher: ({ url }) => url.hostname === "fonts.googleapis.com",
      handler: new StaleWhileRevalidate({ cacheName: "font-css" }),
    },
    // 4. Images: instant from cache, refreshed in the background.
    {
      matcher: ({ url }) => isImageUrl(url, origin),
      handler: new StaleWhileRevalidate({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * DAY,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 5. Storefront pages (HTML and the RSC payloads used for in-app navigation).
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        (request.mode === "navigate" || isRsc(request)) &&
        pageRule(url.pathname) === "stale-while-revalidate",
      handler: new StaleWhileRevalidate({
        cacheName: "pages",
        plugins: [okOnly(), new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 7 * DAY })],
      }),
    },
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        (request.mode === "navigate" || isRsc(request)) &&
        pageRule(url.pathname) === "network-first",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 4,
        plugins: [okOnly(), new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 7 * DAY })],
      }),
    },
    // 6. Public APIs (e.g. search suggestions): network first.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api",
        networkTimeoutSeconds: 5,
        plugins: [okOnly(), new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: DAY })],
      }),
    },
    // 7. Anything else: straight to the network.
    { matcher: () => true, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: SW_LOCALES.map((locale) => ({
      url: `/${locale}/offline`,
      matcher: ({ request }) =>
        request.destination === "document" &&
        offlinePath(new URL(request.url).pathname) === `/${locale}/offline`,
    })),
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

type PushPayload = { title?: string; body?: string; url?: string; image?: string; tag?: string };

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    data = (event.data?.json() ?? {}) as PushPayload;
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      ...(data.image ? { image: data.image } : {}),
      ...(data.tag ? { tag: data.tag } : {}),
      data: { url: safeNotificationUrl(data.url, origin) },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeNotificationUrl((event.notification.data as { url?: string })?.url, origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === origin);
      if (existing) {
        await existing.focus();
        await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

serwist.addEventListeners();
