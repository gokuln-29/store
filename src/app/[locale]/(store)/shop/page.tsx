import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreBreadcrumbs } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/listing/product-listing";
import { PAGE_SIZE, loadListing } from "@/lib/services/listing-page";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings] = await Promise.all([getTranslations("Listing"), getStoreSettings()]);
  return {
    title: t("allProducts"),
    alternates: localeAlternates(
      "/shop",
      locale,
      settings.supportedLocales,
      settings.defaultLocale,
    ),
  };
}

export default async function ShopPage({ params, searchParams }: PageProps<"/[locale]/shop">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Listing");
  const listing = await loadListing({
    raw: await searchParams,
    scope: {},
    attributes: [],
    locale,
    defaultSort: "newest",
  });

  return (
    <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6">
      <StoreBreadcrumbs items={[{ label: t("allProducts") }]} locale={locale} />
      <h1 className="text-2xl font-bold sm:text-3xl">{t("allProducts")}</h1>
      <ProductListing
        basePath="/shop"
        {...listing}
        pageSize={PAGE_SIZE}
        attributes={[]}
        locale={locale}
        sortOptions={["newest", "price_asc", "price_desc", "name"]}
        defaultSort="newest"
        emptyTitle={t("noProducts")}
        emptyHint={t("emptyCategory")}
      />
    </div>
  );
}
