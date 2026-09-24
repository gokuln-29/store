"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";

/** Rich text edited per language (tabs), stored at `${name}.en`, `${name}.ta`, … */
export function LocalizedRichText({ name, label }: { name: string; label: string }) {
  const t = useTranslations("LocalizedInput");
  const tLocale = useTranslations("LocaleSwitcher");
  const { control } = useFormContext();
  const [active, setActive] = useState<string>(routing.defaultLocale);
  const values = (useWatch({ control, name }) ?? {}) as Record<string, string | undefined>;
  const baseId = `field-${name.replace(/\./g, "-")}`;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label id={`${baseId}-label`}>{label}</Label>
        <div
          role="tablist"
          aria-label={t("language")}
          className="inline-flex rounded-md border p-0.5"
        >
          {routing.locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={active === locale}
              aria-controls={`${baseId}-panel-${locale}`}
              onClick={() => setActive(locale)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium text-muted-foreground",
                active === locale && "bg-accent text-foreground",
              )}
            >
              {tLocale("locale", { locale })}
              {!values[locale] && <span className="sr-only"> ({t("missing")})</span>}
            </button>
          ))}
        </div>
      </div>
      {routing.locales.map((locale) => (
        <div
          key={locale}
          role="tabpanel"
          id={`${baseId}-panel-${locale}`}
          hidden={active !== locale}
        >
          <Controller
            control={control}
            name={`${name}.${locale}`}
            render={({ field }) => (
              <RichTextEditor
                id={`${baseId}-${locale}`}
                lang={locale}
                value={field.value ?? ""}
                onChange={field.onChange}
                ariaLabelledBy={`${baseId}-label`}
              />
            )}
          />
        </div>
      ))}
    </div>
  );
}
