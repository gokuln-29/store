import Papa from "papaparse";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "./audit.service";
import { escapeCell } from "./product-csv";

/**
 * Customers for the admin: order count, lifetime value (LTV) and last order.
 * LTV = total of the customer's placed, not-cancelled orders (same rule as the dashboard).
 */

const COUNTED = Prisma.sql`o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED') AND o."placedAt" IS NOT NULL`;

export const CUSTOMER_SORTS = ["ltv", "orders", "lastOrder", "joined"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  orders: number;
  ltv: number;
  lastOrderAt: Date | null;
};

function searchSql(q: string | undefined): Prisma.Sql {
  if (!q) return Prisma.sql`TRUE`;
  const digits = q.replace(/\D/g, "");
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return Prisma.sql`(u.name ILIKE ${like} OR u.email ILIKE ${like}${
    digits.length >= 4 ? Prisma.sql` OR u.phone LIKE ${`%${digits.slice(-10)}%`}` : Prisma.empty
  })`;
}

const ORDER_BY: Record<CustomerSort, Prisma.Sql> = {
  ltv: Prisma.sql`ltv DESC, u."createdAt" DESC`,
  orders: Prisma.sql`orders DESC, u."createdAt" DESC`,
  lastOrder: Prisma.sql`"lastOrderAt" DESC NULLS LAST, u."createdAt" DESC`,
  joined: Prisma.sql`u."createdAt" DESC`,
};

async function customerRows(where: Prisma.Sql, sort: CustomerSort, limit: number, offset: number) {
  const rows = await db.$queryRaw<
    (Omit<CustomerRow, "orders" | "ltv"> & { orders: bigint; ltv: bigint })[]
  >`
    SELECT u.id, u.name, u.phone, u.email, u."createdAt",
           COUNT(o.id) FILTER (WHERE ${COUNTED}) AS orders,
           COALESCE(SUM(o.total) FILTER (WHERE ${COUNTED}), 0) AS ltv,
           MAX(o."placedAt") FILTER (WHERE ${COUNTED}) AS "lastOrderAt"
    FROM "User" u
    LEFT JOIN "Order" o ON o."userId" = u.id
    WHERE u.role = 'CUSTOMER' AND ${where}
    GROUP BY u.id
    ORDER BY ${ORDER_BY[sort]}
    LIMIT ${limit} OFFSET ${offset}`;
  return rows.map((r) => ({ ...r, orders: Number(r.orders), ltv: Number(r.ltv) }));
}

export async function listCustomers(query: {
  page: number;
  pageSize: number;
  q?: string;
  sort?: CustomerSort;
}) {
  const where = searchSql(query.q);
  const [rows, [count]] = await Promise.all([
    customerRows(where, query.sort ?? "ltv", query.pageSize, (query.page - 1) * query.pageSize),
    db.$queryRaw<
      { n: bigint }[]
    >`SELECT COUNT(*) AS n FROM "User" u WHERE u.role = 'CUSTOMER' AND ${where}`,
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

export async function getCustomer(id: string) {
  const user = await db.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      preferredLocale: true,
      createdAt: true,
      isActive: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });
  if (!user) return null;
  const [stats] = await customerRows(Prisma.sql`u.id = ${id}`, "joined", 1, 0);
  return { user, stats: stats! };
}

// ───────────── CSV exports ─────────────

const BOM = "﻿"; // lets Excel open UTF-8 (Tamil/Kannada names) correctly
const MAX_ROWS = 50_000;

function istDateTime(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

const rupees = (paise: number) => (paise / 100).toFixed(2);

function toCsv(fields: string[], rows: (string | number)[][]): string {
  return `${BOM}${Papa.unparse(
    { fields, data: rows.map((r) => r.map((c) => (typeof c === "string" ? escapeCell(c) : c))) },
    { newline: "\r\n" },
  )}`;
}

export async function exportCustomersCsv(actorId: string): Promise<string> {
  const rows = await customerRows(Prisma.sql`TRUE`, "joined", MAX_ROWS, 0);
  await audit({
    actorId,
    action: "customers.export",
    entityType: "User",
    changes: { rows: rows.length },
  });
  return toCsv(
    ["Name", "Phone", "Email", "Joined", "Orders", "Lifetime value (INR)", "Last order"],
    rows.map((r) => [
      r.name ?? "",
      r.phone ?? "",
      r.email ?? "",
      istDateTime(r.createdAt),
      r.orders,
      rupees(r.ltv),
      istDateTime(r.lastOrderAt),
    ]),
  );
}

/** Orders created in [from, to) — every status, so the file can be reconciled. */
export async function exportOrdersCsv(from: Date, to: Date, actorId: string): Promise<string> {
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    select: {
      orderNumber: true,
      createdAt: true,
      placedAt: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      shippingAddress: true,
      subtotal: true,
      discountTotal: true,
      shippingTotal: true,
      codFee: true,
      taxTotal: true,
      total: true,
      couponCode: true,
      invoiceNumber: true,
      _count: { select: { items: true } },
    },
  });
  await audit({
    actorId,
    action: "orders.export",
    entityType: "Order",
    changes: { rows: orders.length, from: from.toISOString(), to: to.toISOString() },
  });
  return toCsv(
    [
      "Order",
      "Created",
      "Placed",
      "Status",
      "Payment method",
      "Payment status",
      "Customer",
      "Phone",
      "Email",
      "City",
      "State",
      "Pincode",
      "Items",
      "Subtotal",
      "Discount",
      "Shipping",
      "COD fee",
      "Tax",
      "Total",
      "Coupon",
      "Invoice",
    ],
    orders.map((o) => {
      const a = (o.shippingAddress ?? {}) as { city?: string; state?: string; pincode?: string };
      return [
        o.orderNumber,
        istDateTime(o.createdAt),
        istDateTime(o.placedAt),
        o.status,
        o.paymentMethod,
        o.paymentStatus,
        o.customerName,
        o.customerPhone,
        o.customerEmail ?? "",
        a.city ?? "",
        a.state ?? "",
        a.pincode ?? "",
        o._count.items,
        rupees(o.subtotal),
        rupees(o.discountTotal),
        rupees(o.shippingTotal),
        rupees(o.codFee),
        rupees(o.taxTotal),
        rupees(o.total),
        o.couponCode ?? "",
        o.invoiceNumber ?? "",
      ];
    }),
  );
}
