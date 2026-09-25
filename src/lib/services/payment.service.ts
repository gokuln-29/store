import { randomUUID } from "node:crypto";
import {
  Prisma,
  type PaymentMethod,
  type PaymentStatus,
  type RefundStatus,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  getPaymentProviderByName,
  PaymentProviderError,
  type ProviderRefund,
} from "@/lib/providers/payment";
import { audit } from "./audit.service";
import { enqueueOrderNotification, scheduleNotificationDelivery } from "./notification.service";

/**
 * Online payment lifecycle: capture, failure and retry, expiry of unpaid orders, refunds.
 *
 * Every function here is idempotent and may run concurrently from the browser callback, the
 * provider webhook, the expiry job and admin actions. Lock order is always Order row first,
 * then Payment, so these never deadlock each other.
 */

type Tx = Prisma.TransactionClient;

const PAID: readonly PaymentStatus[] = ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"];
const REFUNDABLE: readonly PaymentStatus[] = ["CAPTURED", "PARTIALLY_REFUNDED"];

async function lockOrder(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

function event(tx: Tx, orderId: string, note: string, actorId: string | null = null) {
  return tx.orderEvent.create({ data: { orderId, note, actorId } });
}

type Meta = Record<string, unknown>;
function mergeMeta(current: Prisma.JsonValue | null, patch: Meta): Prisma.InputJsonValue {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}
function isDuplicatePayment(meta: Prisma.JsonValue | null): boolean {
  return !!meta && typeof meta === "object" && !Array.isArray(meta) && "duplicateOf" in meta;
}

// ───────────── Payment session ─────────────

/**
 * Makes sure the order's pending payment has a provider order to pay against (creates one if
 * the first attempt at checkout failed). Retries reuse the same provider order.
 */
export async function ensurePaymentSession(
  orderId: string,
): Promise<{ provider: string; providerOrderId: string; amount: number } | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      payments: {
        where: { method: "ONLINE", status: { in: ["PENDING", "FAILED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const payment = order?.payments[0];
  if (!order || order.status !== "PENDING_PAYMENT" || !payment) return null;
  if (payment.providerOrderId) {
    return {
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      amount: payment.amount,
    };
  }

  const session = await getPaymentProviderByName(payment.provider).createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: payment.amount,
    currency: "INR",
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
  });
  // Another request may have created one meanwhile; keep whichever was stored first.
  await db.payment.updateMany({
    where: { id: payment.id, providerOrderId: null },
    data: { providerOrderId: session.providerOrderId },
  });
  const stored = await db.payment.findUniqueOrThrow({
    where: { id: payment.id },
    select: { provider: true, providerOrderId: true, amount: true },
  });
  return {
    provider: stored.provider,
    providerOrderId: stored.providerOrderId!,
    amount: stored.amount,
  };
}

// ───────────── Capture / failure ─────────────

export type CaptureResult =
  | { outcome: "paid" | "already_paid" | "not_found" | "amount_mismatch" }
  | {
      outcome: "refund_required";
      reason: "order_expired" | "duplicate_payment";
      paymentId: string;
      amount: number;
    };

/**
 * Records a successful payment. Safe to call any number of times, in any order with the
 * webhook. A payment that arrives after its order expired, or a second payment for an order
 * that is already paid, is recorded and refunded in full.
 */
export async function markPaymentCaptured(input: {
  providerOrderId: string;
  providerPaymentId: string;
  amount: number;
  method: string | null;
}): Promise<CaptureResult> {
  const result = await db.$transaction(async (tx): Promise<CaptureResult> => {
    const ref = await tx.payment.findUnique({
      where: { providerOrderId: input.providerOrderId },
      select: { orderId: true },
    });
    if (!ref) return { outcome: "not_found" };
    await lockOrder(tx, ref.orderId);

    const known = await tx.payment.findUnique({
      where: { providerPaymentId: input.providerPaymentId },
      select: { id: true },
    });
    if (known) return { outcome: "already_paid" };

    const payment = await tx.payment.findUniqueOrThrow({
      where: { providerOrderId: input.providerOrderId },
    });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: ref.orderId },
      select: { id: true, status: true },
    });

    if (input.amount !== payment.amount) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          metadata: mergeMeta(payment.metadata, {
            amountMismatch: { providerPaymentId: input.providerPaymentId, amount: input.amount },
          }),
        },
      });
      await event(tx, order.id, "payment_amount_mismatch");
      return { outcome: "amount_mismatch" };
    }

    if (PAID.includes(payment.status)) {
      // A second successful payment for the same order: track it and give it back.
      const extra = await tx.payment.create({
        data: {
          orderId: order.id,
          method: "ONLINE",
          provider: payment.provider,
          status: "CAPTURED",
          amount: input.amount,
          providerPaymentId: input.providerPaymentId,
          metadata: { duplicateOf: payment.id, method: input.method },
        },
      });
      await event(tx, order.id, "payment_duplicate_refunding");
      return {
        outcome: "refund_required",
        reason: "duplicate_payment",
        paymentId: extra.id,
        amount: input.amount,
      };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        providerPaymentId: input.providerPaymentId,
        failureReason: null,
        metadata: mergeMeta(payment.metadata, { method: input.method }),
      },
    });

    if (order.status === "CANCELLED") {
      // Paid after the order expired and its stock was released: refund it.
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "CAPTURED" } });
      await event(tx, order.id, "late_payment_refunding");
      return {
        outcome: "refund_required",
        reason: "order_expired",
        paymentId: payment.id,
        amount: payment.amount,
      };
    }

    const now = new Date();
    if (order.status === "PENDING_PAYMENT") {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "PLACED", paymentStatus: "CAPTURED", placedAt: now, expiresAt: null },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: "PENDING_PAYMENT",
          toStatus: "PLACED",
          note: "payment_captured",
        },
      });
      await enqueueOrderNotification(tx, order.id, "order_placed");
    } else {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "CAPTURED" } });
    }
    return { outcome: "paid" };
  });

  if (result.outcome === "paid") {
    const { orderId } = await db.payment.findUniqueOrThrow({
      where: { providerOrderId: input.providerOrderId },
      select: { orderId: true },
    });
    await scheduleNotificationDelivery(orderId);
  }
  if (result.outcome === "refund_required") {
    const refund = await createRefund({
      paymentId: result.paymentId,
      amount: result.amount,
      reason: result.reason,
      actorId: null,
    });
    if (!refund.ok) {
      console.error(`[payments] automatic refund of ${result.paymentId} failed: ${refund.error}`);
    }
  }
  return result;
}

