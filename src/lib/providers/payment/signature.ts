import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

/** Razorpay Checkout success: HMAC-SHA256("<order_id>|<payment_id>", key secret). */
export function verifyRazorpayCheckoutSignature(
  secret: string,
  input: { providerOrderId: string; providerPaymentId: string; signature: string },
): boolean {
  if (!secret) return false;
  const expected = hmacSha256Hex(secret, `${input.providerOrderId}|${input.providerPaymentId}`);
  return safeEqualHex(expected, input.signature);
}

/** Razorpay webhook: HMAC-SHA256(raw request body, webhook secret). */
export function verifyRazorpayWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!secret || !signature) return false;
  return safeEqualHex(hmacSha256Hex(secret, rawBody), signature);
}
