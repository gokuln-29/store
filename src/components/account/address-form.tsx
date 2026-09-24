"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { saveAddressAction } from "@/lib/actions/account.actions";
import { INDIAN_STATES } from "@/lib/constants/indian-states";
import { addressSchema, type AddressInput } from "@/lib/validators/auth";
export function AddressForm({ id, defaults }: { id: string | null; defaults: AddressInput }) {
  const t = useTranslations("Addresses");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddressInput, unknown, z.output<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const err = (field: keyof AddressInput) => errorText(errors[field]?.message);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveAddressAction(id, {
        ...values,
        label: values.label ?? "",
        line2: values.line2 ?? "",
        landmark: values.landmark ?? "",
      });
      if (result.ok) {
        toast.success(t("saved"));
        router.push("/account/addresses");
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof AddressInput, { message });
      }
      if (!result.fieldErrors) toast.error(errorText(result.error));
    });
  });

  const optional = (label: string) => `${label} (${tCommon("optional")})`;

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-xl gap-4 sm:grid-cols-2">
      <FormField id="name" label={t("name")} error={err("name")}>
        {(aria) => <Input autoComplete="name" {...aria} {...form.register("name")} />}
      </FormField>
      <FormField id="phone" label={t("phone")} error={err("phone")}>
        {(aria) => (
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            {...aria}
            {...form.register("phone")}
          />
        )}
      </FormField>
      <FormField id="line1" label={t("line1")} error={err("line1")} className="sm:col-span-2">
        {(aria) => <Input autoComplete="address-line1" {...aria} {...form.register("line1")} />}
      </FormField>
      <FormField
        id="line2"
        label={optional(t("line2"))}
        error={err("line2")}
        className="sm:col-span-2"
      >
        {(aria) => <Input autoComplete="address-line2" {...aria} {...form.register("line2")} />}
      </FormField>
      <FormField id="landmark" label={optional(t("landmark"))} error={err("landmark")}>
        {(aria) => <Input {...aria} {...form.register("landmark")} />}
      </FormField>
      <FormField id="pincode" label={t("pincode")} error={err("pincode")}>
        {(aria) => (
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            {...aria}
            {...form.register("pincode")}
          />
        )}
      </FormField>
      <FormField id="city" label={t("city")} error={err("city")}>
        {(aria) => <Input autoComplete="address-level2" {...aria} {...form.register("city")} />}
      </FormField>
      <FormField id="stateCode" label={t("state")} error={err("stateCode")}>
        {(aria) => (
          <NativeSelect autoComplete="address-level1" {...aria} {...form.register("stateCode")}>
            <option value="" disabled>
              {t("statePlaceholder")}
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="label" label={optional(t("label"))} error={err("label")}>
        {(aria) => <Input {...aria} {...form.register("label")} />}
      </FormField>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Controller
          control={form.control}
          name="isDefault"
          render={({ field }) => (
            <Checkbox
              id="isDefault"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="isDefault" className="font-normal">
          {t("isDefault")}
        </Label>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/addresses">{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
