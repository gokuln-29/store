import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  safeEqualHex,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/providers/payment/signature";

const hmac = (secret: string, data: string) =>
  createHmac("sha256", secret).update(data).digest("hex");

describe("Razorpay checkout signature", () => {
  const secret = "key_secret_test";
  const ids = { providerOrderId: "order_ABC123", providerPaymentId: "pay_XYZ789" };
  const valid = hmac(secret, "order_ABC123|pay_XYZ789");

  it("accepts the HMAC of order_id|payment_id", () => {
    expect(verifyRazorpayCheckoutSignature(secret, { ...ids, signature: valid })).toBe(true);
    expect(
      verifyRazorpayCheckoutSignature(secret, { ...ids, signature: valid.toUpperCase() }),
    ).toBe(true);
  });

  it("rejects tampered ids, wrong secrets and malformed signatures", () => {
    const check = (over: Partial<typeof ids> & { signature?: string }, key = secret) =>
      verifyRazorpayCheckoutSignature(key, { ...ids, signature: valid, ...over });
    expect(check({ providerPaymentId: "pay_OTHER" })).toBe(false);
    expect(check({ providerOrderId: "order_OTHER" })).toBe(false);
    expect(check({}, "another_secret")).toBe(false);
    expect(check({}, "")).toBe(false);
    expect(check({ signature: valid.slice(0, -2) })).toBe(false);
    expect(check({ signature: `${valid.slice(0, -1)}z` })).toBe(false);
    expect(check({ signature: "" })).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const secret = "whsec_test";
  const body = '{"event":"payment.captured","payload":{}}';

  it("is computed over the exact raw body", () => {
    expect(verifyRazorpayWebhookSignature(secret, body, hmac(secret, body))).toBe(true);
    // Re-serialized JSON (different whitespace) must not verify.
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyRazorpayWebhookSignature(secret, reformatted, hmac(secret, body))).toBe(false);
  });

  it("rejects missing signatures or secrets", () => {
    expect(verifyRazorpayWebhookSignature(secret, body, null)).toBe(false);
    expect(verifyRazorpayWebhookSignature("", body, hmac("", body))).toBe(false);
  });
});

describe("safeEqualHex", () => {
  it("compares hex digests in constant time without throwing on bad input", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("abcd", "ab-d")).toBe(false);
  });
});
