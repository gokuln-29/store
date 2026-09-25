import { cronGuard } from "@/lib/cron";
import { processCartReminders } from "@/lib/services/cart-reminder.service";
import { deliverNotifications } from "@/lib/services/notification.service";
import { processCampaigns } from "@/lib/services/push.service";

export const dynamic = "force-dynamic";

/**
 * Retries order notifications (email / SMS / WhatsApp / push) that could not be sent right
 * away, queues abandoned cart reminders, and continues push campaigns that are still sending.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET`. See docs/orders.md.
 */
async function handle(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const cartReminders = await processCartReminders();
  const notifications = await deliverNotifications({ limit: 100 });
  const campaigns = await processCampaigns({ timeBudgetMs: 25_000 });
  return Response.json({ ...notifications, campaigns, cartReminders });
}

export const GET = handle;
export const POST = handle;
