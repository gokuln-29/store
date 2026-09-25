import { cronGuard } from "@/lib/cron";
import { deliverNotifications } from "@/lib/services/notification.service";
import { processCampaigns } from "@/lib/services/push.service";

export const dynamic = "force-dynamic";

/**
 * Retries order notifications (email / SMS / WhatsApp / push) that could not be sent right
 * away, and continues push campaigns that are still sending.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET`. See docs/orders.md.
 */
async function handle(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const notifications = await deliverNotifications({ limit: 100 });
  const campaigns = await processCampaigns({ timeBudgetMs: 25_000 });
  return Response.json({ ...notifications, campaigns });
}

export const GET = handle;
export const POST = handle;
