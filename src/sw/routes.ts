/**
 * Which requests the service worker may cache. Pure functions, shared with unit tests, so the
 * "never cache private pages" rule is checked in CI. Kept free of app imports because it is
 * bundled into the service worker.
 */

export const SW_LOCALES = ["en", "ta", "kn"] as const;

/** Pages with personal or payment data: never cached, always from the network. */
const PRIVATE_SECTIONS = ["admin", "checkout", "order", "account", "login"];
const PRIVATE_API = [
  "/api/auth",
  "/api/admin",
  "/api/orders",
  "/api/webhooks",
  "/api/cron",
  "/api/cart",
  "/api/push",
  "/serwist",
];

export function splitLocale(pathname: string): { locale: string | null; rest: string } {
  const match = /^\/(en|ta|kn)(?=\/|$)/.exec(pathname);
  return match
    ? { locale: match[1]!, rest: pathname.slice(match[0].length) }
    : { locale: null, rest: pathname };
}

export function isPrivatePath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (PRIVATE_API.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  const section = splitLocale(path).rest.split("/")[1] ?? "";
  return PRIVATE_SECTIONS.includes(section);
}

export type PageRule = "network-only" | "stale-while-revalidate" | "network-first";

/**
 * How to serve a storefront page:
 * - home, product and category pages: from cache instantly, refreshed in the background
 *   (prices and stock are always rechecked by the server at checkout)
 * - other public pages (cart, search, shop, offline): network first, cache when offline
 * - private pages: network only
 */
export function pageRule(pathname: string): PageRule {
  if (isPrivatePath(pathname)) return "network-only";
  const { rest } = splitLocale(pathname);
  if (rest === "" || rest === "/" || /^\/(p|c)\/[^/]+\/?$/.test(rest))
    return "stale-while-revalidate";
  return "network-first";
}

export function isImageUrl(url: URL, origin: string): boolean {
  if (url.hostname === "res.cloudinary.com" || url.hostname === "picsum.photos") return true;
  if (url.origin !== origin) return false;
  return (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/icons/")
  );
}

/** The offline page in the language of the page that failed. */
export function offlinePath(pathname: string): string {
  return `/${splitLocale(pathname).locale ?? "en"}/offline`;
}

/** Push payloads may only open pages on this site. */
export function safeNotificationUrl(value: unknown, origin: string): string {
  if (typeof value !== "string") return "/";
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
