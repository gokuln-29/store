"use client";

import { useEffect } from "react";
import { trackFunnel } from "@/lib/analytics-client";
import { cartCount, useCart } from "@/lib/cart-store";
import { useFeatures } from "./features-context";

/** Counts a visit, and an add-to-cart when the cart grows (Settings → Features → Visit statistics). */
export function AnalyticsBeacon() {
  const { analytics } = useFeatures();
  useEffect(() => {
    if (!analytics) return;
    trackFunnel("visit");
    return useCart.subscribe((state, prev) => {
      if (cartCount(state.items) > cartCount(prev.items)) trackFunnel("cart");
    });
  }, [analytics]);
  return null;
}

/** Counts a funnel step when rendered (checkout page: "checkout"; confirmation page: "ordered"). */
export function TrackStep({ step }: { step: "checkout" | "ordered" }) {
  const { analytics } = useFeatures();
  useEffect(() => {
    if (analytics) trackFunnel(step);
  }, [analytics, step]);
  return null;
}
