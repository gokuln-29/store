import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { setEmailProviderForTests, type EmailMessage } from "@/lib/providers/notify";
import { buildQuote, placeOrder } from "@/lib/services/checkout.service";
import { invoicePdf, packingSlipPdf } from "@/lib/services/invoice.service";
import { deliverNotifications, MAX_ATTEMPTS } from "@/lib/services/notification.service";
import {
  addInternalNote,
  changeOrderStatus,
  getCustomerOrderDetail,
  listOrders,
  reorderItems,
  type StatusActor,
} from "@/lib/services/order.service";
import { financialYear } from "@/lib/services/order-status";
import { recordMockPayment } from "@/lib/services/payment.service";
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

/** Captures emails instead of sending them; `fail` makes the next sends throw. */
const mailbox = { sent: [] as EmailMessage[], fail: 0 };
setEmailProviderForTests({
  name: "memory",
  async send(message) {
    if (mailbox.fail > 0) {
      mailbox.fail -= 1;
      throw new Error("SMTP down");
    }
    mailbox.sent.push(message);
  },
});
process.env.SMS_ORDER_UPDATES = "false"; // keep test output quiet; email covers the outbox
afterAll(() => setEmailProviderForTests(undefined));

let variantId: string;
let staff: StatusActor;
let owner: StatusActor;
let phoneSeq = 0;

beforeEach(async () => {
  mailbox.sent = [];
  mailbox.fail = 0;
  process.env.PAYMENT_PROVIDER = "mock";
  await db.storeSettings.create({
    data: {
      id: "default",
      name: "Demo Store",
      legalName: "Demo Store Pvt Ltd",
      gstNumber: "29ABCDE1234F1Z5",
      stateCode: "KA",
      orderNumberPrefix: "DS",
      codEnabled: true,
    },
  });
  const category = await db.category.create({
    data: { slug: "food", name: { en: "Food" }, taxRateBps: 500, hsnCode: "0901" },
  });
  const product = await db.product.create({
    data: {
      slug: "coffee",
      name: { en: "Filter Coffee", ta: "ஃபில்டர் காபி" },
      categoryId: category.id,
      status: "PUBLISHED",
      variants: { create: [{ sku: "COFFEE-250", price: 22000, stock: 10, weightGrams: 260 }] },
    },
    include: { variants: true },
  });
  variantId = product.variants[0]!.id;
  await db.shippingRule.create({
    data: { name: "All India", pincodePrefixes: [], rateType: "FLAT", flatRate: 4000 },
  });
  await db.coupon.create({ data: { code: "SAVE10", type: "PERCENTAGE", value: 1000 } });
  const staffUser = await db.user.create({ data: { email: "staff@x.in", role: "STAFF" } });
  const ownerUser = await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } });
  staff = { type: "staff", id: staffUser.id, canRefund: false };
  owner = { type: "staff", id: ownerUser.id, canRefund: true };
});

async function newOrder(
  opts: { method?: "COD" | "ONLINE"; quantity?: number; couponCode?: string; email?: string } = {},
) {
  phoneSeq += 1;
  const user = await db.user.create({
    data: { phone: `+9198${String(phoneSeq).padStart(8, "0")}`, role: "CUSTOMER" },
  });
  const items = [{ variantId, quantity: opts.quantity ?? 1 }];
  const paymentMethod = opts.method ?? "COD";
  const quote = await buildQuote({
    items,
    destination: { pincode: "560001", stateCode: "KA" },
    couponCode: opts.couponCode ?? null,
    paymentMethod,
    customer: { userId: user.id, phone: user.phone },
  });
  const result = await placeOrder({
    userId: user.id,
    items,
    address: { kind: "new", address, save: false },
    couponCode: opts.couponCode ?? null,
    paymentMethod,
    customerEmail: opts.email ?? "asha@example.com",
    customerNote: null,
    expectedTotal: quote.price.total,
    locale: "ta",
  });
  if (!result.ok) throw new Error(`placeOrder failed: ${JSON.stringify(result.error)}`);
  return { user, id: result.orderId, number: result.orderNumber };
}

const stock = async () =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
const load = (id: string) =>
  db.order.findUniqueOrThrow({ where: { id }, include: { payments: true, events: true } });

