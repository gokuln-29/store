import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Development payment provider: sends the customer to a local "test payment" page where
 * they can simulate success or failure. Never enabled in production.
 */
export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  async createPayment({ orderNumber }) {
    return {
      provider: "mock",
      providerOrderId: `mock_${randomUUID()}`,
      next: { type: "redirect", url: `/checkout/pay/${encodeURIComponent(orderNumber)}` },
    };
  },
};
