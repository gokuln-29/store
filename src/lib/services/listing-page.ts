import { getFacets, listStoreProducts } from "@/lib/services/catalog-query.service";
import {
  parseListingParams,
  type FilterableAttribute,
  type ListingAttribute,
  type SortKey,
} from "@/lib/utils/store-filters";

export const PAGE_SIZE = 24;

/** Loads everything a listing page (shop/category/search) needs. */
export async function loadListing(input: {
  raw: Record<string, string | string[] | undefined>;
  scope: { categoryIds?: string[]; q?: string };
  attributes: ListingAttribute[];
  locale: string;
  defaultSort: SortKey;
  allowRelevance?: boolean;
}) {
  const filterable = input.attributes.map((a) => ({
    key: a.key,
    type: a.type,
    options: Array.isArray(a.options) ? (a.options as { value: string }[]) : null,
  })) satisfies FilterableAttribute[];
  const params = parseListingParams(input.raw, filterable, {
    defaultSort: input.defaultSort,
    allowRelevance: input.allowRelevance,
  });
  const [{ cards, total }, facets] = await Promise.all([
    listStoreProducts({
      scope: input.scope,
      params,
      attributes: filterable,
      locale: input.locale,
      pageSize: PAGE_SIZE,
      cumulative: true,
    }),
    getFacets(input.scope, filterable),
  ]);
  return { params, cards, total, facets };
}
