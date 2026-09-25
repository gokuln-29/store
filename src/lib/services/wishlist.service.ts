import { db } from "@/lib/db";
import { productCards, type ProductCard } from "./catalog-query.service";

export const MAX_WISHLIST = 100;

/** Only products customers can actually see and buy. */
async function publishedIds(ids: string[]): Promise<Set<string>> {
  const rows = await db.product.findMany({
    where: { id: { in: ids.slice(0, MAX_WISHLIST) }, status: "PUBLISHED" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export async function getWishlistIds(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId, product: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    take: MAX_WISHLIST,
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

/** Adds a guest's saved products to the account; returns the merged list (newest first). */
export async function mergeWishlist(userId: string, guestIds: string[]): Promise<string[]> {
  const valid = await publishedIds(guestIds);
  const toAdd = guestIds.filter((id) => valid.has(id));
  if (toAdd.length) {
    await db.wishlistItem.createMany({
      data: toAdd.map((productId) => ({ userId, productId })),
      skipDuplicates: true,
    });
  }
  return getWishlistIds(userId);
}

export async function setWishlisted(userId: string, productId: string, saved: boolean) {
  if (!saved) {
    await db.wishlistItem.deleteMany({ where: { userId, productId } });
    return;
  }
  if (!(await publishedIds([productId])).has(productId)) return;
  const count = await db.wishlistItem.count({ where: { userId } });
  if (count >= MAX_WISHLIST) return;
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
}

/** Card data for saved products that are still published, in the given order. */
export async function publishedCards(ids: string[]): Promise<ProductCard[]> {
  const valid = await publishedIds(ids);
  return productCards(ids.filter((id) => valid.has(id)));
}
