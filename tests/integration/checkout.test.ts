import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  getSavedCartItems,
  loadCartLines,
  mergeGuestCart,
  saveCart,
} from "@/lib/services/cart.service";
import {
  buildQuote,
  placeOrder,
  recordMockPayment,
  storeInitials,
} from "@/lib/services/checkout.service";
import { addressSchema } from "@/lib/validators/auth";

const address = addressSchema.parse({
  label: "",
  name: "Asha Rao",
  phone: "9876543210",
  line1: "12 MG Road",
  line2: "",
  landmark: "",
  city: "Bengaluru",
  stateCode: "KA",
  pincode: "560001",
  isDefault: false,
});

let variantId: string;
let lowStockVariantId: string;

async function customer(phone: string) {
  return db.user.create({ data: { phone, role: "CUSTOMER", name: "Customer" } });
}

beforeEach(async () => {
  await db.storeSettings.create({
    data: {
      id: "default",
      name: "Demo Store",
      stateCode: "KA",
      pricesIncludeTax: true,
      defaultTaxRateBps: 1800,
      codEnabled: true,
      codFee: 4900,
      codMaxOrderValue: 500000,
      minOrderValue: 10000,
      orderNumberPrefix: "DS",
    },
  });
  const category = await db.category.create({
    data: { slug: "food", name: { en: "Food" }, taxRateBps: 500 },
  });
  const product = await db.product.create({
    data: {
      slug: "coffee",
      name: { en: "Coffee" },
      categoryId: category.id,
      status: "PUBLISHED",
      variants: {
        create: [
          { sku: "COFFEE-250", price: 22000, stock: 50, weightGrams: 260 },
          { sku: "COFFEE-1KG", price: 79900, stock: 1, weightGrams: 1030 },
        ],
      },
    },
    include: { variants: { orderBy: { sku: "asc" } } },
  });
  variantId = product.variants.find((v) => v.sku === "COFFEE-250")!.id;
  lowStockVariantId = product.variants.find((v) => v.sku === "COFFEE-1KG")!.id;
  await db.shippingRule.create({
    data: {
      name: "Local",
      pincodePrefixes: ["560"],
      rateType: "FLAT",
      flatRate: 4000,
      freeShippingThreshold: 99900,
      priority: 10,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
    },
  });
  await db.coupon.create({
    data: { code: "SAVE10", type: "PERCENTAGE", value: 1000, usageLimit: 1 },
  });
});

async function quoteFor(
  userId: string,
  items: { variantId: string; quantity: number }[],
  extra: { couponCode?: string | null; paymentMethod?: "COD" | "ONLINE" } = {},
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return buildQuote({
    items,
    destination: { pincode: "560001", stateCode: "KA" },
    couponCode: extra.couponCode ?? null,
    paymentMethod: extra.paymentMethod ?? null,
    customer: { userId, phone: user.phone },
  });
}

async function order(
  userId: string,
  items: { variantId: string; quantity: number }[],
  opts: {
    couponCode?: string | null;
    paymentMethod?: "COD" | "ONLINE";
    expectedTotal?: number;
  } = {},
) {
  const paymentMethod = opts.paymentMethod ?? "COD";
  const expectedTotal =
    opts.expectedTotal ??
    (await quoteFor(userId, items, { couponCode: opts.couponCode, paymentMethod })).price.total;
  return placeOrder({
    userId,
    items,
    address: { kind: "new", address, save: true },
    couponCode: opts.couponCode ?? null,
    paymentMethod,
    customerEmail: null,
    customerNote: null,
    expectedTotal,
    locale: "en",
  });
}

