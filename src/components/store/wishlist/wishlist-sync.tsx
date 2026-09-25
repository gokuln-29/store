"use client";

import { useEffect } from "react";
import { useFeatures } from "@/components/store/features-context";
import { mergeWishlistAction, savedWishlistAction } from "@/lib/actions/wishlist.actions";
import { sessionUserId } from "@/lib/session-client";
import { useWishlist } from "@/lib/wishlist-store";

/**
 * Keeps the browser wishlist and a signed-in customer's saved wishlist in step:
 * first sign-in on this device merges the guest list in; afterwards the account is the source
 * of truth (changes are saved as they happen). After logout the device list is cleared.
 */
export function WishlistSync() {
  const { wishlist } = useFeatures();

  useEffect(() => {
    if (!wishlist) return;
    let cancelled = false;
    (async () => {
      const userId = await sessionUserId();
      if (cancelled) return;
      const { ids, syncedUserId, replace } = useWishlist.getState();
      if (!userId) {
        if (syncedUserId) replace([], null);
        return;
      }
      try {
        const result =
          syncedUserId === userId ? await savedWishlistAction() : await mergeWishlistAction(ids);
        if (!cancelled && result.ok) replace(result.data, userId);
      } catch {
        // Offline: the next page load syncs again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wishlist]);

  return null;
}
