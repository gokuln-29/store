import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  // The [locale] layout has already validated the locale.
  setRequestLocale(locale as Locale);
  const t = useTranslations("Home");

  return (
    <section className="container mx-auto px-4 py-16 text-center sm:py-24">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
        {t("subtitle")}
      </p>
    </section>
  );
}
