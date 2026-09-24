import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/services/catalog-query.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { siteUrl } from "@/lib/seo";

// Regenerated at most hourly; catalog changes also revalidate "/".
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [settings, [products, categories]] = await Promise.all([
    getStoreSettings(),
    listPublishedSlugs(),
  ]);
  const locales = settings.supportedLocales;

  const entries = (path: string, lastModified?: Date, priority?: number): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      priority,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
    }));

  return [
    ...entries("", undefined, 1),
    ...entries("/shop", undefined, 0.8),
    ...categories.flatMap((c) => entries(`/c/${c.slug}`, c.updatedAt, 0.7)),
    ...products.flatMap((p) => entries(`/p/${p.slug}`, p.updatedAt, 0.6)),
  ];
}
