import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { storedSectionConfig, type SectionType } from "@/lib/validators/content";
import {
  getCategoryTree,
  listStoreProducts,
  type NavCategory,
  type ProductCard,
} from "./catalog-query.service";

type Json = Prisma.JsonValue;

export type HomeBlock =
  | {
      id: string;
      type: "HERO_BANNER";
      title: Json;
      banners: {
        id: string;
        title: Json;
        subtitle: Json;
        ctaLabel: Json;
        imageUrl: string;
        mobileImageUrl: string | null;
        linkUrl: string | null;
      }[];
    }
  | {
      id: string;
      type: "FEATURED_CATEGORIES";
      title: Json;
      categories: Pick<NavCategory, "id" | "slug" | "name" | "imageUrl">[];
    }
  | {
      id: string;
      type: "PRODUCT_CAROUSEL";
      title: Json;
      products: ProductCard[];
      viewAllHref: string | null;
    }
  | {
      id: string;
      type: "OFFER_STRIP";
      title: Json;
      message: Record<string, string>;
      linkUrl: string | null;
    }
  | {
      id: string;
      type: "TESTIMONIALS";
      title: Json;
      items: {
        quote: Record<string, string>;
        author: string;
        location: string | null;
        rating: number;
      }[];
    }
  | { id: string; type: "RICH_TEXT"; title: Json; html: Record<string, string> | null };

const DEFAULT_PARAMS = {
  sort: "newest" as const,
  page: 1,
  minPrice: null,
  maxPrice: null,
  inStock: false,
  attributes: {},
};

/** Active home sections in order, with their data resolved. Invalid configs are skipped. */
export async function getHomeBlocks(locale: string): Promise<HomeBlock[]> {
  const sections = await db.homeSection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const now = new Date();

  const blocks = await Promise.all(
    sections.map(async (section): Promise<HomeBlock | null> => {
      const type = section.type as SectionType;
      const parsed = storedSectionConfig[type].safeParse(section.config);
      if (!parsed.success) {
        console.warn(`[home] skipping section ${section.id}: invalid config`);
        return null;
      }
      const base = { id: section.id, title: section.title };

      switch (type) {
        case "HERO_BANNER": {
          const { bannerIds } = parsed.data as { bannerIds: string[] };
          const banners = await db.banner.findMany({
            where: {
              id: { in: bannerIds },
              isActive: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
              ],
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          });
          return banners.length ? { ...base, type, banners } : null;
        }
        case "FEATURED_CATEGORIES": {
          const { categoryIds } = parsed.data as { categoryIds: string[] };
          const all = flatten(await getCategoryTree());
          const categories = categoryIds.flatMap((id) => all.filter((c) => c.id === id));
          return categories.length ? { ...base, type, categories } : null;
        }
        case "PRODUCT_CAROUSEL": {
          const config = parsed.data as {
            source: "featured" | "newest" | "category";
            categoryId: string | null;
            limit: number;
          };
          let categoryIds: string[] | undefined;
          let viewAllHref: string | null = "/shop";
          if (config.source === "category" && config.categoryId) {
            const node = flatten(await getCategoryTree()).find((c) => c.id === config.categoryId);
            if (!node) return null;
            categoryIds = flatten([node]).map((c) => c.id);
            viewAllHref = `/c/${node.slug}`;
          }
          const { cards } = await listStoreProducts({
            scope: { categoryIds, featured: config.source === "featured" },
            params: DEFAULT_PARAMS,
            locale,
            pageSize: config.limit,
          });
          return cards.length ? { ...base, type, products: cards, viewAllHref } : null;
        }
        case "OFFER_STRIP": {
          const config = parsed.data as { message: Record<string, string>; linkUrl: string | null };
          return { ...base, type, message: config.message, linkUrl: config.linkUrl };
        }
        case "TESTIMONIALS": {
          const config = parsed.data as {
            items: {
              quote: Record<string, string>;
              author: string;
              location: string | null;
              rating: number;
            }[];
          };
          return config.items.length ? { ...base, type, items: config.items } : null;
        }
        case "RICH_TEXT": {
          const config = parsed.data as { html: Record<string, string> | null };
          return { ...base, type, html: config.html };
        }
      }
    }),
  );
  return blocks.filter((b): b is HomeBlock => b !== null);
}

function flatten(nodes: NavCategory[]): NavCategory[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
