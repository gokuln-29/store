import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveFeatures } from "@/lib/features";
import { getBoughtTogether } from "@/lib/services/catalog-query.service";
import { buildQuote } from "@/lib/services/checkout.service";
import { couponStats, deleteCoupon, saveCoupon } from "@/lib/services/coupon.service";
import { getFeatures, updateFeatureSettings } from "@/lib/services/settings.service";
import { getWishlistIds, mergeWishlist, setWishlisted } from "@/lib/services/wishlist.service";
import { couponFormSchema } from "@/lib/validators/coupons";

let products: Record<string, string>;
let variants: Record<string, string>;
let admin: string;
let seq = 0;

beforeEach(async () => {
  await db.storeSettings.create({ data: { id: "default", name: "Demo", orderNumberPrefix: "DS" } });
  const category = await db.category.create({ data: { slug: "food", name: { en: "Food" } } });
  products = {};
  variants = {};
  for (const [slug, status] of [
    ["a", "PUBLISHED"],
    ["b", "PUBLISHED"],
    ["c", "PUBLISHED"],
    ["d", "PUBLISHED"],
    ["hidden", "DRAFT"],
  ] as const) {
    const p = await db.product.create({
      data: {
        slug,
        name: { en: slug.toUpperCase() },
        categoryId: category.id,
        status,
        variants: { create: [{ sku: slug.toUpperCase(), price: 10000, stock: 50 }] },
      },
      include: { variants: true },
    });
    products[slug] = p.id;
    variants[slug] = p.variants[0]!.id;
  }
  admin = (await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } })).id;
});

async function order(
  slugs: string[],
  status: "PLACED" | "CANCELLED" | "PENDING_PAYMENT" = "PLACED",
  extra: object = {},
) {
  seq += 1;
  return db.order.create({
    data: {
      orderNumber: `DS-${5000 + seq}`,
      status,
      paymentMethod: "COD",
      customerName: "A",
      customerPhone: "+919800000000",
      shippingAddress: {},
      subtotal: 10000 * slugs.length,
      total: 10000 * slugs.length,
      pricesIncludeTax: true,
      ...extra,
      items: {
        create: slugs.map((s) => ({
          productId: products[s],
          variantId: variants[s],
          productName: { en: s },
          sku: s,
          unitPrice: 10000,
          quantity: 1,
          taxRateBps: 0,
          taxAmount: 0,
          lineTotal: 10000,
        })),
      },
    },
  });
}

describe("feature switches", () => {
  it("default to on and can be turned off; coupons off means codes are ignored", async () => {
    expect(await getFeatures()).toEqual(resolveFeatures({}));
    expect(Object.values(await getFeatures()).every(Boolean)).toBe(true);
    await db.coupon.create({ data: { code: "SAVE10", type: "PERCENTAGE", value: 1000 } });
    const user = await db.user.create({ data: { phone: "+919811111111", role: "CUSTOMER" } });
    const quote = () =>
      buildQuote({
        items: [{ variantId: variants.a!, quantity: 1 }],
        destination: null,
        couponCode: "SAVE10",
        paymentMethod: null,
        customer: { userId: user.id, phone: user.phone },
      });
    expect((await quote()).coupon).toMatchObject({ status: "applied", discount: 1000 });

    await updateFeatureSettings({ ...resolveFeatures({}), coupons: false }, admin);
    expect((await getFeatures()).coupons).toBe(false);
    const off = await quote();
    expect(off.coupon).toBeNull();
    expect(off.price.discountTotal).toBe(0);
  });
});

describe("wishlist", () => {
  it("merges a guest list on login, skipping hidden products and duplicates", async () => {
    const user = await db.user.create({ data: { phone: "+919822222222", role: "CUSTOMER" } });
    await setWishlisted(user.id, products.b!, true);
    const merged = await mergeWishlist(user.id, [
      products.a!,
      products.b!,
      products.hidden!,
      "nope",
    ]);
    expect(merged.sort()).toEqual([products.a!, products.b!].sort());
    await setWishlisted(user.id, products.a!, false);
    await setWishlisted(user.id, products.hidden!, true); // not published: ignored
    expect(await getWishlistIds(user.id)).toEqual([products.b!]);
  });
});

describe("frequently bought together", () => {
  it("ranks products bought in the same paid orders, ignoring cancelled and unpaid ones", async () => {
    await order(["a", "b"]);
    await order(["a", "b", "c"]);
    await order(["a", "d"], "CANCELLED");
    await order(["a", "d"], "PENDING_PAYMENT");
    await order(["a", "hidden"]);
    const ids = (await getBoughtTogether(products.a!)).map((p) => p.id);
    expect(ids).toEqual([products.b!, products.c!]);
    expect(await getBoughtTogether(products.d!)).toEqual([]);
  });
});

describe("coupons admin", () => {
  const form = (code: string) =>
    couponFormSchema.parse({
      code,
      description: {},
      type: "FLAT",
      percent: "",
      amount: "50",
      minCartValue: "",
      maxDiscount: "",
      usageLimit: "",
      perUserLimit: "",
      startsAt: "",
      endsAt: "",
      isActive: true,
      categoryIds: [],
      productIds: [],
    });

  it("creates, rejects duplicate codes, reports stats and protects used coupons", async () => {
    const created = await saveCoupon(null, form("FEST50"), admin);
    expect(created).toMatchObject({ ok: true });
    expect(await saveCoupon(null, form("fest50".toUpperCase()), admin)).toEqual({
      ok: false,
      error: "couponCodeTaken",
    });
    if (!created.ok) return;

    const paid = await order(["a", "b"], "PLACED", {
      couponId: created.id,
      couponCode: "FEST50",
      discountTotal: 5000,
    });
    const cancelled = await order(["c"], "CANCELLED", {
      couponId: created.id,
      couponCode: "FEST50",
      discountTotal: 5000,
    });
    for (const o of [paid, cancelled]) {
      await db.couponUsage.create({
        data: { couponId: created.id, orderId: o.id, discountAmount: 5000 },
      });
    }
    expect((await couponStats([created.id])).get(created.id)).toEqual({
      uses: 1,
      discount: 5000,
      revenue: 20000,
    });
    expect(await deleteCoupon(created.id, admin)).toEqual({ ok: false, error: "coupon_used" });

    const unused = await saveCoupon(null, form("UNUSED"), admin);
    expect(await deleteCoupon((unused as { id: string }).id, admin)).toEqual({ ok: true });
    expect(await db.auditLog.count({ where: { entityType: "Coupon" } })).toBe(3);
  });
});
