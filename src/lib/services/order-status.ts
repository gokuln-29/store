import type { OrderStatus } from "@/generated/prisma/client";

/**
 * Order status state machine — pure, no database access.
 *
 *   PENDING_PAYMENT ─(payment)→ PLACED → CONFIRMED → PACKED → SHIPPED → DELIVERED → RETURNED
 *                                  └────────┴──────────┴─→ CANCELLED     └─→ RETURNED (RTO)
 *
 * PENDING_PAYMENT is left only by the payment flow (captured → PLACED) or expiry
 * (→ CANCELLED); staff can't move it by hand.
 */
export const ORDER_FLOW: readonly OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  // A shipment that comes back undelivered (return to origin) is recorded as RETURNED.
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Statuses a customer may cancel from themselves (before the order is packed). */
const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["PLACED", "CONFIRMED"];

export type StatusActor = "staff" | "customer";

export function nextStatuses(from: OrderStatus, actor: StatusActor = "staff"): OrderStatus[] {
  if (actor === "customer") return CUSTOMER_CANCELLABLE.includes(from) ? ["CANCELLED"] : [];
  return [...TRANSITIONS[from]];
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: StatusActor = "staff",
): boolean {
  return nextStatuses(from, actor).includes(to);
}

export function canCustomerCancel(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(status);
}

/** Leaving these statuses puts the items back on the shelf. */
export function restocksOn(to: OrderStatus): "always" | "optional" | "never" {
  if (to === "CANCELLED") return "always";
  if (to === "RETURNED") return "optional"; // staff decide: returned goods may be damaged
  return "never";
}

/** Position in the normal flow for progress displays; -1 for cancelled/returned/pending. */
export function flowStep(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status);
}

// ───────────── GST invoice numbers ─────────────

/** Indian financial year (April–March) of a date, in IST: "2026-27". */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 330 * 60_000); // UTC+05:30
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1; // April = month 3
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * GST invoice serial: prefix + financial year + running number, e.g. "DS2627-0001".
 * GST rules allow at most 16 characters (letters, digits, "-" and "/"); a 6-character prefix
 * still fits up to 99,999 invoices a year.
 */
export function formatInvoiceNumber(prefix: string, fy: string, n: number): string {
  const [start, end] = fy.split("-");
  const code = `${prefix
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6)}${start!.slice(2)}${end}`;
  return `${code}-${String(n).padStart(4, "0")}`;
}
