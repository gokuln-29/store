import { describe, expect, it } from "vitest";
import {
  contactSettingsSchema,
  generalSettingsSchema,
  paymentSettingsSchema,
  shippingRuleSchema,
  taxSettingsSchema,
} from "@/lib/validators/settings";

describe("settings validators", () => {
  it("general: converts rupees and requires default locale to be supported", () => {
    const base = {
      name: "Kaveri",
      tagline: { en: "", ta: "" },
      supportedLocales: ["en", "ta"],
      defaultLocale: "en",
      minOrderValue: "99",
    };
    const parsed = generalSettingsSchema.parse(base);
    expect(parsed.minOrderValue).toBe(9900);
    expect(parsed.tagline).toBeNull();
    expect(generalSettingsSchema.safeParse({ ...base, defaultLocale: "kn" }).success).toBe(false);
    expect(generalSettingsSchema.safeParse({ ...base, supportedLocales: [] }).success).toBe(false);
  });

  it("tax: validates GSTIN and converts percent to basis points", () => {
    const base = {
      legalName: "",
      gstNumber: "29abcde1234f1z5",
      stateCode: "KA",
      pricesIncludeTax: true,
      defaultTaxRateBps: "12.5",
    };
    const parsed = taxSettingsSchema.parse(base);
    expect(parsed.gstNumber).toBe("29ABCDE1234F1Z5");
    expect(parsed.defaultTaxRateBps).toBe(1250);
    expect(taxSettingsSchema.safeParse({ ...base, gstNumber: "29ABCDE1234F1X5" }).success).toBe(
      false,
    );
    expect(taxSettingsSchema.safeParse({ ...base, defaultTaxRateBps: "101" }).success).toBe(false);
  });

  it("payments: needs one method and max >= min", () => {
    const base = {
      onlinePaymentsEnabled: true,
      codEnabled: true,
      codFee: "49",
      codMinOrderValue: "",
      codMaxOrderValue: "",
      pendingOrderTtlMinutes: "30",
    };
    expect(paymentSettingsSchema.parse(base)).toMatchObject({
      codFee: 4900,
      codMinOrderValue: null,
    });
    expect(
      paymentSettingsSchema.safeParse({ ...base, onlinePaymentsEnabled: false, codEnabled: false })
        .success,
    ).toBe(false);
    expect(
      paymentSettingsSchema.safeParse({ ...base, codMinOrderValue: "500", codMaxOrderValue: "100" })
        .success,
    ).toBe(false);
    expect(paymentSettingsSchema.safeParse({ ...base, pendingOrderTtlMinutes: "2" }).success).toBe(
      false,
    );
  });

  it("contact: a partial address must be completed", () => {
    const base = {
      contactEmail: "",
      contactPhone: "",
      whatsappNumber: "",
      address: { line1: "", line2: "", city: "", stateCode: "", pincode: "" },
      socialLinks: { instagram: "", facebook: "", youtube: "", x: "" },
    };
    expect(contactSettingsSchema.safeParse(base).success).toBe(true);
    expect(
      contactSettingsSchema.safeParse({ ...base, address: { ...base.address, city: "Mysuru" } })
        .success,
    ).toBe(false);
    expect(
      contactSettingsSchema.safeParse({
        ...base,
        socialLinks: { ...base.socialLinks, x: "javascript:alert(1)" },
      }).success,
    ).toBe(false);
  });

  it("shipping: requires fields for the chosen rate type and clears the others", () => {
    const base = {
      name: "Local",
      isActive: true,
      priority: "10",
      pincodePrefixes: "560, 600 560",
      stateCodes: [],
      rateType: "FLAT",
      flatRate: "40",
      baseWeightGrams: "500",
      baseRate: "60",
      additionalWeightGrams: "",
      additionalRate: "",
      freeShippingThreshold: "499",
      estimatedDaysMin: "1",
      estimatedDaysMax: "3",
      codAvailable: true,
    };
    const flat = shippingRuleSchema.parse(base);
    expect(flat).toMatchObject({
      flatRate: 4000,
      baseRate: null,
      pincodePrefixes: ["560", "600"],
      freeShippingThreshold: 49900,
    });
    expect(shippingRuleSchema.safeParse({ ...base, rateType: "WEIGHT_BASED" }).success).toBe(false);
    expect(shippingRuleSchema.safeParse({ ...base, pincodePrefixes: "56A" }).success).toBe(false);
    expect(shippingRuleSchema.safeParse({ ...base, estimatedDaysMin: "5" }).success).toBe(false);
  });
});
