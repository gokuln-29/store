/** Variant helpers shared by the product form (client) and product service (server). */

export type OptionValues = Record<string, string>;

/** Every combination of option values: [{size:"S",color:"red"}, …]. No options -> [{}]. */
export function combinations(
  options: { key: string; values: { value: string }[] }[],
): OptionValues[] {
  let combos: OptionValues[] = [{}];
  for (const option of options) {
    if (!option.values.length) continue;
    combos = combos.flatMap((combo) =>
      option.values.map((v) => ({ ...combo, [option.key]: v.value })),
    );
  }
  return combos;
}

/** Stable identity of a combination regardless of key order. */
export function comboKey(values: OptionValues): string {
  return Object.keys(values)
    .sort()
    .map((k) => `${k}=${values[k]}`)
    .join("|");
}

/** Suggested SKU: "TEE" + ["M","black"] -> "TEE-M-BLACK". */
export function suggestSku(prefix: string, values: OptionValues): string {
  return [prefix, ...Object.values(values)]
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** SKU prefix from a slug: "classic-cotton-t-shirt" -> "CLASSIC-COTTON-T-SHIRT" (max 24 chars). */
export function skuPrefixFromSlug(slug: string): string {
  return (
    slug
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .slice(0, 24)
      .replace(/-$/, "") || "SKU"
  );
}

/**
 * Rebuilds the variant list for new options: keeps existing rows whose combination still
 * exists (with their price/stock), adds rows for new combinations using `makeNew`.
 */
export function syncVariants<V extends { optionValues: OptionValues }>(
  options: { key: string; values: { value: string }[] }[],
  existing: V[],
  makeNew: (values: OptionValues) => V,
): V[] {
  const byKey = new Map(existing.map((v) => [comboKey(v.optionValues), v]));
  return combinations(options).map((values) => byKey.get(comboKey(values)) ?? makeNew(values));
}
