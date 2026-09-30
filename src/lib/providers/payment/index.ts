import { mockPaymentProvider } from "./mock";
import { razorpayFromEnv } from "./razorpay";
import type { PaymentProvider } from "./types";

export type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentSession,
  ProviderPayment,
  ProviderRefund,
} from "./types";
export { PaymentProviderError } from "./types";

let override: PaymentProvider | null = null;

/** Tests only: replace the provider returned for its name. */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  override = provider;
}

/** A provider by name, e.g. the one a stored Payment was made with. */
export function getPaymentProviderByName(name: string): PaymentProvider {
  if (override && override.name === name) return override;
  switch (name) {
    case "mock":
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ALLOW_MOCK_PAYMENTS !== "true" &&
        process.env.DEMO_MODE !== "true"
      ) {
        throw new Error("PAYMENT_PROVIDER=mock is not allowed in production.");
      }
      return mockPaymentProvider;
    case "razorpay":
      return razorpayFromEnv();
    default:
      throw new Error(`Unknown payment provider "${name}"`);
  }
}

/** The provider used for new online payments, from PAYMENT_PROVIDER (default "mock"). */
export function getPaymentProvider(): PaymentProvider {
  return getPaymentProviderByName(process.env.PAYMENT_PROVIDER ?? "mock");
}
