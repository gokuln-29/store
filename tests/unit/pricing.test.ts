import { describe, expect, it } from "vitest";
import { pincodeMatchesState } from "@/lib/constants/pincode-zones";
import {
  allocate,
  evaluateCoupon,
  mulDivRound,
  priceOrder,
  resolveTaxRate,
  splitTax,
  taxFromInclusive,
  taxOnExclusive,
  type CouponLine,
  type CouponRule,
  type PricingLine,
} from "@/lib/services/pricing";

const line = (overrides: Partial<PricingLine> = {}): PricingLine => ({
  variantId: "v1",
  productId: "p1",
  categoryPath: ["clothing"],
  unitPrice: 49900,
  quantity: 1,
  taxRateBps: 500,
  weightGrams: 200,
  ...overrides,
});

const inclusive = { pricesIncludeTax: true, storeStateCode: "KA", codFee: 4900 };
const exclusive = { ...inclusive, pricesIncludeTax: false };

describe("integer maths", () => {
  it("rounds half up without floats", () => {
    expect(mulDivRound(10, 1, 4)).toBe(3); // 2.5 → 3
    expect(mulDivRound(10, 1, 3)).toBe(3); // 3.33 → 3
    expect(mulDivRound(11, 1, 3)).toBe(4); // 3.67 → 4
    expect(mulDivRound(0, 500, 10500)).toBe(0);
    expect(() => mulDivRound(1, 1, 0)).toThrow();
  });

  it("extracts and adds GST", () => {
    expect(taxFromInclusive(105000, 500)).toBe(5000); // ₹1050 incl 5% → ₹50
    expect(taxFromInclusive(118000, 1800)).toBe(18000);
    expect(taxFromInclusive(49900, 500)).toBe(2376); // 2376.19
    expect(taxOnExclusive(100000, 1800)).toBe(18000);
    expect(taxOnExclusive(12345, 1200)).toBe(1481); // 1481.4
    expect(taxFromInclusive(50000, 0)).toBe(0);
  });

  it("allocates exactly, largest remainders first", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [0, 5, 5])).toEqual([0, 5, 5]);
    expect(allocate(7, [2, 1])).toEqual([5, 2]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    const parts = allocate(99_999, [49900, 12345, 777]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(99_999);
  });

  it("splits GST for intra- and inter-state sales", () => {
    expect(splitTax(101, true)).toEqual({ cgst: 50, sgst: 51, igst: 0 });
    expect(splitTax(101, false)).toEqual({ cgst: 0, sgst: 0, igst: 101 });
  });

  it("resolves tax rate product → category → store", () => {
    expect(resolveTaxRate(1200, 500, 1800)).toBe(1200);
    expect(resolveTaxRate(null, 500, 1800)).toBe(500);
    expect(resolveTaxRate(null, null, 1800)).toBe(1800);
    expect(resolveTaxRate(0, 500, 1800)).toBe(0);
  });
});

