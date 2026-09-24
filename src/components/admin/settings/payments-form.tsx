"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { updatePaymentSettingsAction } from "@/lib/actions/settings.actions";
import { paymentSettingsSchema, type PaymentSettingsInput } from "@/lib/validators/settings";

export function PaymentSettingsForm({ defaults }: { defaults: PaymentSettingsInput }) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const form = useForm<PaymentSettingsInput, unknown, z.output<typeof paymentSettingsSchema>>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, updatePaymentSettingsAction, {
    successMessage: t("saved"),
  });
  const codEnabled = useWatch({ control: form.control, name: "codEnabled" });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
      <Controller
        control={form.control}
        name="onlinePaymentsEnabled"
        render={({ field }) => (
          <SwitchField
            id="onlinePaymentsEnabled"
            label={t("onlinePayments")}
            hint={t("onlinePaymentsHint")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="codEnabled"
        render={({ field }) => (
          <SwitchField
            id="codEnabled"
            label={t("cod")}
            checked={field.value}
            onCheckedChange={field.onChange}
            error={errorText(errors.codEnabled?.message)}
          />
        )}
      />
      {codEnabled && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="codFee" label={t("codFee")} error={errorText(errors.codFee?.message)}>
            {(aria) => <Input inputMode="decimal" {...aria} {...form.register("codFee")} />}
          </FormField>
          <FormField
            id="codMinOrderValue"
            label={t("codMin")}
            hint={t("noLimitHint")}
            error={errorText(errors.codMinOrderValue?.message)}
          >
            {(aria) => (
              <Input inputMode="decimal" {...aria} {...form.register("codMinOrderValue")} />
            )}
          </FormField>
          <FormField
            id="codMaxOrderValue"
            label={t("codMax")}
            hint={t("noLimitHint")}
            error={errorText(errors.codMaxOrderValue?.message)}
          >
            {(aria) => (
              <Input inputMode="decimal" {...aria} {...form.register("codMaxOrderValue")} />
            )}
          </FormField>
        </div>
      )}
      <FormField
        id="pendingOrderTtlMinutes"
        label={t("pendingTtl")}
        hint={t("pendingTtlHint")}
        error={errorText(errors.pendingOrderTtlMinutes?.message)}
      >
        {(aria) => (
          <Input
            inputMode="numeric"
            className="max-w-[8rem]"
            {...aria}
            {...form.register("pendingOrderTtlMinutes")}
          />
        )}
      </FormField>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
