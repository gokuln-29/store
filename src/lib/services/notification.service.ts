import { after } from "next/server";
import type { NotificationChannel, OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  getEmailProvider,
  getSmsProvider,
  getWhatsAppProvider,
  orderSmsEnabled,
} from "@/lib/providers/notify";
import {
  CART_REMINDER,
  cartPayloadSchema,
  orderPayloadSchema,
  renderCartReminder,
  renderOrderNotification,
  ORDER_TEMPLATES,
  type RenderedNotification,
  type OrderNotificationPayload,
  type OrderTemplate,
} from "@/lib/notifications/render";
import { routing } from "@/i18n/routing";
import { formatINR } from "@/lib/utils/money";
import { pushConfigured, sendPush } from "./push.service";
import { getStoreSettings } from "./settings.service";
import { logger } from "@/lib/logger";

const log = logger("notify");

/**
 * Customer notifications (email / SMS / WhatsApp) use an outbox: rows are written in the same
 * transaction as the change they announce, then delivered after the response. Failures are
 * retried with backoff by the cron job, so a slow provider never blocks an order update.
 */

type Tx = Prisma.TransactionClient;

export const MAX_ATTEMPTS = 5;
const SEND_LOCK_MS = 2 * 60_000;
/** Wait before retry n (1-based). */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** A failure that retrying can't fix (e.g. the push subscription is gone). */
export class PermanentDeliveryError extends Error {}

/** Status changes the customer is told about. */
export const NOTIFY_ON: Partial<Record<OrderStatus, OrderTemplate>> = {
  PLACED: "order_placed",
  SHIPPED: "order_shipped",
  DELIVERED: "order_delivered",
  CANCELLED: "order_cancelled",
  RETURNED: "order_returned",
};

function enabled(check: () => unknown): boolean {
  try {
    return !!check();
  } catch {
    return false; // misconfigured provider: skip that channel rather than fail the order
  }
}

export async function enqueueOrderNotification(
  tx: Tx,
  orderId: string,
  template: OrderTemplate,
  extra: { refund?: boolean } = {},
): Promise<number> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      userId: true,
      user: { select: { preferredLocale: true } },
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      total: true,
      locale: true,
      courierName: true,
      trackingNumber: true,
      trackingUrl: true,
    },
  });
  const settings = await getStoreSettings();
  // The customer's current language choice wins over the one they ordered in.
  const locale =
    [order.user?.preferredLocale, order.locale].find(
      (l): l is string => !!l && (routing.locales as readonly string[]).includes(l),
    ) ?? routing.defaultLocale;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const payload: OrderNotificationPayload = {
    storeName: settings.name,
    brandColor: settings.primaryColor,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: formatINR(order.total, locale),
    orderUrl: `${appUrl}/${locale}/account/orders/${encodeURIComponent(order.orderNumber)}`,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    ...(extra.refund ? { refund: true } : {}),
  };

  const targets: { channel: NotificationChannel; recipient: string }[] = [];
  if (order.customerEmail && enabled(getEmailProvider)) {
    targets.push({ channel: "EMAIL", recipient: order.customerEmail });
  }
  if (orderSmsEnabled() && enabled(getSmsProvider)) {
    targets.push({ channel: "SMS", recipient: order.customerPhone });
  }
  if (enabled(getWhatsAppProvider)) {
    targets.push({ channel: "WHATSAPP", recipient: order.customerPhone });
  }
  if (order.userId && pushConfigured()) {
    const devices = await tx.pushSubscription.findMany({
      where: { userId: order.userId, orderUpdates: true },
      select: { endpoint: true },
    });
    for (const d of devices) targets.push({ channel: "PUSH", recipient: d.endpoint });
  }
  if (!targets.length) return 0;

  await tx.notification.createMany({
    data: targets.map((target) => ({
      ...target,
      orderId,
      userId: order.userId,
      template,
      locale,
      payload: payload as Prisma.InputJsonValue,
    })),
  });
  return targets.length;
}

type Row = {
  id: string;
  channel: NotificationChannel;
  template: string;
  locale: string;
  recipient: string;
  payload: Prisma.JsonValue;
};

type Prepared = {
  message: RenderedNotification;
  params: Record<string, string>;
  push: { url: string; tag: string; consent: "orderUpdates" | "offers" };
};

