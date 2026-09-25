"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./safe-storage";

export type CartItem = { variantId: string; quantity: number };

const MAX_QTY = 20;

type CartState = {
  items: CartItem[];
  /** Account the cart was last synced with; null for a guest cart. */
  syncedUserId: string | null;
  add: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  replace: (items: CartItem[], syncedUserId?: string | null) => void;
  clear: () => void;
};

/**
 * The shopping cart in the browser (item ids and quantities only — prices always come from
 * the server). Logged-in customers' carts are also saved on the server by CartSync.
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      syncedUserId: null,
      add: (variantId, quantity) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === variantId);
          const items = existing
            ? state.items.map((i) =>
                i.variantId === variantId
                  ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) }
                  : i,
              )
            : [...state.items, { variantId, quantity: Math.min(MAX_QTY, quantity) }];
          return { items };
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i,
                ),
        })),
      remove: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      replace: (items, syncedUserId) =>
        set((state) => ({
          items,
          syncedUserId: syncedUserId === undefined ? state.syncedUserId : syncedUserId,
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "cart-v1", storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}
