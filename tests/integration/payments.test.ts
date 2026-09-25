import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setPaymentProviderForTests } from "@/lib/providers/payment";
import { hmacSha256Hex, verifyRazorpayCheckoutSignature } from "@/lib/providers/payment/signature";
import {
  PaymentProviderError,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderRefund,
  type ProviderRefundStatus,
} from "@/lib/providers/payment/types";
import { buildQuote, placeOrder } from "@/lib/services/checkout.service";
import {
  confirmCheckoutPayment,
  createRefund,
  expireDueOrders,
  recordMockPayment,
} from "@/lib/services/payment.service";
import { handleRazorpayWebhook } from "@/lib/services/webhook.service";
import { addressSchema } from "@/lib/validators/auth";

const KEY_SECRET = "rzp_key_secret_test";
const WEBHOOK_SECRET = "rzp_webhook_secret_test";

/** In-memory Razorpay: tests decide what the "provider" reports. */
function fakeRazorpay() {
  let seq = 0;
  const attempts = new Map<string, ProviderPayment[]>();
  const state = {
    refundStatus: "processed" as ProviderRefundStatus,
    refundFails: false,
    refunds: [] as ProviderRefund[],
  };
  const findPayment = (id: string) =>
    [...attempts.values()].flat().find((p) => p.id === id) ?? null;

  const provider: PaymentProvider = {
    name: "razorpay",
    async createPayment() {
      seq += 1;
      return { provider: "razorpay", providerOrderId: `order_T${seq}`, next: { type: "client" } };
    },
    verifyCheckoutSignature: (input) => verifyRazorpayCheckoutSignature(KEY_SECRET, input),
    async getPayment(id) {
      const p = findPayment(id);
      if (!p) throw new PaymentProviderError("not found", "BAD_REQUEST_ERROR");
      return p;
    },
    async listOrderPayments(orderId) {
      return attempts.get(orderId) ?? [];
    },
    async capturePayment(id) {
      const p = findPayment(id)!;
      p.status = "captured";
      return p;
    },
    async refund({ providerPaymentId, amount, receipt }) {
      if (state.refundFails) throw new PaymentProviderError("Razorpay unreachable");
      seq += 1;
      const r = {
        id: `rfnd_T${seq}`,
        providerPaymentId,
        amount,
        status: state.refundStatus,
        receipt,
      };
      state.refunds.push(r);
      return { ...r };
    },
  };

  /** A payment attempt made in the Razorpay window. */
  function attempt(providerOrderId: string, amount: number, status: ProviderPayment["status"]) {
    seq += 1;
    const p: ProviderPayment = {
      id: `pay_T${seq}`,
      providerOrderId,
      status,
      amount,
      method: "upi",
      errorDescription: status === "failed" ? "Payment declined by bank" : null,
    };
    attempts.set(providerOrderId, [...(attempts.get(providerOrderId) ?? []), p]);
    return p;
  }
  return { provider, state, attempt };
}

function sendWebhook(
  event: string,
  payload: Record<string, unknown>,
  opts: { eventId?: string; signature?: string } = {},
) {
  const rawBody = JSON.stringify({ entity: "event", event, payload, created_at: 1_700_000_000 });
  return handleRazorpayWebhook({
    rawBody,
    signature: opts.signature ?? hmacSha256Hex(WEBHOOK_SECRET, rawBody),
    eventId: opts.eventId ?? `evt_${randomUUID()}`,
  });
}
const paymentPayload = (p: ProviderPayment) => ({
  payment: {
    entity: {
      id: p.id,
      entity: "payment",
      order_id: p.providerOrderId,
      amount: p.amount,
      currency: "INR",
      status: p.status,
      method: p.method,
      error_description: p.errorDescription,
    },
  },
});
const refundPayload = (r: ProviderRefund, status: ProviderRefundStatus) => ({
  refund: {
    entity: {
      id: r.id,
      entity: "refund",
      payment_id: r.providerPaymentId,
      amount: r.amount,
      status,
      receipt: r.receipt,
    },
  },
});

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

let fake: ReturnType<typeof fakeRazorpay>;
let variantId: string;
const savedEnv = { ...process.env };

beforeAll(() => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});
afterAll(() => {
  process.env.PAYMENT_PROVIDER = savedEnv.PAYMENT_PROVIDER;
  process.env.RAZORPAY_WEBHOOK_SECRET = savedEnv.RAZORPAY_WEBHOOK_SECRET;
  setPaymentProviderForTests(null);
});

