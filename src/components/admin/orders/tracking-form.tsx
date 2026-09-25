"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { updateTrackingAction } from "@/lib/actions/orders.actions";

type Tracking = { courierName: string; trackingNumber: string; trackingUrl: string };

/** Corrects courier details after an order has shipped. */
export function TrackingForm({ orderId, initial }: { orderId: string; initial: Tracking }) {
  const t = useTranslations("AdminOrders");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateTrackingAction({ orderId, ...values });
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          if (!result.ok) return void toast.error(errorText(result.error));
          toast.success(t("trackingSaved"));
          router.refresh();
        });
      }}
    >
      {(["courierName", "trackingNumber", "trackingUrl"] as const).map((field) => (
        <FormField
          key={field}
          id={`tracking-${field}`}
          label={t(field)}
          error={errorText(errors[field])}
        >
          {(aria) => (
            <Input
              {...aria}
              type={field === "trackingUrl" ? "url" : "text"}
              autoComplete="off"
              value={values[field]}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
            />
          )}
        </FormField>
      ))}
      <div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? tCommon("saving") : t("saveTracking")}
        </Button>
      </div>
    </form>
  );
}
