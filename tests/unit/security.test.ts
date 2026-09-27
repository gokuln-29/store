import { describe, expect, it } from "vitest";
import { sameOriginGuard } from "@/lib/csrf";
import { clientIpFromHeaders } from "@/lib/request";
import { scrubEvent } from "@/lib/sentry-scrub";
import { RATE_LIMITS } from "@/lib/services/rate-limit.service";

describe("client IP for rate limits", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("prefers X-Real-IP set by the proxy", () => {
    expect(
      clientIpFromHeaders(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" })),
    ).toBe("203.0.113.9");
  });
  it("ignores client-supplied X-Forwarded-For entries (takes the one our proxy appended)", () => {
    // Attacker sends "X-Forwarded-For: 6.6.6.6"; Nginx appends the real address.
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
    expect(
      clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.2" }), 2),
    ).toBe("198.51.100.7");
    expect(clientIpFromHeaders(h({}))).toBe("unknown");
  });
});

describe("CSRF guard for cookie-authenticated route handlers", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://shop.example/api/cart", { method: "POST", headers });
  it("allows same-origin requests", () => {
    expect(
      sameOriginGuard(req({ origin: "https://shop.example", host: "shop.example" })),
    ).toBeNull();
    expect(
      sameOriginGuard(
        req({
          origin: "https://shop.example",
          host: "internal:3000",
          "x-forwarded-host": "shop.example",
        }),
      ),
    ).toBeNull();
  });
  it("rejects foreign, missing or malformed origins", () => {
    for (const headers of [
      { origin: "https://evil.example", host: "shop.example" },
      { origin: "https://shop.example.evil.example", host: "shop.example" },
      { host: "shop.example" },
      { origin: "null", host: "shop.example" },
    ]) {
      expect(sameOriginGuard(req(headers))?.status).toBe(403);
    }
  });
});

describe("error reports", () => {
  it("never carry cookies, auth headers, request bodies or contact details", () => {
    const event = scrubEvent({
      type: undefined,
      message: "Order failed for asha@example.com / +91 98765 43210",
      request: {
        cookies: { "authjs.session-token": "secret" },
        data: '{"otp":"123456"}',
        headers: {
          Cookie: "a=b",
          Authorization: "Bearer x",
          "User-Agent": "UA",
          "X-Razorpay-Signature": "sig",
        },
      },
      user: { id: "u1", email: "asha@example.com", ip_address: "1.2.3.4" },
      exception: { values: [{ type: "Error", value: "call 9876543210 now" }] },
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(Object.keys(event.request?.headers ?? {})).toEqual(["User-Agent"]);
    expect(event.user).toEqual({ id: "u1" });
    expect(event.message).toBe("Order failed for [email] / [phone]");
    expect(event.exception?.values?.[0]?.value).toBe("call [phone] now");
  });
});

describe("rate limits", () => {
  it("cover login, OTP (per IP and per phone), checkout and coupons", () => {
    for (const key of [
      "adminLoginByIp",
      "adminLoginByEmail",
      "otpSendByIp",
      "otpSendByPhone",
      "otpVerifyByIp",
      "placeOrderByUser",
      "couponByIp",
    ] as const) {
      expect(RATE_LIMITS[key]("x").limit).toBeGreaterThan(0);
    }
    expect(RATE_LIMITS.otpSendByPhone("+919876543210").limit).toBeLessThanOrEqual(5);
  });
});
