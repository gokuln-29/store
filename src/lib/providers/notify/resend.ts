import type { EmailProvider } from "./types";

/** Resend (https://resend.com) over its REST API. Requires RESEND_API_KEY and EMAIL_FROM. */
export function createResendProvider(config: {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}): EmailProvider {
  const doFetch = config.fetch ?? fetch;
  return {
    name: "resend",
    async send({ to, subject, html, text }) {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 300)}`);
      }
    },
  };
}
