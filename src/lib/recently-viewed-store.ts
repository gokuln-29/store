"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./safe-storage";

const MAX = 12;

type RecentlyViewedState = { ids: string[]; add: (productId: string) => void };

/** Products this device looked at recently (newest first). Stays on the device only. */
export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      add: (productId) =>
        set((s) => ({ ids: [productId, ...s.ids.filter((id) => id !== productId)].slice(0, MAX) })),
    }),
    { name: "recently-viewed-v1", storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);