/** Records a failed attempt. The order stays payable (retry) until it expires. */
export async function markPaymentFailed(input: {
  providerOrderId: string;
  providerPaymentId: string | null;
  reason: string | null;
}): Promise<"failed" | "ignored" | "not_found"> {
  return db.$transaction(async (tx) => {
    const ref = await tx.payment.findUnique({
      where: { providerOrderId: input.providerOrderId },
      select: { orderId: true },
    });
    if (!ref) return "not_found";
    await lockOrder(tx, ref.orderId);
    const payment = await tx.payment.findUniqueOrThrow({
      where: { providerOrderId: input.providerOrderId },
    });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: ref.orderId },
      select: { status: true },
    });
    // A late failure report for an earlier attempt must not undo a success.
    if (PAID.includes(payment.status) || order.status !== "PENDING_PAYMENT") return "ignored";

    const reason = (input.reason ?? "Payment failed").slice(0, 500);
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: reason,
        metadata: mergeMeta(payment.metadata, { lastFailedPaymentId: input.providerPaymentId }),
      },
    });
    await tx.order.update({ where: { id: ref.orderId }, data: { paymentStatus: "FAILED" } });
    await event(tx, ref.orderId, "payment_failed");
    return "failed";
  });
}

// ───────────── Browser callbacks ─────────────

export type CheckoutPaymentResult =
  | { ok: true; status: "paid" | "failed" | "pending" | "already_paid" }
  | {
      ok: false;
      error: "not_found" | "invalid_signature" | "order_expired" | "provider_error";
    };

/**
 * The customer's browser reports a successful payment (Razorpay Checkout handler).
 * The signature proves it came from the provider; the payment is then fetched from the
 * provider so the amount and status never come from the browser.
 */