async function advance(id: string, ...steps: ("CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED")[]) {
  for (const to of steps) {
    const r = await changeOrderStatus({
      orderId: id,
      to,
      actor: staff,
      ...(to === "SHIPPED"
        ? {
            tracking: {
              courierName: "Delhivery",
              trackingNumber: "TRK1",
              trackingUrl: "https://track.example/TRK1",
            },
          }
        : {}),
    });
    expect(r, `→ ${to}`).toMatchObject({ ok: true, status: to });
  }
}

describe("fulfilment flow", () => {
  it("takes a COD order from placed to delivered with invoice, tracking and notifications", async () => {
    const o = await newOrder();
    expect(mailbox.sent.map((m) => m.subject)).toEqual([expect.stringContaining(o.number)]);
    expect(mailbox.sent[0]!.html).toContain('lang="ta"'); // customer's language

    await advance(o.id, "CONFIRMED", "PACKED", "SHIPPED");
    let order = await load(o.id);
    const fy = financialYear(new Date()).replace("-", "").slice(2);
    expect(order.invoiceNumber).toBe(`DS${fy}-0001`);
    expect(order).toMatchObject({ courierName: "Delhivery", trackingNumber: "TRK1" });
    expect(order.shippedAt).not.toBeNull();
    expect(mailbox.sent.at(-1)!.text).toContain("TRK1");

    await advance(o.id, "DELIVERED");
    order = await load(o.id);
    expect(order).toMatchObject({ status: "DELIVERED", paymentStatus: "CAPTURED" });
    expect(order.payments[0]).toMatchObject({ method: "COD", status: "CAPTURED" });
    expect(order.events.filter((e) => e.toStatus).map((e) => e.toStatus)).toEqual([
      "PLACED",
      "CONFIRMED",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
    ]);
    // placed, shipped, delivered (confirmed/packed are internal steps)
    expect(mailbox.sent).toHaveLength(3);
    expect(await db.notification.count({ where: { status: "SENT" } })).toBe(3);
  });

  it("numbers invoices consecutively in shipping order, without gaps", async () => {
    const a = await newOrder();
    const b = await newOrder();
    const c = await newOrder();
    await advance(b.id, "CONFIRMED", "PACKED", "SHIPPED");
    await advance(c.id, "CONFIRMED", "PACKED");
    await changeOrderStatus({ orderId: c.id, to: "CANCELLED", actor: staff });
    await advance(a.id, "CONFIRMED", "PACKED", "SHIPPED");
    const numbers = await Promise.all([a, b, c].map(async (o) => (await load(o.id)).invoiceNumber));
    expect(numbers[1]).toMatch(/-0001$/);
    expect(numbers[0]).toMatch(/-0002$/);
    expect(numbers[2]).toBeNull();
  });

  it("rejects skipped steps, final states and stale pages", async () => {
    const o = await newOrder();
    expect(await changeOrderStatus({ orderId: o.id, to: "SHIPPED", actor: staff })).toEqual({
      ok: false,
      error: "invalid_transition",
    });
    await advance(o.id, "CONFIRMED");
    expect(
      await changeOrderStatus({
        orderId: o.id,
        to: "CONFIRMED",
        expectedStatus: "PLACED",
        actor: staff,
      }),
    ).toEqual({ ok: false, error: "stale" });
    await changeOrderStatus({ orderId: o.id, to: "CANCELLED", actor: staff });
    expect(await changeOrderStatus({ orderId: o.id, to: "PACKED", actor: staff })).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("applies a status change once when two staff click at the same time", async () => {
    const o = await newOrder();
    await advance(o.id, "CONFIRMED", "PACKED");
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        changeOrderStatus({ orderId: o.id, to: "SHIPPED", expectedStatus: "PACKED", actor: staff }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const order = await load(o.id);
    expect(order.events.filter((e) => e.toStatus === "SHIPPED")).toHaveLength(1);
    expect((await db.invoiceCounter.findFirstOrThrow()).lastNumber).toBe(1);
  });
});

describe("cancellation and returns", () => {
  it("restores stock and coupon use when a COD order is cancelled", async () => {
    const o = await newOrder({ quantity: 3, couponCode: "SAVE10" });
    expect(await stock()).toBe(7);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } })).usedCount).toBe(1);

    const r = await changeOrderStatus({
      orderId: o.id,
      to: "CANCELLED",
      actor: staff,
      note: "Out of delivery area",
    });
    expect(r).toMatchObject({ ok: true });
    expect(await stock()).toBe(10);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } })).usedCount).toBe(0);
    const order = await load(o.id);
    expect(order).toMatchObject({ cancelReason: "Out of delivery area", paymentStatus: "FAILED" });
    expect(order.payments[0]).toMatchObject({ status: "FAILED" });
    expect(mailbox.sent.at(-1)!.subject).toContain(o.number);
  });

  it("lets customers cancel their own order only until it is packed", async () => {
    const mine = await newOrder();
    const theirs = await newOrder();
    const me: StatusActor = { type: "customer", id: mine.user.id };

    expect(await changeOrderStatus({ orderId: theirs.id, to: "CANCELLED", actor: me })).toEqual({
      ok: false,
      error: "not_found",
    });
    await advance(mine.id, "CONFIRMED", "PACKED");
    expect(await changeOrderStatus({ orderId: mine.id, to: "CANCELLED", actor: me })).toEqual({
      ok: false,
      error: "invalid_transition",
    });
    expect(
      await changeOrderStatus({
        orderId: theirs.id,
        to: "CANCELLED",
        actor: { type: "customer", id: theirs.user.id },
      }),
    ).toMatchObject({ ok: true });
    const event = (await load(theirs.id)).events.find((e) => e.toStatus === "CANCELLED");
    expect(event).toMatchObject({ note: "cancelled_by_customer", actorId: null });
  });

  it("refunds a paid online order on cancellation, and only owners may do it", async () => {
    const o = await newOrder({ method: "ONLINE", quantity: 2 });
    expect(await recordMockPayment(o.number, o.user.id, true)).toMatchObject({ status: "paid" });
    expect(await stock()).toBe(8);

    expect(await changeOrderStatus({ orderId: o.id, to: "CANCELLED", actor: staff })).toEqual({
      ok: false,
      error: "refund_permission",
    });
    const r = await changeOrderStatus({ orderId: o.id, to: "CANCELLED", actor: owner });
    const order = await load(o.id);
    expect(r).toEqual({
      ok: true,
      status: "CANCELLED",
      invoiceNumber: null,
      refund: { ok: true, amount: order.total },
    });
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.payments[0]).toMatchObject({ status: "REFUNDED", refundedAmount: order.total });
    expect(await stock()).toBe(10);
    expect(mailbox.sent.at(-1)!.text).toMatch(/.+/);
  });

  it("customers can cancel a paid order themselves and get refunded", async () => {
    const o = await newOrder({ method: "ONLINE" });
    await recordMockPayment(o.number, o.user.id, true);
    const r = await changeOrderStatus({
      orderId: o.id,
      to: "CANCELLED",
      actor: { type: "customer", id: o.user.id },
    });
    expect(r).toMatchObject({ ok: true, refund: { ok: true } });
    expect((await load(o.id)).paymentStatus).toBe("REFUNDED");
  });

  it("restocks returns unless the goods can't be resold", async () => {
    const a = await newOrder({ quantity: 2 });
    const b = await newOrder({ quantity: 3 });
    for (const o of [a, b]) await advance(o.id, "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED");
    expect(await stock()).toBe(5);

    await changeOrderStatus({ orderId: a.id, to: "RETURNED", actor: staff });
    expect(await stock()).toBe(7);
    await changeOrderStatus({
      orderId: b.id,
      to: "RETURNED",
      actor: staff,
      restock: false,
      note: "Damaged",
    });
    expect(await stock()).toBe(7);
    const event = (await load(b.id)).events.find((e) => e.toStatus === "RETURNED");
    expect(event?.note).toBe("Damaged · not_restocked");
  });
});

