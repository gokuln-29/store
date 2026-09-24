import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeBlocks } from "@/components/store/home/home-blocks";
import { JsonLd } from "@/components/store/json-ld";
import { getHomeBlocks } from "@/lib/services/home.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localeAlternates, siteUrl } from "@/lib/seo";
import { localize } from "@/lib/utils/localized";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const [settings, t] = await Promise.all([getStoreSettings(), getTranslations("Metadata")]);
  const description =
    localize(settings.metaDescription, locale) ||
    localize(settings.tagline, locale) ||
    t("description");
  return {
    title: { absolute: localize(settings.metaTitle, locale) || settings.name },
    description,
    alternates: localeAlternates("", locale, settings.supportedLocales, settings.defaultLocale),
    openGraph: { type: "website", siteName: settings.name, description, locale },
  };
}

function ComingSoon() {
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

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [blocks, settings] = await Promise.all([getHomeBlocks(locale), getStoreSettings()]);
  const url = `${siteUrl()}/${locale}`;

  return (
    <>
      <h1 className="sr-only">{settings.name}</h1>
      {blocks.length ? <HomeBlocks blocks={blocks} locale={locale} /> : <ComingSoon />}
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: settings.legalName || settings.name,
            url,
            ...(settings.logoUrl ? { logo: new URL(settings.logoUrl, siteUrl()).toString() } : {}),
            ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
            ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: settings.name,
            url,
            potentialAction: {
              "@type": "SearchAction",
              target: `${url}/search?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />
    </>
  );
}
