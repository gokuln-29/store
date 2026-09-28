"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import {
  addInternalNote,
  changeOrderStatus,
  updateTracking,
  type StatusChangeResult,
} from "@/lib/services/order.service";
import {
  orderNoteSchema,
  statusChangeSchema,
  trackingUpdateSchema,
  type OrderNoteInput,
  type StatusChangeInput,
  type TrackingUpdateInput,
} from "@/lib/validators/orders";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };

function revalidateOrders() {
  revalidatePath("/[locale]/admin/(panel)/orders", "layout");
  revalidatePath("/[locale]/admin/(panel)/payments", "layout");
}

export async function changeOrderStatusAction(
  input: StatusChangeInput,
): Promise<ActionResult<Extract<StatusChangeResult, { ok: true }>>> {
  const user = await authorize("orders:manage");
  if (!user) return FORBIDDEN;
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, { nested: true });

  const result = await changeOrderStatus({
    ...parsed.data,
    actor: { type: "staff", id: user.id, canRefund: can(user.role, "payments:refund") },
  });
  revalidateOrders();
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result };
}

export async function updateTrackingAction(input: TrackingUpdateInput): Promise<ActionResult> {
  const user = await authorize("orders:manage");
  if (!user) return FORBIDDEN;
  const parsed = trackingUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, ...tracking } = parsed.data;
  const result = await updateTracking(orderId, tracking, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateOrders();
  return { ok: true, data: undefined };
}

export async function addOrderNoteAction(input: OrderNoteInput): Promise<ActionResult> {
  const user = await authorize("orders:manage");
  if (!user) return FORBIDDEN;
  const parsed = orderNoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await addInternalNote(parsed.data.orderId, parsed.data.note, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateOrders();
  return { ok: true, data: undefined };
}