describe("priceOrder", () => {
  it("prices tax-inclusive lines without changing the total", () => {
    const r = priceOrder({
      lines: [
        line({ quantity: 2 }),
        line({ variantId: "v2", unitPrice: 249900, taxRateBps: 1800 }),
      ],
      settings: inclusive,
      shipping: null,
      cod: false,
      destinationStateCode: null,
    });
    expect(r.subtotal).toBe(349700);
    expect(r.total).toBe(349700);
    expect(r.lines[0]).toMatchObject({
      amount: 99800,
      taxAmount: 4752,
      taxableValue: 95048,
      total: 99800,
    });
    expect(r.lines[1]).toMatchObject({ taxAmount: 38120, total: 249900 });
    expect(r.taxTotal).toBe(4752 + 38120);
    expect(r.taxBreakup).toBeNull();
  });

  it("adds GST on top for tax-exclusive stores", () => {
    const r = priceOrder({
      lines: [line({ unitPrice: 100000, taxRateBps: 1800 })],
      settings: exclusive,
      shipping: null,
      cod: false,
      destinationStateCode: "TN",
    });
    expect(r).toMatchObject({
      subtotal: 100000,
      taxTotal: 18000,
      total: 118000,
      taxBreakup: { cgst: 0, sgst: 0, igst: 18000 },
    });
  });

  it("taxes shipping and COD fee at the highest item rate", () => {
    const r = priceOrder({
      lines: [
        line({ taxRateBps: 500 }),
        line({ variantId: "v2", unitPrice: 100000, taxRateBps: 1800 }),
      ],
      settings: inclusive,
      shipping: { charge: 11800 },
      cod: true,
      destinationStateCode: "KA",
    });
    expect(r.chargesTaxRateBps).toBe(1800);
    expect(r.shippingTotal).toBe(11800);
    expect(r.codFee).toBe(4900);
    const lineTax = taxFromInclusive(49900, 500) + taxFromInclusive(100000, 1800);
    expect(r.taxTotal).toBe(lineTax + 1800 + taxFromInclusive(4900, 1800));
    expect(r.total).toBe(49900 + 100000 + 11800 + 4900);
    expect(r.taxBreakup!.cgst + r.taxBreakup!.sgst).toBe(r.taxTotal);
    expect(r.taxBreakup!.igst).toBe(0);
  });

  it("adds tax to shipping and COD fee in exclusive mode", () => {
    const r = priceOrder({
      lines: [line({ unitPrice: 10000, taxRateBps: 1200 })],
      settings: exclusive,
      shipping: { charge: 5000 },
      cod: true,
      destinationStateCode: "KA",
    });
    expect(r.shippingTotal).toBe(5600);
    expect(r.codFee).toBe(4900 + 588);
    expect(r.total).toBe(11200 + 5600 + 5488);
  });

  it("applies coupon discounts to the taxable value", () => {
    const r = priceOrder({
      lines: [line({ unitPrice: 105000 })],
      lineDiscounts: [5000],
      settings: inclusive,
      shipping: null,
      cod: false,
      destinationStateCode: null,
    });
    expect(r.lines[0]).toMatchObject({
      amount: 105000,
      discount: 5000,
      total: 100000,
      taxAmount: taxFromInclusive(100000, 500),
    });
    expect(r).toMatchObject({ discountTotal: 5000, merchandiseTotal: 100000, total: 100000 });
  });

  it("never discounts a line below zero", () => {
    const r = priceOrder({
      lines: [line({ unitPrice: 1000 })],
      lineDiscounts: [5000],
      settings: inclusive,
      shipping: null,
      cod: false,
      destinationStateCode: null,
    });
    expect(r.total).toBe(0);
    expect(r.lines[0]!.discount).toBe(1000);
  });

  it("sums weight for shipping", () => {
    const r = priceOrder({
      lines: [line({ quantity: 3, weightGrams: 250 }), line({ variantId: "v2", weightGrams: 0 })],
      settings: inclusive,
      shipping: null,
      cod: false,
      destinationStateCode: null,
    });
    expect(r.totalWeightGrams).toBe(750);
  });

  it("keeps totals consistent for many random carts", () => {
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % max;
    };
    for (let i = 0; i < 300; i++) {
      const lines = Array.from({ length: 1 + rand(5) }, (_, j) =>
        line({
          variantId: `v${j}`,
          unitPrice: 100 + rand(500_000),
          quantity: 1 + rand(5),
          taxRateBps: [0, 500, 1200, 1800, 2800][rand(5)]!,
        }),
      );
      const settings = rand(2) ? inclusive : exclusive;
      const discounts = allocate(
        rand(20_000),
        lines.map((l) => l.unitPrice * l.quantity),
      );
      const r = priceOrder({
        lines,
        lineDiscounts: discounts,
        settings,
        shipping: { charge: rand(20_000) },
        cod: rand(2) === 1,
        destinationStateCode: rand(2) ? "KA" : "TN",
      });
      for (const v of [r.total, r.taxTotal, r.subtotal, r.discountTotal])
        expect(Number.isInteger(v)).toBe(true);
      expect(r.total).toBe(r.lines.reduce((s, l) => s + l.total, 0) + r.shippingTotal + r.codFee);
      expect(r.taxBreakup!.cgst + r.taxBreakup!.sgst + r.taxBreakup!.igst).toBe(r.taxTotal);
      if (settings.pricesIncludeTax)
        expect(r.total).toBe(r.subtotal - r.discountTotal + r.shippingTotal + r.codFee);
      for (const l of r.lines)
        expect(l.taxableValue + (settings.pricesIncludeTax ? l.taxAmount : 0)).toBe(
          l.amount - l.discount,
        );
    }
  });
});

