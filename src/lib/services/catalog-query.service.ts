import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { FilterableAttribute, ListingParams, SortKey } from "@/lib/utils/store-filters";

/** Read-only storefront queries. Only PUBLISHED products with at least one active variant are shown. */

// ───────────── Categories ─────────────

export type NavCategory = {
  id: string;
  slug: string;
  name: Prisma.JsonValue;
  parentId: string | null;
  imageUrl: string | null;
  children: NavCategory[];
};

/** Active categories as a tree (fetched once per request). */
export const getCategoryTree = cache(async (): Promise<NavCategory[]> => {
  const rows = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, name: true, parentId: true, imageUrl: true },
  });
  const byId = new Map<string, NavCategory>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: NavCategory[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
  }
  return roots;
});

function flatten(nodes: NavCategory[]): NavCategory[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** A category, its ancestors (for breadcrumbs) and all descendant ids (for listing). */
export async function getStoreCategory(slug: string) {
  const tree = await getCategoryTree();
  const all = flatten(tree);
  const node = all.find((c) => c.slug === slug);
  if (!node) return null;
  const byId = new Map(all.map((c) => [c.id, c]));
  const ancestors: NavCategory[] = [];
  for (
    let p = node.parentId ? byId.get(node.parentId) : undefined;
    p;
    p = p.parentId ? byId.get(p.parentId) : undefined
  ) {
    ancestors.unshift(p);
  }
  const details = await db.category.findUnique({
    where: { id: node.id },
    select: {
      description: true,
      metaTitle: true,
      metaDescription: true,
      attributes: {
        where: { isFilterable: true },
        orderBy: { sortOrder: "asc" },
        select: { key: true, label: true, type: true, options: true, unit: true },
      },
    },
  });
  return {
    ...node,
    ...details!,
    ancestors,
    descendantIds: flatten([node]).map((c) => c.id),
  };
}

// ───────────── Listing ─────────────

export type ProductCard = {
  id: string;
  slug: string;
  name: Prisma.JsonValue;
  image: { url: string; alt: Prisma.JsonValue } | null;
  price: number;
  maxPrice: number;
  compareAtPrice: number | null;
  inStock: boolean;
  variantCount: number;
};

type ListingScope = {
  categoryIds?: string[];
  q?: string;
  featured?: boolean;
  excludeIds?: string[];
};

const PUBLISHED = Prisma.sql`p.status = 'PUBLISHED'`;

/** WHERE clauses for the scope (category/search) — shared by listing and facets. */
function scopeWhere(scope: ListingScope): Prisma.Sql[] {
  const where: Prisma.Sql[] = [PUBLISHED, Prisma.sql`v.min_price IS NOT NULL`];
  if (scope.categoryIds?.length)
    where.push(Prisma.sql`p."categoryId" IN (${Prisma.join(scope.categoryIds)})`);
  if (scope.featured) where.push(Prisma.sql`p."isFeatured" = true`);
  if (scope.excludeIds?.length)
    where.push(Prisma.sql`p.id NOT IN (${Prisma.join(scope.excludeIds)})`);
  if (scope.q) {
    const q = scope.q.toLowerCase();
    // Substring match (uses the trigram index) or fuzzy word match for typos.
    where.push(
      Prisma.sql`(p."searchText" ILIKE ${`%${q}%`} OR word_similarity(${q}, p."searchText") > 0.5)`,
    );
  }
  return where;
}

function filterWhere(params: ListingParams, attributes: FilterableAttribute[]): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (params.minPrice != null) where.push(Prisma.sql`v.min_price >= ${params.minPrice}`);
  if (params.maxPrice != null) where.push(Prisma.sql`v.min_price <= ${params.maxPrice}`);
  if (params.inStock) where.push(Prisma.sql`v.stock > 0`);
  for (const [key, filter] of Object.entries(params.attributes)) {
    if (!attributes.some((a) => a.key === key)) continue;
    if (filter.kind === "values") {
      where.push(Prisma.sql`p.attributes->>${key} IN (${Prisma.join(filter.values)})`);
    } else {
      where.push(Prisma.sql`jsonb_typeof(p.attributes->${key}) = 'number'`);
      if (filter.min != null)
        where.push(Prisma.sql`(p.attributes->>${key})::numeric >= ${filter.min}`);
      if (filter.max != null)
        where.push(Prisma.sql`(p.attributes->>${key})::numeric <= ${filter.max}`);
    }
  }
  return where;
}

function orderBy(sort: SortKey, locale: string, q?: string): Prisma.Sql {
  switch (sort) {
    case "price_asc":
      return Prisma.sql`v.min_price ASC, p.id`;
    case "price_desc":
      return Prisma.sql`v.min_price DESC, p.id`;
    case "name":
      return Prisma.sql`lower(coalesce(nullif(p.name->>${locale}, ''), p.name->>'en')) ASC, p.id`;
    case "relevance":
      if (q)
        return Prisma.sql`word_similarity(${q.toLowerCase()}, p."searchText") DESC, v.stock > 0 DESC, p."publishedAt" DESC NULLS LAST`;
      return Prisma.sql`p."publishedAt" DESC NULLS LAST, p."createdAt" DESC`;
    case "newest":
    default:
      return Prisma.sql`p."publishedAt" DESC NULLS LAST, p."createdAt" DESC`;
  }
}

