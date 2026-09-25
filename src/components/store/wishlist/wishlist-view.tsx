"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ProductCardSkeleton, ProductGrid } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { productCardsAction } from "@/lib/actions/wishlist.actions";
import type { ProductCard } from "@/lib/services/catalog-query.service";
import { useWishlist } from "@/lib/wishlist-store";

const subscribe = () => () => {};

export function WishlistView() {
  const t = useTranslations("Wishlist");
  const tErrors = useTranslations("Errors");
  const ids = useWishlist((s) => s.ids);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [cards, setCards] = useState<ProductCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    productCardsAction(ids)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setCards(r.data);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [ids, hydrated]);

  if (hydrated && ids.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Heart className="size-12 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-lg font-medium">{t("empty")}</p>
        <p className="mt-1 text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild className="mt-6">
          <Link href="/shop">{t("browse")}</Link>
        </Button>
      </div>
    );
  }
  if (failed && !cards) {
    return (
      <p role="alert" className="py-16 text-center text-muted-foreground">
        {tErrors("unknown")}
      </p>
    );
  }
  if (!cards) {
    return (
      <ul
        className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
        aria-busy="true"
      >
        {ids.slice(0, 8).map((id) => (
          <li key={id}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }
  return <ProductGrid products={cards} />;
}
