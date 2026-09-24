import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveCategory } from "@/lib/services/category.service";
import { exportProductsCsv, importProductsCsv } from "@/lib/services/product-import.service";
import { categoryFormSchema } from "@/lib/validators/catalog-forms";

let actorId: string;

beforeEach(async () => {
  actorId = (await db.user.create({ data: { email: "owner@test.dev", role: "OWNER" } })).id;
  const result = await saveCategory(
    null,
    categoryFormSchema.parse({
      name: { en: "Clothing" },
      description: {},
      slug: "clothing",
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
          key: "material",
          label: { en: "Material" },
          type: "SELECT",
          unit: "",
          isRequired: true,
          isFilterable: true,
          options: [
            { value: "cotton", label: {} },
            { value: "silk", label: {} },
          ],
        },
      ],
    }),
    actorId,
  );
  if (!result.ok) throw new Error(result.error);
});

const HEADER =
  "handle,name_en,name_ta,category,status,option1_name,option1_value,sku,price,mrp,stock,attr:material";

/** 25 products × 2 sizes = 50 rows. */
function fiftyRows() {
  const lines = [HEADER];
  for (let i = 1; i <= 25; i++) {
    lines.push(
      `shirt-${i},Shirt ${i},சட்டை ${i},clothing,published,Size,M,SHIRT-${i}-M,${400 + i},999,${i},cotton`,
    );
    lines.push(`shirt-${i},,,,,,L,SHIRT-${i}-L,${450 + i},,${i + 1},`);
  }
  return lines.join("\n");
}

describe("product CSV import", () => {
  it("dry run validates 50 rows without writing anything", async () => {
    const report = await importProductsCsv(fiftyRows(), { dryRun: true, actorId });
    expect(report).toMatchObject({
      totalRows: 50,
      fileErrors: [],
      summary: { created: 25, updated: 0, failed: 0 },
    });
    expect(await db.product.count()).toBe(0);
    expect(await db.productVariant.count()).toBe(0);
  });

  it("imports 50 rows into 25 products with 2 variants each", async () => {
    const report = await importProductsCsv(fiftyRows(), { dryRun: false, actorId });
    expect(report.summary).toEqual({ created: 25, updated: 0, failed: 0 });
    expect(await db.product.count()).toBe(25);
    expect(await db.productVariant.count()).toBe(50);
    const shirt = await db.product.findUniqueOrThrow({
      where: { slug: "shirt-7" },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    });
    expect(shirt.name).toEqual({ en: "Shirt 7", ta: "சட்டை 7" });
    expect(shirt.variants.map((v) => [v.sku, v.price, v.stock])).toEqual([
      ["SHIRT-7-M", 40700, 7],
      ["SHIRT-7-L", 45700, 8],
    ]);
    expect(await db.auditLog.count({ where: { action: "product.import" } })).toBe(1);
  });

  it("re-importing an export updates in place without changes", async () => {
    await importProductsCsv(fiftyRows(), { dryRun: false, actorId });
    const before = await db.productVariant.findMany({
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, price: true, stock: true },
    });
    const csv = await exportProductsCsv();
    const report = await importProductsCsv(csv, { dryRun: false, actorId });
    expect(report.summary).toEqual({ created: 0, updated: 25, failed: 0 });
    const after = await db.productVariant.findMany({
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, price: true, stock: true },
    });
    expect(after).toEqual(before);
  });

  it("reports row-level errors and still imports the valid products", async () => {
    const csv = [
      HEADER,
      "good,Good,,clothing,draft,,,GOOD-1,100,,1,cotton",
      "bad-mrp,Bad,,clothing,draft,,,BAD-1,500,100,1,cotton",
      "bad-attr,Bad attr,,clothing,draft,,,BAD-2,100,,1,wool",
      "dup,Dup,,clothing,draft,,,GOOD-1,100,,1,cotton",
      "nocat,No category,,shoes,draft,,,NC-1,100,,1,",
    ].join("\n");
    const report = await importProductsCsv(csv, { dryRun: false, actorId });
    expect(report.summary).toEqual({ created: 1, updated: 0, failed: 4 });
    const errors = Object.fromEntries(
      report.products.map((p) => [p.handle, p.errors.map((e) => [e.row, e.column, e.message])]),
    );
    expect(errors.good).toEqual([]);
    expect(errors["bad-mrp"]).toEqual([[3, "mrp", "mrpBelowPrice"]]);
    expect(errors["bad-attr"]).toEqual([[4, "attr:material", "attributeInvalid"]]);
    expect(errors.dup).toEqual([[5, "sku", "skuTaken"]]);
    expect(errors.nocat).toEqual([[6, "category", "csvUnknownCategory"]]);
    expect(await db.product.count()).toBe(1);
  });

  it("rejects files without the required columns", async () => {
    const report = await importProductsCsv("handle,name_en\nx,X", { dryRun: true, actorId });
    expect(report.fileErrors.map((e) => e.message)).toEqual([
      "csvMissingColumn",
      "csvMissingColumn",
      "csvMissingColumn",
    ]);
    expect(report.products).toEqual([]);
  });
});