/** Renders a stored notification (any template) in its language. */
function prepare(n: Row): Prepared {
  if (n.template === CART_REMINDER) {
    const payload = cartPayloadSchema.parse(n.payload);
    return {
      message: renderCartReminder(n.locale, payload),
      params: { storeName: payload.storeName, itemCount: String(payload.itemCount) },
      push: { url: `/${n.locale}/cart`, tag: "cart-reminder", consent: "offers" },
    };
  }
  if (!(ORDER_TEMPLATES as readonly string[]).includes(n.template)) {
    throw new PermanentDeliveryError(`Unknown template "${n.template}"`);
  }
  const payload = orderPayloadSchema.parse(n.payload);
  return {
    message: renderOrderNotification(n.template as OrderTemplate, n.locale, payload),
    params: {
      orderNumber: payload.orderNumber,
      total: payload.total,
      storeName: payload.storeName,
      ...(payload.trackingNumber ? { trackingNumber: payload.trackingNumber } : {}),
    },
    push: {
      url: `/${n.locale}/account/orders/${encodeURIComponent(payload.orderNumber)}`,
      tag: `order-${payload.orderNumber}`,
      consent: "orderUpdates",
    },
  };
}

async function send(n: Row): Promise<void> {
  const { message, params, push } = prepare(n);
  const template = n.template;

  switch (n.channel) {
    case "EMAIL": {
      const email = getEmailProvider();
      if (!email) throw new Error("Email is switched off");
      await email.send({
        to: n.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return;
    }
    case "SMS":
      await getSmsProvider().sendMessage({
        to: n.recipient,
        template,
        params,
        locale: n.locale,
        text: message.short,
      });
      return;
    case "WHATSAPP": {
      const whatsapp = getWhatsAppProvider();
      if (!whatsapp) throw new Error("WhatsApp is switched off");
      await whatsapp.sendMessage({
        to: n.recipient,
        template,
        params,
        locale: n.locale,
        text: message.short,
      });
      return;
    }
    case "PUSH": {
      const device = await db.pushSubscription.findUnique({ where: { endpoint: n.recipient } });
      // Consent is checked again at send time: the customer may have changed it meanwhile.
      if (!device || !device[push.consent]) {
        throw new PermanentDeliveryError("Push subscription removed or turned off");
      }
      const result = await sendPush(device, { ...message.push, url: push.url, tag: push.tag });
      if (result === "gone") throw new PermanentDeliveryError("Push subscription expired");
      return;
    }
    default:
      throw new Error(`Channel ${n.channel} is not supported`);
  }
}

/**
 * Sends due notifications. Each row is claimed first (attempts + lock), so concurrent runs
 * never send the same message twice.
 */
export async function deliverNotifications(
  opts: { orderId?: string; limit?: number } = {},
): Promise<{ sent: number; failed: number; retrying: number }> {
  const now = new Date();
  const due = { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] };
  const rows = await db.notification.findMany({
    where: { status: "PENDING", ...(opts.orderId ? { orderId: opts.orderId } : {}), ...due },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });

  const result = { sent: 0, failed: 0, retrying: 0 };
  for (const row of rows) {
    const claimed = await db.notification.updateMany({
      where: { id: row.id, status: "PENDING", ...due },
      data: { attempts: { increment: 1 }, lockedUntil: new Date(Date.now() + SEND_LOCK_MS) },
    });
    if (claimed.count !== 1) continue;
    const attempts = row.attempts + 1;
    try {
      await send(row);
      await db.notification.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lockedUntil: null, error: null },
      });
      result.sent += 1;
    } catch (error) {
      const giveUp = attempts >= MAX_ATTEMPTS || error instanceof PermanentDeliveryError;
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          error: String((error as Error).message ?? error).slice(0, 500),
          lockedUntil: giveUp
            ? null
            : new Date(Date.now() + BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]!),
        },
      });
      result[giveUp ? "failed" : "retrying"] += 1;
    }
  }
  return result;
}

/**
 * Delivers an order's notifications after the current response is sent (Next.js `after`).
 * Outside a request (scripts, tests) it delivers right away.
 */
export async function scheduleNotificationDelivery(orderId: string): Promise<void> {
  const run = () =>
    deliverNotifications({ orderId }).catch((error) =>
      log.error("delivery failed", { orderId }, error),
    );
  try {
    after(run);
  } catch {
    await run();
  }
}
