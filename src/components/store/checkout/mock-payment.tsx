"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { mockPaymentAction } from "@/lib/actions/checkout.actions";
import { formatINR } from "@/lib/utils/money";

/** Buttons for the development payment provider: succeed or fail the payment. */
export function MockPayment({ orderNumber, amount }: { orderNumber: string; amount: number }) {
  const t = useTranslations("Order");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const pay = (success: boolean) =>
    startTransition(async () => {
      setMessage(undefined);
      const result = await mockPaymentAction(orderNumber, success);
      if (!result.ok) return setMessage(errorText(result.error));
      if (result.data.status === "failed") return setMessage(t("paymentFailed"));
      router.replace(`/order/${orderNumber}`);
    });

  return (
    <div className="grid gap-3">
      {message && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      )}
      <Button size="lg" disabled={isPending} onClick={() => pay(true)}>
        {t("payAmount", { amount: formatINR(amount, locale) })}
      </Button>
      <Button variant="outline" disabled={isPending} onClick={() => pay(false)}>
        {t("simulateFailure")}
      </Button>
    </div>
  );
}