export async function confirmCheckoutPayment(input: {
  orderNumber: string;
  userId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<CheckoutPaymentResult> {
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, userId: input.userId, paymentMethod: "ONLINE" },
    select: {
      id: true,
      payments: { where: { providerOrderId: input.providerOrderId }, select: { provider: true } },
    },
  });
  const stored = order?.payments[0];
  if (!order || !stored) return { ok: false, error: "not_found" };

  const provider = getPaymentProviderByName(stored.provider);
  if (!provider.verifyCheckoutSignature(input)) return { ok: false, error: "invalid_signature" };

  try {
    let payment = await provider.getPayment(input.providerPaymentId);
    if (payment.providerOrderId !== input.providerOrderId) {
      return { ok: false, error: "invalid_signature" };
    }
    if (payment.status === "authorized") {
      payment = await provider.capturePayment(payment.id, payment.amount);
    }
    if (payment.status === "captured" || payment.status === "refunded") {
      const result = await markPaymentCaptured({
        providerOrderId: input.providerOrderId,
        providerPaymentId: payment.id,
        amount: payment.amount,
        method: payment.method,
      });
      if (result.outcome === "refund_required" && result.reason === "order_expired") {
        return { ok: false, error: "order_expired" };
      }
      if (result.outcome === "not_found") return { ok: false, error: "not_found" };
      if (result.outcome === "amount_mismatch") return { ok: false, error: "provider_error" };
      return { ok: true, status: result.outcome === "already_paid" ? "already_paid" : "paid" };
    }
    if (payment.status === "failed") {
      await markPaymentFailed({
        providerOrderId: input.providerOrderId,
        providerPaymentId: payment.id,
        reason: payment.errorDescription,
      });
      return { ok: true, status: "failed" };
    }
    return { ok: true, status: "pending" };
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      console.error(`[payments] ${error.message}`);
      return { ok: false, error: "provider_error" };
    }
    throw error;
  }
}

export type MockPaymentResult =
  | { ok: true; status: "paid" | "failed" | "already_paid" }
  | { ok: false; error: "not_found" | "order_expired" };

/** Test payment page (mock provider): simulate success or failure. Idempotent. */
export async function recordMockPayment(
  orderNumber: string,
  userId: string,
  success: boolean,
): Promise<MockPaymentResult> {
  const order = await db.order.findFirst({
    where: { orderNumber, userId, paymentMethod: "ONLINE" },
    select: { id: true, status: true, paymentStatus: true, expiresAt: true },
  });
  if (!order) return { ok: false, error: "not_found" };
  if (PAID.includes(order.paymentStatus)) return { ok: true, status: "already_paid" };
  if (order.status === "PENDING_PAYMENT" && order.expiresAt && order.expiresAt <= new Date()) {
    await expireOrder(order.id);
  }
  const session = await ensurePaymentSession(order.id);
  if (!session) return { ok: false, error: "order_expired" };
  if (session.provider !== "mock") return { ok: false, error: "not_found" };

  if (!success) {
    await markPaymentFailed({
      providerOrderId: session.providerOrderId,
      providerPaymentId: `mock_pay_${randomUUID()}`,
      reason: "Test payment failed",
    });
    return { ok: true, status: "failed" };
  }
  const result = await markPaymentCaptured({
    providerOrderId: session.providerOrderId,
    providerPaymentId: `mock_pay_${randomUUID()}`,
    amount: session.amount,
    method: "mock",
  });
  if (result.outcome === "paid") return { ok: true, status: "paid" };
  if (result.outcome === "already_paid") return { ok: true, status: "already_paid" };
  return { ok: false, error: "order_expired" };
}

// ───────────── Expiry of unpaid orders ─────────────

export type ExpireResult = "expired" | "paid" | "skipped";

/**
 * Cancels an unpaid online order whose hold time has passed and releases its stock and coupon
 * use. The provider is asked first, so an order paid at the last moment is completed instead.
 * If the provider can't be reached the order is left for the next run.
 */
