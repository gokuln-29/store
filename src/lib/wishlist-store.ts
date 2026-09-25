"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./safe-storage";

export const MAX_WISHLIST = 100;

type WishlistState = {
  /** Product ids, newest first. */
  ids: string[];
  /** Account the list was last synced with; null for a guest list. */
  syncedUserId: string | null;
  toggle: (productId: string) => boolean;
  replace: (ids: string[], syncedUserId?: string | null) => void;
};

/**
 * Saved products in the browser. Guests keep them on the device; WishlistSync merges them into
 * the account on login and keeps both in step afterwards.
 */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      syncedUserId: null,
      toggle: (productId) => {
        const saved = get().ids.includes(productId);
        set((s) => ({
          ids: saved
            ? s.ids.filter((id) => id !== productId)
            : [productId, ...s.ids].slice(0, MAX_WISHLIST),
        }));
        return !saved;
      },
      replace: (ids, syncedUserId) =>
        set((s) => ({
          ids: ids.slice(0, MAX_WISHLIST),
          syncedUserId: syncedUserId === undefined ? s.syncedUserId : syncedUserId,
        })),
    }),
    { name: "wishlist-v1", storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);