describe("evaluateCoupon", () => {
  const coupon = (overrides: Partial<CouponRule> = {}): CouponRule => ({
    code: "TEST",
    type: "PERCENTAGE",
    value: 1000,
    minCartValue: null,
    maxDiscount: null,
    usageLimit: null,
    perUserLimit: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    categoryIds: [],
    productIds: [],
    ...overrides,
  });
  const lines: CouponLine[] = [
    { productId: "tee", categoryPath: ["tops", "clothing"], amount: 60000 },
    { productId: "coffee", categoryPath: ["food"], amount: 40000 },
  ];
  const now = new Date("2026-06-01T12:00:00Z");
  const ctx = { now, usedByCustomer: 0 };

  it("applies a percentage across the cart", () => {
    expect(evaluateCoupon(coupon(), lines, ctx)).toEqual({
      ok: true,
      discount: 10000,
      perLine: [6000, 4000],
    });
  });

  it("caps percentage discounts at the maximum", () => {
    expect(evaluateCoupon(coupon({ value: 5000, maxDiscount: 20000 }), lines, ctx)).toMatchObject({
      ok: true,
      discount: 20000,
    });
  });

  it("applies flat discounts, never more than the eligible amount", () => {
    expect(evaluateCoupon(coupon({ type: "FLAT", value: 10000 }), lines, ctx)).toMatchObject({
      ok: true,
      discount: 10000,
      perLine: [6000, 4000],
    });
    expect(
      evaluateCoupon(coupon({ type: "FLAT", value: 999999, productIds: ["coffee"] }), lines, ctx),
    ).toMatchObject({ ok: true, discount: 40000, perLine: [0, 40000] });
  });

  it("limits to categories (including sub-categories) and products", () => {
    expect(evaluateCoupon(coupon({ categoryIds: ["clothing"] }), lines, ctx)).toEqual({
      ok: true,
      discount: 6000,
      perLine: [6000, 0],
    });
    expect(evaluateCoupon(coupon({ categoryIds: ["electronics"] }), lines, ctx)).toEqual({
      ok: false,
      reason: "not_applicable",
    });
  });

  it("checks minimum cart value against the whole cart", () => {
    expect(evaluateCoupon(coupon({ minCartValue: 100001 }), lines, ctx)).toEqual({
      ok: false,
      reason: "min_cart_value",
      minCartValue: 100001,
    });
    expect(evaluateCoupon(coupon({ minCartValue: 100000 }), lines, ctx).ok).toBe(true);
  });

  it("checks status, dates and usage limits", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), lines, ctx)).toMatchObject({
      reason: "inactive",
    });
    expect(evaluateCoupon(coupon({ startsAt: new Date("2026-07-01") }), lines, ctx)).toMatchObject({
      reason: "not_started",
    });
    expect(evaluateCoupon(coupon({ endsAt: new Date("2026-05-31") }), lines, ctx)).toMatchObject({
      reason: "expired",
    });
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), lines, ctx)).toMatchObject({
      reason: "usage_limit",
    });
    expect(
      evaluateCoupon(coupon({ perUserLimit: 1 }), lines, { now, usedByCustomer: 1 }),
    ).toMatchObject({ reason: "per_user_limit" });
  });
});

describe("pincodeMatchesState", () => {
  it("flags clear mismatches only", () => {
    expect(pincodeMatchesState("560001", "KA")).toBe(true);
    expect(pincodeMatchesState("600020", "TN")).toBe(true);
    expect(pincodeMatchesState("600020", "KA")).toBe(false);
    expect(pincodeMatchesState("500001", "AP")).toBe(true); // shared zone
    expect(pincodeMatchesState("990001", "KA")).toBe(true); // unknown prefix
  });
});