export async function expireOrder(orderId: string, now = new Date()): Promise<ExpireResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      expiresAt: true,
      payments: {
        where: { method: "ONLINE", providerOrderId: { not: null } },
        select: { provider: true, providerOrderId: true },
      },
    },
  });
  if (!order || order.status !== "PENDING_PAYMENT" || !order.expiresAt || order.expiresAt > now) {
    return "skipped";
  }

  for (const p of order.payments) {
    const provider = getPaymentProviderByName(p.provider);
    try {
      const attempts = await provider.listOrderPayments(p.providerOrderId!);
      let paid = attempts.find((a) => a.status === "captured");
      const authorized = attempts.find((a) => a.status === "authorized");
      if (!paid && authorized)
        paid = await provider.capturePayment(authorized.id, authorized.amount);
      if (paid?.status === "captured") {
        const result = await markPaymentCaptured({
          providerOrderId: p.providerOrderId!,
          providerPaymentId: paid.id,
          amount: paid.amount,
          method: paid.method,
        });
        if (result.outcome === "paid" || result.outcome === "already_paid") return "paid";
      }
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        console.error(`[payments] expiry check for ${orderId} postponed: ${error.message}`);
        return "skipped";
      }
      throw error;
    }
  }

  return db.$transaction(async (tx): Promise<ExpireResult> => {
    await lockOrder(tx, orderId);
    const current = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        expiresAt: true,
        items: { select: { variantId: true, quantity: true } },
        couponUsage: { select: { id: true, couponId: true } },
      },
    });
    if (current.status !== "PENDING_PAYMENT" || !current.expiresAt || current.expiresAt > now) {
      return "skipped";
    }

    for (const item of current.items) {
      if (!item.variantId) continue;
      await tx.$executeRaw`
        UPDATE "ProductVariant" SET stock = stock + ${item.quantity}, "updatedAt" = now()
        WHERE id = ${item.variantId}`;
    }
    if (current.couponUsage) {
      await tx.couponUsage.delete({ where: { id: current.couponUsage.id } });
      await tx.$executeRaw`
        UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = now()
        WHERE id = ${current.couponUsage.couponId}`;
    }
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED", failureReason: "Payment window expired" },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: now, expiresAt: null },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: "PENDING_PAYMENT",
        toStatus: "CANCELLED",
        note: "payment_expired",
      },
    });
    return "expired";
  });
}

/** Expires every overdue unpaid order (run by the cron endpoint). */
export async function expireDueOrders(
  opts: { now?: Date; limit?: number } = {},
): Promise<{ checked: number; expired: number; paid: number; skipped: number }> {
  const now = opts.now ?? new Date();
  const due = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: opts.limit ?? 100,
    select: { id: true },
  });
  const counts = { checked: due.length, expired: 0, paid: 0, skipped: 0 };
  for (const { id } of due) {
    try {
      counts[await expireOrder(id, now)] += 1;
    } catch (error) {
      console.error(`[payments] expiring ${id} failed`, error);
      counts.skipped += 1;
    }
  }
  return counts;
}

// ───────────── Refunds ─────────────

export type RefundError = "not_found" | "not_refundable" | "amount_exceeds" | "provider_error";

/**
 * Refunds part or all of a captured online payment. The amount is checked against what is
 * left (including refunds still in progress) under a lock, so refunds never exceed the payment.
 */
export async function createRefund(input: {
  paymentId: string;
  amount: number;
  reason: string | null;
  actorId: string | null;
}): Promise<
  { ok: true; refundId: string; status: RefundStatus } | { ok: false; error: RefundError }
> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "amount_exceeds" };
  }

  const pending = await db.$transaction(async (tx) => {
    const ref = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { orderId: true },
    });
    if (!ref) return { ok: false as const, error: "not_found" as const };
    await lockOrder(tx, ref.orderId);
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: { refunds: { where: { status: { not: "FAILED" } }, select: { amount: true } } },
    });
    if (
      payment.method !== "ONLINE" ||
      !payment.providerPaymentId ||
      !REFUNDABLE.includes(payment.status)
    ) {
      return { ok: false as const, error: "not_refundable" as const };
    }
    const committed = payment.refunds.reduce((s, r) => s + r.amount, 0);
    if (input.amount > payment.amount - committed) {
      return { ok: false as const, error: "amount_exceeds" as const };
    }

    const refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        amount: input.amount,
        reason: input.reason,
        actorId: input.actorId,
      },
    });
    if (input.actorId) {
      await audit(
        {
          actorId: input.actorId,
          action: "payment.refund",
          entityType: "Payment",
          entityId: payment.id,
          changes: { refundId: refund.id, amount: input.amount, reason: input.reason },
        },
        tx,
      );
    }
    await event(tx, ref.orderId, "refund_requested", input.actorId);
    return {
      ok: true as const,
      refundId: refund.id,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
    };
  });
  if (!pending.ok) return pending;

  let providerRefund: ProviderRefund;
  try {
    providerRefund = await getPaymentProviderByName(pending.provider).refund({
      providerPaymentId: pending.providerPaymentId,
      amount: input.amount,
      receipt: pending.refundId,
    });
  } catch (error) {
    if (!(error instanceof PaymentProviderError)) throw error;
    console.error(`[payments] refund ${pending.refundId} failed: ${error.message}`);
    // If the provider did accept it after all, its refund webhook moves this to PROCESSED.
    await db.refund.update({
      where: { id: pending.refundId },
      data: { status: "FAILED", failureReason: error.message.slice(0, 500) },
    });
    return { ok: false, error: "provider_error" };
  }

  const status = await applyRefundUpdate({ ...providerRefund, receipt: pending.refundId });
  return { ok: true, refundId: pending.refundId, status: status ?? "PENDING" };
}

