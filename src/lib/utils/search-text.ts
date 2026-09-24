/** Lowercased text searched with pg_trgm: names in every language, brand, slug and SKUs. */
export function buildSearchText(input: {
  name: Record<string, string | undefined> | null | undefined;
  brand?: string | null;
  slug: string;
  skus: string[];
}): string {
  return [...Object.values(input.name ?? {}), input.brand, input.slug, ...input.skus]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .slice(0, 4000);
}
