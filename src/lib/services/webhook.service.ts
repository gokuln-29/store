import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getPaymentProviderByName } from "@/lib/providers/payment";
import {
  razorpayPaymentEntity,
  razorpayRefundEntity,
  toProviderPayment,
  toProviderRefund,
} from "@/lib/providers/payment/razorpay";
import { verifyRazorpayWebhookSignature } from "@/lib/providers/payment/signature";
import { applyRefundUpdate, markPaymentCaptured, markPaymentFailed } from "./payment.service";

const PROVIDER = "razorpay";

const webhookSchema = z.object({
  event: z.string().min(1).max(100),
  payload: z.object({
    payment: z.object({ entity: razorpayPaymentEntity }).optional(),
    refund: z.object({ entity: razorpayRefundEntity }).optional(),
  }),
});
type RazorpayWebhook = z.infer<typeof webhookSchema>;

export type WebhookResult = {
  /** HTTP status for the provider: 2xx = done, 4xx = don't retry, 5xx = retry later. */
  status: 200 | 400 | 401 | 500;
  result: "processed" | "duplicate" | "ignored" | "invalid_signature" | "invalid_payload" | "error";
};

/**
 * Handles a Razorpay webhook delivery. Deliveries are at-least-once, so every event is stored
 * by its id and processed once; replays return 200 without changing anything.
 */
export async function handleRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
  eventId: string | null;
}): Promise<WebhookResult> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!verifyRazorpayWebhookSignature(secret, input.rawBody, input.signature)) {
    return { status: 401, result: "invalid_signature" };
  }

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, result: "invalid_payload" };
  }
  const parsed = webhookSchema.safeParse(json);
  if (!parsed.success) return { status: 400, result: "invalid_payload" };

  const eventId =
    (input.eventId?.trim() || null)?.slice(0, 100) ??
    `sha256:${createHash("sha256").update(input.rawBody).digest("hex")}`;

  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventId: { provider: PROVIDER, eventId } },
    select: { id: true, processedAt: true },
  });
  if (existing?.processedAt) return { status: 200, result: "duplicate" };

  let recordId = existing?.id;
  if (!recordId) {
    try {
      recordId = (
        await db.webhookEvent.create({
          data: {
            provider: PROVIDER,
            eventId,
            type: parsed.data.event,
            payload: json as Prisma.InputJsonValue,
          },
          select: { id: true },
        })
      ).id;
    } catch (error) {
      // The same event is being handled by a concurrent delivery.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: 200, result: "duplicate" };
      }
      throw error;
    }
  }

  try {
    const handled = await dispatch(parsed.data);
    await db.webhookEvent.update({
      where: { id: recordId },
      data: { processedAt: new Date(), error: handled ? null : "ignored" },
    });
    return { status: 200, result: handled ? "processed" : "ignored" };
  } catch (error) {
    console.error(`[webhook] razorpay ${parsed.data.event} ${eventId} failed`, error);
    await db.webhookEvent.update({
      where: { id: recordId },
      data: { error: String((error as Error).message ?? error).slice(0, 1000) },
    });
    return { status: 500, result: "error" };
  }
}

/** Returns false for events we don't act on. */
async function dispatch(webhook: RazorpayWebhook): Promise<boolean> {
  const payment = webhook.payload.payment?.entity;
  const refund = webhook.payload.refund?.entity;

  switch (webhook.event) {
    case "payment.captured": {
      if (!payment?.order_id) return false;
      const result = await markPaymentCaptured({
        providerOrderId: payment.order_id,
        providerPaymentId: payment.id,
        amount: payment.amount,
        method: payment.method ?? null,
      });
      return result.outcome !== "not_found";
    }
    case "payment.authorized": {
      // Only needed when auto-capture is off. Uncaptured payments on orders that are no longer
      // waiting are voided and returned by Razorpay automatically.
      if (!payment?.order_id) return false;
      const stored = await db.payment.findUnique({
        where: { providerOrderId: payment.order_id },
        select: { provider: true, order: { select: { status: true } } },
      });
      if (!stored || stored.order.status !== "PENDING_PAYMENT") return false;
      const captured = await getPaymentProviderByName(stored.provider).capturePayment(
        payment.id,
        payment.amount,
      );
      const p = toProviderPayment({ ...payment, status: captured.status });
      if (p.status !== "captured") return false;
      await markPaymentCaptured({
        providerOrderId: payment.order_id,
        providerPaymentId: p.id,
        amount: p.amount,
        method: p.method,
      });
      return true;
    }
    case "payment.failed": {
      if (!payment?.order_id) return false;
      const result = await markPaymentFailed({
        providerOrderId: payment.order_id,
        providerPaymentId: payment.id,
        reason: payment.error_description ?? null,
      });
      return result !== "not_found";
    }
    case "refund.processed":
    case "refund.failed": {
      if (!refund) return false;
      return (await applyRefundUpdate(toProviderRefund(refund))) !== null;
    }
    default:
      return false;
  }
}