/**
 * Applies a refund status from the provider (API response or webhook). Idempotent: a refund is
 * counted towards Payment.refundedAmount exactly once. Refunds made in the provider's own
 * dashboard are recorded too.
 */
export async function applyRefundUpdate(update: ProviderRefund): Promise<RefundStatus | null> {
  return db.$transaction(async (tx) => {
    const ref = await tx.payment.findUnique({
      where: { providerPaymentId: update.providerPaymentId },
      select: { id: true, orderId: true },
    });
    if (!ref) return null;
    await lockOrder(tx, ref.orderId);

    let refund =
      (await tx.refund.findUnique({ where: { providerRefundId: update.id } })) ??
      (update.receipt
        ? await tx.refund.findFirst({ where: { id: update.receipt, paymentId: ref.id } })
        : null);
    if (!refund) {
      refund = await tx.refund.create({
        data: {
          paymentId: ref.id,
          amount: update.amount,
          providerRefundId: update.id,
          reason: "provider_dashboard",
        },
      });
    }
    if (refund.status === "PROCESSED") return "PROCESSED";

    const next: RefundStatus =
      update.status === "processed"
        ? "PROCESSED"
        : update.status === "failed"
          ? "FAILED"
          : "PENDING";
    // FAILED only moves on if the provider says it went through after all.
    if (refund.status === "FAILED" && next !== "PROCESSED") return "FAILED";

    await tx.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: update.id,
        status: next,
        processedAt: next === "PROCESSED" ? new Date() : null,
        failureReason: next === "FAILED" ? "Rejected by the payment provider" : null,
      },
    });
    if (next === "PROCESSED") {
      const payment = await tx.payment.update({
        where: { id: ref.id },
        data: { refundedAmount: { increment: refund.amount } },
        select: { amount: true, refundedAmount: true, metadata: true },
      });
      const status: PaymentStatus =
        payment.refundedAmount >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await tx.payment.update({ where: { id: ref.id }, data: { status } });
      if (!isDuplicatePayment(payment.metadata)) {
        await tx.order.update({ where: { id: ref.orderId }, data: { paymentStatus: status } });
      }
      await event(tx, ref.orderId, "refund_processed");
    } else if (next === "FAILED") {
      await event(tx, ref.orderId, "refund_failed");
    }
    return next;
  });
}

// ───────────── Admin queries ─────────────

export type PaymentListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
};

export async function listPayments({ page, pageSize, q, status, method }: PaymentListQuery) {
  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(q
      ? {
          OR: [
            { order: { orderNumber: { contains: q, mode: "insensitive" } } },
            { order: { customerPhone: { contains: q } } },
            { order: { customerName: { contains: q, mode: "insensitive" } } },
            { providerPaymentId: q },
            { providerOrderId: q },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        method: true,
        provider: true,
        status: true,
        amount: true,
        refundedAmount: true,
        createdAt: true,
        order: {
          select: { orderNumber: true, customerName: true, customerPhone: true, status: true },
        },
      },
    }),
    db.payment.count({ where }),
  ]);
  return { rows, total };
}

export function getPaymentDetail(id: string) {
  return db.payment.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          total: true,
          createdAt: true,
        },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });
}

/** Amount that can still be refunded (excludes refunds that are processing). */
export function refundableAmount(payment: {
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  providerPaymentId: string | null;
  refunds: { amount: number; status: RefundStatus }[];
}): number {
  if (payment.method !== "ONLINE" || !payment.providerPaymentId) return 0;
  if (!REFUNDABLE.includes(payment.status)) return 0;
  const committed = payment.refunds
    .filter((r) => r.status !== "FAILED")
    .reduce((s, r) => s + r.amount, 0);
  return Math.max(0, payment.amount - committed);
}
