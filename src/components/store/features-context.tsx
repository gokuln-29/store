"use client";

import { createContext, useContext, type ReactNode } from "react";
import { resolveFeatures, type Features } from "@/lib/features";

const FeaturesContext = createContext<Features>(resolveFeatures({}));

/** Makes the store's feature switches (Settings → Features) available to client components. */
export function FeaturesProvider({ value, children }: { value: Features; children: ReactNode }) {
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures(): Features {
  return useContext(FeaturesContext);
}
