"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFeatures } from "@/components/store/features-context";
import { ProductCard } from "@/components/store/product-card";
import { ScrollRow } from "@/components/store/scroll-row";
import { productCardsAction } from "@/lib/actions/wishlist.actions";
import { useRecentlyViewed } from "@/lib/recently-viewed-store";
import type { ProductCard as Card } from "@/lib/services/catalog-query.service";

/** Remembers that this product was viewed (on this device only). */
export function RecordView({ productId }: { productId: string }) {
  const { recentlyViewed } = useFeatures();
  useEffect(() => {
    if (recentlyViewed) useRecentlyViewed.getState().add(productId);
  }, [productId, recentlyViewed]);
  return null;
}

/** "Recently viewed" row; renders nothing when empty or switched off. */
export function RecentlyViewedRow({ excludeId }: { excludeId?: string }) {
  const t = useTranslations("Product");
  const { recentlyViewed } = useFeatures();
  const ids = useRecentlyViewed((s) => s.ids);
  const [cards, setCards] = useState<Card[]>([]);
  const wanted = ids.filter((id) => id !== excludeId).slice(0, 10);
  const key = wanted.join(",");

  useEffect(() => {
    if (!recentlyViewed || !key) return;
    let cancelled = false;
    productCardsAction(key.split(","))
      .then((r) => !cancelled && r.ok && setCards(r.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, recentlyViewed]);

  if (!recentlyViewed || !key || cards.length === 0) return null;
  return (
    <section className="grid gap-4" aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="text-xl font-bold">
        {t("recentlyViewed")}
      </h2>
      <ScrollRow label={t("recentlyViewed")}>
        {cards.map((p) => (
          <li key={p.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
            <ProductCard product={p} />
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}
