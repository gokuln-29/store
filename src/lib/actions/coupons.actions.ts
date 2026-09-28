"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import {
  deleteCoupon,
  saveCoupon,
  searchProductsForPicker,
  setCouponActive,
} from "@/lib/services/coupon.service";
import { couponFormSchema, type CouponFormInput } from "@/lib/validators/coupons";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };
const idSchema = z.string().min(1).max(64);

function revalidateCoupons() {
  revalidatePath("/[locale]/admin/(panel)/coupons", "layout");
}

export async function saveCouponAction(
  id: string | null,
  input: CouponFormInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("coupons:manage");
  if (!user) return FORBIDDEN;
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const parsed = couponFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await saveCoupon(id, parsed.data, user.id);
  if (!result.ok) {
    return result.error === "couponCodeTaken"
      ? { ok: false, error: "validation", fieldErrors: { code: "couponCodeTaken" } }
      : { ok: false, error: result.error };
  }
  revalidateCoupons();
  return { ok: true, data: { id: result.id } };
}

export async function setCouponActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await authorize("coupons:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean")
    return { ok: false, error: "validation" };
  if (!(await setCouponActive(id, isActive, user.id))) return { ok: false, error: "not_found" };
  revalidateCoupons();
  return { ok: true, data: undefined };
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  const user = await authorize("coupons:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const result = await deleteCoupon(id, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateCoupons();
  return { ok: true, data: undefined };
}

export async function searchCouponProductsAction(
  q: string,
): Promise<ActionResult<{ id: string; name: unknown; slug: string }[]>> {
  const user = await authorize("coupons:manage");
  if (!user) return FORBIDDEN;
  const parsed = z.string().max(100).safeParse(q);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await searchProductsForPicker(parsed.data.trim()) };
}
