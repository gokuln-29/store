import { z } from "zod";
import { getClientIp } from "@/lib/request";
import { isBot, recordFunnelEvent } from "@/lib/services/analytics.service";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import { getFeatures } from "@/lib/services/settings.service";

export const dynamic = "force-dynamic";

const STEPS = {
  visit: "VISIT",
  cart: "ADD_TO_CART",
  checkout: "CHECKOUT",
  ordered: "ORDERED",
} as const;
const bodySchema = z.object({
  s: z.uuid(),
  step: z.enum(["visit", "cart", "checkout", "ordered"]),
});

/**
 * Anonymous funnel beacon (navigator.sendBeacon). Stores only a random per-session id, the
 * step and the day. Always answers 204 so it never shows errors in the browser.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  if (!(await getFeatures()).analytics || isBot(request.headers.get("user-agent"))) return done;
  const text = await request.text().catch(() => "");
  if (text.length > 200) return done;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return done;
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return done;
  const limit = await rateLimit(
    postgresRateLimitStore,
    RATE_LIMITS.analyticsByIp(await getClientIp()),
  );
  if (!limit.allowed) return done;
  await recordFunnelEvent(parsed.data.s, STEPS[parsed.data.step]);
  return done;
}