beforeEach(async () => {
  fake = fakeRazorpay();
  setPaymentProviderForTests(fake.provider);
  process.env.PAYMENT_PROVIDER = "razorpay";
  await db.storeSettings.create({
    data: {
      id: "default",
      name: "Demo Store",
      stateCode: "KA",
      orderNumberPrefix: "DS",
      pendingOrderTtlMinutes: 30,
    },
  });
  const category = await db.category.create({ data: { slug: "food", name: { en: "Food" } } });
  const product = await db.product.create({
    data: {
      slug: "coffee",
      name: { en: "Coffee" },
      categoryId: category.id,
      status: "PUBLISHED",
      variants: { create: [{ sku: "COFFEE-250", price: 50000, stock: 10, weightGrams: 260 }] },
    },
    include: { variants: true },
  });
  variantId = product.variants[0]!.id;
  await db.shippingRule.create({
    data: { name: "All India", pincodePrefixes: [], rateType: "FLAT", flatRate: 0 },
  });
  await db.coupon.create({ data: { code: "SAVE10", type: "PERCENTAGE", value: 1000 } });
});

async function onlineOrder(opts: { quantity?: number; couponCode?: string } = {}) {
  const user = await db.user.create({
    data: {
      phone: `+9190000${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`,
      role: "CUSTOMER",
    },
  });
  const items = [{ variantId, quantity: opts.quantity ?? 2 }];
  const quote = await buildQuote({
    items,
    destination: { pincode: "560001", stateCode: "KA" },
    couponCode: opts.couponCode ?? null,
    paymentMethod: "ONLINE",
    customer: { userId: user.id, phone: user.phone },
  });
  const result = await placeOrder({
    userId: user.id,
    items,
    address: { kind: "new", address, save: false },
    couponCode: opts.couponCode ?? null,
    paymentMethod: "ONLINE",
    customerEmail: null,
    customerNote: null,
    expectedTotal: quote.price.total,
    locale: "en",
  });
  if (!result.ok) throw new Error(`placeOrder failed: ${JSON.stringify(result.error)}`);
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: result.orderId } });
  return {
    user,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    providerOrderId: payment.providerOrderId!,
    paymentId: payment.id,
    amount: payment.amount,
  };
}

const orderState = (id: string) =>
  db.order.findUniqueOrThrow({
    where: { id },
    include: {
      payments: { orderBy: { createdAt: "asc" }, include: { refunds: true } },
      events: true,
    },
  });
const stock = async () =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

/** Pays an order through the webhook (the usual way Razorpay confirms). */
async function payViaWebhook(o: Awaited<ReturnType<typeof onlineOrder>>) {
  const p = fake.attempt(o.providerOrderId, o.amount, "captured");
  expect(await sendWebhook("payment.captured", paymentPayload(p))).toMatchObject({ status: 200 });
  return p;
}

