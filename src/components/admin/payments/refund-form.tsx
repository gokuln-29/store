"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { refundPaymentAction } from "@/lib/actions/payments.actions";
import { formatINR, paiseToRupeeInput } from "@/lib/utils/money";
import { refundSchema, type RefundInput } from "@/lib/validators/payments";

/** Full or partial refund. Validates, asks for confirmation, then calls the provider. */
export function RefundForm({ paymentId, maxAmount }: { paymentId: string; maxAmount: number }) {
  const t = useTranslations("Payments");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const form = useForm<RefundInput, unknown, z.output<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    defaultValues: { paymentId, amount: paiseToRupeeInput(maxAmount), reason: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    if (values.amount > maxAmount) {
      form.setError("amount", { message: "amount_exceeds" });
      return;
    }
    setConfirmAmount(values.amount);
  });

  const confirm = () =>
    startTransition(async () => {
      const result = await refundPaymentAction(form.getValues());
      setConfirmAmount(null);
      if (result.ok) {
        toast.success(
          result.data.status === "PROCESSED" ? t("refundProcessed") : t("refundStarted"),
        );
        router.refresh();
        return;
      }
      if (result.fieldErrors?.amount)
        form.setError("amount", { message: result.fieldErrors.amount });
      toast.error(
        errorText(result.fieldErrors?.amount ?? result.error, {
          amount: formatINR(maxAmount, locale),
        }),
      );
    });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-sm gap-4">
      <FormField
        id="amount"
        label={t("refundAmount")}
        hint={t("refundHint", { amount: formatINR(maxAmount, locale) })}
        error={errorText(errors.amount?.message, { amount: formatINR(maxAmount, locale) })}
      >
        {(aria) => (
          <Input inputMode="decimal" autoComplete="off" {...aria} {...form.register("amount")} />
        )}
      </FormField>
      <FormField
        id="reason"
        label={t("refundReason")}
        hint={t("refundReasonHint")}
        error={errorText(errors.reason?.message)}
      >
        {(aria) => <Input autoComplete="off" {...aria} {...form.register("reason")} />}
      </FormField>
      <div>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {t("refundSubmit")}
        </Button>
      </div>

      <AlertDialog
        open={confirmAmount !== null}
        onOpenChange={(open) => !open && !isPending && setConfirmAmount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("refundConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("refundConfirm", { amount: formatINR(confirmAmount ?? 0, locale) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              {t("refundButton", { amount: formatINR(confirmAmount ?? 0, locale) })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
