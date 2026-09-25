"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { cancelMyOrderAction } from "@/lib/actions/my-orders.actions";
import { formatINR } from "@/lib/utils/money";

export function CancelOrderButton({
  orderNumber,
  refundAmount,
}: {
  orderNumber: string;
  /** Paid online: this amount is refunded automatically. */
  refundAmount: number;
}) {
  const t = useTranslations("MyOrders");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("cancel")}</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await cancelMyOrderAction({ orderNumber, reason });
              if (!result.ok) {
                toast.error(errorText(result.error));
                setOpen(false);
                router.refresh();
                return;
              }
              setOpen(false);
              toast.success(result.data.refunded ? t("cancelledRefund") : t("cancelled"));
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>
              {refundAmount > 0
                ? t("cancelRefund", { amount: formatINR(refundAmount, locale) })
                : t("cancelDescription")}
            </DialogDescription>
          </DialogHeader>
          <FormField id="cancel-reason" label={t("cancelReason")}>
            {(aria) => (
              <Input
                {...aria}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              {t("keepOrder")}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {t("cancelConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
