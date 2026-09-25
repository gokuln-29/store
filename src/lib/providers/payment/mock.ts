import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Development payment provider: sends the customer to a local "test payment" page where
 * they can simulate success or failure. Refunds settle immediately. Never enabled in
 * production unless ALLOW_MOCK_PAYMENTS=true.
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
  // The test page is handled by recordMockPayment; there is no browser signature to check.
  verifyCheckoutSignature: () => false,
  async getPayment(id) {
    return {
      id,
      providerOrderId: null,
      status: "captured",
      amount: 0,
      method: "mock",
      errorDescription: null,
    };
  },
  // Mock payments are recorded synchronously, so there is never anything to reconcile.
  async listOrderPayments() {
    return [];
  },
  async capturePayment(id, amount) {
    return {
      id,
      providerOrderId: null,
      status: "captured",
      amount,
      method: "mock",
      errorDescription: null,
    };
  },
  async refund({ providerPaymentId, amount, receipt }) {
    return {
      id: `mock_rfnd_${randomUUID()}`,
      providerPaymentId,
      amount,
      status: "processed",
      receipt,
    };
  },
};
