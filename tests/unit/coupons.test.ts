import { describe, expect, it } from "vitest";
import { couponState } from "@/lib/services/coupon.service";
import { couponFormSchema, type CouponFormInput } from "@/lib/validators/coupons";

const base: CouponFormInput = {
  code: " diwali20 ",
  description: {},
  type: "PERCENTAGE",
  percent: "12.5",
  amount: "",
  minCartValue: "499",
  maxDiscount: "150",
  usageLimit: "",
  perUserLimit: "1",
  startsAt: "2026-10-20",
  endsAt: "2026-10-25",
  isActive: true,
  categoryIds: ["c1", "c1"],
  productIds: [],
};

describe("coupon form", () => {
  it("normalises code, converts percent to basis points and dates to India time", () => {
    const c = couponFormSchema.parse(base);
    expect(c).toMatchObject({
      code: "DIWALI20",
      type: "PERCENTAGE",
      value: 1250,
      minCartValue: 49900,
      maxDiscount: 15000,
      usageLimit: null,
      perUserLimit: 1,
      categoryIds: ["c1"],
    });
    expect(c.startsAt!.toISOString()).toBe("2026-10-19T18:30:00.000Z"); // 00:00 IST
    expect(c.endsAt!.toISOString()).toBe("2026-10-25T18:29:59.999Z"); // end of day IST
  });

  it("uses rupees for fixed discounts and drops the cap", () => {
    const c = couponFormSchema.parse({ ...base, type: "FLAT", amount: "100", percent: "" });
    expect(c).toMatchObject({ type: "FLAT", value: 10000, maxDiscount: null });
  });

  it("rejects bad codes, zero or impossible discounts and reversed dates", () => {
    const issues = (input: Partial<CouponFormInput>) =>
      (couponFormSchema.safeParse({ ...base, ...input }).error?.issues ?? []).map((i) => [
        i.path.join("."),
        i.message,
      ]);
    expect(issues({ code: "a b" })).toEqual([["code", "couponCodeInvalid"]]);
    expect(issues({ percent: "0" })).toEqual([["percent", "percentInvalid"]]);
    expect(issues({ percent: "150" })).toEqual([["percent", "percentInvalid"]]);
    expect(issues({ type: "FLAT", amount: "" })).toEqual([["amount", "required"]]);
    expect(issues({ endsAt: "2026-10-01" })).toEqual([["endsAt", "maxBelowMin"]]);
  });
});

describe("coupon state", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  const c = { isActive: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 };
  it("reports why a coupon can't be used", () => {
    expect(couponState(c, now)).toBe("active");
    expect(couponState({ ...c, isActive: false }, now)).toBe("disabled");
    expect(couponState({ ...c, endsAt: new Date("2026-10-21T00:00:00Z") }, now)).toBe("expired");
    expect(couponState({ ...c, startsAt: new Date("2026-10-23T00:00:00Z") }, now)).toBe(
      "scheduled",
    );
    expect(couponState({ ...c, usageLimit: 5, usedCount: 5 }, now)).toBe("used_up");
  });
});
