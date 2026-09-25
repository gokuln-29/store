"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import type { ProductCard } from "@/lib/services/catalog-query.service";
import { getFeatures } from "@/lib/services/settings.service";
import {
  getWishlistIds,
  MAX_WISHLIST,
  mergeWishlist,
  publishedCards,
  setWishlisted,
} from "@/lib/services/wishlist.service";
import type { ActionResult } from "./result";

const idsSchema = z.array(z.string().min(1).max(64)).max(MAX_WISHLIST);
const DISABLED: ActionResult<never> = { ok: false, error: "feature_disabled" };

async function customer() {
  const user = await getCurrentUser();
  return user && can(user.role, "account:self") ? user : null;
}

/** On login: guest list + saved list, merged. */
export async function mergeWishlistAction(ids: string[]): Promise<ActionResult<string[]>> {
  if (!(await getFeatures()).wishlist) return DISABLED;
  const user = await customer();
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await mergeWishlist(user.id, parsed.data) };
}

export async function savedWishlistAction(): Promise<ActionResult<string[]>> {
  if (!(await getFeatures()).wishlist) return DISABLED;
  const user = await customer();
  if (!user) return { ok: false, error: "unauthorized" };
  return { ok: true, data: await getWishlistIds(user.id) };
}

export async function setWishlistedAction(
  productId: string,
  saved: boolean,
): Promise<ActionResult> {
  if (!(await getFeatures()).wishlist) return DISABLED;
  const user = await customer();
  if (!user) return { ok: true, data: undefined }; // guests: browser only
  const id = z.string().min(1).max(64).safeParse(productId);
  if (!id.success || typeof saved !== "boolean") return { ok: false, error: "validation" };
  await setWishlisted(user.id, id.data, saved);
  return { ok: true, data: undefined };
}

/** Card data for ids kept in the browser (guests) or the account. Public: product data only. */
export async function productCardsAction(ids: string[]): Promise<ActionResult<ProductCard[]>> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await publishedCards(parsed.data) };
}
