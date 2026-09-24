"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { routing } from "@/i18n/routing";
import { updateGeneralSettingsAction } from "@/lib/actions/settings.actions";
import { generalSettingsSchema, type GeneralSettingsInput } from "@/lib/validators/settings";

export function GeneralSettingsForm({ defaults }: { defaults: GeneralSettingsInput }) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const tLocale = useTranslations("LocaleSwitcher");
  const errorText = useErrorText();
  const form = useForm<GeneralSettingsInput, unknown, z.output<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, updateGeneralSettingsAction, {
    successMessage: t("saved"),
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
        <FormField id="name" label={t("storeName")} error={errorText(errors.name?.message)}>
          {(aria) => <Input {...aria} {...form.register("name")} />}
        </FormField>
        <LocalizedInput name="tagline" label={t("tagline")} hint={t("taglineHint")} />
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t("languages")}</legend>
          <p className="text-xs text-muted-foreground">{t("languagesHint")}</p>
          <Controller
            control={form.control}
            name="supportedLocales"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4">
                {routing.locales.map((locale) => (
                  <label key={locale} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(locale)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...field.value, locale]
                            : field.value.filter((l) => l !== locale),
                        )
                      }
                    />
                    {tLocale("locale", { locale })}
                  </label>
                ))}
              </div>
            )}
          />
          {errors.supportedLocales && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(errors.supportedLocales.message)}
            </p>
          )}
        </fieldset>
        <FormField
          id="defaultLocale"
          label={t("defaultLanguage")}
          error={errorText(errors.defaultLocale?.message)}
        >
          {(aria) => (
            <NativeSelect {...aria} {...form.register("defaultLocale")} className="max-w-xs">
              {routing.locales.map((l) => (
                <option key={l} value={l}>
                  {tLocale("locale", { locale: l })}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id="minOrderValue"
          label={t("minOrderValue")}
          hint={t("minOrderHint")}
          error={errorText(errors.minOrderValue?.message)}
        >
          {(aria) => (
            <Input
              inputMode="decimal"
              className="max-w-xs"
              {...aria}
              {...form.register("minOrderValue")}
            />
          )}
        </FormField>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