const VARIANT_AGG = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MIN(pv.price) AS min_price, SUM(pv.stock) AS stock
    FROM "ProductVariant" pv
    WHERE pv."productId" = p.id AND pv."isActive" = true
  ) v ON true`;

export async function listStoreProducts(input: {
  scope: ListingScope;
  params: ListingParams;
  attributes?: FilterableAttribute[];
  locale: string;
  pageSize: number;
  /** Return all pages up to params.page (used by "Load more"). */
  cumulative?: boolean;
}): Promise<{ cards: ProductCard[]; total: number }> {
  const where = [...scopeWhere(input.scope), ...filterWhere(input.params, input.attributes ?? [])];
  const limit = input.cumulative ? input.pageSize * input.params.page : input.pageSize;
  const offset = input.cumulative ? 0 : (input.params.page - 1) * input.pageSize;
  const rows = await db.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT p.id, count(*) OVER() AS total
    FROM "Product" p ${VARIANT_AGG}
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY ${orderBy(input.params.sort, input.locale, input.scope.q)}
    LIMIT ${limit} OFFSET ${offset}`;
  return {
    cards: await productCards(rows.map((r) => r.id)),
    total: Number(rows[0]?.total ?? 0),
  };
}

export type Facets = {
  price: { min: number; max: number } | null;
  attributes: Record<
    string,
    { values: { value: string; count: number }[] } | { min: number; max: number }
  >;
};

/** Filter options for the current scope (category/search), ignoring the active filters. */
export async function getFacets(
  scope: ListingScope,
  attributes: FilterableAttribute[],
): Promise<Facets> {
  const where = Prisma.join(scopeWhere(scope), " AND ");
  const base = Prisma.sql`FROM "Product" p ${VARIANT_AGG} WHERE ${where}`;
  const [price] = await db.$queryRaw<{ min: number | null; max: number | null }[]>`
    SELECT MIN(v.min_price)::int AS min, MAX(v.min_price)::int AS max ${base}`;

  const result: Facets = {
    price: price?.min != null && price.max != null ? { min: price.min, max: price.max } : null,
    attributes: {},
  };
  await Promise.all(
    attributes.map(async (attr) => {
      if (attr.type === "NUMBER") {
        const [range] = await db.$queryRaw<{ min: number | null; max: number | null }[]>`
          SELECT MIN((p.attributes->>${attr.key})::numeric)::float AS min, MAX((p.attributes->>${attr.key})::numeric)::float AS max
          ${base} AND jsonb_typeof(p.attributes->${attr.key}) = 'number'`;
        if (range?.min != null && range.max != null)
          result.attributes[attr.key] = { min: range.min, max: range.max };
      } else {
        const values = await db.$queryRaw<{ value: string; count: bigint }[]>`
          SELECT p.attributes->>${attr.key} AS value, count(*) AS count
          ${base} AND p.attributes ? ${attr.key}
          GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 50`;
        if (values.length) {
          result.attributes[attr.key] = {
            values: values.map((v) => ({ value: v.value, count: Number(v.count) })),
          };
        }
      }
    }),
  );
  return result;
}

/** Loads display data for product cards, preserving the order of `ids`. */
export async function productCards(ids: string[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
      variants: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { price: true, compareAtPrice: true, stock: true },
      },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    const cheapest = p?.variants[0];
    if (!p || !cheapest) return [];
    return [
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        image: p.images[0] ?? null,
        price: cheapest.price,
        maxPrice: p.variants.at(-1)!.price,
        compareAtPrice:
          cheapest.compareAtPrice && cheapest.compareAtPrice > cheapest.price
            ? cheapest.compareAtPrice
            : null,
        inStock: p.variants.some((v) => v.stock > 0),
        variantCount: p.variants.length,
      },
    ];
  });
}

// ───────────── Product page ─────────────

export async function getStoreProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          attributes: {
            orderBy: { sortOrder: "asc" },
            select: { key: true, label: true, type: true, options: true, unit: true },
          },
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sku: true,
          optionValues: true,
          price: true,
          compareAtPrice: true,
          stock: true,
          weightGrams: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, width: true, height: true },
      },
    },
  });
  if (!product || product.variants.length === 0) return null;
  return product;
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 8,
): Promise<ProductCard[]> {
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      categoryId,
      NOT: { id: productId },
      variants: { some: { isActive: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: limit,
    select: { id: true },
  });
  return productCards(rows.map((r) => r.id));
}

/**
 * "Frequently bought together": other published products that appeared in the same orders
 * (unpaid and cancelled orders excluded), most common first.
 */
export async function getBoughtTogether(productId: string, limit = 8): Promise<ProductCard[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT other."productId" AS id
    FROM "OrderItem" mine
    JOIN "OrderItem" other ON other."orderId" = mine."orderId" AND other."productId" <> mine."productId"
    JOIN "Order" o ON o.id = mine."orderId"
    JOIN "Product" p ON p.id = other."productId"
    WHERE mine."productId" = ${productId}
      AND o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED')
      AND p.status = 'PUBLISHED'
    GROUP BY other."productId"
    ORDER BY COUNT(DISTINCT o.id) DESC, MAX(o."createdAt") DESC
    LIMIT ${limit}`;
  return productCards(rows.map((r) => r.id));
}

/** Slugs for the sitemap. */
export function listPublishedSlugs() {
  return Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED", variants: { some: { isActive: true } } },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
}
