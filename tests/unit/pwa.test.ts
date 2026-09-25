import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cartFromSnapshot } from "@/lib/cart-snapshot";
import { ICONS, iconVersion, loadLogo, renderIcon, type IconName } from "@/lib/pwa/icons";
import { buildManifest, shortName } from "@/lib/pwa/manifest";
import { pushCampaignSchema, pushSubscriptionSchema } from "@/lib/validators/push";

const source = { logoUrl: null, primaryColor: "#0f766e", updatedAt: new Date(0) };

describe("web app manifest", () => {
  it("is built from store settings", () => {
    const m = buildManifest({
      ...source,
      name: "Demo Store Online",
      tagline: { en: "Fresh sweets", ta: "இனிப்புகள்" },
      defaultLocale: "ta",
    });
    expect(m).toMatchObject({
      name: "Demo Store Online",
      short_name: "Demo Store",
      description: "இனிப்புகள்",
      start_url: "/ta?source=pwa",
      scope: "/",
      display: "standalone",
      theme_color: "#0f766e",
      lang: "ta",
    });
    const purposes = m.icons!.map((i) => `${i.sizes}:${i.purpose}`);
    expect(purposes).toEqual([
      "192x192:any",
      "512x512:any",
      "192x192:maskable",
      "512x512:maskable",
    ]);
    expect(m.icons![0]!.src).toMatch(/^\/icons\/icon-192\.png\?v=[0-9a-f]{10}$/);
  });

  it("shortens names for the home screen", () => {
    expect(shortName("Demo")).toBe("Demo");
    expect(shortName("Sri Lakshmi Sweets and Snacks")).toBe("Sri Lakshmi");
    expect(shortName("Supercalifragilistic")).toBe("Supercalifra");
  });

  it("versions icons by logo and colour", () => {
    const v = iconVersion(source);
    expect(iconVersion({ ...source, primaryColor: "#000000" })).not.toBe(v);
    expect(iconVersion({ ...source, logoUrl: "/uploads/branding/a.png" })).not.toBe(v);
    expect(iconVersion({ ...source, updatedAt: new Date() })).toBe(v);
  });
});

describe("app icons", () => {
  it("renders every size, with and without a logo", async () => {
    const logo = await sharp({
      create: { width: 300, height: 120, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    for (const withLogo of [null, logo]) {
      for (const name of Object.keys(ICONS) as IconName[]) {
        const png = await renderIcon(name, source, withLogo);
        const meta = await sharp(png).metadata();
        expect(meta.format).toBe("png");
        expect(meta.width).toBe(ICONS[name].size);
        expect(meta.height).toBe(ICONS[name].size);
      }
    }
  });

  it("keeps maskable content inside the safe zone and makes apple icons opaque", async () => {
    const logo = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const { data, info } = await sharp(await renderIcon("maskable-512.png", source, logo))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    expect(pixel(256, 256)).toBe(255); // logo (red) in the centre
    expect(pixel(40, 40)).toBe(255); // white margin in the corner, not logo
    expect(data[(40 * info.width + 40) * info.channels + 1]).toBe(255);
    const apple = await sharp(await renderIcon("apple-touch-icon.png", source, null)).stats();
    expect(apple.isOpaque).toBe(true);
  });

  it("falls back to the glyph for broken logos, and never reads outside uploads", async () => {
    const png = await renderIcon("icon-192.png", source, Buffer.from("not an image"));
    expect((await sharp(png).metadata()).width).toBe(192);
    expect(await loadLogo("/uploads/../../.env")).toBeNull();
    expect(await loadLogo("https://evil.example/logo.png")).toBeNull();
    expect(await loadLogo("http://res.cloudinary.com/x.png")).toBeNull();
    expect(await loadLogo(null)).toBeNull();
  });
});

describe("push validation", () => {
  const keys = {
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
  };
  const base = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys,
    orderUpdates: true,
    offers: false,
    locale: "en" as const,
  };

  it("accepts browser subscriptions over https only", () => {
    expect(pushSubscriptionSchema.safeParse(base).success).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({ ...base, endpoint: "http://x.example/push" }).success,
    ).toBe(false);
    expect(
      pushSubscriptionSchema.safeParse({ ...base, keys: { ...keys, auth: "<script>" } }).success,
    ).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...base, locale: "fr" }).success).toBe(false);
  });

  it("limits campaign length and only links to this store", () => {
    const ok = {
      title: { en: "Diwali sale" },
      body: { en: "20% off sweets" },
      imageUrl: "",
      url: "/c/sweets",
    };
    expect(pushCampaignSchema.parse(ok)).toMatchObject({ url: "/c/sweets", imageUrl: null });
    const issues = (input: object) =>
      (pushCampaignSchema.safeParse({ ...ok, ...input }).error?.issues ?? []).map((i) => [
        i.path.join("."),
        i.message,
      ]);
    expect(issues({ title: { en: "x".repeat(61) } })).toEqual([["title.en", "tooLong"]]);
    expect(issues({ body: { ta: "செய்தி" } })).toEqual([["body.en", "required"]]);
    expect(issues({ url: "https://evil.example" })).toEqual([["url", "pathInvalid"]]);
    expect(issues({ url: "//evil.example" })).toEqual([["url", "pathInvalid"]]);
    expect(issues({ imageUrl: "javascript:x" })).toEqual([["imageUrl", "urlInvalid"]]);
  });
});

describe("offline cart snapshot", () => {
  it("prices the current items from the last known prices", () => {
    const line = (variantId: string, unitPrice: number, stock: number) =>
      ({ variantId, unitPrice, stock, quantity: 1 }) as Parameters<
        typeof cartFromSnapshot
      >[0]["lines"][number];
    const snapshot = { lines: [line("a", 10000, 5), line("b", 2500, 1)], savedAt: 0 };
    const cart = cartFromSnapshot(snapshot, [
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 3 }, // more than stock: clamped
      { variantId: "c", quantity: 1 }, // unknown offline: left out
    ]);
    expect(cart.lines.map((l) => [l.variantId, l.quantity])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
    expect(cart.subtotal).toBe(22500);
  });
});
