import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeaderSearch } from "@/components/store/header-search";
import { ProductListing } from "@/components/store/listing/product-listing";
import { PAGE_SIZE, loadListing } from "@/lib/services/listing-page";
import { firstParam } from "@/lib/utils/search-params";

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const t = await getTranslations("Search");
  const q = firstParam((await searchParams).q)?.trim();
  // Search result pages shouldn't be indexed.
  return { title: q ? t("resultsFor", { q }) : t("title"), robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const raw = await searchParams;
  const q = (firstParam(raw.q) ?? "").trim().slice(0, 80);
  const t = await getTranslations("Search");

  return (
    <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6">
      <HeaderSearch className="md:hidden" autoFocus={!q} initialQuery={q} />
      <h1 className="text-2xl font-bold sm:text-3xl">{q ? t("resultsFor", { q }) : t("title")}</h1>
      {!q ? (
        <p className="text-muted-foreground">{t("emptyQuery")}</p>
      ) : (
        <SearchResults q={q} raw={raw} locale={locale} />
      )}
    </div>
  );
}

async function SearchResults({
  q,
  raw,
  locale,
}: {
  q: string;
  raw: Record<string, string | string[] | undefined>;
  locale: string;
}) {
  const t = await getTranslations("Search");
  const listing = await loadListing({
    raw,
    scope: { q },
    attributes: [],
    locale,
    defaultSort: "relevance",
    allowRelevance: true,
  });
  return (
    <ProductListing
      basePath="/search"
      q={q}
      {...listing}
      pageSize={PAGE_SIZE}
      attributes={[]}
      locale={locale}
      sortOptions={["relevance", "newest", "price_asc", "price_desc"]}
      defaultSort="relevance"
      emptyTitle={t("noResults", { q })}
      emptyHint={t("noResultsHint")}
    />
  );
}
