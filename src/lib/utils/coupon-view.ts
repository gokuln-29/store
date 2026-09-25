import type { Coupon } from "@/generated/prisma/client";
import { toDateInput } from "@/lib/utils/content-view";
import { paiseToRupeeInput } from "@/lib/utils/money";
import type { CouponFormInput } from "@/lib/validators/coupons";

/** Form values for a stored coupon (or a new one). */
export function couponFormDefaults(c: Coupon | null): CouponFormInput {
  const description = (c?.description ?? {}) as Record<string, string>;
  return {
    code: c?.code ?? "",
    description,
    type: c?.type ?? "PERCENTAGE",
    percent: c?.type === "PERCENTAGE" ? String(c.value / 100) : "",
    amount: c?.type === "FLAT" ? paiseToRupeeInput(c.value) : "",
    minCartValue: paiseToRupeeInput(c?.minCartValue),
    maxDiscount: paiseToRupeeInput(c?.maxDiscount),
    usageLimit: c?.usageLimit != null ? String(c.usageLimit) : "",
    perUserLimit: c?.perUserLimit != null ? String(c.perUserLimit) : "",
    startsAt: toDateInput(c?.startsAt ?? null),
    endsAt: toDateInput(c?.endsAt ?? null),
    isActive: c?.isActive ?? true,
    categoryIds: c?.categoryIds ?? [],
    productIds: c?.productIds ?? [],
  };
}

/** Flat, indented category list for checkboxes. */
export function categoryOptions(
  rows: { id: string; name: unknown; parentId: string | null }[],
  label: (name: unknown) => string,
) {
  const children = new Map<string | null, typeof rows>();
  for (const r of rows) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r]);
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const r of children.get(parent) ?? []) {
      out.push({ id: r.id, label: label(r.name), depth });
      if (depth < 5) walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
