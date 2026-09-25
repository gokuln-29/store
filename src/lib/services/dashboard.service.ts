import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Admin dashboard numbers. Definitions (also shown in the UI):
 * - An order counts once it is placed (COD at checkout, online when paid), dated by placedAt,
 *   and unless it was cancelled. Revenue = sum of those orders' totals (incl. GST and shipping).
 * - AOV = revenue ÷ orders. Conversion = sessions that ordered ÷ sessions that visited (the
 *   funnel counts anonymous sessions only, so shoppers who opt out of tracking are left out
 *   of every step alike).
 * All periods are India time (IST) calendar days.
 */

export const RANGES = ["today", "7d", "30d"] as const;
export type Range = (typeof RANGES)[number];

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Start of the IST calendar day containing `date`, as a UTC instant. */
export function istStartOfDay(date: Date): Date {
  const shifted = date.getTime() + IST_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - IST_OFFSET_MS);
}

export function rangeBounds(
  range: Range,
  now = new Date(),
): { start: Date; end: Date; previousStart: Date; days: number } {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const start = new Date(istStartOfDay(now).getTime() - (days - 1) * DAY_MS);
  return { start, end: now, previousStart: new Date(start.getTime() - days * DAY_MS), days };
}

const COUNTED = Prisma.sql`o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED') AND o."placedAt" IS NOT NULL`;

type Totals = { revenue: number; orders: number; aov: number };

async function totals(from: Date, to: Date): Promise<Totals> {
  const [row] = await db.$queryRaw<{ revenue: bigint | null; orders: bigint }[]>`
    SELECT SUM(o.total) AS revenue, COUNT(*) AS orders
    FROM "Order" o
    WHERE ${COUNTED} AND o."placedAt" >= ${from} AND o."placedAt" < ${to}`;
  const revenue = Number(row?.revenue ?? 0);
  const orders = Number(row?.orders ?? 0);
  return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
}

export type SeriesPoint = { key: string; revenue: number; orders: number };

/** Revenue and orders per IST hour (today) or IST day (7/30 days), zero-filled. */
async function series(range: Range, start: Date, end: Date): Promise<SeriesPoint[]> {
  const unit = range === "today" ? "hour" : "day";
  const rows = await db.$queryRaw<{ bucket: Date; revenue: bigint; orders: bigint }[]>`
    SELECT date_trunc(${unit}, o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS bucket,
           SUM(o.total) AS revenue, COUNT(*) AS orders
    FROM "Order" o
    WHERE ${COUNTED} AND o."placedAt" >= ${start} AND o."placedAt" < ${end}
    GROUP BY bucket`;
  // `bucket` is an IST wall-clock time returned as a UTC-labelled timestamp.
  const byKey = new Map(
    rows.map((r) => [r.bucket.toISOString().slice(0, unit === "hour" ? 13 : 10), r]),
  );
  const points: SeriesPoint[] = [];
  const count =
    range === "today"
      ? 24
      : Math.round((istStartOfDay(end).getTime() - start.getTime()) / DAY_MS) + 1;
  for (let i = 0; i < count; i++) {
    const wall = new Date(
      start.getTime() + IST_OFFSET_MS + i * (unit === "hour" ? 60 * 60_000 : DAY_MS),
    );
    const key = wall.toISOString().slice(0, unit === "hour" ? 13 : 10);
    const row = byKey.get(key);
    points.push({ key, revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) });
  }
  return points;
}

export type Funnel = { visits: number; carts: number; checkouts: number; orders: number };

async function funnel(start: Date, end: Date): Promise<Funnel> {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const rows = await db.$queryRaw<{ step: string; sessions: bigint }[]>`
    SELECT step::text AS step, COUNT(DISTINCT "sessionId") AS sessions
    FROM "FunnelEvent"
    WHERE "day" BETWEEN ${day(start)}::date AND ${day(end)}::date
    GROUP BY step`;
  const n = (step: string) => Number(rows.find((r) => r.step === step)?.sessions ?? 0);
  return {
    visits: n("VISIT"),
    carts: n("ADD_TO_CART"),
    checkouts: n("CHECKOUT"),
    orders: n("ORDERED"),
  };
}

export type TopProduct = {
  productId: string;
  name: Prisma.JsonValue;
  quantity: number;
  revenue: number;
};

async function topProducts(start: Date, end: Date, limit = 5): Promise<TopProduct[]> {
  const rows = await db.$queryRaw<
    { productId: string; name: Prisma.JsonValue; quantity: bigint; revenue: bigint }[]
  >`
    SELECT oi."productId", (array_agg(oi."productName" ORDER BY o."placedAt" DESC))[1] AS name,
           SUM(oi.quantity) AS quantity, SUM(oi."lineTotal") AS revenue
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
    WHERE ${COUNTED} AND o."placedAt" >= ${start} AND o."placedAt" < ${end} AND oi."productId" IS NOT NULL
    GROUP BY oi."productId"
    ORDER BY revenue DESC, quantity DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue) }));
}

export function lowStock(limit = 8) {
  return db.$queryRaw<
    {
      variantId: string;
      productId: string;
      name: Prisma.JsonValue;
      sku: string;
      stock: number;
      threshold: number;
    }[]
  >`
    SELECT v.id AS "variantId", p.id AS "productId", p.name, v.sku, v.stock, v."lowStockThreshold" AS threshold
    FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
    WHERE v."isActive" AND p.status = 'PUBLISHED' AND v.stock <= v."lowStockThreshold"
    ORDER BY v.stock ASC, p."updatedAt" DESC
    LIMIT ${limit}`;
}

export async function getDashboard(range: Range, now = new Date()) {
  const { start, end, previousStart } = rangeBounds(range, now);
  const [current, previous, points, top, low, toConfirm, pendingReviews] = await Promise.all([
    totals(start, end),
    totals(previousStart, start),
    series(range, start, end),
    topProducts(start, end),
    lowStock(),
    db.order.count({ where: { status: "PLACED" } }),
    db.review.count({ where: { status: "PENDING" } }),
  ]);
  return {
    range,
    start,
    current,
    previous,
    series: points,
    funnel: await funnel(start, end),
    topProducts: top,
    lowStock: low,
    toConfirm,
    pendingReviews,
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/** Percentage change vs the previous period; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
