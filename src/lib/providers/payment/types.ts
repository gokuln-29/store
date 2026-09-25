/**
 * Online payment provider adapter. "mock" is the development provider; "razorpay" is the real
 * one. Business logic (orders, refunds, idempotency) lives in lib/services/payment.service.ts;
 * adapters only talk to the provider.
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
  next: { type: "redirect"; url: string } | { type: "client" };
};

export type ProviderPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

/** A payment attempt as the provider reports it. */
export type ProviderPayment = {
  id: string;
  providerOrderId: string | null;
  status: ProviderPaymentStatus;
  /** paise */
  amount: number;
  method: string | null;
  errorDescription: string | null;
};

export type ProviderRefundStatus = "pending" | "processed" | "failed";

export type ProviderRefund = {
  id: string;
  providerPaymentId: string;
  /** paise */
  amount: number;
  status: ProviderRefundStatus;
  /** Our Refund id, sent as the provider's "receipt". */
  receipt: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentSession>;
  /** Proves that a success result from the browser really came from the provider. */
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;
  getPayment(providerPaymentId: string): Promise<ProviderPayment>;
  /** Payment attempts made against a provider order (checked before expiring an order). */
  listOrderPayments(providerOrderId: string): Promise<ProviderPayment[]>;
  /** Captures an authorized payment (only needed when auto-capture is off). */
  capturePayment(providerPaymentId: string, amount: number): Promise<ProviderPayment>;
  refund(input: {
    providerPaymentId: string;
    amount: number;
    receipt: string;
  }): Promise<ProviderRefund>;
}

/** The provider rejected a request or could not be reached. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code: string = "provider_error",
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
