import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveFeatures } from "@/lib/features";
import { productCards, ratingSummary } from "@/lib/services/catalog-query.service";
import {
  deleteReview,
  moderateReview,
  productReviews,
  reencodeReviewPhoto,
  reviewerName,
  submitReview,
} from "@/lib/services/review.service";
import { updateFeatureSettings } from "@/lib/services/settings.service";

let productId: string;
let variantId: string;
let admin: string;
let seq = 0;

beforeEach(async () => {
  await db.storeSettings.create({ data: { id: "default", name: "Demo", orderNumberPrefix: "DS" } });
  const category = await db.category.create({ data: { slug: "c", name: { en: "C" } } });
  const product = await db.product.create({
    data: {
      slug: "p",
      name: { en: "P" },
      categoryId: category.id,
      status: "PUBLISHED",
      variants: { create: [{ sku: "P1", price: 10000, stock: 5 }] },
    },
    include: { variants: true },
  });
  productId = product.id;
  variantId = product.variants[0]!.id;
  admin = (await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } })).id;
});

async function customerWithOrder(status: "DELIVERED" | "SHIPPED", name = "Asha Rao") {
  seq += 1;
  const user = await db.user.create({
    data: { phone: `+9197${String(seq).padStart(8, "0")}`, role: "CUSTOMER", name },
  });
  await db.order.create({
    data: {
      orderNumber: `DS-${7000 + seq}`,
      userId: user.id,
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : null,
      paymentMethod: "COD",
      customerName: name,
      customerPhone: user.phone!,
      shippingAddress: {},
      subtotal: 10000,
      total: 10000,
      pricesIncludeTax: true,
      items: {
        create: [
          {
            productId,
            variantId,
            productName: { en: "P" },
            sku: "P1",
            unitPrice: 10000,
            quantity: 1,
            taxRateBps: 0,
            taxAmount: 0,
            lineTotal: 10000,
          },
        ],
      },
    },
  });
  return user;
}

const review = (userId: string, rating: number, imageUrls: string[] = []) =>
  submitReview({ userId, productId, rating, title: "Nice", body: "Tasty", imageUrls });

const totals = () =>
  db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { ratingCount: true, ratingTotal: true },
  });

describe("writing reviews", () => {
  it("is limited to customers who received the product, once each", async () => {
    const waiting = await customerWithOrder("SHIPPED");
    expect(await review(waiting.id, 5)).toEqual({ ok: false, error: "not_eligible" });

    const buyer = await customerWithOrder("DELIVERED");
    const first = await review(buyer.id, 4, ["/uploads/reviews/a.webp"]);
    expect(first).toMatchObject({ ok: true });
    expect(await review(buyer.id, 5)).toEqual({ ok: false, error: "already_reviewed" });

    const stored = await db.review.findFirstOrThrow({ where: { userId: buyer.id } });
    expect(stored).toMatchObject({ status: "PENDING", imageUrls: ["/uploads/reviews/a.webp"] });
    expect(stored.orderItemId).not.toBeNull(); // verified purchase
    expect(await totals()).toEqual({ ratingCount: 0, ratingTotal: 0 }); // not counted until approved
  });

  it("respects the feature switches", async () => {
    const buyer = await customerWithOrder("DELIVERED");
    await updateFeatureSettings({ ...resolveFeatures({}), reviewPhotos: false }, admin);
    await review(buyer.id, 5, ["/uploads/reviews/a.webp"]);
    expect((await db.review.findFirstOrThrow()).imageUrls).toEqual([]);

    await updateFeatureSettings({ ...resolveFeatures({}), reviews: false }, admin);
    const other = await customerWithOrder("DELIVERED");
    expect(await review(other.id, 5)).toEqual({ ok: false, error: "feature_disabled" });
  });
});

describe("moderation", () => {
  it("keeps the product rating in step with approvals, rejections and deletions", async () => {
    const a = await customerWithOrder("DELIVERED", "Asha Rao");
    const b = await customerWithOrder("DELIVERED", "Bala");
    const ra = await review(a.id, 5);
    const rb = await review(b.id, 2);
    if (!ra.ok || !rb.ok) throw new Error("setup");

    await moderateReview(ra.id, "APPROVED", admin);
    await moderateReview(ra.id, "APPROVED", admin); // repeat: no double count
    await moderateReview(rb.id, "APPROVED", admin);
    expect(await totals()).toEqual({ ratingCount: 2, ratingTotal: 7 });
    expect((await productCards([productId]))[0]!.rating).toEqual({ average: 3.5, count: 2 });

    await moderateReview(rb.id, "REJECTED", admin);
    expect(await totals()).toEqual({ ratingCount: 1, ratingTotal: 5 });
    await deleteReview(ra.id, admin);
    expect(await totals()).toEqual({ ratingCount: 0, ratingTotal: 0 });
    expect((await productCards([productId]))[0]!.rating).toBeNull();
  });

  it("stays consistent when two admins moderate at once", async () => {
    const a = await customerWithOrder("DELIVERED");
    const r = await review(a.id, 4);
    if (!r.ok) throw new Error("setup");
    await Promise.all(Array.from({ length: 5 }, () => moderateReview(r.id, "APPROVED", admin)));
    expect(await totals()).toEqual({ ratingCount: 1, ratingTotal: 4 });
  });

  it("shows only approved reviews publicly, with a privacy-friendly name", async () => {
    const a = await customerWithOrder("DELIVERED", "Asha Rao");
    const b = await customerWithOrder("DELIVERED");
    const ra = await review(a.id, 5);
    await review(b.id, 1); // still pending
    if (!ra.ok) throw new Error("setup");
    await moderateReview(ra.id, "APPROVED", admin);
    const { reviews, total, distribution } = await productReviews(productId, 1);
    expect(total).toBe(1);
    expect(reviews[0]).toMatchObject({ author: "Asha R.", verified: true, rating: 5 });
    expect(distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
  });
});

describe("helpers", () => {
  it("rounds averages and shortens names", () => {
    expect(ratingSummary(3, 13)).toEqual({ average: 4.3, count: 3 });
    expect(ratingSummary(0, 0)).toBeNull();
    expect(reviewerName("  Lakshmi   Narayanan Iyer ")).toBe("Lakshmi I.");
    expect(reviewerName(null)).toBe("");
  });

  it("re-encodes photos to WebP and removes location data", async () => {
    const jpeg = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "#c33" },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: "PhoneCo" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 58/1 0/1" },
      })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();

    const result = await reencodeReviewPhoto(new Uint8Array(jpeg));
    if (!result.ok) throw new Error(result.error);
    const meta = await sharp(result.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(meta.exif).toBeUndefined();

    expect(await reencodeReviewPhoto(new Uint8Array())).toEqual({ ok: false, error: "file_empty" });
    expect(await reencodeReviewPhoto(new TextEncoder().encode("<svg onload=alert(1)>"))).toEqual({
      ok: false,
      error: "file_type",
    });
  });
});
