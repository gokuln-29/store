import type { Metadata } from "next";

/** Absolute site URL (no trailing slash). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Canonical + hreflang alternates for a path that exists in every store language.
 * `path` is without the locale prefix, e.g. "/p/silk-saree" ("" for home).
 */
export function localeAlternates(
  path: string,
  locale: string,
  supportedLocales: string[],
  defaultLocale: string,
): Metadata["alternates"] {
  const languages: Record<string, string> = Object.fromEntries(
    supportedLocales.map((l) => [l, `/${l}${path}`]),
  );
  languages["x-default"] = `/${defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

/** Plain text from HTML for meta descriptions / JSON-LD (max length, whole words). */
export function toPlainText(html: string, max = 160): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
