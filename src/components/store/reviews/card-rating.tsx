"use client";

import { useFeatures } from "@/components/store/features-context";
import { RatingStars } from "./rating-stars";

/** Rating on product cards; hidden when reviews are switched off. */
export function CardRating({ rating }: { rating: { average: number; count: number } | null }) {
  const { reviews } = useFeatures();
  if (!reviews || !rating) return null;
  return <RatingStars value={rating.average} count={rating.count} />;
}
