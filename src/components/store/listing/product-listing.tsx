import { PackageSearch, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Facets, ProductCard } from "@/lib/services/catalog-query.service";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";
import {
  activeFilterCount,
  listingQuery,
  type ListingAttribute,
  type ListingParams,
  type SortKey,
} from "@/lib/utils/store-filters";

export type { ListingAttribute };
import { ProductGrid } from "../product-card";
import { FilterPanel, type FilterAttributeView } from "./filter-panel";
import { SortSelect } from "./sort-select";

/** Grid + filters + sort + active filter chips + "Load more", shared by shop/category/search. */
export async function ProductListing({
  basePath,
  q,
  params,
  cards,
  total,
  pageSize,
  facets,
  attributes,
  locale,
  sortOptions,
  defaultSort,
  emptyTitle,
  emptyHint,
}: {
  basePath: string;
  q?: string;
  params: ListingParams;
  cards: ProductCard[];
  total: number;
  pageSize: number;
  facets: Facets;
  attributes: ListingAttribute[];
  locale: string;
  sortOptions: SortKey[];
  defaultSort: SortKey;
  emptyTitle: string;
  emptyHint?: string;
}) {
  const t = await getTranslations("Listing");
  const optionLabel = (attr: ListingAttribute, value: string) => {
    const options = Array.isArray(attr.options)
      ? (attr.options as { value: string; label: unknown }[])
      : [];
    return localize(options.find((o) => o.value === value)?.label, locale) || value;
  };

  const filterViews: FilterAttributeView[] = attributes.flatMap((attr) => {
    const facet = facets.attributes[attr.key];
    if (!facet) return [];
    const label = localize(attr.label, locale);
    return [
      "values" in facet
        ? {
            key: attr.key,
            label,
            type: attr.type,
            unit: attr.unit,
            values: facet.values.map((v) => ({ ...v, label: optionLabel(attr, v.value) })),
          }
        : { key: attr.key, label, type: attr.type, unit: attr.unit, range: facet },
    ];
  });

  // Chips for active filters, each linking to the same page without that filter.
  const chips: { label: string; href: string }[] = [];
  const hrefWithout = (next: Partial<ListingParams>) =>
    `${basePath}${listingQuery({ ...params, ...next, page: 1, q }, { sort: defaultSort })}`;
  if (params.inStock)
    chips.push({ label: t("inStockOnly"), href: hrefWithout({ inStock: false }) });
  if (params.minPrice != null || params.maxPrice != null) {
    chips.push({
      label: `${t("price")}: ${t("range", { min: params.minPrice != null ? formatINR(params.minPrice, locale) : "…", max: params.maxPrice != null ? formatINR(params.maxPrice, locale) : "…" })}`,
      href: hrefWithout({ minPrice: null, maxPrice: null }),
    });
  }
  for (const [key, filter] of Object.entries(params.attributes)) {
    const attr = attributes.find((a) => a.key === key);
    if (!attr) continue;
    const rest = { ...params.attributes };
    delete rest[key];
    const value =
      filter.kind === "values"
        ? filter.values.map((v) => optionLabel(attr, v)).join(", ")
        : t("range", { min: filter.min ?? "…", max: filter.max ?? "…" });
    chips.push({
      label: `${localize(attr.label, locale)}: ${value}`,
      href: hrefWithout({ attributes: rest }),
    });
  }
  const activeCount = activeFilterCount(params);
  const shown = cards.length;
  const hasMore = shown < total;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <FilterPanel attributes={filterViews} price={facets.price} activeCount={activeCount} />
      <div className="grid min-w-0 content-start gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <SortSelect value={params.sort} options={sortOptions} defaultSort={defaultSort} />
        </div>

        {chips.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={chip.href}
                  scroll={false}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm hover:bg-muted"
                  aria-label={t("removeFilter", { label: chip.label })}
                >
                  {chip.label}
                  <X className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`${basePath}${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                scroll={false}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("clearAll")}
              </Link>
            </li>
          </ul>
        )}

        {cards.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-16 text-center">
            <PackageSearch className="size-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{emptyTitle}</p>
            {(emptyHint || activeCount > 0) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCount > 0 ? t("noProductsHint") : emptyHint}
              </p>
            )}
          </div>
        ) : (
          <ProductGrid products={cards} priorityCount={4} />
        )}

        {cards.length > 0 && (
          <div className="flex flex-col items-center gap-3 pt-4">
            <p className="text-sm text-muted-foreground">{t("showing", { shown, total })}</p>
            {hasMore && (
              <Button asChild variant="outline">
                <Link
                  href={`${basePath}${listingQuery({ ...params, q, page: Math.floor(shown / pageSize) + 1 }, { sort: defaultSort })}`}
                  scroll={false}
                  rel="next"
                >
                  {t("loadMore")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
