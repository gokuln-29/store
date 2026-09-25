import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setEmailProviderForTests } from "@/lib/providers/notify";
import { getSavedCartItems, saveCartIfNewer } from "@/lib/services/cart.service";
import { deliverNotifications } from "@/lib/services/notification.service";
import { changeOrderStatus } from "@/lib/services/order.service";
import {
  createCampaign,
  processCampaigns,
  PushGoneError,
  savePushSubscription,
  setPushSenderForTests,
  updatePushPreferences,
  type PushPayload,
} from "@/lib/services/push.service";

type Sent = { endpoint: string; payload: PushPayload };
const outbox: Sent[] = [];
const gone = new Set<string>();

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "test-public";
  process.env.VAPID_PRIVATE_KEY = "test-private";
  process.env.SMS_ORDER_UPDATES = "false";
  setEmailProviderForTests(null); // email off: only push in these tests
  setPushSenderForTests(async (target, payload) => {
    if (gone.has(target.endpoint)) throw new PushGoneError();
    outbox.push({ endpoint: target.endpoint, payload: JSON.parse(payload) as PushPayload });
  });
});
afterAll(() => {
  setPushSenderForTests(null);
  setEmailProviderForTests(undefined);
});

let seq = 0;
beforeEach(async () => {
  outbox.length = 0;
  gone.clear();
  await db.storeSettings.create({
    data: { id: "default", name: "Demo Store", orderNumberPrefix: "DS", defaultLocale: "en" },
  });
});

async function device(opts: {
  userId?: string | null;
  locale?: string;
  orderUpdates?: boolean;
  offers?: boolean;
}) {
  seq += 1;
  const endpoint = `https://push.example/${seq}`;
  await savePushSubscription({
    userId: opts.userId ?? null,
    endpoint,
    p256dh: "p256dh-key",
    auth: "auth-key",
    locale: opts.locale ?? "en",
    userAgent: "vitest",
    orderUpdates: opts.orderUpdates ?? true,
    offers: opts.offers ?? false,
  });
  return endpoint;
}

/** A placed COD order for a new customer (created directly: checkout is tested elsewhere). */
async function placedOrder() {
  const user = await db.user.create({
    data: { phone: `+91970000${String(seq++).padStart(4, "0")}`, role: "CUSTOMER" },
  });
  const order = await db.order.create({
    data: {
      orderNumber: `DS-${2000 + seq}`,
      userId: user.id,
      status: "PLACED",
      paymentMethod: "COD",
      customerName: "Asha",
      customerPhone: user.phone!,
      shippingAddress: {
        name: "Asha",
        line1: "1 Road",
        city: "Chennai",
        state: "Tamil Nadu",
        stateCode: "TN",
        pincode: "600001",
      },
      subtotal: 10000,
      total: 10000,
      pricesIncludeTax: true,
      locale: "ta",
    },
  });
  return { user, order };
}

describe("push subscriptions", () => {
  it("stores one row per device and follows whoever signs in on it", async () => {
    const a = await db.user.create({ data: { phone: "+919800000001", role: "CUSTOMER" } });
    const b = await db.user.create({ data: { phone: "+919800000002", role: "CUSTOMER" } });
    const endpoint = await device({ userId: a.id });
    await savePushSubscription({
      userId: b.id,
      endpoint,
      p256dh: "new",
      auth: "new",
      locale: "kn",
      userAgent: null,
      orderUpdates: false,
      offers: true,
    });
    const rows = await db.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: b.id,
      locale: "kn",
      orderUpdates: false,
      offers: true,
    });
    expect(await updatePushPreferences(endpoint, { orderUpdates: true, offers: false })).toBe(true);
    expect(
      await updatePushPreferences("https://push.example/unknown", {
        orderUpdates: true,
        offers: false,
      }),
    ).toBe(false);
  });
});

describe("order updates by push", () => {
  it("notifies the customer's devices that want order updates", async () => {
    const { user, order } = await placedOrder();
    const phone = await device({ userId: user.id, locale: "ta" });
    await device({ userId: user.id, orderUpdates: false, offers: true });
    await device({ userId: null, offers: true }); // someone else's device

    for (const to of ["CONFIRMED", "PACKED", "SHIPPED"] as const) {
      await changeOrderStatus({
        orderId: order.id,
        to,
        actor: { type: "staff", id: user.id, canRefund: false },
      });
    }
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      endpoint: phone,
      payload: {
        url: `/ta/account/orders/${order.orderNumber}`,
        tag: `order-${order.orderNumber}`,
      },
    });
    expect(outbox[0]!.payload.title).toContain(order.orderNumber);
    expect(await db.notification.findFirst({ where: { channel: "PUSH" } })).toMatchObject({
      status: "SENT",
      recipient: phone,
    });
  });

  it("drops expired subscriptions without retrying", async () => {
    const { user, order } = await placedOrder();
    const endpoint = await device({ userId: user.id });
    gone.add(endpoint);
    await changeOrderStatus({
      orderId: order.id,
      to: "CANCELLED",
      actor: { type: "staff", id: user.id, canRefund: false },
    });

    expect(await db.pushSubscription.count()).toBe(0);
    const row = await db.notification.findFirstOrThrow({ where: { channel: "PUSH" } });
    expect(row).toMatchObject({ status: "FAILED", attempts: 1, lockedUntil: null });
    expect(await deliverNotifications()).toEqual({ sent: 0, failed: 0, retrying: 0 });
  });
});

