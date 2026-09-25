import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resolveTaxRate, type PricingLine } from "./pricing";
import { getStoreSettings } from "./settings.service";

type Client = Prisma.TransactionClient | typeof db;

export const MAX_QTY_PER_LINE = 20;
export const MAX_CART_LINES = 50;

export type CartItemInput = { variantId: string; quantity: number };

/** A cart line as shown to the customer, built from the database (never from the browser). */
export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: Prisma.JsonValue;
  imageUrl: string | null;
  sku: string;
  /** [{ label, value }] of the variant's options, localized JSON */
  options: { label: Prisma.JsonValue; value: Prisma.JsonValue }[];
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  stock: number;
  weightGrams: number;
  taxRateBps: number;
  hsnCode: string | null;
  categoryPath: string[];
};

/** Why a requested item changed when the cart was checked against the database. */
export type CartAdjustment =
  | { variantId: string; kind: "unavailable" }
  | { variantId: string; kind: "quantity_reduced"; requested: number; available: number };

/** Merges duplicate lines and clamps quantities to sane limits. */
export function normalizeItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item.variantId || !Number.isInteger(item.quantity) || item.quantity <= 0) continue;
    merged.set(
      item.variantId,
      Math.min(MAX_QTY_PER_LINE, (merged.get(item.variantId) ?? 0) + item.quantity),
    );
  }
  return [...merged]
    .slice(0, MAX_CART_LINES)
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function categoryPaths(client: Client): Promise<Map<string, string[]>> {
  const rows = await client.category.findMany({ select: { id: true, parentId: true } });
  const parent = new Map(rows.map((r) => [r.id, r.parentId]));
  const paths = new Map<string, string[]>();
  for (const { id } of rows) {
    const path: string[] = [];
    for (let c: string | null | undefined = id; c && path.length < 50; c = parent.get(c))
      path.push(c);
    paths.set(id, path);
  }
  return paths;
}

/**
 * Loads current price, stock and details for the requested items. Unavailable items are
 * dropped and quantities above stock are reduced; each change is reported.
 */
export async function loadCartLines(
  items: CartItemInput[],
  client: Client = db,
): Promise<{ lines: CartLine[]; adjustments: CartAdjustment[] }> {
  const normalized = normalizeItems(items);
  if (normalized.length === 0) return { lines: [], adjustments: [] };

  const [variants, paths, settings] = await Promise.all([
    client.productVariant.findMany({
      where: { id: { in: normalized.map((i) => i.variantId) } },
      select: {
        id: true,
        sku: true,
        price: true,
        compareAtPrice: true,
        stock: true,
        weightGrams: true,
        isActive: true,
        optionValues: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            options: true,
            taxRateBps: true,
            hsnCode: true,
            categoryId: true,
            category: { select: { taxRateBps: true, hsnCode: true } },
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    }),
    categoryPaths(client),
    getStoreSettings(),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: CartLine[] = [];
  const adjustments: CartAdjustment[] = [];
  for (const item of normalized) {
    const v = byId.get(item.variantId);
    if (!v || !v.isActive || v.product.status !== "PUBLISHED" || v.stock <= 0) {
      adjustments.push({ variantId: item.variantId, kind: "unavailable" });
      continue;
    }
    const quantity = Math.min(item.quantity, v.stock);
    if (quantity < item.quantity) {
      adjustments.push({
        variantId: item.variantId,
        kind: "quantity_reduced",
        requested: item.quantity,
        available: v.stock,
      });
    }
    const options = (Array.isArray(v.product.options) ? v.product.options : []) as {
      key: string;
      label: Prisma.JsonValue;
      values: { value: string; label: Prisma.JsonValue }[];
    }[];
    const picked = (v.optionValues ?? {}) as Record<string, string>;
    lines.push({
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      imageUrl: v.images[0]?.url ?? v.product.images[0]?.url ?? null,
      sku: v.sku,
      options: options
        .filter((o) => picked[o.key] !== undefined)
        .map((o) => ({
          label: o.label,
          value: o.values.find((x) => x.value === picked[o.key])?.label ?? picked[o.key]!,
        })),
      unitPrice: v.price,
      compareAtPrice: v.compareAtPrice,
      quantity,
      stock: v.stock,
      weightGrams: v.weightGrams ?? 0,
      taxRateBps: resolveTaxRate(
        v.product.taxRateBps,
        v.product.category.taxRateBps,
        settings.defaultTaxRateBps,
      ),
      hsnCode: v.product.hsnCode ?? v.product.category.hsnCode,
      categoryPath: paths.get(v.product.categoryId) ?? [v.product.categoryId],
    });
  }
  return { lines, adjustments };
}

export function toPricingLines(lines: CartLine[]): PricingLine[] {
  return lines.map((l) => ({
    variantId: l.variantId,
    productId: l.productId,
    categoryPath: l.categoryPath,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    taxRateBps: l.taxRateBps,
    weightGrams: l.weightGrams,
  }));
}

// ───────────── Saved carts (logged-in customers) ─────────────

export async function getSavedCartItems(userId: string): Promise<CartItemInput[]> {
  const cart = await db.cart.findUnique({
    where: { userId },
    select: {
      items: { orderBy: { createdAt: "asc" }, select: { variantId: true, quantity: true } },
    },
  });
  return cart?.items ?? [];
}

/** Replaces the customer's saved cart with `items`. */
export async function saveCart(
  userId: string,
  items: CartItemInput[],
  client: Client = db,
): Promise<void> {
  const normalized = normalizeItems(items);
  const cart = await client.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  await client.cartItem.deleteMany({ where: { cartId: cart.id } });
  if (normalized.length) {
    // Only keep variants that still exist (the foreign key would reject others).
    const existing = await client.productVariant.findMany({
      where: { id: { in: normalized.map((i) => i.variantId) } },
      select: { id: true },
    });
    const ok = new Set(existing.map((e) => e.id));
    await client.cartItem.createMany({
      data: normalized
        .filter((i) => ok.has(i.variantId))
        .map((i) => ({ cartId: cart.id, variantId: i.variantId, quantity: i.quantity })),
    });
  }
  await client.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

/**
 * Saves the cart unless a newer change is already stored. `clientUpdatedAt` is when the browser
 * made the change, so a save replayed after being offline never overwrites a later one.
 */
export async function saveCartIfNewer(
  userId: string,
  items: CartItemInput[],
  clientUpdatedAt: Date,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
    const [row] = await tx.$queryRaw<{ clientUpdatedAt: Date | null }[]>`
      SELECT "clientUpdatedAt" FROM "Cart" WHERE "userId" = ${userId} FOR UPDATE`;
    if (row?.clientUpdatedAt && row.clientUpdatedAt > clientUpdatedAt) return false;
    await saveCart(userId, items, tx);
    await tx.cart.update({ where: { userId }, data: { clientUpdatedAt } });
    return true;
  });
}

/**
 * Merges a guest cart (from the browser) into the customer's saved cart on login:
 * quantities of the same item are added (capped), new items appended.
 */
export async function mergeGuestCart(
  userId: string,
  guestItems: CartItemInput[],
): Promise<CartItemInput[]> {
  const saved = await getSavedCartItems(userId);
  const merged = normalizeItems([...saved, ...guestItems]);
  await saveCart(userId, merged);
  return merged;
}

export async function clearCart(userId: string, client: Client = db): Promise<void> {
  await client.cartItem.deleteMany({ where: { cart: { userId } } });
}
