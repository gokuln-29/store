"use server";

import { hasLocale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { authorize } from "@/lib/auth-guards";
import { getClientIp } from "@/lib/request";
import {
  buildQuote,
  placeOrder,
  type CheckoutQuote,
  type PlaceOrderResult,
} from "@/lib/services/checkout.service";
import { confirmCheckoutPayment, recordMockPayment } from "@/lib/services/payment.service";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import {
  placeOrderSchema,
  quoteInputSchema,
  type PlaceOrderInput,
  type QuoteInput,
} from "@/lib/validators/checkout";
import { db } from "@/lib/db";
import { invalid, type ActionResult } from "./result";

/** Live checkout summary. Prices always come from the database. */
export async function quoteCheckoutAction(input: QuoteInput): Promise<ActionResult<CheckoutQuote>> {
  const user = await authorize("account:self");
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const phone =
    (await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null;
  const quote = await buildQuote({ ...parsed.data, customer: { userId: user.id, phone } });

  // Only codes that don't exist count, so repeated re-quotes are fine but guessing is not.
  if (quote.coupon?.status === "rejected" && quote.coupon.reason === "not_found") {
    const limit = await rateLimit(
      postgresRateLimitStore,
      RATE_LIMITS.couponByIp(await getClientIp()),
    );
    if (!limit.allowed) return { ok: false, error: "rate_limited" };
  }
  return { ok: true, data: quote };
}

export async function placeOrderAction(
  input: PlaceOrderInput,
  rawLocale: string,
): Promise<ActionResult<PlaceOrderResult>> {
  const user = await authorize("account:self");
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, { nested: true });

  const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.placeOrderByUser(user.id));
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const result = await placeOrder({ ...parsed.data, userId: user.id, locale });
  return { ok: true, data: result };
}

/** Test payment page (mock provider): simulate success or failure. */
export async function mockPaymentAction(
  orderNumber: string,
  success: boolean,
): Promise<ActionResult<{ status: string }>> {
  const user = await authorize("account:self");
  if (!user) return { ok: false, error: "unauthorized" };
  if (typeof orderNumber !== "string" || orderNumber.length > 40 || typeof success !== "boolean") {
    return { ok: false, error: "validation" };
  }
  const result = await recordMockPayment(orderNumber, user.id, success);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { status: result.status } };
}

const razorpayResultSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

/** Razorpay Checkout success handler: verified by signature, then confirmed with Razorpay. */
export async function confirmRazorpayPaymentAction(
  input: z.input<typeof razorpayResultSchema>,
): Promise<ActionResult<{ status: string }>> {
  const user = await authorize("account:self");
  if (!user) return { ok: false, error: "unauthorized" };
  const parsed = razorpayResultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const result = await confirmCheckoutPayment({
    orderNumber: parsed.data.orderNumber,
    userId: user.id,
    providerOrderId: parsed.data.razorpay_order_id,
    providerPaymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { status: result.status } };
}