describe("capturing online payments", () => {
  it("creates a Razorpay order at checkout and keeps stock reserved while waiting", async () => {
    const o = await onlineOrder();
    expect(o.providerOrderId).toBe("order_T1");
    const order = await orderState(o.orderId);
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "PENDING" });
    expect(order.payments[0]).toMatchObject({ provider: "razorpay", amount: order.total });
    expect(await stock()).toBe(8);
  });

  it("confirms a browser result only with a valid signature, and only once", async () => {
    const o = await onlineOrder();
    const p = fake.attempt(o.providerOrderId, o.amount, "captured");
    const base = {
      orderNumber: o.orderNumber,
      userId: o.user.id,
      providerOrderId: o.providerOrderId,
      providerPaymentId: p.id,
    };

    const forged = await confirmCheckoutPayment({ ...base, signature: "0".repeat(64) });
    expect(forged).toEqual({ ok: false, error: "invalid_signature" });
    expect((await orderState(o.orderId)).status).toBe("PENDING_PAYMENT");

    const signature = hmacSha256Hex(KEY_SECRET, `${o.providerOrderId}|${p.id}`);
    expect(await confirmCheckoutPayment({ ...base, signature })).toEqual({
      ok: true,
      status: "paid",
    });
    expect(await confirmCheckoutPayment({ ...base, signature })).toEqual({
      ok: true,
      status: "already_paid",
    });
    // The webhook for the same payment arrives later: nothing changes.
    await sendWebhook("payment.captured", paymentPayload(p));

    const order = await orderState(o.orderId);
    expect(order).toMatchObject({ status: "PLACED", paymentStatus: "CAPTURED", expiresAt: null });
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]).toMatchObject({ status: "CAPTURED", providerPaymentId: p.id });
    expect(order.events.filter((e) => e.note === "payment_captured")).toHaveLength(1);

    // Another customer can't confirm someone else's order.
    const stranger = await db.user.create({ data: { phone: "+919111111111", role: "CUSTOMER" } });
    expect(await confirmCheckoutPayment({ ...base, userId: stranger.id, signature })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("handles callback and webhooks racing for the same payment", async () => {
    const o = await onlineOrder();
    const p = fake.attempt(o.providerOrderId, o.amount, "captured");
    const signature = hmacSha256Hex(KEY_SECRET, `${o.providerOrderId}|${p.id}`);
    await Promise.all([
      confirmCheckoutPayment({
        orderNumber: o.orderNumber,
        userId: o.user.id,
        providerOrderId: o.providerOrderId,
        providerPaymentId: p.id,
        signature,
      }),
      sendWebhook("payment.captured", paymentPayload(p)),
      sendWebhook("payment.captured", paymentPayload(p)),
    ]);
    const order = await orderState(o.orderId);
    expect(order.status).toBe("PLACED");
    expect(order.payments).toHaveLength(1);
    expect(order.events.filter((e) => e.note === "payment_captured")).toHaveLength(1);
  });
});

describe("webhooks", () => {
  it("rejects bad signatures and treats replays as no-ops", async () => {
    const o = await onlineOrder();
    const p = fake.attempt(o.providerOrderId, o.amount, "captured");

    expect(
      await sendWebhook("payment.captured", paymentPayload(p), { signature: "ab".repeat(32) }),
    ).toEqual({ status: 401, result: "invalid_signature" });
    expect((await orderState(o.orderId)).status).toBe("PENDING_PAYMENT");
    expect(await db.webhookEvent.count()).toBe(0);

    const eventId = "evt_replayed";
    expect(await sendWebhook("payment.captured", paymentPayload(p), { eventId })).toEqual({
      status: 200,
      result: "processed",
    });
    const before = await orderState(o.orderId);
    for (let i = 0; i < 3; i++) {
      expect(await sendWebhook("payment.captured", paymentPayload(p), { eventId })).toEqual({
        status: 200,
        result: "duplicate",
      });
    }
    expect(await orderState(o.orderId)).toEqual(before);
    expect(await db.webhookEvent.count()).toBe(1);
  });

  it("acknowledges events it doesn't handle and rejects malformed payloads", async () => {
    expect(await sendWebhook("order.paid", {})).toEqual({ status: 200, result: "ignored" });
    const rawBody = "{not json";
    expect(
      await handleRazorpayWebhook({
        rawBody,
        signature: hmacSha256Hex(WEBHOOK_SECRET, rawBody),
        eventId: "evt_bad",
      }),
    ).toEqual({ status: 400, result: "invalid_payload" });
  });
});

describe("failure and retry", () => {
  it("keeps the order payable after a failed attempt, and a stale failure can't undo success", async () => {
    const o = await onlineOrder();
    const failed = fake.attempt(o.providerOrderId, o.amount, "failed");
    await sendWebhook("payment.failed", paymentPayload(failed));

    let order = await orderState(o.orderId);
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "FAILED" });
    expect(order.payments[0]).toMatchObject({
      status: "FAILED",
      failureReason: "Payment declined by bank",
    });
    expect(await stock()).toBe(8); // still reserved for the retry

    await payViaWebhook(o);
    // The failure is delivered again late (different event id): ignored.
    await sendWebhook("payment.failed", paymentPayload(failed));

    order = await orderState(o.orderId);
    expect(order).toMatchObject({ status: "PLACED", paymentStatus: "CAPTURED" });
    expect(order.payments[0]).toMatchObject({ status: "CAPTURED", failureReason: null });
  });
});

