import { handleRazorpayWebhook } from "@/lib/services/webhook.service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Razorpay webhook. Configure in Razorpay Dashboard → Webhooks with the events
 * payment.captured, payment.failed, payment.authorized, refund.processed, refund.failed.
 * See docs/payments.md.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  // The signature covers the exact bytes sent, so read the raw body before parsing.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const { status, result } = await handleRazorpayWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    eventId: request.headers.get("x-razorpay-event-id"),
  });
  return Response.json({ result }, { status });
}
