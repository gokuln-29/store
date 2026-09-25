import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { OrderStatus } from "@/generated/prisma/client";
import { ORDER_FLOW, flowStep } from "@/lib/services/order-status";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Placed → Confirmed → Packed → Shipped → Delivered, with the date each step happened. */
export async function OrderProgress({
  status,
  events,
  locale,
}: {
  status: OrderStatus;
  events: { toStatus: OrderStatus | null; createdAt: Date }[];
  locale: string;
}) {
  const t = await getTranslations("Order");
  const current = flowStep(status);
  const reachedAt = (s: OrderStatus) => events.findLast((e) => e.toStatus === s)?.createdAt;
  // For cancelled/returned orders, show how far the order got before that.
  const lastReached = ORDER_FLOW.reduce((acc, s, i) => (reachedAt(s) ? i : acc), -1);
  const done = current >= 0 ? current : lastReached;

  return (
    <ol className="grid gap-0 sm:grid-cols-5">
      {ORDER_FLOW.map((step, i) => {
        const reached = i <= done;
        const at = reachedAt(step);
        return (
          <li
            key={step}
            aria-current={i === current ? "step" : undefined}
            className="flex gap-3 pb-4 sm:flex-col sm:items-center sm:pb-0 sm:text-center"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                reached
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {reached ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className="text-sm">
              <span className={cn("block", reached ? "font-medium" : "text-muted-foreground")}>
                {t(`status${step}`)}
              </span>
              {at && reached && (
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(at, locale)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
