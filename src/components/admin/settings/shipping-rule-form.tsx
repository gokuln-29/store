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
import { Link, useRouter } from "@/i18n/navigation";
import { saveShippingRuleAction } from "@/lib/actions/settings.actions";
import { INDIAN_STATES } from "@/lib/constants/indian-states";
import { shippingRuleSchema, type ShippingRuleInput } from "@/lib/validators/settings";

export function ShippingRuleForm({
  id,
  defaults,
}: {
  id: string | null;
  defaults: ShippingRuleInput;
}) {
  const t = useTranslations("Shipping");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const form = useForm<ShippingRuleInput, unknown, z.output<typeof shippingRuleSchema>>({
    resolver: zodResolver(shippingRuleSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const rateType = useWatch({ control: form.control, name: "rateType" });
  const { onSubmit, isPending } = useActionForm(
    form,
    (input) => saveShippingRuleAction(id, input),
    {
      successMessage: t("saved"),
      onSuccess: () => router.push("/admin/settings/shipping"),
    },
  );
  const err = (field: keyof ShippingRuleInput) =>
    errorText(errors[field]?.message as string | undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField id="name" label={t("name")} error={err("name")}>
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <FormField id="priority" label={t("priority")} error={err("priority")}>
          {(aria) => <Input inputMode="numeric" {...aria} {...form.register("priority")} />}
        </FormField>
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">{t("priorityHint")}</p>

      <FormField
        id="pincodePrefixes"
        label={t("pincodes")}
        hint={t("pincodesHint")}
        error={err("pincodePrefixes")}
      >
        {(aria) => <Input placeholder="560, 600" {...aria} {...form.register("pincodePrefixes")} />}
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t("states")}</legend>
        <p className="text-xs text-muted-foreground">{t("statesHint")}</p>
        <Controller
          control={form.control}
          name="stateCodes"
          render={({ field }) => (
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              {INDIAN_STATES.map((s) => (
                <label key={s.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={field.value.includes(s.code)}
                    onChange={(e) =>
                      field.onChange(
                        e.target.checked
                          ? [...field.value, s.code]
                          : field.value.filter((c) => c !== s.code),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{t("rateType")}</legend>
        <div className="flex gap-4">
          {(["FLAT", "WEIGHT_BASED"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value={type}
                className="size-4 accent-primary"
                {...form.register("rateType")}
              />
              {type === "FLAT" ? t("flat") : t("weightBased")}
            </label>
          ))}
        </div>
      </fieldset>

      {rateType === "FLAT" ? (
        <FormField id="flatRate" label={t("flatRate")} error={err("flatRate")}>
          {(aria) => (
            <Input
              inputMode="decimal"
              className="max-w-[10rem]"
              {...aria}
              {...form.register("flatRate")}
            />
          )}
        </FormField>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="baseWeightGrams" label={t("baseWeight")} error={err("baseWeightGrams")}>
            {(aria) => (
              <Input inputMode="numeric" {...aria} {...form.register("baseWeightGrams")} />
            )}
          </FormField>
          <FormField id="baseRate" label={t("baseRate")} error={err("baseRate")}>
            {(aria) => <Input inputMode="decimal" {...aria} {...form.register("baseRate")} />}
          </FormField>
          <FormField
            id="additionalWeightGrams"
            label={t("additionalWeight")}
            error={err("additionalWeightGrams")}
          >
            {(aria) => (
              <Input inputMode="numeric" {...aria} {...form.register("additionalWeightGrams")} />
            )}
          </FormField>
          <FormField id="additionalRate" label={t("additionalRate")} error={err("additionalRate")}>
            {(aria) => <Input inputMode="decimal" {...aria} {...form.register("additionalRate")} />}
          </FormField>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="freeShippingThreshold"
          label={t("freeAbove")}
          error={err("freeShippingThreshold")}
        >
          {(aria) => (
            <Input inputMode="decimal" {...aria} {...form.register("freeShippingThreshold")} />
          )}
        </FormField>
        <FormField id="estimatedDaysMin" label={t("daysMin")} error={err("estimatedDaysMin")}>
          {(aria) => <Input inputMode="numeric" {...aria} {...form.register("estimatedDaysMin")} />}
        </FormField>
        <FormField id="estimatedDaysMax" label={t("daysMax")} error={err("estimatedDaysMax")}>
          {(aria) => <Input inputMode="numeric" {...aria} {...form.register("estimatedDaysMax")} />}
        </FormField>
      </div>

      <Controller
        control={form.control}
        name="codAvailable"
        render={({ field }) => (
          <SwitchField
            id="codAvailable"
            label={t("codAvailable")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <SwitchField
            id="isActive"
            label={t("active")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/settings/shipping">{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
