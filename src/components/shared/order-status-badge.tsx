import { getTranslations } from "next-intl/server";
import type { OrderStatus } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  PLACED: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  CONFIRMED: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300",
  PACKED: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  SHIPPED: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  DELIVERED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
  RETURNED: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
};

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = await getTranslations("Order");
  return (
    <Badge variant="outline" className={cn("border-transparent", TONE[status])}>
      {t(`status${status}`)}
    </Badge>
  );
}
