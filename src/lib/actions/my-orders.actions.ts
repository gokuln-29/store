"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth-guards";
import type { CartItemInput } from "@/lib/services/cart.service";
import { db } from "@/lib/db";
import { changeOrderStatus, reorderItems } from "@/lib/services/order.service";
import { customerCancelSchema, type CustomerCancelInput } from "@/lib/validators/orders";
import { invalid, type ActionResult } from "./result";

const UNAUTHORIZED: ActionResult<never> = { ok: false, error: "unauthorized" };

/** A customer cancels their own order (only before it is packed). */
export async function cancelMyOrderAction(
  input: CustomerCancelInput,
): Promise<ActionResult<{ refunded: boolean }>> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  const parsed = customerCancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const order = await db.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, userId: user.id },
    select: { id: true },
  });
  if (!order) return { ok: false, error: "not_found" };
  const result = await changeOrderStatus({
    orderId: order.id,
    to: "CANCELLED",
    actor: { type: "customer", id: user.id },
    note: parsed.data.reason,
  });
  revalidatePath("/[locale]/account", "layout");
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "invalid_transition" ? "cannot_cancel" : result.error,
    };
  }
  return { ok: true, data: { refunded: result.refund?.ok === true } };
}

/** Items of a past order that are still available, to put back in the cart. */
export async function reorderAction(
  orderNumber: string,
): Promise<ActionResult<{ items: CartItemInput[]; unavailable: number }>> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  if (typeof orderNumber !== "string" || orderNumber.length > 40) {
    return { ok: false, error: "validation" };
  }
  const result = await reorderItems(orderNumber, user.id);
  if (!result) return { ok: false, error: "not_found" };
  return { ok: true, data: result };
}
