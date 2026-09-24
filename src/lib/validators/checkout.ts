import { z } from "zod";
import { addressSchema } from "./auth";

// Messages are keys in the "Errors" namespace.

export const cartItemsSchema = z
  // Quantities are clamped to stock and the per-line limit by the cart service, not rejected.
  .array(
    z.object({ variantId: z.string().min(1).max(64), quantity: z.int().min(1).max(1_000_000) }),
  )
  .max(100, "tooMany");

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(40, "tooLong")
  .transform((v) => v || null);

/** Where to deliver: a saved address of the customer, or a new one typed at checkout. */
export const checkoutAddressSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), addressId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("new"), address: addressSchema, save: z.boolean() }),
]);

export const paymentMethodSchema = z.enum(["ONLINE", "COD"]);

export const quoteInputSchema = z.object({
  items: cartItemsSchema,
  destination: z
    .object({
      pincode: z
        .string()
        .trim()
        .regex(/^[1-9]\d{5}$/),
      stateCode: z.string().length(2),
    })
    .nullable(),
  couponCode: couponCodeSchema,
  paymentMethod: paymentMethodSchema.nullable(),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

export const placeOrderSchema = z.object({
  items: cartItemsSchema.min(1, "cartEmpty"),
  address: checkoutAddressSchema,
  couponCode: couponCodeSchema,
  paymentMethod: paymentMethodSchema,
  customerEmail: z
    .union([z.literal(""), z.email({ error: "emailInvalid" })])
    .transform((v) => v || null),
  customerNote: z
    .string()
    .trim()
    .max(500, "tooLong")
    .transform((v) => v || null),
  /** Totals the customer saw; if the server total differs the order is not placed. */
  expectedTotal: z.int().nonnegative(),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
