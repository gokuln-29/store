import { z } from "./zod";
import { optionalText } from "./common";

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);

const orderId = z.string().min(1).max(64);

/** Empty → null; otherwise an http(s) URL (courier tracking page). */
const trackingUrl = z
  .string()
  .trim()
  .max(500, "tooLong")
  .transform((v) => v || null)
  .refine((v) => {
    if (v === null) return true;
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "urlInvalid");

export const trackingSchema = z.object({
  courierName: optionalText(60),
  trackingNumber: optionalText(60),
  trackingUrl,
});
export type TrackingInput = z.input<typeof trackingSchema>;

export const statusChangeSchema = z.object({
  orderId,
  to: orderStatusSchema,
  /** The status the page showed, so a stale page can't act twice. */
  expectedStatus: orderStatusSchema,
  note: optionalText(300),
  tracking: trackingSchema.optional(),
  restock: z.boolean().optional(),
});
export type StatusChangeInput = z.input<typeof statusChangeSchema>;

export const trackingUpdateSchema = trackingSchema.extend({ orderId });
export type TrackingUpdateInput = z.input<typeof trackingUpdateSchema>;

export const orderNoteSchema = z.object({
  orderId,
  note: z.string().trim().min(1, "required").max(1000, "tooLong"),
});
export type OrderNoteInput = z.input<typeof orderNoteSchema>;

export const customerCancelSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  reason: optionalText(300),
});
export type CustomerCancelInput = z.input<typeof customerCancelSchema>;
