"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useFeatures } from "@/components/store/features-context";
import { Button } from "@/components/ui/button";
import { setWishlistedAction } from "@/lib/actions/wishlist.actions";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist-store";

const subscribe = () => () => {};

/** Heart toggle for a product; hidden when the wishlist feature is off. */
export function WishlistButton({
  productId,
  name,
  variant = "icon",
  className,
}: {
  productId: string;
  name: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const t = useTranslations("Wishlist");
  const { wishlist } = useFeatures();
  const saved = useWishlist((s) => s.ids.includes(productId));
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!wishlist) return null;
  const on = hydrated && saved;

  const toggle = () => {
    const nowSaved = useWishlist.getState().toggle(productId);
    toast.success(nowSaved ? t("added", { name }) : t("removed", { name }));
    if (useWishlist.getState().syncedUserId) {
      setWishlistedAction(productId, nowSaved).catch(() => undefined);
    }
  };

  const label = on ? t("remove", { name }) : t("add", { name });
  const icon = <Heart className={cn("size-5", on && "fill-current text-rose-600")} aria-hidden />;
  return variant === "icon" ? (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn("size-9 rounded-full bg-background/90 shadow-sm", className)}
    >
      {icon}
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      aria-pressed={on}
      onClick={toggle}
      className={className}
    >
      {icon}
      {on ? t("saved") : t("save")}
    </Button>
  );
}
