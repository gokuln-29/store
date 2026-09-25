"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { authorize, getCurrentUser } from "@/lib/auth-guards";
import {
  createCampaign,
  getPushPreferences,
  removePushSubscription,
  savePushSubscription,
  scheduleCampaignSending,
  updatePushPreferences,
} from "@/lib/services/push.service";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import { getClientIp } from "@/lib/request";
import {
  pushCampaignSchema,
  pushPreferencesSchema,
  pushSubscriptionSchema,
  type PushCampaignInput,
  type PushPreferencesInput,
  type PushSubscriptionInput,
} from "@/lib/validators/push";
import { invalid, type ActionResult } from "./result";

const endpointSchema = pushSubscriptionSchema.shape.endpoint;

/** Stores this browser's push subscription (signed-in customers get order updates on it). */
export async function savePushSubscriptionAction(
  input: PushSubscriptionInput,
): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.pushByIp(await getClientIp()));
  if (!limit.allowed) return { ok: false, error: "rate_limited" };
  const user = await getCurrentUser();
  await savePushSubscription({
    userId: user?.id ?? null,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    locale: parsed.data.locale,
    userAgent: (await headers()).get("user-agent"),
    orderUpdates: parsed.data.orderUpdates,
    offers: parsed.data.offers,
  });
  return { ok: true, data: undefined };
}

/** This device's choices, or null if it isn't subscribed. The endpoint acts as its key. */
export async function pushPreferencesAction(
  endpoint: string,
): Promise<ActionResult<{ orderUpdates: boolean; offers: boolean } | null>> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await getPushPreferences(parsed.data) };
}

export async function updatePushPreferencesAction(
  input: PushPreferencesInput,
): Promise<ActionResult> {
  const parsed = pushPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { endpoint, ...prefs } = parsed.data;
  const found = await updatePushPreferences(endpoint, prefs);
  return found ? { ok: true, data: undefined } : { ok: false, error: "not_found" };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "validation" };
  await removePushSubscription(parsed.data);
  return { ok: true, data: undefined };
}

/** Sends a promotion to every device that opted in to offers. */
export async function sendPushCampaignAction(
  input: PushCampaignInput,
): Promise<ActionResult<{ id: string; audienceCount: number }>> {
  const user = await authorize("content:manage");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = pushCampaignSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, { nested: true });
  const result = await createCampaign({ ...parsed.data, actorId: user.id });
  if (result.audienceCount > 0) await scheduleCampaignSending();
  revalidatePath("/[locale]/admin/push", "layout");
  return { ok: true, data: result };
}
