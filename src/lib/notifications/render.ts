import { createTranslator } from "next-intl";
import { z } from "zod";
import en from "@/messages/en.json";
import kn from "@/messages/kn.json";
import ta from "@/messages/ta.json";

const MESSAGES = { en, ta, kn } as const;

export const ORDER_TEMPLATES = [
  "order_placed",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "order_returned",
] as const;
export type OrderTemplate = (typeof ORDER_TEMPLATES)[number];

/** Data stored with each notification, so it can be rendered (and retried) later. */
export const orderPayloadSchema = z.object({
  storeName: z.string(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .catch("#111827"),
  orderNumber: z.string(),
  customerName: z.string(),
  total: z.string(),
  orderUrl: z.string(),
  courierName: z.string().nullish(),
  trackingNumber: z.string().nullish(),
  trackingUrl: z.string().nullish(),
  refund: z.boolean().optional(),
});
export type OrderNotificationPayload = z.infer<typeof orderPayloadSchema>;

export type RenderedNotification = {
  subject: string;
  /** Plain-text email body. */
  text: string;
  html: string;
  /** Short text for SMS / WhatsApp. */
  short: string;
  /** Web push notification text. */
  push: { title: string; body: string };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) links end up in emails. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function renderOrderNotification(
  template: OrderTemplate,
  locale: string,
  payload: OrderNotificationPayload,
): RenderedNotification {
  const lang = (locale in MESSAGES ? locale : "en") as keyof typeof MESSAGES;
  const t = createTranslator({
    locale: lang,
    messages: MESSAGES[lang] as typeof en,
    namespace: "Notifications",
  });
  const values = {
    store: payload.storeName,
    name: payload.customerName || t("customerFallback"),
    number: payload.orderNumber,
    total: payload.total,
  };

  const subject = t(`${template}.subject`, values);
  const body = t(`${template}.body`, values);
  const lines = [body];
  const trackingUrl = safeUrl(payload.trackingUrl);
  if (template === "order_shipped" && payload.trackingNumber) {
    lines.push(
      t("trackingLine", {
        courier: payload.courierName || t("courierFallback"),
        tracking: payload.trackingNumber,
      }),
    );
  }
  if (template === "order_cancelled" && payload.refund) lines.push(t("refundLine"));

  const orderUrl = safeUrl(payload.orderUrl) ?? payload.orderUrl;
  const text = [
    t("greeting", values),
    "",
    ...lines,
    "",
    ...(trackingUrl ? [`${t("trackParcel")}: ${trackingUrl}`] : []),
    `${t("viewOrder")}: ${orderUrl}`,
    "",
    t("footer", values),
  ].join("\n");

  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;${
      primary
        ? `background:${payload.brandColor};color:#ffffff`
        : `border:1px solid ${payload.brandColor};color:${payload.brandColor}`
    }">${escapeHtml(label)}</a>`;

  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:'Noto Sans','Noto Sans Tamil','Noto Sans Kannada',Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px">
<tr><td style="padding:24px">
<p style="margin:0 0 16px;font-size:18px;font-weight:700">${escapeHtml(payload.storeName)}</p>
<p style="margin:0 0 12px">${escapeHtml(t("greeting", values))}</p>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:20px 0">${button(orderUrl, t("viewOrder"), true)}${trackingUrl ? button(trackingUrl, t("trackParcel"), false) : ""}</p>
<p style="margin:16px 0 0;font-size:12px;color:#71717a">${escapeHtml(t("footer", values))}</p>
</td></tr></table></td></tr></table></body></html>`;

  const short = [t(`${template}.sms`, values), trackingUrl ?? orderUrl].join(" ");
  return { subject, text, html, short, push: { title: subject, body: lines.join(" ") } };
}
