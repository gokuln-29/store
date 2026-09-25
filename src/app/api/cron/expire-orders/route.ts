import { cronGuard } from "@/lib/cron";
import { expireDueOrders } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

/**
 * Cancels unpaid online orders whose payment window has passed and releases their stock.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET`. See docs/payments.md.
 */
async function handle(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  return Response.json(await expireDueOrders());
}

export const GET = handle;
export const POST = handle;
