import { authorize } from "@/lib/auth-guards";
import { sameOriginGuard } from "@/lib/csrf";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import { uploadReviewPhoto } from "@/lib/services/review.service";
import { getFeatures } from "@/lib/services/settings.service";

export const dynamic = "force-dynamic";

/** Photo for a review (signed-in customers only; re-encoded before storing). */
export async function POST(request: Request) {
  const forbidden = sameOriginGuard(request);
  if (forbidden) return forbidden;
  const features = await getFeatures();
  if (!features.reviews || !features.reviewPhotos) {
    return Response.json({ ok: false, error: "feature_disabled" }, { status: 403 });
  }
  const user = await authorize("account:self");
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.reviewPhotoByUser(user.id));
  if (!limit.allowed) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return Response.json({ ok: false, error: "validation" }, { status: 400 });
  const result = await uploadReviewPhoto(file);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
