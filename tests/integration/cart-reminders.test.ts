import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveFeatures } from "@/lib/features";
import { setEmailProviderForTests, type EmailMessage } from "@/lib/providers/notify";
import { processCartReminders } from "@/lib/services/cart-reminder.service";
import { setPushSenderForTests, type PushPayload } from "@/lib/services/push.service";
import { updateFeatureSettings } from "@/lib/services/settings.service";

const mailbox: EmailMessage[] = [];
const pushes: { endpoint: string; payload: PushPayload }[] = [];
const HOUR = 60 * 60_000;
const now = new Date("2026-10-01T12:00:00Z");

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "k";
  process.env.VAPID_PRIVATE_KEY = "k";
  setEmailProviderForTests({ name: "memory", send: async (m) => void mailbox.push(m) });
  setPushSenderForTests(
    async (target, payload) =>
      void pushes.push({ endpoint: target.endpoint, payload: JSON.parse(payload) }),
  );
});
afterAll(() => {
  setEmailProviderForTests(undefined);
  setPushSenderForTests(null);
});

let variantId: string;
let seq = 0;
beforeEach(async () => {
  mailbox.length = 0;
  pushes.length = 0;
  await db.storeSettings.create({ data: { id: "default", name: "Demo Store" } });
  const category = await db.category.create({ data: { slug: "c", name: { en: "C" } } });
  const product = await db.product.create({
    data: {
      slug: "mysore-pak",
      name: { en: "Mysore Pak", ta: "மைசூர் பாக்" },
      categoryId: category.id,
      status: "PUBLISHED",
      variants: { create: [{ sku: "MP", price: 25000, stock: 10 }] },
    },
    include: { variants: true },
  });
  variantId = product.variants[0]!.id;
});

async function cartFor(opts: {
  ageHours: number;
  email?: string | null;
  cartReminders?: boolean;
  locale?: string;
}) {
  seq += 1;
  const user = await db.user.create({
    data: {
      phone: `+9196${String(seq).padStart(8, "0")}`,
      role: "CUSTOMER",
      name: "Asha",
      email: opts.email === undefined ? `asha${seq}@example.com` : opts.email,
      cartReminders: opts.cartReminders ?? true,
      preferredLocale: opts.locale ?? "en",
    },
  });
  const cart = await db.cart.create({
    data: { userId: user.id, items: { create: [{ variantId, quantity: 2 }] } },
  });
  // @updatedAt is set by Prisma on write, so backdate with SQL.
  await db.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${new Date(now.getTime() - opts.ageHours * HOUR)} WHERE id = ${cart.id}`;
  return { user, cart };
}

describe("abandoned cart reminders", () => {
  it("reminds once, 3 hours after the last change, in the customer's language", async () => {
    const { cart } = await cartFor({ ageHours: 4, locale: "ta" });
    await cartFor({ ageHours: 1 }); // too recent
    await cartFor({ ageHours: 24 * 8 }); // too old

    expect(await processCartReminders({ now })).toEqual({ reminded: 1 });
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]!.html).toContain('lang="ta"');
    expect(mailbox[0]!.text).toContain("மைசூர் பாக்");
    expect(mailbox[0]!.text).toMatch(/\/ta\/cart/);
    expect((await db.cart.findUniqueOrThrow({ where: { id: cart.id } })).reminderSentAt).toEqual(
      now,
    );

    expect(await processCartReminders({ now: new Date(now.getTime() + HOUR) })).toEqual({
      reminded: 0,
    });
  });

  it("does not remind again within 7 days, even if the cart changes", async () => {
    const { cart } = await cartFor({ ageHours: 4 });
    await processCartReminders({ now });
    const later = new Date(now.getTime() + 2 * 24 * HOUR);
    await db.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${new Date(later.getTime() - 5 * HOUR)} WHERE id = ${cart.id}`;
    expect(await processCartReminders({ now: later })).toEqual({ reminded: 0 });

    const nextWeek = new Date(now.getTime() + 8 * 24 * HOUR);
    await db.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${new Date(nextWeek.getTime() - 5 * HOUR)} WHERE id = ${cart.id}`;
    expect(await processCartReminders({ now: nextWeek })).toEqual({ reminded: 1 });
  });

  it("respects the customer's opt-out, empty carts and the store switch", async () => {
    await cartFor({ ageHours: 4, cartReminders: false });
    const { cart } = await cartFor({ ageHours: 4 });
    await db.cartItem.deleteMany({ where: { cartId: cart.id } }); // ordered / emptied
    expect(await processCartReminders({ now })).toEqual({ reminded: 0 });

    await cartFor({ ageHours: 4 });
    const admin = await db.user.create({ data: { email: "o@x.in", role: "OWNER" } });
    await updateFeatureSettings({ ...resolveFeatures({}), abandonedCart: false }, admin.id);
    expect(await processCartReminders({ now })).toEqual({ reminded: 0 });
  });

  it("pushes only to devices that opted in to offers", async () => {
    const { user } = await cartFor({ ageHours: 4, email: null });
    await db.pushSubscription.createMany({
      data: [
        {
          userId: user.id,
          endpoint: "https://push.example/offers",
          p256dh: "a",
          auth: "b",
          offers: true,
        },
        {
          userId: user.id,
          endpoint: "https://push.example/orders-only",
          p256dh: "a",
          auth: "b",
          offers: false,
        },
      ],
    });
    await processCartReminders({ now });
    expect(pushes.map((p) => p.endpoint)).toEqual(["https://push.example/offers"]);
    expect(pushes[0]!.payload).toMatchObject({ url: "/en/cart", tag: "cart-reminder" });
    expect(mailbox).toHaveLength(0);
  });

  it("sends a single reminder when jobs overlap", async () => {
    await cartFor({ ageHours: 4 });
    await Promise.all([
      processCartReminders({ now }),
      processCartReminders({ now }),
      processCartReminders({ now }),
    ]);
    expect(mailbox).toHaveLength(1);
  });
});
