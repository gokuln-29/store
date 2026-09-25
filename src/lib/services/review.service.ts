import sharp from "sharp";
import type { Prisma, ReviewStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getStorageProvider, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/providers/storage";
import { audit } from "./audit.service";
import { getFeatures } from "./settings.service";

type Tx = Prisma.TransactionClient;

/**
 * Reviews: only customers who received the product (a delivered order) can review it, once.
 * New reviews wait for moderation; approved ones count towards the product's rating, which is
 * stored on the product (ratingCount / ratingTotal) and kept in step inside each change.
 */

/** The purchase that makes a review verified: the latest delivered order item. */
export function eligibleOrderItem(userId: string, productId: string) {
  return db.orderItem.findFirst({
    where: { productId, order: { userId, status: "DELIVERED" } },
    orderBy: { order: { deliveredAt: "desc" } },
    select: { id: true },
  });
}

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: "feature_disabled" | "not_eligible" | "already_reviewed" };

export async function submitReview(input: {
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string | null;
  imageUrls: string[];
}): Promise<SubmitResult> {
  const features = await getFeatures();
  if (!features.reviews) return { ok: false, error: "feature_disabled" };
  const item = await eligibleOrderItem(input.userId, input.productId);
  if (!item) return { ok: false, error: "not_eligible" };
  const existing = await db.review.findUnique({
    where: { productId_userId: { productId: input.productId, userId: input.userId } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "already_reviewed" };
  const review = await db.review.create({
    data: {
      productId: input.productId,
      userId: input.userId,
      orderItemId: item.id,
      rating: input.rating,
      title: input.title,
      body: input.body,
      imageUrls: features.reviewPhotos ? input.imageUrls : [],
    },
    select: { id: true },
  });
  return { ok: true, id: review.id };
}

async function adjustTotals(tx: Tx, productId: string, rating: number, direction: 1 | -1) {
  await tx.product.update({
    where: { id: productId },
    data: { ratingCount: { increment: direction }, ratingTotal: { increment: direction * rating } },
  });
}

/** Approve or reject; product rating totals follow the change exactly once. */
export async function moderateReview(
  id: string,
  status: Extract<ReviewStatus, "APPROVED" | "REJECTED">,
  actorId: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: ReviewStatus; productId: string; rating: number }[]>`
      SELECT status, "productId", rating FROM "Review" WHERE id = ${id} FOR UPDATE`;
    if (!row) return false;
    if (row.status === status) return true;
    await tx.review.update({ where: { id }, data: { status } });
    if (status === "APPROVED") await adjustTotals(tx, row.productId, row.rating, 1);
    else if (row.status === "APPROVED") await adjustTotals(tx, row.productId, row.rating, -1);
    await audit(
      { actorId, action: `review.${status.toLowerCase()}`, entityType: "Review", entityId: id },
      tx,
    );
    return true;
  });
}

export async function deleteReview(id: string, actorId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: ReviewStatus; productId: string; rating: number }[]>`
      SELECT status, "productId", rating FROM "Review" WHERE id = ${id} FOR UPDATE`;
    if (!row) return false;
    await tx.review.delete({ where: { id } });
    if (row.status === "APPROVED") await adjustTotals(tx, row.productId, row.rating, -1);
    await audit({ actorId, action: "review.delete", entityType: "Review", entityId: id }, tx);
    return true;
  });
}

/** First name and last initial only: reviews are public. */
export function reviewerName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0]!;
}

export async function productReviews(productId: string, page: number, pageSize = 10) {
  const where = { productId, status: "APPROVED" as const };
  const [rows, total, distribution] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        imageUrls: true,
        createdAt: true,
        orderItemId: true,
        user: { select: { name: true } },
      },
    }),
    db.review.count({ where }),
    db.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);
  return {
    reviews: rows.map(({ user, orderItemId, ...r }) => ({
      ...r,
      author: reviewerName(user.name),
      verified: orderItemId !== null,
    })),
    total,
    distribution: Object.fromEntries(
      [1, 2, 3, 4, 5].map((n) => [n, distribution.find((d) => d.rating === n)?._count._all ?? 0]),
    ) as Record<1 | 2 | 3 | 4 | 5, number>,
  };
}

/** A customer's own reviews for a set of products (to show "Reviewed" / "Awaiting approval"). */
export async function myReviews(userId: string, productIds: string[]) {
  const rows = await db.review.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true, status: true, rating: true },
  });
  return new Map(rows.map((r) => [r.productId, r]));
}

export async function listReviewsAdmin(query: {
  page: number;
  pageSize: number;
  status?: ReviewStatus;
  q?: string;
}) {
  const where: Prisma.ReviewWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { body: { contains: query.q, mode: "insensitive" } },
            { product: { slug: { contains: query.q.toLowerCase() } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.review.findMany({
      where,
      // Enum order puts PENDING first: the moderation queue is always on top.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { name: true, phone: true } },
      },
    }),
    db.review.count({ where }),
  ]);
  return { rows, total };
}

export function pendingReviewCount() {
  return db.review.count({ where: { status: "PENDING" } });
}

/**
 * Re-encodes a customer photo: applies the camera orientation, resizes to at most 1600 px and
 * converts to WebP. All metadata (including GPS location from phone cameras) is dropped.
 */
export async function reencodeReviewPhoto(
  bytes: Uint8Array,
): Promise<
  { ok: true; webp: Buffer } | { ok: false; error: "file_empty" | "file_too_large" | "file_type" }
> {
  if (bytes.length === 0) return { ok: false, error: "file_empty" };
  if (bytes.length > MAX_UPLOAD_BYTES * 2) return { ok: false, error: "file_too_large" };
  const type = sniffImageType(bytes);
  if (!type || type === "image/x-icon" || type === "image/gif")
    return { ok: false, error: "file_type" };
  try {
    const webp = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, webp };
  } catch {
    return { ok: false, error: "file_type" };
  }
}

/** Stores a customer review photo (re-encoded first). */
export async function uploadReviewPhoto(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const result = await reencodeReviewPhoto(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return result;
  const stored = await getStorageProvider().upload({
    bytes: new Uint8Array(result.webp),
    contentType: "image/webp",
    folder: "reviews",
  });
  return { ok: true, url: stored.url };
}
