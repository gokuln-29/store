import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import {
  isImageUrl,
  isPrivatePath,
  offlinePath,
  pageRule,
  safeNotificationUrl,
  SW_LOCALES,
} from "@/sw/routes";

describe("service worker caching rules", () => {
  it("knows every store language", () => {
    expect([...SW_LOCALES].sort()).toEqual([...routing.locales].sort());
  });

  it("never caches admin, account, login, checkout, payment or order pages", () => {
    const privatePaths = [
      "/en/admin",
      "/ta/admin/orders/123",
      "/kn/checkout",
      "/en/checkout/pay/DS-1001",
      "/en/order/DS-1001",
      "/en/account",
      "/ta/account/orders/DS-1001",
      "/en/login",
      "/admin",
      "/EN/ADMIN",
      "/api/auth/session",
      "/api/admin/products/export",
      "/api/orders/DS-1001/invoice",
      "/api/webhooks/razorpay",
      "/api/cron/expire-orders",
      "/api/cart",
      "/serwist/sw.js",
    ];
    for (const path of privatePaths) {
      expect(isPrivatePath(path), path).toBe(true);
      expect(pageRule(path), path).toBe("network-only");
    }
  });

  it("serves product, category and home pages from cache while refreshing", () => {
    for (const path of ["/en", "/ta/", "/kn/p/mysore-pak", "/en/c/sweets"]) {
      expect(pageRule(path), path).toBe("stale-while-revalidate");
    }
    for (const path of ["/en/cart", "/en/search", "/en/shop", "/en/offline", "/en/p/x/y"]) {
      expect(pageRule(path), path).toBe("network-first");
    }
    // Look-alike paths are not private.
    expect(isPrivatePath("/en/p/admin-kit")).toBe(false);
    expect(isPrivatePath("/en/c/accounting-books")).toBe(false);
  });

  it("recognises images from the store and Cloudinary only", () => {
    const origin = "https://shop.example";
    const url = (u: string) => new URL(u, origin);
    expect(isImageUrl(url("/_next/image?url=x&w=640"), origin)).toBe(true);
    expect(isImageUrl(url("/uploads/products/a.jpg"), origin)).toBe(true);
    expect(isImageUrl(url("https://res.cloudinary.com/demo/image/upload/a.jpg"), origin)).toBe(
      true,
    );
    expect(isImageUrl(url("https://evil.example/uploads/a.jpg"), origin)).toBe(false);
    expect(isImageUrl(url("/en/p/x"), origin)).toBe(false);
  });

  it("picks the offline page in the right language", () => {
    expect(offlinePath("/ta/p/x")).toBe("/ta/offline");
    expect(offlinePath("/kn")).toBe("/kn/offline");
    expect(offlinePath("/something")).toBe("/en/offline");
  });

  it("only opens same-site pages from notifications", () => {
    const origin = "https://shop.example";
    expect(safeNotificationUrl("/en/account/orders/DS-1", origin)).toBe("/en/account/orders/DS-1");
    expect(safeNotificationUrl("https://shop.example/ta/c/x?y=1", origin)).toBe("/ta/c/x?y=1");
    expect(safeNotificationUrl("https://evil.example/phish", origin)).toBe("/");
    expect(safeNotificationUrl("javascript:alert(1)", origin)).toBe("/");
    expect(safeNotificationUrl(42, origin)).toBe("/");
  });
});
