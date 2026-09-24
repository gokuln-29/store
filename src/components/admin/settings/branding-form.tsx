"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ColorInput } from "@/components/admin/forms/color-input";
import { ImageUploadField } from "@/components/admin/forms/image-upload";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { updateBrandingSettingsAction } from "@/lib/actions/settings.actions";
import { STORE_FONTS, googleFontsHref } from "@/lib/constants/fonts";
import { contrastRatio, HEX_COLOR, readableForeground } from "@/lib/utils/color";
import { brandingSettingsSchema, type BrandingSettingsInput } from "@/lib/validators/settings";

function fontFamily(name: string) {
  const font = STORE_FONTS.find((f) => f.name === name);
  return font?.googleId ? `"${font.family}", var(--font-noto-sans)` : "var(--font-noto-sans)";
}

export function BrandingSettingsForm({
  defaults,
  storeName,
}: {
  defaults: BrandingSettingsInput;
  storeName: string;
}) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const form = useForm<BrandingSettingsInput, unknown, z.output<typeof brandingSettingsSchema>>({
    resolver: zodResolver(brandingSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, updateBrandingSettingsAction, {
    successMessage: t("saved"),
  });
  const values = useWatch({ control: form.control }) as BrandingSettingsInput;

  const primary = HEX_COLOR.test(values.primaryColor ?? "")
    ? values.primaryColor
    : defaults.primaryColor;
  const secondary = HEX_COLOR.test(values.secondaryColor ?? "")
    ? values.secondaryColor
    : defaults.secondaryColor;
  const lowContrast = contrastRatio(primary, "#ffffff") < 3;
  const fontsHref = googleFontsHref([values.headingFont, values.bodyFont]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
        <FormField id="logoUrl" label={t("logo")} error={errorText(errors.logoUrl?.message)}>
          {(aria) => (
            <Controller
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <ImageUploadField
                  id={aria.id}
                  folder="branding"
                  value={field.value || null}
                  onChange={(url) => field.onChange(url ?? "")}
                  previewClassName="w-40"
                />
              )}
            />
          )}
        </FormField>
        <FormField
          id="faviconUrl"
          label={t("favicon")}
          hint={t("faviconHint")}
          error={errorText(errors.faviconUrl?.message)}
        >
          {(aria) => (
            <Controller
              control={form.control}
              name="faviconUrl"
              render={({ field }) => (
                <ImageUploadField
                  id={aria.id}
                  folder="branding"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/webp"
                  value={field.value || null}
                  onChange={(url) => field.onChange(url ?? "")}
                  previewClassName="size-12"
                  describedBy={aria["aria-describedby"]}
                />
              )}
            />
          )}
        </FormField>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            id="primaryColor"
            label={t("primaryColor")}
            error={errorText(errors.primaryColor?.message)}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <ColorInput
                    id={aria.id}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={aria["aria-invalid"]}
                  />
                )}
              />
            )}
          </FormField>
          <FormField
            id="secondaryColor"
            label={t("secondaryColor")}
            error={errorText(errors.secondaryColor?.message)}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <ColorInput
                    id={aria.id}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={aria["aria-invalid"]}
                  />
                )}
              />
            )}
          </FormField>
        </div>
        {lowContrast && (
          <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t("contrastWarning")}
          </p>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          {(["headingFont", "bodyFont"] as const).map((name) => (
            <FormField key={name} id={name} label={t(name)} hint={t("fontHint")}>
              {(aria) => (
                <NativeSelect {...aria} {...form.register(name)}>
                  {STORE_FONTS.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ))}
        </div>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">{t("preview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {fontsHref && <link rel="stylesheet" href={fontsHref} />}
          <div
            className="overflow-hidden rounded-lg border bg-white text-neutral-900"
            style={{ fontFamily: fontFamily(values.bodyFont) }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              {values.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- live preview of an unsaved upload
                <img src={values.logoUrl} alt="" className="h-7 w-auto object-contain" />
              ) : (
                <span className="font-bold" style={{ fontFamily: fontFamily(values.headingFont) }}>
                  {storeName}
                </span>
              )}
              <span className="size-5 rounded-full" style={{ background: primary }} aria-hidden />
            </div>
            <div className="grid gap-3 p-4">
              <span
                className="w-fit rounded px-2 py-0.5 text-xs font-semibold"
                style={{ background: secondary, color: readableForeground(secondary) }}
              >
                {t("previewBadge")}
              </span>
              <p
                className="text-xl font-bold"
                style={{ fontFamily: fontFamily(values.headingFont) }}
              >
                {t("previewHeading")}
              </p>
              <p className="text-sm text-neutral-600">{t("previewText")}</p>
              <span
                className="w-fit rounded-md px-4 py-2 text-sm font-medium"
                style={{ background: primary, color: readableForeground(primary) }}
              >
                {t("previewButton")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
