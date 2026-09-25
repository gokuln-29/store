import {
  optionalIntFromString,
  optionalLocalizedSchema,
  optionalRupeesSchema,
  percentToBpsSchema,
  rupeesSchema,
} from "./common";
import { z } from "./zod";

const id = z.string().min(1).max(64);

/** "YYYY-MM-DD" (India time) → start or end of that day; empty → null. */
function istDay(edge: "start" | "end") {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "dateInvalid")
    .transform((v) =>
      v ? new Date(`${v}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}+05:30`) : null,
    );
}

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,20}$/, "couponCodeInvalid"),
    description: optionalLocalizedSchema,
    type: z.enum(["PERCENTAGE", "FLAT"]),
    /** Percent off, used when type is PERCENTAGE ("10", "12.5"). */
    percent: z.string(),
    /** Rupees off, used when type is FLAT. */
    amount: z.string(),
    minCartValue: optionalRupeesSchema,
    maxDiscount: optionalRupeesSchema,
    usageLimit: optionalIntFromString({ min: 1, max: 1_000_000 }),
    perUserLimit: optionalIntFromString({ min: 1, max: 1000 }),
    startsAt: istDay("start"),
    endsAt: istDay("end"),
    isActive: z.boolean(),
    categoryIds: z.array(id).max(100),
    productIds: z.array(id).max(200),
  })
  .transform((v, ctx) => {
    const parsed =
      v.type === "PERCENTAGE"
        ? percentToBpsSchema.safeParse(v.percent)
        : rupeesSchema.safeParse(v.amount);
    const field = v.type === "PERCENTAGE" ? "percent" : "amount";
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: parsed.error.issues[0]?.message ?? "invalid",
      });
      return z.NEVER;
    }
    if (parsed.data <= 0) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: v.type === "PERCENTAGE" ? "percentInvalid" : "amountInvalid",
      });
      return z.NEVER;
    }
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "maxBelowMin" });
      return z.NEVER;
    }
    return {
      code: v.code,
      description: v.description,
      type: v.type,
      value: parsed.data,
      minCartValue: v.minCartValue,
      // A cap only makes sense for percentage discounts.
      maxDiscount: v.type === "PERCENTAGE" ? v.maxDiscount : null,
      usageLimit: v.usageLimit,
      perUserLimit: v.perUserLimit,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      isActive: v.isActive,
      categoryIds: [...new Set(v.categoryIds)],
      productIds: [...new Set(v.productIds)],
    };
  });
export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponData = z.output<typeof couponFormSchema>;
