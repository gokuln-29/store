import type { PricedCart } from "@/lib/actions/cart.actions";
import type { CartItem } from "@/lib/cart-store";

/**
 * The last cart the server priced, kept in the browser so the cart can still be shown offline.
 * Prices are for display only; the server re-prices everything at checkout.
 */
const KEY = "cart-priced-v1";

export type CartSnapshot = { lines: PricedCart["lines"]; savedAt: number };

export function saveCartSnapshot(cart: PricedCart): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lines: cart.lines, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: offline viewing just won't be available.
  }
}

export function readCartSnapshot(): CartSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as CartSnapshot) : null;
    return data && Array.isArray(data.lines) && typeof data.savedAt === "number" ? data : null;
  } catch {
    return null;
  }
}

/** The current cart priced from the snapshot (items it doesn't know are left out). */
export function cartFromSnapshot(snapshot: CartSnapshot, items: CartItem[]): PricedCart {
  const lines = items.flatMap((item) => {
    const line = snapshot.lines.find((l) => l.variantId === item.variantId);
    return line ? [{ ...line, quantity: Math.min(item.quantity, line.stock) }] : [];
  });
  return {
    lines,
    adjustments: [],
    subtotal: lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    items,
  };
}
