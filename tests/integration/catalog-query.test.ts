import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  getFacets,
  getStoreCategory,
  getStoreProduct,
  listStoreProducts,
} from "@/lib/services/catalog-query.service";
import { buildSearchText } from "@/lib/utils/search-text";
import { parseListingParams, type FilterableAttribute } from "@/lib/utils/store-filters";

let clothing: string;
let sarees: string;

async function product(
  slug: string,
  opts: {
    name: Record<string, string>;
    categoryId: string;
    status?: "PUBLISHED" | "DRAFT";
    attributes?: Record<string, string | number>;
    variants: [string, number, number][]; // sku, price, stock
    publishedAt?: Date;
    featured?: boolean;
  },
) {
  return db.product.create({
    data: {
      slug,
      name: opts.name,
      categoryId: opts.categoryId,
      status: opts.status ?? "PUBLISHED",
      isFeatured: opts.featured ?? false,
      attributes: opts.attributes ?? {},
      publishedAt: opts.publishedAt ?? new Date(),
      searchText: buildSearchText({ name: opts.name, slug, skus: opts.variants.map((v) => v[0]) }),
      variants: { create: opts.variants.map(([sku, price, stock]) => ({ sku, price, stock })) },
    },
  });
}

beforeEach(async () => {
  clothing = (await db.category.create({ data: { slug: "clothing", name: { en: "Clothing" } } }))
    .id;
  sarees = (
    await db.category.create({
      data: { slug: "sarees", name: { en: "Sarees" }, parentId: clothing },
    })
  ).id;
  await db.attributeDefinition.createMany({
    data: [
      {
        categoryId: clothing,
        key: "material",
        label: { en: "Material" },
        type: "SELECT",
        isFilterable: true,
        options: [
          { value: "cotton", label: { en: "Cotton" } },
          { value: "silk", label: { en: "Silk" } },
        ],
      },
      {
        categoryId: clothing,
        key: "weight",
        label: { en: "Weight" },
        type: "NUMBER",
        isFilterable: true,
      },
    ],
  });
  const day = 86_400_000;
  await product("cotton-tee", {
    name: { en: "Cotton Tee", ta: "பருத்தி டீ" },
    categoryId: clothing,
    attributes: { material: "cotton", weight: 200 },
    variants: [
      ["TEE-S", 49900, 5],
      ["TEE-M", 54900, 0],
    ],
    publishedAt: new Date(Date.now() - 3 * day),
  });
  await product("silk-saree", {
    name: { en: "Silk Saree", kn: "ರೇಷ್ಮೆ ಸೀರೆ" },
    categoryId: sarees,
    attributes: { material: "silk", weight: 800 },
    variants: [["SAREE-1", 1249900, 2]],
    publishedAt: new Date(Date.now() - day),
    featured: true,
  });
  await product("linen-kurta", {
    name: { en: "Linen Kurta" },
    categoryId: clothing,
    attributes: { weight: 300 },
    variants: [["KURTA-1", 129900, 0]],
    publishedAt: new Date(Date.now() - 2 * day),
  });
  await product("draft-shirt", {
    name: { en: "Draft Shirt" },
    categoryId: clothing,
    status: "DRAFT",
    variants: [["DRAFT-1", 100, 1]],
  });
  const noActive = await product("hidden-variants", {
    name: { en: "Hidden" },
    categoryId: clothing,
    variants: [["HID-1", 100, 1]],
  });
  await db.productVariant.updateMany({
    where: { productId: noActive.id },
    data: { isActive: false },
  });
});

const attrs = async () => {
  const category = (await getStoreCategory("clothing"))!;
  return { category, filterable: category.attributes as unknown as FilterableAttribute[] };
};

