import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  deleteCategory,
  getCategory,
  listCategoryTree,
  saveCategory,
} from "@/lib/services/category.service";
import { listProducts, saveProduct, setProductsStatus } from "@/lib/services/product.service";
import {
  categoryFormSchema,
  productFormSchema,
  type CategoryFormInput,
  type ProductFormInput,
} from "@/lib/validators/catalog-forms";

let actorId: string;

beforeEach(async () => {
  actorId = (await db.user.create({ data: { email: "owner@test.dev", role: "OWNER" } })).id;
});

function categoryInput(overrides: Partial<CategoryFormInput> = {}): CategoryFormInput {
  return {
    name: { en: "Clothing", ta: "ஆடைகள்" },
    description: {},
    slug: "",
    parentId: "",
    imageUrl: "",
    sortOrder: "0",
    isActive: true,
    taxRateBps: "5",
    hsnCode: "",
    metaTitle: {},
    metaDescription: {},
    attributes: [
      {
        id: "",
        key: "",
        label: { en: "Material" },
        type: "SELECT",
        unit: "",
        isRequired: true,
        isFilterable: true,
        options: [
          { value: "cotton", label: { en: "Cotton" } },
          { value: "silk", label: { en: "Silk" } },
        ],
      },
      {
        id: "",
        key: "",
        label: { en: "Shelf life" },
        type: "NUMBER",
        unit: "days",
        isRequired: false,
        isFilterable: false,
        options: [],
      },
    ],
    ...overrides,
  };
}