describe("notifications outbox", () => {
  it("retries failed sends with backoff and gives up after the limit", async () => {
    mailbox.fail = 1;
    const o = await newOrder();
    let row = await db.notification.findFirstOrThrow({ where: { orderId: o.id } });
    expect(row).toMatchObject({ status: "PENDING", attempts: 1, error: "SMTP down" });
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Not due yet: nothing is sent twice.
    expect(await deliverNotifications()).toEqual({ sent: 0, failed: 0, retrying: 0 });
    await db.notification.update({ where: { id: row.id }, data: { lockedUntil: new Date(0) } });
    expect(await deliverNotifications()).toEqual({ sent: 1, failed: 0, retrying: 0 });
    row = await db.notification.findFirstOrThrow({ where: { id: row.id } });
    expect(row).toMatchObject({ status: "SENT", attempts: 2, error: null });

    mailbox.fail = 99;
    await advance(o.id, "CONFIRMED", "PACKED", "SHIPPED");
    const shipped = await db.notification.findFirstOrThrow({
      where: { template: "order_shipped" },
    });
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await db.notification.update({
        where: { id: shipped.id },
        data: { lockedUntil: new Date(0) },
      });
      await deliverNotifications();
    }
    expect(await db.notification.findUniqueOrThrow({ where: { id: shipped.id } })).toMatchObject({
      status: "FAILED",
      attempts: MAX_ATTEMPTS,
    });
  });

  it("never sends the same message twice when deliveries overlap", async () => {
    mailbox.fail = 1;
    await newOrder();
    await db.notification.updateMany({ data: { lockedUntil: new Date(0) } });
    await Promise.all([deliverNotifications(), deliverNotifications(), deliverNotifications()]);
    expect(mailbox.sent).toHaveLength(1);
  });

  it("skips email when the customer gave none", async () => {
    await newOrder({ email: "" });
    expect(await db.notification.count()).toBe(0);
  });
});

