"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { updateTaxSettingsAction } from "@/lib/actions/settings.actions";
import { INDIAN_STATES } from "@/lib/constants/indian-states";
import { taxSettingsSchema, type TaxSettingsInput } from "@/lib/validators/settings";

export function TaxSettingsForm({ defaults }: { defaults: TaxSettingsInput }) {
  const t = useTranslations("Settings");
  const tAddr = useTranslations("Addresses");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const form = useForm<TaxSettingsInput, unknown, z.output<typeof taxSettingsSchema>>({
    resolver: zodResolver(taxSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, updateTaxSettingsAction, {
    successMessage: t("saved"),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
      <FormField id="legalName" label={t("legalName")} error={errorText(errors.legalName?.message)}>
        {(aria) => <Input {...aria} {...form.register("legalName")} />}
      </FormField>
      <FormField
        id="gstNumber"
        label={t("gstin")}
        hint={t("gstinHint")}
        error={errorText(errors.gstNumber?.message)}
      >
        {(aria) => (
          <Input
            className="max-w-xs font-mono uppercase"
            maxLength={15}
            {...aria}
            {...form.register("gstNumber")}
          />
        )}
      </FormField>
      <FormField
        id="stateCode"
        label={t("businessState")}
        hint={t("businessStateHint")}
        error={errorText(errors.stateCode?.message)}
      >
        {(aria) => (
          <NativeSelect className="max-w-xs" {...aria} {...form.register("stateCode")}>
            <option value="">{tAddr("statePlaceholder")}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <Controller
        control={form.control}
        name="pricesIncludeTax"
        render={({ field }) => (
          <SwitchField
            id="pricesIncludeTax"
            label={t("pricesIncludeTax")}
            hint={t("pricesIncludeTaxHint")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <FormField
        id="defaultTaxRateBps"
        label={t("defaultTaxRate")}
        hint={t("defaultTaxRateHint")}
        error={errorText(errors.defaultTaxRateBps?.message)}
      >
        {(aria) => (
          <Input
            inputMode="decimal"
            className="max-w-[8rem]"
            {...aria}
            {...form.register("defaultTaxRateBps")}
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
