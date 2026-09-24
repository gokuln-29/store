"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { get, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * One field edited in every store language (en / ta / kn) via tabs. Registers
 * `${name}.en`, `${name}.ta`, … on the surrounding <FormProvider>.
 */
export function LocalizedInput({
  name,
  label,
  hint,
  multiline = false,
  requiredLocale,
}: {
  name: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  /** Marks this language as required in the UI (validation happens in the schema). */
  requiredLocale?: string;
}) {
  const t = useTranslations("LocalizedInput");
  const tLocale = useTranslations("LocaleSwitcher");
  const errorText = useErrorText();
  const { register, formState, control } = useFormContext();
  const [active, setActive] = useState<string>(routing.defaultLocale);
  const values = (useWatch({ control, name }) ?? {}) as Record<string, string | undefined>;
  const errors = (get(formState.errors, name) ?? {}) as Record<
    string,
    { message?: string } | undefined
  >;
  const baseId = `field-${name.replace(/\./g, "-")}`;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`${baseId}-${active}`}>{label}</Label>
        <div
          role="tablist"
          aria-label={t("language")}
          className="inline-flex rounded-md border p-0.5"
        >
          {routing.locales.map((locale) => {
            const missing = !values[locale];
            const hasError = Boolean(errors[locale]);
            return (
              <button
                key={locale}
                type="button"
                role="tab"
                id={`${baseId}-tab-${locale}`}
                aria-selected={active === locale}
                aria-controls={`${baseId}-panel-${locale}`}
                onClick={() => setActive(locale)}
                className={cn(
                  "relative rounded px-2.5 py-1 text-xs font-medium text-muted-foreground",
                  active === locale && "bg-accent text-foreground",
                )}
              >
                {tLocale("locale", { locale })}
                {(hasError || (missing && locale === requiredLocale)) && (
                  <span
                    className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive"
                    aria-hidden
                  />
                )}
                {missing && <span className="sr-only"> ({t("missing")})</span>}
              </button>
            );
          })}
        </div>
      </div>
      {routing.locales.map((locale) => {
        const error = errorText(errors[locale]?.message);
        const fieldProps = {
          id: `${baseId}-${locale}`,
          lang: locale,
          "aria-invalid": Boolean(error),
          "aria-describedby": error
            ? `${baseId}-${locale}-error`
            : hint
              ? `${baseId}-hint`
              : undefined,
          ...register(`${name}.${locale}`),
        };
        return (
          <div
            key={locale}
            role="tabpanel"
            id={`${baseId}-panel-${locale}`}
            aria-labelledby={`${baseId}-tab-${locale}`}
            hidden={active !== locale}
            className="grid gap-2"
          >
            {multiline ? <Textarea rows={4} {...fieldProps} /> : <Input {...fieldProps} />}
            {error && (
              <p id={`${baseId}-${locale}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {hint && (
        <p id={`${baseId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