async function list(
  query: Record<string, string>,
  scope: { q?: string; categoryIds?: string[] } = {},
) {
  const { category, filterable } = await attrs();
  const params = parseListingParams(query, filterable, { allowRelevance: true });
  const result = await listStoreProducts({
    scope: {
      categoryIds: scope.q ? undefined : (scope.categoryIds ?? category.descendantIds),
      q: scope.q,
    },
    params,
    attributes: filterable,
    locale: "en",
    pageSize: 24,
  });
  return { slugs: result.cards.map((c) => c.slug), total: result.total, cards: result.cards };
}

describe("storefront catalog queries", () => {
  it("lists published products with active variants, including sub-categories, newest first", async () => {
    const { slugs, total } = await list({});
    expect(slugs).toEqual(["silk-saree", "linen-kurta", "cotton-tee"]);
    expect(total).toBe(3);
  });

  it("builds cards from the cheapest active variant", async () => {
    const { cards } = await list({ sort: "price_asc" });
    expect(cards[0]).toMatchObject({
      slug: "cotton-tee",
      price: 49900,
      maxPrice: 54900,
      inStock: true,
      variantCount: 2,
    });
    expect(cards.find((c) => c.slug === "linen-kurta")?.inStock).toBe(false);
  });

  it("filters by price, stock and attributes", async () => {
    expect((await list({ max: "1000" })).slugs).toEqual(["cotton-tee"]);
    expect((await list({ stock: "1", sort: "price_asc" })).slugs).toEqual([
      "cotton-tee",
      "silk-saree",
    ]);
    expect((await list({ "f.material": "silk,cotton", sort: "price_asc" })).slugs).toEqual([
      "cotton-tee",
      "silk-saree",
    ]);
    expect((await list({ "f.weight": "250-900", sort: "price_asc" })).slugs).toEqual([
      "linen-kurta",
      "silk-saree",
    ]);
  });

  it("sorts by price and name", async () => {
    expect((await list({ sort: "price_desc" })).slugs).toEqual([
      "silk-saree",
      "linen-kurta",
      "cotton-tee",
    ]);
    expect((await list({ sort: "name" })).slugs).toEqual([
      "cotton-tee",
      "linen-kurta",
      "silk-saree",
    ]);
  });

  it("searches names in every language, SKUs and tolerates typos", async () => {
    expect((await list({ sort: "relevance" }, { q: "ரேஷ்மே" })).slugs).toEqual([]);
    expect((await list({ sort: "relevance" }, { q: "ರೇಷ್ಮೆ" })).slugs).toEqual(["silk-saree"]);
    expect((await list({ sort: "relevance" }, { q: "பருத்தி" })).slugs).toEqual(["cotton-tee"]);
    expect((await list({ sort: "relevance" }, { q: "kurta-1" })).slugs).toEqual(["linen-kurta"]);
    expect((await list({ sort: "relevance" }, { q: "sillk sare" })).slugs).toContain("silk-saree");
    expect((await list({ sort: "relevance" }, { q: "draft" })).slugs).toEqual([]);
    // Short Tamil words share many trigrams; only the real match should come back.
    expect((await list({ sort: "relevance" }, { q: "டீ" })).slugs).toEqual(["cotton-tee"]);
  });

  it("returns facets for the whole category regardless of active filters", async () => {
    const { category, filterable } = await attrs();
    const facets = await getFacets({ categoryIds: category.descendantIds }, filterable);
    expect(facets.price).toEqual({ min: 49900, max: 1249900 });
    expect(facets.attributes.material).toEqual({
      values: [
        { value: "cotton", count: 1 },
        { value: "silk", count: 1 },
      ],
    });
    expect(facets.attributes.weight).toEqual({ min: 200, max: 800 });
  });

  it("loads category breadcrumbs and published products only", async () => {
    const category = await getStoreCategory("sarees");
    expect(category?.ancestors.map((a) => a.slug)).toEqual(["clothing"]);
    expect(await getStoreProduct("silk-saree")).not.toBeNull();
    expect(await getStoreProduct("draft-shirt")).toBeNull();
    expect(await getStoreProduct("hidden-variants")).toBeNull();
  });
});
