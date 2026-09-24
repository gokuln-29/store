import { mockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { CreatePaymentInput, PaymentProvider, PaymentSession } from "./types";

/** Picks the online payment provider from PAYMENT_PROVIDER (default "mock"). */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
        throw new Error("PAYMENT_PROVIDER=mock is not allowed in production.");
      }
      return mockPaymentProvider;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
}
