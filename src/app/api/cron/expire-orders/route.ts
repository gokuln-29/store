import { timingSafeEqual } from "node:crypto";
import { expireDueOrders } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Cancels unpaid online orders whose payment window has passed and releases their stock.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this
 * header automatically). See docs/payments.md.
 */
async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await expireDueOrders();
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