describe("checkout quote", () => {
  it("prices a cart with shipping, COD fee and GST split for the store's state", async () => {
    const user = await customer("+919000000001");
    const q = await quoteFor(user.id, [{ variantId, quantity: 2 }], { paymentMethod: "COD" });
    expect(q.issues).toEqual([]);
    expect(q.shipping).toMatchObject({ charge: 4000, isFree: false });
    expect(q.price).toMatchObject({
      subtotal: 44000,
      shippingTotal: 4000,
      codFee: 4900,
      total: 52900,
    });
    expect(q.price.taxBreakup!.igst).toBe(0);
    expect(q.price.taxBreakup!.cgst + q.price.taxBreakup!.sgst).toBe(q.price.taxTotal);
  });

  it("reports minimum order value, delivery and COD problems", async () => {
    const user = await customer("+919000000002");
    await db.storeSettings.update({ where: { id: "default" }, data: { minOrderValue: 50000 } });
    const small = await quoteFor(user.id, [{ variantId, quantity: 1 }]);
    expect(small.issues).toContainEqual({ code: "min_order_value", minOrderValue: 50000 });

    const far = await buildQuote({
      items: [{ variantId, quantity: 3 }],
      destination: { pincode: "110001", stateCode: "DL" },
      couponCode: null,
      paymentMethod: "COD",
      customer: null,
    });
    expect(far.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["not_deliverable"]));

    await db.storeSettings.update({
      where: { id: "default" },
      data: { minOrderValue: 0, codMaxOrderValue: 30000 },
    });
    const bigCod = await quoteFor(user.id, [{ variantId, quantity: 2 }], { paymentMethod: "COD" });
    expect(bigCod.codAvailable).toBe(false);
    expect(bigCod.issues).toContainEqual({ code: "cod_unavailable" });
  });

  it("drops unavailable items and reduces quantities above stock", async () => {
    const { lines, adjustments } = await loadCartLines([
      { variantId: lowStockVariantId, quantity: 3 },
      { variantId: "missing", quantity: 1 },
    ]);
    expect(lines.map((l) => [l.sku, l.quantity])).toEqual([["COFFEE-1KG", 1]]);
    expect(adjustments).toEqual([
      { variantId: lowStockVariantId, kind: "quantity_reduced", requested: 3, available: 1 },
      { variantId: "missing", kind: "unavailable" },
    ]);
  });
});

