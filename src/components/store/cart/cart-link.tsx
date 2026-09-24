"use client";

import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { cartCount, useCart } from "@/lib/cart-store";

const subscribe = () => () => {};

/** Header cart icon with item count (count appears after hydration to avoid a mismatch). */
export function CartLink() {
  const t = useTranslations("Header");
  const tCart = useTranslations("Cart");
  const count = useCart((s) => cartCount(s.items));
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const shown = hydrated ? count : 0;

  return (
    <Link
      href="/cart"
      aria-label={shown ? tCart("linkWithCount", { count: shown }) : t("cart")}
      className="relative rounded-md p-2 hover:bg-accent"
    >
      <ShoppingCart className="size-5" aria-hidden />
      {shown > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums">
          {shown > 99 ? "99+" : shown}
        </span>
      )}
    </Link>
  );
}
