"use client";

import { useEffect, useRef } from "react";
import { mergeCartAction, saveCartAction, savedCartAction } from "@/lib/actions/cart.actions";
import { useCart } from "@/lib/cart-store";

type SessionResponse = { user?: { id?: string } } | null;

/**
 * Keeps the browser cart and a logged-in customer's saved cart in step. Pages stay static:
 * the login state is read from the session endpoint in the browser.
 * - First time we see this account: the guest cart is merged into the saved cart.
 * - Later visits: a non-empty local cart is saved (it may hold unsaved changes); an empty one
 *   is filled from the saved cart (e.g. on another device).
 * - After logout: the local cart is cleared so the next person on this device doesn't see it.
 */
export function CartSync() {
  const userIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let userId: string | null = null;
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        userId = ((await res.json()) as SessionResponse)?.user?.id ?? null;
      } catch {
        return;
      }
      if (cancelled) return;
      userIdRef.current = userId;
      const { items, syncedUserId, replace } = useCart.getState();

      if (!userId) {
        if (syncedUserId) replace([], null);
        return;
      }
      try {
        if (syncedUserId !== userId) {
          // First time for this account on this device: add the guest cart to the saved one.
          const merged = await mergeCartAction(items);
          if (!cancelled && merged.ok) {
            // Items added while merging are kept too (they are saved on the next change).
            const addedMeanwhile = useCart
              .getState()
              .items.filter((i) => !items.some((o) => o.variantId === i.variantId));
            replace([...merged.data, ...addedMeanwhile], userId);
          }
        } else if (items.length > 0) {
          // This device already has the cart (maybe with changes not yet saved): push it.
          await saveCartAction(items);
        } else {
          // Empty here (e.g. new device or cleared): load what's saved for the account.
          const saved = await savedCartAction();
          // Don't overwrite items the customer added while this request was in flight.
          if (!cancelled && saved.ok && useCart.getState().items.length === 0)
            replace(saved.data, userId);
        }
      } catch {
        // Offline or interrupted by navigation: the next page load syncs again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save changes for logged-in customers (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useCart.subscribe((state, prev) => {
      if (
        state.items === prev.items ||
        !userIdRef.current ||
        state.syncedUserId !== userIdRef.current
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveCartAction(state.items).catch(() => undefined);
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
