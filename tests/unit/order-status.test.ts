import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/client";
import {
  canCustomerCancel,
  canTransition,
  financialYear,
  formatInvoiceNumber,
  nextStatuses,
  restocksOn,
} from "@/lib/services/order-status";

const ALL: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

describe("order status state machine", () => {
  it("allows exactly the documented staff transitions (all 64 pairs)", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to, "staff"), `${from} → ${to}`).toBe(
          ALLOWED[from].includes(to),
        );
      }
    }
  });

  it("never skips steps, goes backwards or leaves a final state", () => {
    expect(canTransition("PLACED", "SHIPPED")).toBe(false);
    expect(canTransition("SHIPPED", "PACKED")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(nextStatuses("CANCELLED")).toEqual([]);
    expect(nextStatuses("RETURNED")).toEqual([]);
    // Payment decides when an unpaid order moves on, not staff.
    expect(nextStatuses("PENDING_PAYMENT")).toEqual([]);
  });

  it("lets customers cancel only until the order is packed", () => {
    for (const from of ALL) {
      const allowed = from === "PLACED" || from === "CONFIRMED";
      expect(canCustomerCancel(from)).toBe(allowed);
      expect(nextStatuses(from, "customer")).toEqual(allowed ? ["CANCELLED"] : []);
      for (const to of ALL) {
        expect(canTransition(from, to, "customer")).toBe(allowed && to === "CANCELLED");
      }
    }
  });

  it("restocks on cancellation always and on return by choice", () => {
    expect(restocksOn("CANCELLED")).toBe("always");
    expect(restocksOn("RETURNED")).toBe("optional");
    for (const s of ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const) {
      expect(restocksOn(s)).toBe("never");
    }
  });
});

describe("GST invoice numbering", () => {
  it("uses the Indian financial year in IST", () => {
    // 1 April 00:00 IST is 31 March 18:30 UTC.
    expect(financialYear(new Date("2027-03-31T18:29:59Z"))).toBe("2026-27");
    expect(financialYear(new Date("2027-03-31T18:30:00Z"))).toBe("2027-28");
    expect(financialYear(new Date("2026-09-25T10:00:00Z"))).toBe("2026-27");
    expect(financialYear(new Date("2099-12-31T00:00:00Z"))).toBe("2099-00");
  });

  it("formats serials within GST's 16-character limit", () => {
    expect(formatInvoiceNumber("DS", "2026-27", 1)).toBe("DS2627-0001");
    expect(formatInvoiceNumber("ds/x", "2026-27", 12345)).toBe("DSX2627-12345");
    const longest = formatInvoiceNumber("ABCDEFGH", "2026-27", 99_999);
    expect(longest).toBe("ABCDEF2627-99999");
    expect(longest.length).toBeLessThanOrEqual(16);
    expect(longest).toMatch(/^[A-Z0-9/-]+$/);
  });
});
