"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth-guards";
import { createRefund } from "@/lib/services/payment.service";
import { refundSchema, type RefundInput } from "@/lib/validators/payments";
import { invalid, type ActionResult } from "./result";

/** Full or partial refund of an online payment (owner only). */
export async function refundPaymentAction(
  input: RefundInput,
): Promise<ActionResult<{ status: string }>> {
  const user = await authorize("payments:refund");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await createRefund({ ...parsed.data, actorId: user.id });
  revalidatePath("/[locale]/admin/(panel)/payments", "layout");
  if (!result.ok) {
    return result.error === "amount_exceeds"
      ? { ok: false, error: "validation", fieldErrors: { amount: "amount_exceeds" } }
      : { ok: false, error: result.error };
  }
  return { ok: true, data: { status: result.status } };
}
