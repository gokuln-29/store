import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { countLowStock, listInventory, setVariantStock } from "@/lib/services/inventory.service";

let actorId: string;

beforeEach(async () => {
  actorId = (await db.user.create({ data: { email: "owner@test.dev", role: "OWNER" } })).id;
  const category = await db.category.create({ data: { slug: "food", name: { en: "Food" } } });
  const make = (
    slug: string,
    status: "PUBLISHED" | "ARCHIVED",
    variants: [string, number, number][],
  ) =>
    db.product.create({
      data: {
        slug,
        name: { en: slug, ta: `${slug}-ta` },
        categoryId: category.id,
        status,
        variants: {
          create: variants.map(([sku, stock, threshold]) => ({
            sku,
            stock,
            lowStockThreshold: threshold,
            price: 100,
          })),
        },
      },
    });
  await make("coffee", "PUBLISHED", [
    ["COFFEE-250", 50, 5],
    ["COFFEE-500", 4, 5],
    ["COFFEE-1K", 0, 5],
  ]);
  await make("tea", "PUBLISHED", [["TEA-1", 10, 10]]);
  await make("old", "ARCHIVED", [["OLD-1", 0, 5]]);
});

const base = { page: 1, pageSize: 20, sort: "stock" as const, dir: "asc" as const };

describe("inventory service", () => {
  it("filters low and out-of-stock variants against each variant's own threshold", async () => {
    const low = await listInventory({ ...base, filter: "low" });
    expect(low.rows.map((r) => r.sku)).toEqual(["COFFEE-1K", "COFFEE-500", "TEA-1"]);
    const out = await listInventory({ ...base, filter: "out" });
    expect(out.rows.map((r) => r.sku)).toEqual(["COFFEE-1K"]);
    expect(await countLowStock()).toBe(3);
  });

  it("searches by SKU and product name in any language, excluding archived products", async () => {
    expect((await listInventory({ ...base, q: "tea-ta" })).rows.map((r) => r.sku)).toEqual([
      "TEA-1",
    ]);
    expect((await listInventory({ ...base, q: "coffee-5" })).rows.map((r) => r.sku)).toEqual([
      "COFFEE-500",
    ]);
    expect((await listInventory({ ...base, q: "OLD" })).total).toBe(0);
  });

  it("sets stock and audits the change", async () => {
    const variant = await db.productVariant.findUniqueOrThrow({ where: { sku: "COFFEE-500" } });
    expect(await setVariantStock(variant.id, 40, actorId)).toEqual({ ok: true, stock: 40 });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      40,
    );
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "inventory.set_stock" } });
    expect(log.changes).toEqual({ sku: "COFFEE-500", stock: { from: 4, to: 40 } });
    expect(await setVariantStock("missing", 1, actorId)).toEqual({ ok: false, error: "not_found" });
  });
});
