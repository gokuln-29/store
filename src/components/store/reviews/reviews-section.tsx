import { getTranslations } from "next-intl/server";
import { productReviews } from "@/lib/services/review.service";
import { RatingStars } from "./rating-stars";
import { ReviewList } from "./review-list";

/** Rating summary, distribution and the latest approved reviews for a product page. */
export async function ReviewsSection({
  productId,
  rating,
}: {
  productId: string;
  rating: { average: number; count: number } | null;
}) {
  const t = await getTranslations("Reviews");
  const { reviews, total, distribution } = await productReviews(productId, 1);

  return (
    <section aria-labelledby="reviews-heading" className="grid max-w-3xl gap-4">
      <h2 id="reviews-heading" className="text-xl font-bold">
        {t("title")}
      </h2>
      {rating ? (
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="grid content-start gap-1">
            <p className="text-4xl font-bold tabular-nums">{rating.average.toFixed(1)}</p>
            <RatingStars value={rating.average} size="md" />
            <p className="text-sm text-muted-foreground">{t("basedOn", { count: rating.count })}</p>
          </div>
          <ul className="grid content-start gap-1.5" aria-label={t("distribution")}>
            {([5, 4, 3, 2, 1] as const).map((stars) => {
              const n = distribution[stars];
              const pct = rating.count ? Math.round((n / rating.count) * 100) : 0;
              return (
                <li
                  key={stars}
                  className="grid grid-cols-[3rem_1fr_2.5rem] items-center gap-2 text-sm"
                >
                  <span>{t("stars", { count: stars })}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}
      <p className="text-sm text-muted-foreground">{t("howToReview")}</p>
      {total > 0 && <ReviewList productId={productId} initial={reviews} total={total} />}
    </section>
  );
}
