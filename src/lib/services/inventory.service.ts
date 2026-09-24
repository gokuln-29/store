import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "./audit.service";

export type InventoryFilter = "low" | "out";

export type InventoryQuery = {
  page: number;
  pageSize: number;
  q?: string;
  filter?: InventoryFilter;
  sort: "stock" | "sku" | "updatedAt";
  dir: "asc" | "desc";
};

/** Variant-level stock list. Archived products are left out. */
export async function listInventory({ page, pageSize, q, filter, sort, dir }: InventoryQuery) {
  let nameMatches: string[] = [];
  if (q) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE name::text ILIKE ${`%${q}%`} LIMIT 500`;
    nameMatches = rows.map((r) => r.id);
  }
  const where: Prisma.ProductVariantWhereInput = {
    isActive: true,
    product: { status: { not: "ARCHIVED" } },
    ...(filter === "out" ? { stock: 0 } : {}),
    // Compare two columns: stock <= this variant's own low-stock threshold.
    ...(filter === "low" ? { stock: { lte: db.productVariant.fields.lowStockThreshold } } : {}),
    ...(q
      ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { productId: { in: nameMatches } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: [{ [sort]: dir }, { sku: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        stock: true,
        lowStockThreshold: true,
        optionValues: true,
        product: { select: { id: true, name: true, options: true } },
      },
    }),
    db.productVariant.count({ where }),
  ]);
  return { rows, total };
}

export async function countLowStock(): Promise<number> {
  return db.productVariant.count({
    where: {
      isActive: true,
      product: { status: { not: "ARCHIVED" } },
      stock: { lte: db.productVariant.fields.lowStockThreshold },
    },
  });
}

export type SetStockResult = { ok: true; stock: number } | { ok: false; error: "not_found" };

/** Sets a variant's stock to an absolute value and records the change. */
export async function setVariantStock(
  id: string,
  stock: number,
  actorId: string,
): Promise<SetStockResult> {
  return db.$transaction(async (tx): Promise<SetStockResult> => {
    const variant = await tx.productVariant.findUnique({
      where: { id },
      select: { stock: true, sku: true, productId: true },
    });
    if (!variant) return { ok: false, error: "not_found" };
    if (variant.stock === stock) return { ok: true, stock };
    await tx.productVariant.update({ where: { id }, data: { stock } });
    await audit(
      {
        actorId,
        action: "inventory.set_stock",
        entityType: "ProductVariant",
        entityId: id,
        changes: { sku: variant.sku, stock: { from: variant.stock, to: stock } },
      },
      tx,
    );
    return { ok: true, stock };
  });
}
