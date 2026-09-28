import { describe, expect, it } from "vitest";
import { PermanentDeliveryError } from "@/lib/providers/notify";
import { createMsg91Provider } from "@/lib/providers/notify/msg91";

type Call = { url: string; headers: Record<string, string>; body: unknown };

function fakeFetch(respond: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call: Call = {
      url,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const { status = 200, json } = respond(call);
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const env = {
  MSG91_TEMPLATE_OTP: "tpl-otp",
  MSG91_TEMPLATE_ORDER_SHIPPED: "tpl-shipped-en",
  MSG91_TEMPLATE_ORDER_SHIPPED_TA: "tpl-shipped-ta",
};
const ok = () => ({ json: { type: "success", request_id: "r1" } });

describe("MSG91 provider", () => {
  it("sends our own OTP code through the OTP API", async () => {
    const { calls, fetchImpl } = fakeFetch(ok);
    const sms = createMsg91Provider({ authKey: "key", env, fetch: fetchImpl });
    await sms.sendOtp({ to: "+919876543210", code: "482913", locale: "kn", expiresInMinutes: 5 });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/api/v5/otp");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      template_id: "tpl-otp", // no Kannada template: falls back to the English one
      mobile: "919876543210",
      otp: "482913",
      otp_expiry: "5",
    });
    expect(calls[0]!.headers.authkey).toBe("key");
  });

  it("sends order updates with the template for the customer's language", async () => {
    const { calls, fetchImpl } = fakeFetch(ok);
    const sms = createMsg91Provider({ authKey: "key", env, fetch: fetchImpl });
    const params = { orderNumber: "DS-1001", total: "₹309.00", storeName: "Demo Store" };
    await sms.sendMessage({
      to: "+919876543210",
      template: "order_shipped",
      params,
      locale: "ta",
      text: "…",
    });

    expect(calls[0]!.url).toBe("https://control.msg91.com/api/v5/flow");
    expect(calls[0]!.body).toEqual({
      template_id: "tpl-shipped-ta",
      short_url: "0",
      recipients: [{ mobiles: "919876543210", ...params }],
    });
  });

  it("gives up at once when a message type has no template", async () => {
    const { calls, fetchImpl } = fakeFetch(ok);
    const sms = createMsg91Provider({ authKey: "key", env, fetch: fetchImpl });
    const send = sms.sendMessage({
      to: "+919876543210",
      template: "order_delivered",
      params: {},
      locale: "en",
      text: "…",
    });
    await expect(send).rejects.toThrow(PermanentDeliveryError);
    await expect(send).rejects.toThrow("MSG91_TEMPLATE_ORDER_DELIVERED");
    expect(calls).toHaveLength(0);
  });

  it("treats {type: error} with HTTP 200 as a failure, and 4xx as permanent", async () => {
    const soft = fakeFetch(() => ({ json: { type: "error", message: "Invalid template" } }));
    const sms = createMsg91Provider({ authKey: "key", env, fetch: soft.fetchImpl });
    const otp = { to: "+919876543210", code: "1", locale: "en", expiresInMinutes: 5 };
    const failure = sms.sendOtp(otp);
    await expect(failure).rejects.toThrow("Invalid template");
    await expect(failure).rejects.not.toBeInstanceOf(PermanentDeliveryError);

    const rejected = fakeFetch(() => ({
      status: 401,
      json: { type: "error", message: "Bad authkey" },
    }));
    const bad = createMsg91Provider({ authKey: "x", env, fetch: rejected.fetchImpl });
    await expect(bad.sendOtp(otp)).rejects.toBeInstanceOf(PermanentDeliveryError);
  });
});
