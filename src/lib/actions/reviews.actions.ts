"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import {
  deleteReview,
  moderateReview,
  productReviews,
  submitReview,
} from "@/lib/services/review.service";
import { getFeatures } from "@/lib/services/settings.service";
import { reviewSchema, type ReviewInput } from "@/lib/validators/reviews";
import { invalid, type ActionResult } from "./result";

const idSchema = z.string().min(1).max(64);

function revalidateReviews() {
  revalidatePath("/[locale]/admin/(panel)/reviews", "layout");
  revalidatePath("/[locale]/(store)/p/[slug]", "page");
}

/** A customer reviews a product they received. */
export async function submitReviewAction(
  input: ReviewInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("account:self");
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.reviewByUser(user.id));
  if (!limit.allowed) return { ok: false, error: "rate_limited" };
  const result = await submitReview({ ...parsed.data, userId: user.id });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/[locale]/(account)/account", "layout");
  return { ok: true, data: { id: result.id } };
}

/** "Show more reviews" on the product page (public: approved reviews only). */
export async function productReviewsAction(productId: string, page: number) {
  if (!(await getFeatures()).reviews) return { ok: false as const, error: "feature_disabled" };
  const parsed = z
    .object({ productId: idSchema, page: z.int().min(1).max(500) })
    .safeParse({ productId, page });
  if (!parsed.success) return { ok: false as const, error: "validation" };
  const { reviews } = await productReviews(parsed.data.productId, parsed.data.page);
  return { ok: true as const, data: reviews };
}

export async function moderateReviewAction(
  id: string,
  status: "APPROVED" | "REJECTED",
): Promise<ActionResult> {
  const user = await authorize("catalog:write");
  if (!user) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success || !["APPROVED", "REJECTED"].includes(status)) {
    return { ok: false, error: "validation" };
  }
  if (!(await moderateReview(id, status, user.id))) return { ok: false, error: "not_found" };
  revalidateReviews();
  return { ok: true, data: undefined };
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  const user = await authorize("catalog:write");
  if (!user) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  if (!(await deleteReview(id, user.id))) return { ok: false, error: "not_found" };
  revalidateReviews();
  return { ok: true, data: undefined };
}
