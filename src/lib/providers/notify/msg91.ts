import { PermanentDeliveryError } from "./errors";
import type { SmsProvider } from "./types";

const API = "https://control.msg91.com/api/v5";

type Env = Record<string, string | undefined>;

/**
 * MSG91 (https://msg91.com) over its REST API: login codes through the OTP API, order updates and
 * cart reminders through Flow templates. Indian SMS must use DLT-approved templates, so every
 * message type needs a template id from the MSG91 panel, set per language in the environment:
 *
 *   MSG91_TEMPLATE_OTP, MSG91_TEMPLATE_ORDER_SHIPPED, MSG91_TEMPLATE_ORDER_SHIPPED_TA, …
 *
 * A language without its own template uses the English one (the variable without a suffix).
 * Template variables are named like the message params: ##orderNumber##, ##total##, ##storeName##,
 * ##trackingNumber##, ##itemCount## (the OTP template uses MSG91's ##OTP##). See docs/sms.md.
 */
export function createMsg91Provider(config: {
  authKey: string;
  env?: Env;
  fetch?: typeof fetch;
}): SmsProvider {
  const doFetch = config.fetch ?? fetch;
  const env = config.env ?? process.env;

  function templateId(template: string, locale: string): string {
    const base = `MSG91_TEMPLATE_${template.toUpperCase()}`;
    const id = env[`${base}_${locale.toUpperCase()}`] || env[base];
    if (!id) throw new PermanentDeliveryError(`No MSG91 template configured: set ${base}`);
    return id;
  }

  /** MSG91 wants the country code without "+", e.g. 919876543210. */
  const mobile = (e164: string) => e164.replace(/^\+/, "");

  async function call(url: string, body: unknown): Promise<void> {
    const res = await doFetch(url, {
      method: "POST",
      headers: { authkey: config.authKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => "");
    let result: { type?: string; message?: string } = {};
    try {
      result = JSON.parse(text) as typeof result;
    } catch {
      // Not JSON: judged by the status code alone.
    }
    // MSG91 reports some errors with HTTP 200 and {"type":"error"}.
    if (!res.ok || result.type === "error") {
      const detail = (result.message ?? text).slice(0, 300);
      // 4xx means a problem with our request or account (bad key, template, number): retrying won't help.
      const ErrorType = res.status >= 400 && res.status < 500 ? PermanentDeliveryError : Error;
      throw new ErrorType(`MSG91 failed (${res.status}): ${detail}`);
    }
  }

  return {
    name: "msg91",
    async sendOtp({ to, code, locale, expiresInMinutes }) {
      const query = new URLSearchParams({
        template_id: templateId("otp", locale),
        mobile: mobile(to),
        otp: code,
        otp_expiry: String(expiresInMinutes),
        realTimeResponse: "1",
      });
      await call(`${API}/otp?${query}`, {});
    },
    async sendMessage({ to, template, params, locale }) {
      await call(`${API}/flow`, {
        template_id: templateId(template, locale),
        short_url: "0",
        recipients: [{ mobiles: mobile(to), ...params }],
      });
    },
  };
}
