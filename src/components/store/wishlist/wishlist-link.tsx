"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useFeatures } from "@/components/store/features-context";
import { Link } from "@/i18n/navigation";
import { useWishlist } from "@/lib/wishlist-store";

const subscribe = () => () => {};

export function WishlistLink() {
  const t = useTranslations("Wishlist");
  const { wishlist } = useFeatures();
  const count = useWishlist((s) => s.ids.length);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!wishlist) return null;
  const shown = hydrated ? count : 0;
  return (
    <Link
      href="/wishlist"
      aria-label={shown ? t("linkWithCount", { count: shown }) : t("title")}
      className="relative hidden rounded-md p-2 hover:bg-accent sm:inline-flex"
    >
      <Heart className="size-5" aria-hidden />
      {shown > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] leading-5 font-semibold text-white tabular-nums">
          {shown > 99 ? "99+" : shown}
        </span>
      )}
    </Link>
  );
}
