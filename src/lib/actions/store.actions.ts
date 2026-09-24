"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import {
  PINCODE_PATTERN,
  checkDelivery,
  type ShippingQuote,
} from "@/lib/services/shipping.service";
import type { ActionResult } from "./result";

const inputSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.int().min(1).max(100),
  pincode: z.string().trim().regex(PINCODE_PATTERN, "pincodeInvalid"),
});

/** Delivery estimate for one product variant. Price and weight are read from the database. */
export async function checkDeliveryAction(input: {
  variantId: string;
  quantity: number;
  pincode: string;
}): Promise<ActionResult<{ quote: ShippingQuote | null }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "validation", fieldErrors: { pincode: "pincodeInvalid" } };

  const limit = await rateLimit(
    postgresRateLimitStore,
    RATE_LIMITS.deliveryCheckByIp(await getClientIp()),
  );
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const variant = await db.productVariant.findFirst({
    where: { id: parsed.data.variantId, isActive: true, product: { status: "PUBLISHED" } },
    select: { price: true, weightGrams: true },
  });
  if (!variant) return { ok: false, error: "not_found" };

  const quote = await checkDelivery({
    pincode: parsed.data.pincode,
    subtotal: variant.price * parsed.data.quantity,
    weightGrams: (variant.weightGrams ?? 0) * parsed.data.quantity,
  });
  return { ok: true, data: { quote } };
}
