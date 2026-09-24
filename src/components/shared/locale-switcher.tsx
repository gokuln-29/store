"use client";

import { Languages } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as AppLocale;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- pathname and params always match for the current route.
        { pathname, params },
        { locale: nextLocale },
      );
    });
  }

  return (
    <label className="relative flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={onChange}
        disabled={isPending}
        className="cursor-pointer bg-transparent outline-none disabled:opacity-50"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {t("locale", { locale: l })}
          </option>
        ))}
      </select>
    </label>
  );
}