describe("placing orders", () => {
  it("creates a COD order with snapshots, reserves stock and clears the saved cart", async () => {
    const user = await customer("+919000000003");
    await saveCart(user.id, [{ variantId, quantity: 2 }]);
    const result = await order(user.id, [{ variantId, quantity: 2 }]);
    expect(result).toMatchObject({ ok: true, next: { type: "confirmation" } });
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^DS-\d{4,}$/);

    const saved = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true, payments: true, events: true },
    });
    expect(saved).toMatchObject({
      status: "PLACED",
      paymentMethod: "COD",
      total: 52900,
      codFee: 4900,
      customerPhone: "+919000000003",
    });
    expect(saved.shippingAddress).toMatchObject({
      city: "Bengaluru",
      stateCode: "KA",
      pincode: "560001",
    });
    expect(saved.items[0]).toMatchObject({
      sku: "COFFEE-250",
      unitPrice: 22000,
      quantity: 2,
      productName: { en: "Coffee" },
    });
    expect(saved.payments[0]).toMatchObject({ method: "COD", provider: "cod", amount: 52900 });
    expect(saved.events.map((e) => e.toStatus)).toEqual(["PLACED"]);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(
      48,
    );
    expect(await getSavedCartItems(user.id)).toEqual([]);
    expect(await db.address.count({ where: { userId: user.id } })).toBe(1);
  });

  it("ignores prices from the browser: a different expected total is rejected", async () => {
    const user = await customer("+919000000004");
    const result = await order(user.id, [{ variantId, quantity: 1 }], { expectedTotal: 100 });
    expect(result).toMatchObject({ ok: false, error: { code: "total_changed" } });
    expect(await db.order.count()).toBe(0);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(
      50,
    );
  });

  it("sells the last unit to exactly one of two simultaneous customers", async () => {
    const [a, b] = await Promise.all([customer("+919000000005"), customer("+919000000006")]);
    const results = await Promise.all([
      order(a.id, [{ variantId: lowStockVariantId, quantity: 1 }]),
      order(b.id, [{ variantId: lowStockVariantId, quantity: 1 }]),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && ["out_of_stock", "cart_changed"]).toContain(
      failed && !failed.ok ? failed.error.code : "",
    );
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: lowStockVariantId } })).stock,
    ).toBe(0);
    expect(await db.order.count()).toBe(1);
  });

  it("never oversells under many concurrent orders", async () => {
    await db.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
    const users = await Promise.all(
      Array.from({ length: 8 }, (_, i) => customer(`+91900000010${i}`)),
    );
    const results = await Promise.all(users.map((u) => order(u.id, [{ variantId, quantity: 1 }])));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(0);
  });

  it("enforces coupon usage limits under concurrency", async () => {
    const [a, b] = await Promise.all([customer("+919000000007"), customer("+919000000008")]);
    const items = [{ variantId, quantity: 2 }];
    const [qa, qb] = await Promise.all([
      quoteFor(a.id, items, { couponCode: "SAVE10", paymentMethod: "COD" }),
      quoteFor(b.id, items, { couponCode: "SAVE10", paymentMethod: "COD" }),
    ]);
    expect(qa.coupon).toMatchObject({ status: "applied", discount: 4400 });
    const results = await Promise.all([
      order(a.id, items, { couponCode: "SAVE10", expectedTotal: qa.price.total }),
      order(b.id, items, { couponCode: "SAVE10", expectedTotal: qb.price.total }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({
      ok: false,
      error: { code: "coupon_rejected" },
    });
    const coupon = await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } });
    expect(coupon.usedCount).toBe(1);
    expect(await db.couponUsage.count()).toBe(1);
  });

  it("takes online payments through the payment provider", async () => {
    const user = await customer("+919000000009");
    const result = await order(user.id, [{ variantId, quantity: 1 }], { paymentMethod: "ONLINE" });
    expect(result).toMatchObject({ ok: true, next: { type: "redirect" } });
    if (!result.ok) return;
    const pending = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { payments: true },
    });
    expect(pending).toMatchObject({
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      codFee: 0,
    });
    expect(pending.expiresAt).not.toBeNull();
    expect(pending.payments[0]!.providerOrderId).toMatch(/^mock_/);

    expect(await recordMockPayment(result.orderNumber, user.id, false)).toEqual({
      ok: true,
      status: "failed",
    });
    expect(await recordMockPayment(result.orderNumber, user.id, true)).toEqual({
      ok: true,
      status: "paid",
    });
    expect(await recordMockPayment(result.orderNumber, user.id, true)).toEqual({
      ok: true,
      status: "already_paid",
    });
    const paid = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(paid).toMatchObject({ status: "PLACED", paymentStatus: "CAPTURED", expiresAt: null });

    const stranger = await customer("+919000000010");
    expect(await recordMockPayment(result.orderNumber, stranger.id, true)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("carts", () => {
  it("merges a guest cart into the saved cart on login", async () => {
    const user = await customer("+919000000011");
    await saveCart(user.id, [{ variantId, quantity: 2 }]);
    const merged = await mergeGuestCart(user.id, [
      { variantId, quantity: 3 },
      { variantId: lowStockVariantId, quantity: 1 },
    ]);
    expect(merged).toEqual([
      { variantId, quantity: 5 },
      { variantId: lowStockVariantId, quantity: 1 },
    ]);
    expect(await getSavedCartItems(user.id)).toEqual(merged);
  });

  it("derives order number prefixes from the store name", () => {
    expect(storeInitials("Demo Store")).toBe("DS");
    expect(storeInitials("kaveri silk & sarees house")).toBe("KSSH");
    expect(storeInitials("!!!")).toBe("ORD");
  });
});
