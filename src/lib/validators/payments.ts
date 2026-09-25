import { z } from "zod";
import { optionalText, rupeesSchema } from "./common";

export const refundSchema = z.object({
  paymentId: z.string().min(1).max(64),
  /** Rupees as typed ("250.50"), converted to paise. */
  amount: rupeesSchema.refine((paise) => paise > 0, "amountInvalid"),
  reason: optionalText(200),
});
export type RefundInput = z.input<typeof refundSchema>;
