"use server";

import { getCurrentUser } from "@/lib/auth-guards";
import {
  getSavedCartItems,
  loadCartLines,
  mergeGuestCart,
  saveCart,
  type CartAdjustment,
  type CartItemInput,
  type CartLine,
} from "@/lib/services/cart.service";
import { cartItemsSchema } from "@/lib/validators/checkout";
import type { ActionResult } from "./result";

export type PricedCart = {
  lines: CartLine[];
  adjustments: CartAdjustment[];
  /** paise, before coupons/shipping */
  subtotal: number;
  /** The validated items (quantities clamped, unavailable removed) to keep in the browser. */
  items: CartItemInput[];
};

function priced(lines: CartLine[], adjustments: CartAdjustment[]): PricedCart {
  return {
    lines,
    adjustments,
    subtotal: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
  };
}

/** Current prices/stock for the cart. Also saves it for logged-in customers. */
export async function priceCartAction(items: CartItemInput[]): Promise<ActionResult<PricedCart>> {
  const parsed = cartItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { lines, adjustments } = await loadCartLines(parsed.data);
  const user = await getCurrentUser();
  if (user)
    await saveCart(
      user.id,
      lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    );
  return { ok: true, data: priced(lines, adjustments) };
}

/** After login: adds the guest cart to the customer's saved cart and returns the result. */
export async function mergeCartAction(
  guestItems: CartItemInput[],
): Promise<ActionResult<CartItemInput[]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = cartItemsSchema.safeParse(guestItems);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await mergeGuestCart(user.id, parsed.data) };
}

/** The logged-in customer's saved cart (so the cart follows them across devices). */
export async function savedCartAction(): Promise<ActionResult<CartItemInput[]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  return { ok: true, data: await getSavedCartItems(user.id) };
}

/** Saves the cart for a logged-in customer (no-op for guests). */
export async function saveCartAction(items: CartItemInput[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: true, data: undefined };
  const parsed = cartItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "validation" };
  await saveCart(user.id, parsed.data);
  return { ok: true, data: undefined };
}
