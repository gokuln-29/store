import { getTranslations } from "next-intl/server";
import type { PaymentStatus, RefundStatus } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  AUTHORIZED: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  CAPTURED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  FAILED: "bg-destructive/15 text-destructive",
  PARTIALLY_REFUNDED: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  REFUNDED: "bg-muted text-muted-foreground",
};

const REFUND_TONE: Record<RefundStatus, string> = {
  PENDING: PAYMENT_TONE.PENDING,
  PROCESSED: PAYMENT_TONE.CAPTURED,
  FAILED: PAYMENT_TONE.FAILED,
};

export async function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = await getTranslations("Payments");
  return (
    <Badge variant="outline" className={cn("border-transparent", PAYMENT_TONE[status])}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}

export async function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const t = await getTranslations("Payments");
  return (
    <Badge variant="outline" className={cn("border-transparent", REFUND_TONE[status])}>
      {t(`refundStatuses.${status}`)}
    </Badge>
  );
}