describe("expiry of unpaid orders", () => {
  it("cancels overdue orders and releases stock and coupon use", async () => {
    const overdue = await onlineOrder({ couponCode: "SAVE10" });
    const fresh = await onlineOrder({ quantity: 1 });
    await db.order.update({
      where: { id: overdue.orderId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect(await stock()).toBe(7);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } })).usedCount).toBe(1);

    expect(await expireDueOrders()).toEqual({ checked: 1, expired: 1, paid: 0, skipped: 0 });

    const order = await orderState(overdue.orderId);
    expect(order).toMatchObject({ status: "CANCELLED", paymentStatus: "FAILED", expiresAt: null });
    expect(order.cancelledAt).not.toBeNull();
    expect(order.payments[0]).toMatchObject({ status: "FAILED" });
    expect(order.events.map((e) => e.note)).toContain("payment_expired");
    expect(await stock()).toBe(9);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } })).usedCount).toBe(0);
    expect(await db.couponUsage.count()).toBe(0);
    expect((await orderState(fresh.orderId)).status).toBe("PENDING_PAYMENT");

    // Running again changes nothing.
    expect(await expireDueOrders()).toEqual({ checked: 0, expired: 0, paid: 0, skipped: 0 });
    expect(await stock()).toBe(9);
  });

  it("completes an order that was paid at the last moment instead of expiring it", async () => {
    const o = await onlineOrder();
    fake.attempt(o.providerOrderId, o.amount, "failed");
    fake.attempt(o.providerOrderId, o.amount, "captured"); // webhook not delivered yet
    await db.order.update({ where: { id: o.orderId }, data: { expiresAt: new Date(0) } });

    expect(await expireDueOrders()).toMatchObject({ expired: 0, paid: 1 });
    expect((await orderState(o.orderId)).status).toBe("PLACED");
    expect(await stock()).toBe(8);
  });

  it("refunds a payment that arrives after the order expired", async () => {
    const o = await onlineOrder();
    await db.order.update({ where: { id: o.orderId }, data: { expiresAt: new Date(0) } });
    await expireDueOrders();
    expect(await stock()).toBe(10);

    await payViaWebhook(o);

    const order = await orderState(o.orderId);
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.payments[0]).toMatchObject({ status: "REFUNDED", refundedAmount: o.amount });
    expect(order.payments[0]!.refunds[0]).toMatchObject({
      status: "PROCESSED",
      amount: o.amount,
      reason: "order_expired",
      actorId: null,
    });
    expect(await stock()).toBe(10); // not reserved again
  });

  it("lazily expires an overdue order when the customer opens it", async () => {
    const o = await onlineOrder();
    await db.order.update({ where: { id: o.orderId }, data: { expiresAt: new Date(0) } });
    const { getCustomerOrder } = await import("@/lib/services/checkout.service");
    expect((await getCustomerOrder(o.orderNumber, o.user.id))?.status).toBe("CANCELLED");
    expect(await stock()).toBe(10);
  });
});

