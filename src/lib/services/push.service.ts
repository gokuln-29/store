import { after } from "next/server";
import webpush from "web-push";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { localize } from "@/lib/utils/localized";
import { audit } from "./audit.service";
import { getStoreSettings } from "./settings.service";

/**
 * Web push: subscriptions (one per browser/device), delivery via VAPID, and promotional
 * campaigns. Order updates go through the notification outbox (notification.service).
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Same-site path opened on click. */
  url: string;
  image?: string;
  /** Replaces an earlier notification with the same tag (e.g. updates for one order). */
  tag?: string;
};

type Target = { endpoint: string; p256dh: string; auth: string };
export type PushSender = (target: Target, payload: string) => Promise<void>;

/** The browser dropped this subscription (404/410): it will never work again. */
export class PushGoneError extends Error {
  constructor() {
    super("Push subscription expired");
    this.name = "PushGoneError";
  }
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const webPushSender: PushSender = async (target, payload) => {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ||
      `mailto:${process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? "admin@example.com"}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      payload,
      { TTL: 24 * 60 * 60, timeout: 10_000 },
    );
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) throw new PushGoneError();
    throw error;
  }
};

let senderOverride: PushSender | null = null;
/** Tests only. */
export function setPushSenderForTests(sender: PushSender | null): void {
  senderOverride = sender;
}

/** Sends one push; a subscription the browser has dropped is deleted. */
export async function sendPush(target: Target, payload: PushPayload): Promise<"sent" | "gone"> {
  if (!pushConfigured() && !senderOverride) throw new Error("Push is not configured (VAPID keys)");
  try {
    await (senderOverride ?? webPushSender)(target, JSON.stringify(payload));
    await db.pushSubscription.updateMany({
      where: { endpoint: target.endpoint },
      data: { lastUsedAt: new Date() },
    });
    return "sent";
  } catch (error) {
    if (!(error instanceof PushGoneError)) throw error;
    await db.pushSubscription.deleteMany({ where: { endpoint: target.endpoint } });
    return "gone";
  }
}

// ───────────── Subscriptions ─────────────

export async function savePushSubscription(input: {
  userId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  userAgent: string | null;
  orderUpdates: boolean;
  offers: boolean;
}): Promise<void> {
  const data = {
    userId: input.userId,
    p256dh: input.p256dh,
    auth: input.auth,
    locale: input.locale,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
    orderUpdates: input.orderUpdates,
    offers: input.offers,
  };
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    // A device that changed hands follows whoever is signed in now.
    update: data,
  });
}

export function getPushPreferences(endpoint: string) {
  return db.pushSubscription.findUnique({
    where: { endpoint },
    select: { orderUpdates: true, offers: true },
  });
}

export async function updatePushPreferences(
  endpoint: string,
  prefs: { orderUpdates: boolean; offers: boolean },
): Promise<boolean> {
  const { count } = await db.pushSubscription.updateMany({ where: { endpoint }, data: prefs });
  return count === 1;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint } });
}

// ───────────── Campaigns ─────────────

export function countOfferSubscribers() {
  return db.pushSubscription.count({ where: { offers: true } });
}

export async function createCampaign(input: {
  title: Record<string, string>;
  body: Record<string, string>;
  imageUrl: string | null;
  url: string | null;
  actorId: string;
}): Promise<{ id: string; audienceCount: number }> {
  return db.$transaction(async (tx) => {
    const audienceCount = await tx.pushSubscription.count({ where: { offers: true } });
    const campaign = await tx.pushCampaign.create({
      data: {
        title: input.title as Prisma.InputJsonValue,
        body: input.body as Prisma.InputJsonValue,
        imageUrl: input.imageUrl,
        url: input.url,
        audienceCount,
        createdById: input.actorId,
        ...(audienceCount === 0 ? { status: "SENT", completedAt: new Date() } : {}),
      },
      select: { id: true },
    });
    await audit(
      {
        actorId: input.actorId,
        action: "push.campaign.send",
        entityType: "PushCampaign",
        entityId: campaign.id,
        changes: { title: input.title, audienceCount },
      },
      tx,
    );
    return { id: campaign.id, audienceCount };
  });
}

export function listCampaigns(page: number, pageSize: number) {
  return Promise.all([
    db.pushCampaign.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { createdBy: { select: { name: true, email: true } } },
    }),
    db.pushCampaign.count(),
  ]).then(([rows, total]) => ({ rows, total }));
}

const LOCK_MS = 60_000;
const CONCURRENCY = 10;

function campaignPayload(
  campaign: {
    id: string;
    title: unknown;
    body: unknown;
    imageUrl: string | null;
    url: string | null;
  },
  locale: string,
  defaultLocale: string,
): PushPayload {
  const path = campaign.url ?? "/";
  return {
    title: localize(campaign.title, locale, defaultLocale),
    body: localize(campaign.body, locale, defaultLocale),
    url: `/${locale}${path === "/" ? "" : path}`,
    ...(campaign.imageUrl ? { image: campaign.imageUrl } : {}),
    tag: `campaign-${campaign.id}`,
  };
}

/**
 * Sends campaigns in batches, resuming where it stopped (cursor). Safe to run from several
 * places at once: each campaign is locked while one sender works on it.
 */
export async function processCampaigns(
  opts: { batchSize?: number; timeBudgetMs?: number } = {},
): Promise<{ sent: number; failed: number }> {
  const batchSize = opts.batchSize ?? 100;
  const deadline = Date.now() + (opts.timeBudgetMs ?? 20_000);
  const settings = await getStoreSettings();
  const totals = { sent: 0, failed: 0 };

  const campaigns = await db.pushCampaign.findMany({
    where: { status: "SENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const { id } of campaigns) {
    const now = new Date();
    const claimed = await db.pushCampaign.updateMany({
      where: { id, status: "SENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
    });
    if (claimed.count !== 1) continue;
    const campaign = await db.pushCampaign.findUniqueOrThrow({ where: { id } });
    let cursor = campaign.cursor;

    while (Date.now() < deadline) {
      const batch = await db.pushSubscription.findMany({
        where: { offers: true, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      let sent = 0;
      let failed = 0;
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const results = await Promise.allSettled(
          batch
            .slice(i, i + CONCURRENCY)
            .map((sub) =>
              sendPush(
                sub,
                campaignPayload(
                  campaign,
                  sub.locale ?? settings.defaultLocale,
                  settings.defaultLocale,
                ),
              ),
            ),
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value === "sent") sent += 1;
          else failed += 1;
        }
      }
      cursor = batch.at(-1)?.id ?? cursor;
      const done = batch.length < batchSize;
      await db.pushCampaign.update({
        where: { id },
        data: {
          cursor,
          sentCount: { increment: sent },
          failedCount: { increment: failed },
          lockedUntil: done ? null : new Date(Date.now() + LOCK_MS),
          ...(done ? { status: "SENT", completedAt: new Date() } : {}),
        },
      });
      totals.sent += sent;
      totals.failed += failed;
      if (done) break;
    }
    if (Date.now() >= deadline) {
      // Out of time: release the lock so the next run continues from the cursor.
      await db.pushCampaign.updateMany({
        where: { id, status: "SENDING" },
        data: { lockedUntil: null },
      });
      break;
    }
  }
  return totals;
}

/** Sends campaigns after the current response (the cron job picks up anything left). */
export async function scheduleCampaignSending(): Promise<void> {
  const run = () =>
    processCampaigns().catch((error) => console.error("[push] campaign sending failed", error));
  try {
    after(run);
  } catch {
    await run();
  }
}
