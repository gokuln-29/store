/**
 * Optional store features, switched on/off in Admin → Settings → Features (StoreSettings.features).
 * Missing values default to on, so new features appear enabled for existing stores.
 */
export const FEATURES = [
  "wishlist",
  "reviews",
  "reviewPhotos",
  "recentlyViewed",
  "relatedProducts",
  "coupons",
  "abandonedCart",
  "analytics",
] as const;
export type Feature = (typeof FEATURES)[number];
export type Features = Record<Feature, boolean>;

export function resolveFeatures(raw: unknown): Features {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    FEATURES.map((f) => [f, typeof stored[f] === "boolean" ? stored[f] : true]),
  ) as Features;
}
