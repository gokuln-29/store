export const PAGE_SIZES = [10, 20, 50, 100] as const;

export type TableParams<S extends string> = {
  page: number;
  pageSize: number;
  q: string;
  sort: S;
  dir: "asc" | "desc";
  /** Any extra single-value filters, e.g. { status: "PUBLISHED" }. */
  filters: Record<string, string>;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses list query params from the URL with safe defaults. Unknown sort fields fall back
 * to the default, so user input never reaches Prisma's orderBy unchecked.
 */
export function parseTableParams<S extends string>(
  raw: RawParams,
  config: {
    sortable: readonly S[];
    defaultSort: S;
    defaultDir?: "asc" | "desc";
    filters?: Record<string, readonly string[]>;
    defaultPageSize?: number;
  },
): TableParams<S> {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(first(raw.page) ?? "1", 10) || 1));
  const sizeParam = Number.parseInt(first(raw.pageSize) ?? "", 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam)
    ? sizeParam
    : (config.defaultPageSize ?? 20);
  const sortParam = first(raw.sort);
  const sort =
    sortParam && (config.sortable as readonly string[]).includes(sortParam)
      ? (sortParam as S)
      : config.defaultSort;
  const dirParam = first(raw.dir);
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : (config.defaultDir ?? "desc");
  const q = (first(raw.q) ?? "").trim().slice(0, 100);

  const filters: Record<string, string> = {};
  for (const [key, allowed] of Object.entries(config.filters ?? {})) {
    const value = first(raw[key]);
    if (value && allowed.includes(value)) filters[key] = value;
  }
  return { page, pageSize, q, sort, dir, filters };
}

/** Builds a query string from current params with overrides; drops defaults/empties. */
export function tableHref(
  pathname: string,
  current: Record<string, string | number | undefined>,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value !== undefined && value !== "" && !(key === "page" && Number(value) === 1)) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