describe("notification language", () => {
  it("follows the customer's current language choice, not the one they ordered in", async () => {
    const { user, order } = await placedOrder(); // ordered in Tamil
    const endpoint = await device({ userId: user.id, locale: "ta" });
    await db.user.update({ where: { id: user.id }, data: { preferredLocale: "kn" } });
    await changeOrderStatus({
      orderId: order.id,
      to: "CANCELLED",
      actor: { type: "staff", id: user.id, canRefund: false },
    });
    const row = await db.notification.findFirstOrThrow({ where: { recipient: endpoint } });
    expect(row.locale).toBe("kn");
    expect(outbox[0]!.payload).toMatchObject({ url: `/kn/account/orders/${order.orderNumber}` });
    expect(outbox[0]!.payload.title).toContain("ರದ್ದಾಗಿದೆ"); // "cancelled" in Kannada
  });
});

describe("push campaigns", () => {
  const input = (actorId: string) => ({
    title: { en: "Diwali sale", ta: "தீபாவளி விற்பனை" },
    body: { en: "20% off sweets" },
    imageUrl: "/uploads/banners/diwali.jpg",
    url: "/c/sweets",
    actorId,
  });

  it("goes only to devices that opted in to offers, in their language", async () => {
    const admin = await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } });
    const ta = await device({ offers: true, locale: "ta" });
    const en = await device({ offers: true, locale: "en" });
    await device({ offers: false });

    const { id, audienceCount } = await createCampaign(input(admin.id));
    expect(audienceCount).toBe(2);
    expect(await processCampaigns({ batchSize: 1 })).toEqual({ sent: 2, failed: 0 });

    const byEndpoint = Object.fromEntries(outbox.map((s) => [s.endpoint, s.payload]));
    expect(byEndpoint[ta]).toMatchObject({
      title: "தீபாவளி விற்பனை",
      body: "20% off sweets",
      url: "/ta/c/sweets",
    });
    expect(byEndpoint[en]).toMatchObject({
      title: "Diwali sale",
      url: "/en/c/sweets",
      image: "/uploads/banners/diwali.jpg",
    });
    expect(await db.pushCampaign.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "SENT",
      sentCount: 2,
      failedCount: 0,
      lockedUntil: null,
    });
    expect(await processCampaigns()).toEqual({ sent: 0, failed: 0 });
    expect(await db.auditLog.count({ where: { action: "push.campaign.send" } })).toBe(1);
  });

  it("resumes after an interruption and never sends twice when senders overlap", async () => {
    const admin = await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } });
    const endpoints: string[] = [];
    for (let i = 0; i < 7; i++) endpoints.push(await device({ offers: true }));
    gone.add(endpoints[3]!);
    const { id } = await createCampaign(input(admin.id));

    // Out of time straight away: nothing sent, lock released for the next run.
    expect(await processCampaigns({ timeBudgetMs: 0 })).toEqual({ sent: 0, failed: 0 });
    expect((await db.pushCampaign.findUniqueOrThrow({ where: { id } })).lockedUntil).toBeNull();

    await Promise.all([
      processCampaigns({ batchSize: 2 }),
      processCampaigns({ batchSize: 2 }),
      processCampaigns({ batchSize: 2 }),
    ]);
    const campaign = await db.pushCampaign.findUniqueOrThrow({ where: { id } });
    if (campaign.status !== "SENT") await processCampaigns({ batchSize: 2 });

    expect(outbox.map((s) => s.endpoint).sort()).toEqual(
      endpoints.filter((e) => e !== endpoints[3]).sort(),
    );
    expect(await db.pushCampaign.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "SENT",
      sentCount: 6,
      failedCount: 1,
    });
    expect(await db.pushSubscription.count()).toBe(6); // the expired one is gone
  });

  it("completes immediately when nobody opted in", async () => {
    const admin = await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } });
    const { id, audienceCount } = await createCampaign(input(admin.id));
    expect(audienceCount).toBe(0);
    expect((await db.pushCampaign.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });
});

describe("offline cart saves", () => {
  it("never lets an older (replayed) save overwrite a newer one", async () => {
    const user = await db.user.create({ data: { phone: "+919800000009", role: "CUSTOMER" } });
    const category = await db.category.create({ data: { slug: "c", name: { en: "C" } } });
    const product = await db.product.create({
      data: {
        slug: "p",
        name: { en: "P" },
        categoryId: category.id,
        status: "PUBLISHED",
        variants: {
          create: [
            { sku: "A", price: 100, stock: 9 },
            { sku: "B", price: 100, stock: 9 },
          ],
        },
      },
      include: { variants: { orderBy: { sku: "asc" } } },
    });
    const [a, b] = product.variants;
    const t0 = new Date("2026-09-25T10:00:00Z");
    const t1 = new Date("2026-09-25T10:05:00Z");

    expect(await saveCartIfNewer(user.id, [{ variantId: b!.id, quantity: 2 }], t1)).toBe(true);
    // Made offline at t0, delivered later by background sync:
    expect(await saveCartIfNewer(user.id, [{ variantId: a!.id, quantity: 1 }], t0)).toBe(false);
    expect(await getSavedCartItems(user.id)).toEqual([{ variantId: b!.id, quantity: 2 }]);
  });
});
