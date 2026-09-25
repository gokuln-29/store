"use client";

import { BadgeCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { productReviewsAction } from "@/lib/actions/reviews.actions";
import { formatDateTime } from "@/lib/utils/format";
import { isLocalUpload } from "@/lib/utils/images";
import { RatingStars } from "./rating-stars";

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  imageUrls: string[];
  createdAt: Date;
  author: string;
  verified: boolean;
};

export function ReviewList({
  productId,
  initial,
  total,
}: {
  productId: string;
  initial: PublicReview[];
  total: number;
}) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const [reviews, setReviews] = useState(initial);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const more = () =>
    startTransition(async () => {
      const result = await productReviewsAction(productId, page + 1);
      if (result.ok) {
        setReviews((r) => [...r, ...result.data]);
        setPage(page + 1);
      }
    });

  return (
    <div className="grid gap-4">
      <ul className="divide-y">
        {reviews.map((r) => (
          <li key={r.id} className="grid gap-2 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <RatingStars value={r.rating} />
              {r.title && <p className="font-semibold">{r.title}</p>}
            </div>
            {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
            {r.imageUrls.length > 0 && (
              <ul className="flex gap-2">
                {r.imageUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <Image
                        src={url}
                        alt={t("photoBy", { name: r.author || t("customer") })}
                        width={80}
                        height={80}
                        className="size-20 rounded-md object-cover"
                        unoptimized={isLocalUpload(url)}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{r.author || t("customer")}</span>
              {r.verified && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t("verified")}
                </span>
              )}
              <span>{formatDateTime(new Date(r.createdAt), locale)}</span>
            </p>
          </li>
        ))}
      </ul>
      {reviews.length < total && (
        <div>
          <Button variant="outline" onClick={more} disabled={isPending}>
            {t("showMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
