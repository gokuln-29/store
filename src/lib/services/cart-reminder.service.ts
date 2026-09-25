import type { NotificationChannel, Prisma } from "@/generated/prisma/client";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { CART_REMINDER, type CartReminderPayload } from "@/lib/notifications/render";
import { getEmailProvider, getWhatsAppProvider } from "@/lib/providers/notify";
import { localize } from "@/lib/utils/localized";
import { deliverNotifications } from "./notification.service";
import { pushConfigured } from "./push.service";
import { getFeatures, getStoreSettings } from "./settings.service";

/**
 * Abandoned cart reminders: one message 3 hours after a signed-in customer last changed a cart
 * they didn't order, at most once per 7 days per customer, and never for carts older than a
 * week. Email (if they gave one), WhatsApp (if configured) and push only to devices that
 * opted in to offers. Customers can switch reminders off in My account.
 */

export const REMIND_AFTER_MS = 3 * 60 * 60_000;
export const QUIET_PERIOD_MS = 7 * 24 * 60 * 60_000;

function enabled(check: () => unknown): boolean {
  try {
    return !!check();
  } catch {
    return false;
  }
}

export async function processCartReminders(
  opts: { now?: Date; limit?: number } = {},
): Promise<{ reminded: number }> {
  if (!(await getFeatures()).abandonedCart) return { reminded: 0 };
  const now = opts.now ?? new Date();
  const settings = await getStoreSettings();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const quietSince = new Date(now.getTime() - QUIET_PERIOD_MS);

  const carts = await db.cart.findMany({
    where: {
      updatedAt: { lte: new Date(now.getTime() - REMIND_AFTER_MS), gte: quietSince },
      items: { some: {} },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: quietSince } }],
      user: { role: "CUSTOMER", isActive: true, cartReminders: true },
    },
    orderBy: { updatedAt: "asc" },
    take: opts.limit ?? 100,
    select: {
      id: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          preferredLocale: true,
          pushSubscriptions: { where: { offers: true }, select: { endpoint: true } },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          variant: { select: { product: { select: { name: true, status: true } } } },
        },
      },
    },
  });

  let reminded = 0;
  for (const cart of carts) {
    const user = cart.user;
    const items = cart.items.filter((i) => i.variant.product.status === "PUBLISHED");
    if (!items.length) continue;
    const locale = (routing.locales as readonly string[]).includes(user.preferredLocale ?? "")
      ? user.preferredLocale!
      : routing.defaultLocale;

    const targets: { channel: NotificationChannel; recipient: string }[] = [];
    if (user.email && enabled(getEmailProvider))
      targets.push({ channel: "EMAIL", recipient: user.email });
    if (user.phone && enabled(getWhatsAppProvider))
      targets.push({ channel: "WHATSAPP", recipient: user.phone });
    if (pushConfigured()) {
      for (const d of user.pushSubscriptions)
        targets.push({ channel: "PUSH", recipient: d.endpoint });
    }

    const payload: CartReminderPayload = {
      storeName: settings.name,
      brandColor: settings.primaryColor,
      customerName: user.name ?? "",
      items: items.slice(0, 3).map((i) => localize(i.variant.product.name, locale)),
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      cartUrl: `${appUrl}/${locale}/cart`,
      accountUrl: `${appUrl}/${locale}/account`,
    };

    const sent = await db.$transaction(async (tx) => {
      // Claim the cart: only one run can mark it, and only if it hasn't changed meanwhile.
      const claimed = await tx.cart.updateMany({
        where: {
          id: cart.id,
          updatedAt: cart.updatedAt,
          OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: quietSince } }],
        },
        data: { reminderSentAt: now },
      });
      if (claimed.count !== 1) return false;
      if (targets.length) {
        await tx.notification.createMany({
          data: targets.map((target) => ({
            ...target,
            userId: user.id,
            template: CART_REMINDER,
            locale,
            payload: payload as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      return true;
    });
    if (sent) reminded += 1;
  }
  if (reminded) await deliverNotifications({ limit: 200 });
  return { reminded };
}

export async function setCartReminders(userId: string, on: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { cartReminders: on } });
}
