import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { recordFunnelEvent } from "@/lib/services/analytics.service";
import {
  getDashboard,
  istStartOfDay,
  percentChange,
  rangeBounds,
} from "@/lib/services/dashboard.service";

// 2026-10-10 15:00 IST
const now = new Date("2026-10-10T09:30:00Z");
const ist = (s: string) => new Date(`${s}+05:30`);

let products: string[];
let seq = 0;

beforeEach(async () => {
  const category = await db.category.create({ data: { slug: "c", name: { en: "C" } } });
  products = [];
  for (const [i, stock] of [
    [1, 50],
    [2, 3],
    [3, 0],
  ] as const) {
    const p = await db.product.create({
      data: {
        slug: `p${i}`,
        name: { en: `P${i}` },
        categoryId: category.id,
        status: "PUBLISHED",
        variants: { create: [{ sku: `P${i}`, price: 10000 * i, stock, lowStockThreshold: 5 }] },
      },
    });
    products.push(p.id);
  }
});

async function order(
  placedAt: Date | null,
  total: number,
  status = "PLACED",
  items: [number, number][] = [[0, 1]],
) {
  seq += 1;
  return db.order.create({
    data: {
      orderNumber: `DS-${9000 + seq}`,
      status: status as "PLACED",
      placedAt,
      paymentMethod: "COD",
      customerName: "A",
      customerPhone: "+919800000000",
      shippingAddress: {},
      subtotal: total,
      total,
      pricesIncludeTax: true,
      items: {
        create: items.map(([p, qty]) => ({
          productId: products[p],
          productName: { en: `P${p + 1}` },
          sku: `P${p + 1}`,
          unitPrice: Math.round(total / qty),
          quantity: qty,
          taxRateBps: 0,
          taxAmount: 0,
          lineTotal: total,
        })),
      },
    },
  });
}

describe("dashboard", () => {
  it("uses India-time day boundaries", () => {
    expect(istStartOfDay(now).toISOString()).toBe("2026-10-09T18:30:00.000Z");
    expect(rangeBounds("7d", now).start.toISOString()).toBe("2026-10-03T18:30:00.000Z");
    expect(rangeBounds("30d", now).previousStart.toISOString()).toBe("2026-08-11T18:30:00.000Z");
  });

  it("matches the orders in the database for each range", async () => {
    await order(ist("2026-10-10T00:30:00"), 50000, "PLACED", [[0, 2]]); // today, early
    await order(ist("2026-10-10T14:00:00"), 30000, "DELIVERED", [[1, 1]]); // today
    await order(ist("2026-10-09T23:30:00"), 20000); // yesterday late: not "today"
    await order(ist("2026-10-05T12:00:00"), 10000); // within 7 days
    await order(ist("2026-09-30T12:00:00"), 70000); // previous 7-day period
    await order(ist("2026-10-10T10:00:00"), 99900, "CANCELLED"); // never counts
    await order(null, 88800, "PENDING_PAYMENT"); // unpaid: never counts

    const today = await getDashboard("today", now);
    expect(today.current).toEqual({ revenue: 80000, orders: 2, aov: 40000 });
    expect(today.series).toHaveLength(24);
    expect(today.series.find((p) => p.key === "2026-10-10T00")).toEqual({
      key: "2026-10-10T00",
      revenue: 50000,
      orders: 1,
    });
    expect(today.series.reduce((s, p) => s + p.revenue, 0)).toBe(80000);

    const week = await getDashboard("7d", now);
    expect(week.current).toEqual({ revenue: 110000, orders: 4, aov: 27500 });
    expect(week.previous).toEqual({ revenue: 70000, orders: 1, aov: 70000 });
    expect(week.series.map((p) => p.key)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(week.series.reduce((s, p) => s + p.orders, 0)).toBe(4);

    // Independent check straight from the rows.
    const rows = await db.order.findMany({
      where: {
        status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] },
        placedAt: { gte: rangeBounds("7d", now).start, lt: now },
      },
    });
    expect(week.current.revenue).toBe(rows.reduce((s, o) => s + o.total, 0));

    expect(week.topProducts.map((p) => [p.productId, p.quantity, p.revenue])).toEqual([
      [products[0], 4, 80000],
      [products[1], 1, 30000],
    ]);
    expect(week.toConfirm).toBe(4); // PLACED orders (incl. the older one)
  });

  it("builds the funnel from unique anonymous sessions", async () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    for (let i = 0; i < 3; i++) await recordFunnelEvent(a, "VISIT", now); // repeats count once
    await recordFunnelEvent(b, "VISIT", now);
    await recordFunnelEvent(a, "ADD_TO_CART", now);
    await recordFunnelEvent(a, "CHECKOUT", now);
    await recordFunnelEvent(a, "ORDERED", now);
    await recordFunnelEvent(b, "VISIT", new Date("2026-09-01T00:00:00Z")); // outside the range
    await order(ist("2026-10-10T11:00:00"), 10000);
    expect((await getDashboard("today", now)).funnel).toEqual({
      visits: 2,
      carts: 1,
      checkouts: 1,
      orders: 1,
    });
  });

  it("lists low stock by each variant's own threshold", async () => {
    const d = await getDashboard("7d", now);
    expect(d.lowStock.map((v) => [v.sku, v.stock])).toEqual([
      ["P3", 0],
      ["P2", 3],
    ]);
  });

  it("computes period-over-period change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(0, 100)).toBe(-100);
    expect(percentChange(5, 0)).toBeNull();
  });
});
