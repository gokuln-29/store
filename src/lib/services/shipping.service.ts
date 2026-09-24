import type { ShippingRule } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type ShippingRuleLike = Pick<
  ShippingRule,
  | "id"
  | "name"
  | "isActive"
  | "priority"
  | "pincodePrefixes"
  | "stateCodes"
  | "rateType"
  | "flatRate"
  | "baseWeightGrams"
  | "baseRate"
  | "additionalWeightGrams"
  | "additionalRate"
  | "freeShippingThreshold"
  | "estimatedDaysMin"
  | "estimatedDaysMax"
  | "codAvailable"
>;

export type ShippingQuote = {
  ruleId: string;
  /** paise; 0 when free */
  charge: number;
  isFree: boolean;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  codAvailable: boolean;
};

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

/**
 * Picks the first active rule (highest priority first) matching the destination.
 * A rule matches by pincode prefix, or by state when the state is known.
 * A rule with neither prefixes nor states is a catch-all.
 */
export function matchRule<R extends ShippingRuleLike>(
  rules: R[],
  destination: { pincode: string; stateCode?: string | null },
): R | null {
  const sorted = rules.filter((r) => r.isActive).sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    const byPincode = rule.pincodePrefixes.some((prefix) => destination.pincode.startsWith(prefix));
    const byState =
      Boolean(destination.stateCode) && rule.stateCodes.includes(destination.stateCode!);
    const catchAll = rule.pincodePrefixes.length === 0 && rule.stateCodes.length === 0;
    if (byPincode || byState || catchAll) return rule;
  }
  return null;
}

/** Charge in paise for a rule, given the order subtotal and total weight. */
export function computeCharge(
  rule: ShippingRuleLike,
  subtotal: number,
  weightGrams: number,
): { charge: number; isFree: boolean } {
  if (rule.freeShippingThreshold != null && subtotal >= rule.freeShippingThreshold)
    return { charge: 0, isFree: true };
  if (rule.rateType === "FLAT")
    return { charge: rule.flatRate ?? 0, isFree: (rule.flatRate ?? 0) === 0 };

  const base = rule.baseRate ?? 0;
  const baseWeight = rule.baseWeightGrams ?? 0;
  const step = rule.additionalWeightGrams ?? 0;
  const extra =
    weightGrams > baseWeight && step > 0
      ? Math.ceil((weightGrams - baseWeight) / step) * (rule.additionalRate ?? 0)
      : 0;
  const charge = base + extra;
  return { charge, isFree: charge === 0 };
}

export function quote(
  rules: ShippingRuleLike[],
  input: { pincode: string; stateCode?: string | null; subtotal: number; weightGrams: number },
): ShippingQuote | null {
  const rule = matchRule(rules, input);
  if (!rule) return null;
  const { charge, isFree } = computeCharge(rule, input.subtotal, input.weightGrams);
  return {
    ruleId: rule.id,
    charge,
    isFree,
    freeShippingThreshold: rule.freeShippingThreshold,
    estimatedDaysMin: rule.estimatedDaysMin,
    estimatedDaysMax: rule.estimatedDaysMax,
    codAvailable: rule.codAvailable,
  };
}

export function getActiveShippingRules() {
  return db.shippingRule.findMany({ where: { isActive: true } });
}

/**
 * Delivery check on the product page. The state isn't known from a pincode alone, so only
 * pincode-prefix and catch-all rules apply here; state rules apply at checkout.
 */
export async function checkDelivery(input: {
  pincode: string;
  subtotal: number;
  weightGrams: number;
}) {
  return quote(await getActiveShippingRules(), { ...input, stateCode: null });
}