describe("refunds", () => {
  it("refunds partially then fully, counting each refund once", async () => {
    const o = await onlineOrder();
    await payViaWebhook(o);
    const owner = await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } });
    fake.state.refundStatus = "pending";

    const first = await createRefund({
      paymentId: o.paymentId,
      amount: 10_000,
      reason: "Damaged item",
      actorId: owner.id,
    });
    expect(first).toMatchObject({ ok: true, status: "PENDING" });
    let payment = (await orderState(o.orderId)).payments[0]!;
    expect(payment).toMatchObject({ status: "CAPTURED", refundedAmount: 0 });

    // More than what's left (a pending refund already counts) is refused.
    expect(
      await createRefund({
        paymentId: o.paymentId,
        amount: o.amount - 10_000 + 1,
        reason: null,
        actorId: owner.id,
      }),
    ).toEqual({ ok: false, error: "amount_exceeds" });

    const settled = fake.state.refunds[0]!;
    for (let i = 0; i < 2; i++) {
      await sendWebhook("refund.processed", refundPayload(settled, "processed"));
    }
    payment = (await orderState(o.orderId)).payments[0]!;
    expect(payment).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedAmount: 10_000 });

    fake.state.refundStatus = "processed";
    expect(
      await createRefund({
        paymentId: o.paymentId,
        amount: o.amount - 10_000,
        reason: null,
        actorId: owner.id,
      }),
    ).toMatchObject({ ok: true, status: "PROCESSED" });
    const order = await orderState(o.orderId);
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.payments[0]).toMatchObject({ status: "REFUNDED", refundedAmount: o.amount });
    expect(
      await createRefund({ paymentId: o.paymentId, amount: 1, reason: null, actorId: owner.id }),
    ).toEqual({
      ok: false,
      error: "not_refundable",
    });
    expect(await db.auditLog.count({ where: { action: "payment.refund" } })).toBe(2);
  });

  it("never refunds more than was paid under concurrent requests", async () => {
    const o = await onlineOrder();
    await payViaWebhook(o);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createRefund({
          paymentId: o.paymentId,
          amount: Math.ceil(o.amount * 0.6),
          reason: null,
          actorId: null,
        }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(fake.state.refunds).toHaveLength(1);
  });

  it("marks a refund failed when the provider is down, and settles it if the provider did process it", async () => {
    const o = await onlineOrder();
    await payViaWebhook(o);
    fake.state.refundFails = true;
    expect(
      await createRefund({ paymentId: o.paymentId, amount: 5_000, reason: null, actorId: null }),
    ).toEqual({
      ok: false,
      error: "provider_error",
    });
    const refund = (await orderState(o.orderId)).payments[0]!.refunds[0]!;
    expect(refund.status).toBe("FAILED");

    // Razorpay had actually accepted it; its webhook carries our refund id as the receipt.
    await sendWebhook(
      "refund.processed",
      refundPayload(
        {
          id: "rfnd_late",
          providerPaymentId: (await orderState(o.orderId)).payments[0]!.providerPaymentId!,
          amount: 5_000,
          status: "processed",
          receipt: refund.id,
        },
        "processed",
      ),
    );
    const payment = (await orderState(o.orderId)).payments[0]!;
    expect(payment).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedAmount: 5_000 });
    expect(payment.refunds).toHaveLength(1);
  });

  it("records refunds made in the Razorpay dashboard", async () => {
    const o = await onlineOrder();
    const p = await payViaWebhook(o);
    await sendWebhook(
      "refund.processed",
      refundPayload(
        {
          id: "rfnd_dash",
          providerPaymentId: p.id,
          amount: o.amount,
          status: "processed",
          receipt: null,
        },
        "processed",
      ),
    );
    const payment = (await orderState(o.orderId)).payments[0]!;
    expect(payment).toMatchObject({ status: "REFUNDED", refundedAmount: o.amount });
    expect(payment.refunds[0]).toMatchObject({ reason: "provider_dashboard", status: "PROCESSED" });
  });

  it("refunds a second payment for an already paid order automatically", async () => {
    const o = await onlineOrder();
    await payViaWebhook(o);
    await payViaWebhook(o); // customer paid twice (e.g. two tabs)

    const order = await orderState(o.orderId);
    expect(order).toMatchObject({ status: "PLACED", paymentStatus: "CAPTURED" });
    expect(order.payments).toHaveLength(2);
    expect(order.payments[1]).toMatchObject({ status: "REFUNDED", refundedAmount: o.amount });
    expect(order.payments[1]!.refunds[0]).toMatchObject({ reason: "duplicate_payment" });
  });

  it("does not refund cash-on-delivery payments online", async () => {
    const user = await db.user.create({ data: { phone: "+919222222222", role: "CUSTOMER" } });
    const items = [{ variantId, quantity: 1 }];
    const quote = await buildQuote({
      items,
      destination: { pincode: "560001", stateCode: "KA" },
      couponCode: null,
      paymentMethod: "COD",
      customer: { userId: user.id, phone: user.phone },
    });
    const result = await placeOrder({
      userId: user.id,
      items,
      address: { kind: "new", address, save: false },
      couponCode: null,
      paymentMethod: "COD",
      customerEmail: null,
      customerNote: null,
      expectedTotal: quote.price.total,
      locale: "en",
    });
    if (!result.ok) throw new Error("COD order failed");
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: result.orderId } });
    expect(
      await createRefund({ paymentId: payment.id, amount: 100, reason: null, actorId: null }),
    ).toEqual({
      ok: false,
      error: "not_refundable",
    });
  });

  it("settles refunds immediately with the mock provider", async () => {
    setPaymentProviderForTests(null);
    process.env.PAYMENT_PROVIDER = "mock";
    const o = await onlineOrder();
    expect(await recordMockPayment(o.orderNumber, o.user.id, true)).toEqual({
      ok: true,
      status: "paid",
    });
    expect(
      await createRefund({ paymentId: o.paymentId, amount: o.amount, reason: null, actorId: null }),
    ).toMatchObject({ ok: true, status: "PROCESSED" });
    expect((await orderState(o.orderId)).paymentStatus).toBe("REFUNDED");
  });
});
