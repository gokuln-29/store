/**
 * Message namespaces sent to the browser on storefront and account pages. Server components
 * translate on the server, so only namespaces used by client components ("use client") need
 * to travel with the page. The admin panel gets every namespace from its own provider.
 * tests/unit/client-namespaces.test.ts fails if a storefront client component uses a
 * namespace that is missing here.
 */
export const STORE_CLIENT_NAMESPACES = [
  "Account",
  "Addresses",
  "AdminLogin",
  "Cart",
  "Checkout",
  "Common",
  "Coupon",
  "CustomerLogin",
  "Errors",
  "Header",
  "Home",
  "Listing",
  "LocaleSwitcher",
  "MyOrders",
  "Order",
  "Product",
  "Pwa",
  "Reviews",
  "Search",
  "Wishlist",
] as const;

export function pickNamespaces<T extends Record<string, unknown>>(
  messages: T,
  namespaces: readonly string[],
): Partial<T> {
  return Object.fromEntries(
    namespaces.filter((n) => n in messages).map((n) => [n, messages[n]]),
  ) as Partial<T>;
}
