import { z } from "zod";
import { verifyRazorpayCheckoutSignature } from "./signature";
import {
  PaymentProviderError,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderRefund,
} from "./types";

/**
 * Razorpay adapter using its REST API directly (no SDK). Every response is validated with Zod.
 * Docs: https://razorpay.com/docs/api/
 */

const API_BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

const paymentEntity = z.object({
  id: z.string(),
  order_id: z.string().nullish(),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  amount: z.int().nonnegative(),
  method: z.string().nullish(),
  error_description: z.string().nullish(),
});

const refundEntity = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.int().positive(),
  status: z.enum(["pending", "processed", "failed"]),
  receipt: z.string().nullish(),
});

const orderEntity = z.object({ id: z.string(), amount: z.int() });

export function toProviderPayment(p: z.infer<typeof paymentEntity>): ProviderPayment {
  return {
    id: p.id,
    providerOrderId: p.order_id ?? null,
    status: p.status,
    amount: p.amount,
    method: p.method ?? null,
    errorDescription: p.error_description ?? null,
  };
}

export function toProviderRefund(r: z.infer<typeof refundEntity>): ProviderRefund {
  return {
    id: r.id,
    providerPaymentId: r.payment_id,
    amount: r.amount,
    status: r.status,
    receipt: r.receipt ?? null,
  };
}

export { paymentEntity as razorpayPaymentEntity, refundEntity as razorpayRefundEntity };

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
  baseUrl?: string;
};

export function createRazorpayProvider(config: RazorpayConfig): PaymentProvider {
  const doFetch = config.fetch ?? fetch;
  const base = config.baseUrl ?? API_BASE;
  const auth = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

  async function call<T>(
    method: "GET" | "POST",
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: auth,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new PaymentProviderError(`Razorpay unreachable: ${(error as Error).message}`);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = z
        .object({ error: z.object({ code: z.string(), description: z.string().nullish() }) })
        .safeParse(json);
      throw new PaymentProviderError(
        `Razorpay ${method} ${path} failed (${res.status}): ${err.data?.error.description ?? "unknown error"}`,
        err.data?.error.code ?? "provider_error",
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new PaymentProviderError(`Unexpected Razorpay response for ${path}`);
    return parsed.data;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    name: "razorpay",

    async createPayment({ orderId, orderNumber, amount, currency }) {
      const order = await call("POST", "/orders", orderEntity, {
        amount,
        currency,
        receipt: orderNumber.slice(0, 40),
        notes: { orderId, orderNumber },
      });
      if (order.amount !== amount) throw new PaymentProviderError("Razorpay order amount mismatch");
      return { provider: "razorpay", providerOrderId: order.id, next: { type: "client" } };
    },

    verifyCheckoutSignature(input) {
      return verifyRazorpayCheckoutSignature(config.keySecret, input);
    },

    async getPayment(providerPaymentId) {
      return toProviderPayment(
        await call("GET", `/payments/${id(providerPaymentId)}`, paymentEntity),
      );
    },

    async listOrderPayments(providerOrderId) {
      const list = await call(
        "GET",
        `/orders/${id(providerOrderId)}/payments`,
        z.object({ items: z.array(paymentEntity) }),
      );
      return list.items.map(toProviderPayment);
    },

    async capturePayment(providerPaymentId, amount) {
      return toProviderPayment(
        await call("POST", `/payments/${id(providerPaymentId)}/capture`, paymentEntity, {
          amount,
          currency: "INR",
        }),
      );
    },

    async refund({ providerPaymentId, amount, receipt }) {
      return toProviderRefund(
        await call("POST", `/payments/${id(providerPaymentId)}/refund`, refundEntity, {
          amount,
          speed: "normal",
          receipt,
        }),
      );
    },
  };
}

/** Public key id for Razorpay Checkout in the browser (safe to expose). */
export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

export function razorpayFromEnv(): PaymentProvider {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set for PAYMENT_PROVIDER=razorpay.",
    );
  }
  return createRazorpayProvider({ keyId, keySecret });
}
