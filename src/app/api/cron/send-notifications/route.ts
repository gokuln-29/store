import { cronGuard } from "@/lib/cron";
import { deliverNotifications } from "@/lib/services/notification.service";

export const dynamic = "force-dynamic";

/**
 * Retries order notifications (email / SMS / WhatsApp) that could not be sent right away.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET`. See docs/orders.md.
 */
async function handle(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  return Response.json(await deliverNotifications({ limit: 100 }));
}

export const GET = handle;
export const POST = handle;
