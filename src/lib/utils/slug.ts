/**
 * URL slug from text: "Classic Cotton T-Shirt" -> "classic-cotton-t-shirt".
 * Non-Latin text (Tamil/Kannada) is dropped, so slugs come from the English name;
 * `fallback` is used when nothing Latin remains.
 */
export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** "size" style key for JSON (option/attribute keys): lowercase snake_case. */
export function toKey(text: string, fallback = "option"): string {
  const key = slugify(text, fallback).replace(/-/g, "_").slice(0, 40);
  return /^[a-z]/.test(key) ? key : `${fallback}_${key}`.slice(0, 40);
}

/** Finds a free slug by appending -2, -3, … using the `exists` check. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 75)}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base.slice(0, 70)}-${Date.now().toString(36)}`;
}
