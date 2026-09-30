import { getActiveShippingRules } from "@/lib/services/shipping.service";
import { getStoreSettings } from "@/lib/services/settings.service";

/**
 * Reasons to buy shown under the home page hero. Every item comes from the store's real
 * configuration, so a store never advertises something it doesn't offer.
 */
export type StoreHighlight =
  | { kind: "delivery"; freeAbove: number | null }
  | { kind: "secure" }
  | { kind: "cod" }
  | { kind: "support"; phone: string };

export async function getStoreHighlights(): Promise<StoreHighlight[]> {
  const [settings, rules] = await Promise.all([getStoreSettings(), getActiveShippingRules()]);
  // Only the catch-all rule applies everywhere; a local free-delivery offer isn't store-wide.
  const catchAll = rules
    .filter((r) => !r.pincodePrefixes.length && !r.stateCodes.length)
    .sort((a, b) => b.priority - a.priority)[0];

  const items: StoreHighlight[] = [];
  if (rules.length)
    items.push({ kind: "delivery", freeAbove: catchAll?.freeShippingThreshold ?? null });
  if (settings.onlinePaymentsEnabled) items.push({ kind: "secure" });
  if (settings.codEnabled) items.push({ kind: "cod" });
  const phone = settings.whatsappNumber ?? settings.contactPhone;
  if (phone) items.push({ kind: "support", phone });
  return items;
}

export type SocialNetwork = "instagram" | "facebook" | "youtube" | "x";
const NETWORKS: SocialNetwork[] = ["instagram", "facebook", "youtube", "x"];

/** Social profile links from Settings → Contact, in a fixed order, https only. */
export function socialLinks(raw: unknown): { network: SocialNetwork; url: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const links = raw as Record<string, unknown>;
  return NETWORKS.flatMap((network) => {
    const url = links[network];
    return typeof url === "string" && url.startsWith("https://") ? [{ network, url }] : [];
  });
}
