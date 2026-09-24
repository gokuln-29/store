/**
 * Storefront listing filters, kept in the URL so filtered pages can be shared/bookmarked:
 *   ?sort=price_asc&page=2&min=100&max=999&stock=1&f.material=cotton,silk&f.weight=1-5
 * Prices in the URL are rupees; everything internal is paise.
 */

export const SORTS = ["newest", "price_asc", "price_desc", "name", "relevance"] as const;
export type SortKey = (typeof SORTS)[number];

export type FilterableAttribute = {
  key: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
  options: { value: string }[] | null;
};

export type AttributeFilter =
  { kind: "values"; values: string[] } | { kind: "range"; min: number | null; max: number | null };

export type ListingParams = {
  sort: SortKey;
  page: number;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  attributes: Record<string, AttributeFilter>;
};

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function rupeesToPaise(value: string | undefined): number | null {
  if (!value || !/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function num(value: string | undefined): number | null {
  if (value === undefined || value === "" || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

export function parseListingParams(
  raw: Raw,
  attributes: FilterableAttribute[],
  opts: { defaultSort?: SortKey; allowRelevance?: boolean } = {},
): ListingParams {
  const sortParam = first(raw.sort);
  const allowed = SORTS.filter((s) => s !== "relevance" || opts.allowRelevance);
  const sort = (allowed as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortKey)
    : (opts.defaultSort ?? "newest");
  const page = Math.min(50, Math.max(1, Number.parseInt(first(raw.page) ?? "1", 10) || 1));

  let minPrice = rupeesToPaise(first(raw.min));
  let maxPrice = rupeesToPaise(first(raw.max));
  if (minPrice != null && maxPrice != null && minPrice > maxPrice)
    [minPrice, maxPrice] = [maxPrice, minPrice];

  const parsed: Record<string, AttributeFilter> = {};
  for (const attr of attributes) {
    const value = first(raw[`f.${attr.key}`]);
    if (!value) continue;
    if (attr.type === "NUMBER") {
      const [lo, hi] = value.split("-");
      const range = { kind: "range" as const, min: num(lo), max: num(hi) };
      if (range.min != null || range.max != null) parsed[attr.key] = range;
    } else {
      const allowedValues = attr.options?.map((o) => o.value);
      const values = [
        ...new Set(
          value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ]
        .filter((v) => !allowedValues || allowedValues.includes(v))
        .slice(0, 20);
      if (values.length) parsed[attr.key] = { kind: "values", values };
    }
  }

  return { sort, page, minPrice, maxPrice, inStock: first(raw.stock) === "1", attributes: parsed };
}

/** Serializes params back to a query string (defaults omitted). `q` is kept for search pages. */
export function listingQuery(
  params: Partial<ListingParams> & { q?: string },
  defaults: { sort?: SortKey } = {},
): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.sort && params.sort !== (defaults.sort ?? "newest")) qs.set("sort", params.sort);
  if (params.minPrice != null) qs.set("min", String(params.minPrice / 100));
  if (params.maxPrice != null) qs.set("max", String(params.maxPrice / 100));
  if (params.inStock) qs.set("stock", "1");
  for (const [key, filter] of Object.entries(params.attributes ?? {})) {
    if (filter.kind === "values" && filter.values.length)
      qs.set(`f.${key}`, filter.values.join(","));
    if (filter.kind === "range" && (filter.min != null || filter.max != null)) {
      qs.set(`f.${key}`, `${filter.min ?? ""}-${filter.max ?? ""}`);
    }
  }
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(params: ListingParams): number {
  return (
    (params.minPrice != null || params.maxPrice != null ? 1 : 0) +
    (params.inStock ? 1 : 0) +
    Object.keys(params.attributes).length
  );
}

/** A category attribute as used by listing pages (label/options are localized JSON). */
export type ListingAttribute = {
  key: string;
  label: unknown;
  type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
  unit: string | null;
  options: unknown;
};
