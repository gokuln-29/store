import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { loadCartLines, type CartItemInput } from "./cart.service";
import { storeInitials } from "./checkout.service";
import {
  enqueueOrderNotification,
  NOTIFY_ON,
  scheduleNotificationDelivery,
} from "./notification.service";
import { canTransition, financialYear, formatInvoiceNumber, restocksOn } from "./order-status";
import { createRefund, refundableAmount, type RefundError } from "./payment.service";
import { getStoreSettingsFresh } from "./settings.service";

type Tx = Prisma.TransactionClient;

const PAID: readonly PaymentStatus[] = ["CAPTURED", "PARTIALLY_REFUNDED"];

export type Tracking = {
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type StatusActor =
  { type: "staff"; id: string; canRefund: boolean } | { type: "customer"; id: string };

export type StatusChangeError = "not_found" | "invalid_transition" | "stale" | "refund_permission";

export type StatusChangeResult =
  | {
      ok: true;
      status: OrderStatus;
      invoiceNumber: string | null;
      /** Set when cancelling a paid online order triggered a refund. */
      refund?: { ok: true; amount: number } | { ok: false; error: RefundError };
    }
  | { ok: false; error: StatusChangeError };

class Abort extends Error {
  constructor(readonly code: StatusChangeError) {
    super(code);
  }
}

async function lockOrder(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

/** Next consecutive invoice number for the financial year (rolled back with the transaction). */
async function nextInvoiceNumber(tx: Tx, now: Date): Promise<string> {
  const fy = financialYear(now);
  const [row] = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "InvoiceCounter" ("financialYear", "lastNumber") VALUES (${fy}, 1)
    ON CONFLICT ("financialYear")
    DO UPDATE SET "lastNumber" = "InvoiceCounter"."lastNumber" + 1
    RETURNING "lastNumber"`;
  if (!row) throw new Error("InvoiceCounter returned no row");
  const settings = await getStoreSettingsFresh();
  const prefix = settings.orderNumberPrefix ?? storeInitials(settings.name);
  return formatInvoiceNumber(prefix, fy, row.lastNumber);
}

async function restock(tx: Tx, items: { variantId: string | null; quantity: number }[]) {
  for (const item of items) {
    if (!item.variantId) continue; // variant deleted since: nothing to put back
    await tx.$executeRaw`
      UPDATE "ProductVariant" SET stock = stock + ${item.quantity}, "updatedAt" = now()
      WHERE id = ${item.variantId}`;
  }
}

/**
 * Moves an order to a new status, applying its side effects in one transaction:
 * - SHIPPED: tracking details, GST invoice number (first time only)
 * - DELIVERED: cash on delivery counts as collected
 * - CANCELLED: stock and coupon use released; a paid online order is refunded in full
 * - RETURNED: stock restored unless `restock` is false (damaged goods)
 * `expectedStatus` guards against acting on an out-of-date page.
 */
export async function changeOrderStatus(input: {
  orderId: string;
  to: OrderStatus;
  actor: StatusActor;
  expectedStatus?: OrderStatus;
  note?: string | null;
  tracking?: Tracking;
  restock?: boolean;
}): Promise<StatusChangeResult> {
  const { to, actor } = input;
  let refundAfter: { paymentId: string } | null = null;
  let result: { status: OrderStatus; invoiceNumber: string | null };

  try {
    result = await db.$transaction(async (tx) => {
      await lockOrder(tx, input.orderId);
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          userId: true,
          status: true,
          paymentMethod: true,
          invoiceNumber: true,
          items: { select: { variantId: true, quantity: true } },
          couponUsage: { select: { id: true, couponId: true } },
          payments: {
            orderBy: { createdAt: "asc" },
            select: { id: true, method: true, status: true, metadata: true },
          },
        },
      });
      if (!order) throw new Abort("not_found");
      if (actor.type === "customer" && order.userId !== actor.id) throw new Abort("not_found");
      if (input.expectedStatus && input.expectedStatus !== order.status) throw new Abort("stale");
      if (!canTransition(order.status, to, actor.type)) throw new Abort("invalid_transition");

      const mainPayment = order.payments.find(
        (p) => !(p.metadata && typeof p.metadata === "object" && "duplicateOf" in p.metadata),
      );
      const paidOnline =
        order.paymentMethod === "ONLINE" && !!mainPayment && PAID.includes(mainPayment.status);
      if (to === "CANCELLED" && paidOnline) {
        // Cancelling a paid order refunds it, so staff need the refund permission.
        if (actor.type === "staff" && !actor.canRefund) throw new Abort("refund_permission");
        refundAfter = { paymentId: mainPayment.id };
      }

      const now = new Date();
      const data: Prisma.OrderUpdateInput = { status: to };
      let invoiceNumber = order.invoiceNumber;

      switch (to) {
        case "SHIPPED":
          data.shippedAt = now;
          if (input.tracking) Object.assign(data, input.tracking);
          if (!invoiceNumber) {
            invoiceNumber = await nextInvoiceNumber(tx, now);
            data.invoiceNumber = invoiceNumber;
            data.invoicedAt = now;
          }
          break;
        case "DELIVERED":
          data.deliveredAt = now;
          if (order.paymentMethod === "COD") {
            await tx.payment.updateMany({
              where: { orderId: order.id, method: "COD", status: "PENDING" },
              data: { status: "CAPTURED" },
            });
            data.paymentStatus = "CAPTURED";
          }
          break;
        case "CANCELLED":
          data.cancelledAt = now;
          data.cancelReason = input.note?.trim() || null;
          if (order.couponUsage) {
            await tx.couponUsage.delete({ where: { id: order.couponUsage.id } });
            await tx.$executeRaw`
              UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = now()
              WHERE id = ${order.couponUsage.couponId}`;
          }
          if (order.paymentMethod === "COD") {
            await tx.payment.updateMany({
              where: { orderId: order.id, method: "COD", status: "PENDING" },
              data: { status: "FAILED", failureReason: "Order cancelled" },
            });
            data.paymentStatus = "FAILED";
          }
          break;
        case "RETURNED":
          data.returnedAt = now;
          break;
      }

      const restockMode = restocksOn(to);
      if (restockMode === "always" || (restockMode === "optional" && input.restock !== false)) {
        await restock(tx, order.items);
      }

      await tx.order.update({ where: { id: order.id }, data });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: to,
          note:
            actor.type === "customer"
              ? "cancelled_by_customer"
              : to === "RETURNED" && input.restock === false
                ? [input.note?.trim(), "not_restocked"].filter(Boolean).join(" · ")
                : input.note?.trim() || null,
          actorId: actor.type === "staff" ? actor.id : null,
        },
      });

      const template = NOTIFY_ON[to];
      if (template) {
        await enqueueOrderNotification(tx, order.id, template, { refund: !!refundAfter });
      }
      return { status: to, invoiceNumber };
    });
  } catch (error) {
    if (error instanceof Abort) return { ok: false, error: error.code };
    throw error;
  }

  let refund: Extract<StatusChangeResult, { ok: true }>["refund"];
  const pendingRefund = refundAfter as { paymentId: string } | null;
  if (pendingRefund) {
    const payment = await db.payment.findUniqueOrThrow({
      where: { id: pendingRefund.paymentId },
      include: { refunds: { select: { amount: true, status: true } } },
    });
    const amount = refundableAmount(payment);
    if (amount > 0) {
      const r = await createRefund({
        paymentId: payment.id,
        amount,
        reason: "order_cancelled",
        actorId: actor.type === "staff" ? actor.id : null,
      });
      refund = r.ok ? { ok: true, amount } : { ok: false, error: r.error };
    }
  }

  await scheduleNotificationDelivery(input.orderId);
  return { ok: true, ...result, ...(refund ? { refund } : {}) };
}

/** Corrects courier details after shipping. */
export async function updateTracking(
  orderId: string,
  tracking: Tracking,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "invalid_transition" }> {
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) return { ok: false as const, error: "not_found" as const };
    if (!["SHIPPED", "DELIVERED", "RETURNED"].includes(order.status)) {
      return { ok: false as const, error: "invalid_transition" as const };
    }
    await tx.order.update({ where: { id: orderId }, data: tracking });
    await tx.orderEvent.create({ data: { orderId, note: "tracking_updated", actorId } });
    return { ok: true as const };
  });
}

/** Staff-only note on the order timeline (never shown to the customer). */
export async function addInternalNote(
  orderId: string,
  note: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const exists = await db.order.count({ where: { id: orderId } });
  if (!exists) return { ok: false, error: "not_found" };
  await db.orderEvent.create({ data: { orderId, note, actorId, isInternal: true } });
  return { ok: true };
}

// ───────────── Queries ─────────────

export type OrderListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  /** Inclusive IST calendar dates, "YYYY-MM-DD". */
  from?: string;
  to?: string;
  sort?: "createdAt" | "total";
  dir?: "asc" | "desc";
};

/** Start of an IST calendar day as a UTC instant. */
export function istDayStart(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listOrders(query: OrderListQuery) {
  const from = query.from ? istDayStart(query.from) : null;
  const toStart = query.to ? istDayStart(query.to) : null;
  const to = toStart ? new Date(toStart.getTime() + 24 * 60 * 60_000) : null;
  const q = query.q?.trim();
  // Only a query without letters can be a phone number ("DS-1234" is an order number).
  const digits = q && !/\p{L}/u.test(q) ? q.replace(/\D/g, "") : "";
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            // A full mobile number is an exact (indexed) match; fewer digits search within.
            ...(digits.length >= 10
              ? [{ customerPhone: `+91${digits.slice(-10)}` }]
              : digits.length >= 4
                ? [{ customerPhone: { contains: digits } }]
                : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { [query.sort ?? "createdAt"]: query.dir ?? "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        customerPhone: true,
        total: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total };
}

export function getAdminOrder(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { refunds: { select: { amount: true, status: true } } },
      },
      user: { select: { id: true, email: true } },
    },
  });
}

export async function listCustomerOrders(userId: string, page: number, pageSize: number) {
  const where: Prisma.OrderWhereInput = { userId };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          orderBy: { id: "asc" },
          take: 3,
          select: { id: true, productName: true, imageUrl: true },
        },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total };
}

/** A customer's own order with its public timeline (no internal notes). */
export function getCustomerOrderDetail(orderNumber: string, userId: string) {
  return db.order.findFirst({
    where: { orderNumber, userId },
    include: {
      items: { orderBy: { id: "asc" } },
      events: {
        where: { isInternal: false, toStatus: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { id: true, toStatus: true, createdAt: true },
      },
    },
  });
}

/** Items of a past order that can be bought again right now (current prices apply). */
export async function reorderItems(
  orderNumber: string,
  userId: string,
): Promise<{ items: CartItemInput[]; unavailable: number } | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, userId },
    select: { items: { select: { variantId: true, quantity: true } } },
  });
  if (!order) return null;
  const wanted = order.items.flatMap((i) =>
    i.variantId ? [{ variantId: i.variantId, quantity: i.quantity }] : [],
  );
  const { lines } = await loadCartLines(wanted);
  return {
    items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    unavailable: order.items.length - lines.length,
  };
}