async function createCategory(overrides: Partial<CategoryFormInput> = {}) {
  const result = await saveCategory(
    null,
    categoryFormSchema.parse(categoryInput(overrides)),
    actorId,
  );
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

function productInput(
  categoryId: string,
  overrides: Partial<ProductFormInput> = {},
): ProductFormInput {
  return {
    name: { en: "Cotton Tee", kn: "ಹತ್ತಿ ಟೀ" },
    shortDescription: {},
    description: { en: "<p>Soft <strong>cotton</strong></p><script>alert(1)</script>" },
    slug: "",
    categoryId,
    status: "PUBLISHED",
    brand: "",
    isFeatured: false,
    attributes: { material: "cotton", shelf_life_days: "" },
    options: [
      {
        key: "",
        label: { en: "Size" },
        values: [
          { value: "S", label: {} },
          { value: "M", label: {} },
        ],
      },
    ],
    variants: [
      {
        id: "",
        optionValues: { size: "S" },
        sku: "tee-s",
        price: "499",
        compareAtPrice: "799",
        costPrice: "",
        stock: "10",
        lowStockThreshold: "5",
        weightGrams: "200",
        isActive: true,
      },
      {
        id: "",
        optionValues: { size: "M" },
        sku: "TEE-M",
        price: "499.50",
        compareAtPrice: "",
        costPrice: "",
        stock: "0",
        lowStockThreshold: "5",
        weightGrams: "",
        isActive: true,
      },
    ],
    images: [
      {
        url: "/uploads/products/a.jpg",
        publicId: "",
        alt: { en: "Front" },
        width: null,
        height: null,
      },
    ],
    taxRateBps: "",
    hsnCode: "6109",
    metaTitle: {},
    metaDescription: {},
    ...overrides,
  };
}

async function createProduct(categoryId: string, overrides: Partial<ProductFormInput> = {}) {
  return saveProduct(null, productFormSchema.parse(productInput(categoryId, overrides)), actorId);
}

describe("category service", () => {
  it("creates a category with generated slug and attribute keys", async () => {
    const id = await createCategory();
    const category = await getCategory(id);
    expect(category?.slug).toBe("clothing");
    expect(category?.taxRateBps).toBe(500);
    expect(category?.attributes.map((a) => [a.key, a.type])).toEqual([
      ["material", "SELECT"],
      ["shelf_life", "NUMBER"],
    ]);
    // A second category with the same name gets a unique slug.
    const second = await getCategory(await createCategory());
    expect(second?.slug).toBe("clothing-2");
  });

  it("updates, reorders and removes attributes without changing keys", async () => {
    const id = await createCategory();
    const before = (await getCategory(id))!;
    const material = before.attributes.find((a) => a.key === "material")!;
    const input = categoryInput({
      attributes: [
        {
          id: material.id,
          key: "renamed",
          label: { en: "Fabric" },
          type: "SELECT",
          unit: "",
          isRequired: false,
          isFilterable: true,
          options: [{ value: "cotton", label: {} }],
        },
      ],
    });
    const result = await saveCategory(id, categoryFormSchema.parse(input), actorId);
    expect(result.ok).toBe(true);
    const after = (await getCategory(id))!;
    expect(after.attributes).toHaveLength(1);
    expect(after.attributes[0]).toMatchObject({
      id: material.id,
      key: "material",
      label: { en: "Fabric" },
      isRequired: false,
    });
  });

  it("prevents parent cycles", async () => {
    const parent = await createCategory({ name: { en: "Parent" } });
    const child = await createCategory({ name: { en: "Child" }, parentId: parent });
    const result = await saveCategory(
      parent,
      categoryFormSchema.parse(categoryInput({ name: { en: "Parent" }, parentId: child })),
      actorId,
    );
    expect(result).toMatchObject({ ok: false, error: "parent_invalid" });
    const tree = await listCategoryTree();
    expect(tree.map((c) => [c.slug, c.depth])).toEqual([
      ["parent", 0],
      ["child", 1],
    ]);
  });

  it("only deletes empty categories", async () => {
    const parent = await createCategory({ name: { en: "Parent" } });
    await createCategory({ name: { en: "Child" }, parentId: parent });
    expect(await deleteCategory(parent, actorId)).toEqual({ ok: false, error: "has_children" });
    const withProduct = await createCategory({ name: { en: "Food" } });
    await createProduct(withProduct);
    expect(await deleteCategory(withProduct, actorId)).toEqual({
      ok: false,
      error: "has_products",
    });
    const empty = await createCategory({ name: { en: "Empty" } });
    expect(await deleteCategory(empty, actorId)).toEqual({ ok: true });
  });
});

describe("product service", () => {
  it("creates a product with typed attributes, variants, images and clean HTML", async () => {
    const categoryId = await createCategory();
    const result = await createProduct(categoryId);
    expect(result).toMatchObject({ ok: true, slug: "cotton-tee" });
    if (!result.ok) return;

    const product = await db.product.findUniqueOrThrow({
      where: { id: result.id },
      include: { variants: { orderBy: { sortOrder: "asc" } }, images: true },
    });
    expect(product.attributes).toEqual({ material: "cotton" });
    expect(product.description).toEqual({ en: "<p>Soft <strong>cotton</strong></p>" });
    expect(product.publishedAt).not.toBeNull();
    expect(
      product.variants.map((v) => [v.sku, v.price, v.compareAtPrice, v.stock, v.isDefault]),
    ).toEqual([
      ["TEE-S", 49900, 79900, 10, true],
      ["TEE-M", 49950, null, 0, false],
    ]);
    expect(product.images).toHaveLength(1);
    expect(
      await db.auditLog.count({ where: { action: "product.create", entityId: result.id } }),
    ).toBe(1);
  });

  it("rejects invalid attributes for the category", async () => {
    const categoryId = await createCategory();
    const missing = await createProduct(categoryId, { attributes: { material: "" } });
    expect(missing).toMatchObject({
      ok: false,
      fieldErrors: { "attributes.material": "required" },
    });
    const wrong = await createProduct(categoryId, { attributes: { material: "wool" } });
    expect(wrong).toMatchObject({
      ok: false,
      fieldErrors: { "attributes.material": "attributeInvalid" },
    });
    const nan = await createProduct(categoryId, {
      attributes: { material: "silk", shelf_life: "ten" },
    });
    expect(nan).toMatchObject({
      ok: false,
      fieldErrors: { "attributes.shelf_life": "numberInvalid" },
    });
  });

  it("rejects SKUs used by another product", async () => {
    const categoryId = await createCategory();
    await createProduct(categoryId);
    const dup = await createProduct(categoryId, { name: { en: "Other tee" } });
    expect(dup).toMatchObject({
      ok: false,
      fieldErrors: { "variants.0.sku": "skuTaken", "variants.1.sku": "skuTaken" },
    });
  });

  it("updates variants in place and removes dropped ones", async () => {
    const categoryId = await createCategory();
    const created = await createProduct(categoryId);
    if (!created.ok) throw new Error();
    const variants = await db.productVariant.findMany({
      where: { productId: created.id },
      orderBy: { sortOrder: "asc" },
    });
    const small = variants[0]!;

    const input = productInput(categoryId, {
      options: [{ key: "size", label: { en: "Size" }, values: [{ value: "S", label: {} }] }],
      variants: [
        {
          id: small.id,
          optionValues: { size: "S" },
          sku: "TEE-S",
          price: "549",
          compareAtPrice: "",
          costPrice: "",
          stock: "3",
          lowStockThreshold: "5",
          weightGrams: "",
          isActive: true,
        },
      ],
    });
    const updated = await saveProduct(created.id, productFormSchema.parse(input), actorId);
    expect(updated.ok).toBe(true);
    const after = await db.productVariant.findMany({ where: { productId: created.id } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: small.id, price: 54900, stock: 3 });
  });

  it("lists with search across languages and SKU, hides archived, and bulk-updates status", async () => {
    const categoryId = await createCategory();
    const a = await createProduct(categoryId);
    await createProduct(categoryId, {
      name: { en: "Silk Saree" },
      options: [],
      variants: [
        {
          id: "",
          optionValues: {},
          sku: "SAREE-1",
          price: "9999",
          compareAtPrice: "",
          costPrice: "",
          stock: "2",
          lowStockThreshold: "5",
          weightGrams: "",
          isActive: true,
        },
      ],
    });
    const base = { page: 1, pageSize: 20, sort: "updatedAt" as const, dir: "desc" as const };
    expect((await listProducts({ ...base, q: "ಹತ್ತಿ" })).rows.map((r) => r.slug)).toEqual([
      "cotton-tee",
    ]);
    expect((await listProducts({ ...base, q: "saree-1" })).rows.map((r) => r.slug)).toEqual([
      "silk-saree",
    ]);

    const saree = (await listProducts({ ...base, q: "saree" })).rows[0]!;
    expect(saree).toMatchObject({ minPrice: 999900, totalStock: 2, lowStock: true });

    if (!a.ok) throw new Error();
    await setProductsStatus([a.id], "ARCHIVED", actorId);
    expect((await listProducts(base)).total).toBe(1);
    expect((await listProducts({ ...base, status: "ARCHIVED" })).total).toBe(1);
  });
});
