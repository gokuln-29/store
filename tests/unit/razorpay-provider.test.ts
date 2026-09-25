import { describe, expect, it } from "vitest";
import { createRazorpayProvider } from "@/lib/providers/payment/razorpay";
import { PaymentProviderError } from "@/lib/providers/payment/types";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fakeFetch(respond: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const { status = 200, json } = respond(call);
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const customer = { name: "Asha", phone: "+919876543210", email: null };

describe("Razorpay provider", () => {
  it("creates an order for the server-side amount with basic auth", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ json: { id: "order_1", amount: 30900 } }));
    const rp = createRazorpayProvider({ keyId: "rzp_test_k", keySecret: "s", fetch: fetchImpl });
    const session = await rp.createPayment({
      orderId: "o1",
      orderNumber: "DS-1001",
      amount: 30900,
      currency: "INR",
      customer,
    });
    expect(session).toEqual({
      provider: "razorpay",
      providerOrderId: "order_1",
      next: { type: "client" },
    });
    expect(calls[0]).toMatchObject({
      url: "https://api.razorpay.com/v1/orders",
      method: "POST",
      body: { amount: 30900, currency: "INR", receipt: "DS-1001" },
    });
    expect(calls[0]!.headers.Authorization).toBe(
      `Basic ${Buffer.from("rzp_test_k:s").toString("base64")}`,
    );
  });

  it("rejects an order whose amount doesn't match", async () => {
    const { fetchImpl } = fakeFetch(() => ({ json: { id: "order_1", amount: 1 } }));
    const rp = createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: fetchImpl });
    await expect(
      rp.createPayment({ orderId: "o", orderNumber: "N", amount: 500, currency: "INR", customer }),
    ).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("turns API errors, bad responses and network failures into PaymentProviderError", async () => {
    const apiError = fakeFetch(() => ({
      status: 400,
      json: { error: { code: "BAD_REQUEST_ERROR", description: "The amount is invalid" } },
    }));
    const rp = createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: apiError.fetchImpl });
    await expect(rp.getPayment("pay_1")).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "BAD_REQUEST_ERROR",
    });

    const garbage = fakeFetch(() => ({ json: { unexpected: true } }));
    await expect(
      createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: garbage.fetchImpl }).getPayment(
        "pay_1",
      ),
    ).rejects.toBeInstanceOf(PaymentProviderError);

    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: down }).getPayment("pay_1"),
    ).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("maps payments and refunds, sending our refund id as the receipt", async () => {
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.url.endsWith("/refund")
        ? {
            json: {
              id: "rfnd_1",
              payment_id: "pay_1",
              amount: 5000,
              status: "pending",
              receipt: "ref_ours",
            },
          }
        : {
            json: {
              items: [
                {
                  id: "pay_1",
                  order_id: "order_1",
                  status: "captured",
                  amount: 30900,
                  method: "upi",
                  error_description: null,
                },
              ],
            },
          },
    );
    const rp = createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: fetchImpl });
    expect(await rp.listOrderPayments("order_1")).toEqual([
      {
        id: "pay_1",
        providerOrderId: "order_1",
        status: "captured",
        amount: 30900,
        method: "upi",
        errorDescription: null,
      },
    ]);
    expect(
      await rp.refund({ providerPaymentId: "pay_1", amount: 5000, receipt: "ref_ours" }),
    ).toEqual({
      id: "rfnd_1",
      providerPaymentId: "pay_1",
      amount: 5000,
      status: "pending",
      receipt: "ref_ours",
    });
    expect(calls[1]).toMatchObject({
      url: "https://api.razorpay.com/v1/payments/pay_1/refund",
      body: { amount: 5000, receipt: "ref_ours" },
    });
  });

  it("escapes ids in URLs", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({
      json: { id: "x", status: "captured", amount: 1 },
    }));
    const rp = createRazorpayProvider({ keyId: "k", keySecret: "s", fetch: fetchImpl });
    await rp.getPayment("../orders");
    expect(calls[0]!.url).toBe("https://api.razorpay.com/v1/payments/..%2Forders");
  });
});
