"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { changeOrderStatusAction } from "@/lib/actions/orders.actions";
import { formatINR } from "@/lib/utils/money";
import type { ORDER_STATUSES } from "@/lib/validators/orders";

type Status = (typeof ORDER_STATUSES)[number];

/**
 * The next steps for an order. Shipping asks for courier details, cancelling for a reason
 * (and warns about the automatic refund), returning for whether to restock.
 */
export function OrderActions(props: {
  orderId: string;
  status: Status;
  next: Status[];
  /** Amount refunded automatically if this paid online order is cancelled (0 otherwise). */
  refundOnCancel: number;
  canRefund: boolean;
  tracking: { courierName: string; trackingNumber: string; trackingUrl: string };
}) {
  const t = useTranslations("AdminOrders");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [tracking, setTracking] = useState(props.tracking);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!props.next.length) return <p className="text-sm text-muted-foreground">{t("noActions")}</p>;

  const openDialog = (to: Status) => {
    setNote("");
    setRestock(true);
    setTracking(props.tracking);
    setFieldErrors({});
    setOpen(to);
  };

  const submit = (to: Status) =>
    startTransition(async () => {
      const result = await changeOrderStatusAction({
        orderId: props.orderId,
        to,
        expectedStatus: props.status,
        note,
        ...(to === "SHIPPED" ? { tracking } : {}),
        ...(to === "RETURNED" ? { restock } : {}),
      });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(errorText(result.fieldErrors ? "validation" : result.error));
        if (result.error === "stale") router.refresh();
        return;
      }
      setOpen(null);
      toast.success(t("updated", { status: t(`statusShort.${to}`) }));
      const refund = result.data.refund;
      if (refund?.ok)
        toast.success(t("refundIssued", { amount: formatINR(refund.amount, locale) }));
      if (refund && !refund.ok) toast.error(t("refundFailed"));
      router.refresh();
    });

  const primary = props.next.find((s) => s !== "CANCELLED" && s !== "RETURNED");
  const blockedCancel = props.refundOnCancel > 0 && !props.canRefund;

  return (
    <div className="grid gap-2">
      {props.next.map((to) => (
        <Button
          key={to}
          variant={to === primary ? "default" : to === "CANCELLED" ? "destructive" : "outline"}
          disabled={isPending}
          onClick={() => openDialog(to)}
        >
          {t(`action.${to}`)}
        </Button>
      ))}

      <Dialog open={open !== null} onOpenChange={(o) => !o && !isPending && setOpen(null)}>
        <DialogContent>
          {open && (
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit(open);
              }}
            >
              <DialogHeader>
                <DialogTitle>{t(`dialog.${open}.title`)}</DialogTitle>
                <DialogDescription>{t(`dialog.${open}.description`)}</DialogDescription>
              </DialogHeader>

              {open === "SHIPPED" && (
                <div className="grid gap-3">
                  {(["courierName", "trackingNumber", "trackingUrl"] as const).map((field) => (
                    <FormField
                      key={field}
                      id={`ship-${field}`}
                      label={t(field)}
                      hint={field === "trackingUrl" ? t("trackingUrlHint") : undefined}
                      error={errorText(fieldErrors[`tracking.${field}`])}
                    >
                      {(aria) => (
                        <Input
                          {...aria}
                          type={field === "trackingUrl" ? "url" : "text"}
                          autoComplete="off"
                          value={tracking[field]}
                          onChange={(e) => setTracking({ ...tracking, [field]: e.target.value })}
                        />
                      )}
                    </FormField>
                  ))}
                </div>
              )}

              {open === "CANCELLED" && props.refundOnCancel > 0 && (
                <p
                  role={blockedCancel ? "alert" : undefined}
                  className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
                >
                  {blockedCancel
                    ? t("cancelNeedsOwner")
                    : t("cancelRefund", { amount: formatINR(props.refundOnCancel, locale) })}
                </p>
              )}

              {open === "RETURNED" && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="restock"
                    checked={restock}
                    onCheckedChange={(v) => setRestock(v === true)}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="restock">{t("restock")}</Label>
                    <p className="text-xs text-muted-foreground">{t("restockHint")}</p>
                  </div>
                </div>
              )}

              {(open === "CANCELLED" || open === "RETURNED") && (
                <FormField
                  id="status-note"
                  label={open === "CANCELLED" ? t("cancelReason") : t("returnNote")}
                  error={errorText(fieldErrors.note)}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      autoComplete="off"
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                </FormField>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setOpen(null)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="submit"
                  variant={open === "CANCELLED" ? "destructive" : "default"}
                  disabled={isPending || (open === "CANCELLED" && blockedCancel)}
                >
                  {t(`action.${open}`)}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