describe("customer views and documents", () => {
  it("shows customers their timeline without internal notes", async () => {
    const o = await newOrder();
    await addInternalNote(o.id, "Customer called about gift wrap", (staff as { id: string }).id);
    await advance(o.id, "CONFIRMED");
    const detail = await getCustomerOrderDetail(o.number, o.user.id);
    expect(detail!.events.map((e) => e.toStatus)).toEqual(["PLACED", "CONFIRMED"]);
    expect(await getCustomerOrderDetail(o.number, (await newOrder()).user.id)).toBeNull();
  });

  it("serves the invoice only after shipping and only to its customer or staff", async () => {
    const o = await newOrder();
    const stranger = await newOrder();
    expect(await invoicePdf(o.number, o.user.id)).toBeNull();
    await advance(o.id, "CONFIRMED", "PACKED", "SHIPPED");

    const mine = await invoicePdf(o.number, o.user.id);
    expect(mine?.filename).toMatch(/^invoice-DS\d{4}-0001\.pdf$/);
    expect((await PDFDocument.load(mine!.pdf)).getPageCount()).toBe(1);
    expect(await invoicePdf(o.number, stranger.user.id)).toBeNull();
    expect(await invoicePdf(o.number, null)).not.toBeNull(); // staff
    expect((await packingSlipPdf(o.number))?.filename).toBe(
      `packing-slip-${o.number.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`,
    );
  });

  it("reorders only what is still available", async () => {
    const o = await newOrder({ quantity: 2 });
    expect(await reorderItems(o.number, o.user.id)).toEqual({
      items: [{ variantId, quantity: 2 }],
      unavailable: 0,
    });
    await db.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
    expect(await reorderItems(o.number, o.user.id)).toEqual({ items: [], unavailable: 1 });
    expect(await reorderItems(o.number, "someone-else")).toBeNull();
  });

  it("filters the admin list by status, phone and date", async () => {
    const a = await newOrder();
    const b = await newOrder();
    await advance(b.id, "CONFIRMED");
    const base = { page: 1, pageSize: 20 };
    expect((await listOrders({ ...base, status: "CONFIRMED" })).rows.map((r) => r.id)).toEqual([
      b.id,
    ]);
    const phone = a.user.phone!.slice(-10);
    expect(
      (await listOrders({ ...base, q: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` })).rows.map(
        (r) => r.id,
      ),
    ).toEqual([a.id]);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    expect((await listOrders({ ...base, from: today, to: today })).total).toBe(2);
    expect((await listOrders({ ...base, to: "2000-01-01" })).total).toBe(0);
  });
});
