/**
 * Online payment provider adapter. Phase 5 ships a mock provider for development;
 * Razorpay implements the same interface in Phase 6.
 */
export type CreatePaymentInput = {
  orderId: string;
  orderNumber: string;
  /** paise */
  amount: number;
  currency: "INR";
  customer: { name: string; phone: string; email: string | null };
};

export type PaymentSession = {
  provider: string;
  providerOrderId: string;
  /** What the browser should do next. */
  next: { type: "redirect"; url: string } | { type: "client"; data: Record<string, unknown> };
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentSession>;
}
