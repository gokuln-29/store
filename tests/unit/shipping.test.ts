import { describe, expect, it } from "vitest";
import {
  computeCharge,
  matchRule,
  quote,
  type ShippingRuleLike,
} from "@/lib/services/shipping.service";

const rule = (overrides: Partial<ShippingRuleLike>): ShippingRuleLike => ({
  id: "r",
  name: "r",
  isActive: true,
  priority: 0,
  pincodePrefixes: [],
  stateCodes: [],
  rateType: "FLAT",
  flatRate: 5000,
  baseWeightGrams: null,
  baseRate: null,
  additionalWeightGrams: null,
  additionalRate: null,
  freeShippingThreshold: null,
  estimatedDaysMin: null,
  estimatedDaysMax: null,
  codAvailable: true,
  ...overrides,
});

describe("shipping", () => {
  const local = rule({
    id: "local",
    priority: 10,
    pincodePrefixes: ["560", "600"],
    flatRate: 4000,
    freeShippingThreshold: 49900,
  });
  const kerala = rule({ id: "kerala", priority: 5, stateCodes: ["KL"], flatRate: 7000 });
  const india = rule({
    id: "india",
    priority: 0,
    rateType: "WEIGHT_BASED",
    flatRate: null,
    baseWeightGrams: 500,
    baseRate: 6000,
    additionalWeightGrams: 500,
    additionalRate: 3000,
    freeShippingThreshold: 99900,
  });
  const inactive = rule({ id: "off", priority: 100, isActive: false });
  const rules = [india, kerala, local, inactive];

  it("matches by priority: pincode prefix, then state, then catch-all", () => {
    expect(matchRule(rules, { pincode: "560001" })?.id).toBe("local");
    expect(matchRule(rules, { pincode: "682001", stateCode: "KL" })?.id).toBe("kerala");
    expect(matchRule(rules, { pincode: "682001" })?.id).toBe("india");
    expect(matchRule([local], { pincode: "110001" })).toBeNull();
  });

  it("computes flat and weight-based charges with free thresholds", () => {
    expect(computeCharge(local, 30000, 100)).toEqual({ charge: 4000, isFree: false });
    expect(computeCharge(local, 49900, 100)).toEqual({ charge: 0, isFree: true });
    expect(computeCharge(india, 1000, 400)).toEqual({ charge: 6000, isFree: false });
    expect(computeCharge(india, 1000, 500)).toEqual({ charge: 6000, isFree: false });
    expect(computeCharge(india, 1000, 501)).toEqual({ charge: 9000, isFree: false });
    expect(computeCharge(india, 1000, 1600)).toEqual({ charge: 15000, isFree: false });
  });

  it("returns a full quote", () => {
    expect(quote(rules, { pincode: "600020", subtotal: 10000, weightGrams: 200 })).toMatchObject({
      ruleId: "local",
      charge: 4000,
      freeShippingThreshold: 49900,
      codAvailable: true,
    });
  });
});
