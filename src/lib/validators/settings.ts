import { FEATURES, type Feature } from "@/lib/features";
import { z } from "./zod";
import { locales } from "@/i18n/routing";
import { STORE_FONT_NAMES } from "@/lib/constants/fonts";
import { INDIAN_STATE_CODES } from "@/lib/constants/indian-states";
import { HEX_COLOR } from "@/lib/utils/color";
import { emailSchema, indianMobileSchema } from "./auth";
import {
  intFromString,
  optionalIntFromString,
  optionalLocalizedSchema,
  optionalRupeesSchema,
  optionalText,
  optionalUrlSchema,
  percentToBpsSchema,
  rupeesSchema,
  urlOrPathSchema,
} from "./common";

const localeEnum = z.enum(locales);
const optionalStateCode = z
  .union([z.literal(""), z.enum(INDIAN_STATE_CODES)])
  .transform((v) => v || null);

export const generalSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(80, "tooLong"),
    tagline: optionalLocalizedSchema,
    supportedLocales: z.array(localeEnum).min(1, "localeRequired"),
    defaultLocale: localeEnum,
    minOrderValue: rupeesSchema,
    orderNumberPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z0-9]{1,6}$/.test(v), "prefixInvalid")
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (!v.supportedLocales.includes(v.defaultLocale)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultLocale"],
        message: "defaultLocaleNotSupported",
      });
    }
  });

export const brandingSettingsSchema = z.object({
  logoUrl: urlOrPathSchema,
  faviconUrl: urlOrPathSchema,
  primaryColor: z.string().regex(HEX_COLOR, "colorInvalid"),
  secondaryColor: z.string().regex(HEX_COLOR, "colorInvalid"),
  headingFont: z.enum(STORE_FONT_NAMES),
  bodyFont: z.enum(STORE_FONT_NAMES),
});

const optionalEmail = z.union([z.literal(""), emailSchema]).transform((v) => v || null);
const optionalMobile = z.union([z.literal(""), indianMobileSchema]).transform((v) => v || null);
/** Landlines and mobiles: digits, spaces, +, - and brackets. */
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[\d\s\-()]{8,20}$/.test(v), "phoneInvalidGeneric")
  .transform((v) => v || null);

export const contactSettingsSchema = z
  .object({
    contactEmail: optionalEmail,
    contactPhone: optionalPhone,
    whatsappNumber: optionalMobile,
    address: z.object({
      line1: optionalText(120),
      line2: optionalText(120),
      city: optionalText(60),
      stateCode: optionalStateCode,
      pincode: z
        .string()
        .trim()
        .refine((v) => v === "" || /^[1-9]\d{5}$/.test(v), "pincodeInvalid")
        .transform((v) => v || null),
    }),
    socialLinks: z.object({
      instagram: optionalUrlSchema,
      facebook: optionalUrlSchema,
      youtube: optionalUrlSchema,
      x: optionalUrlSchema,
    }),
  })
  .superRefine((v, ctx) => {
    const a = v.address;
    const anyFilled = [a.line1, a.line2, a.city, a.stateCode, a.pincode].some(Boolean);
    if (anyFilled) {
      for (const field of ["line1", "city", "stateCode", "pincode"] as const) {
        if (!a[field])
          ctx.addIssue({ code: "custom", path: ["address", field], message: "required" });
      }
    }
  });

/** GSTIN: 2-digit state code, 10-char PAN, entity number, "Z", checksum. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const taxSettingsSchema = z.object({
  legalName: optionalText(120),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GSTIN_PATTERN.test(v), "gstinInvalid")
    .transform((v) => v || null),
  stateCode: optionalStateCode,
  pricesIncludeTax: z.boolean(),
  defaultTaxRateBps: percentToBpsSchema,
});

export const paymentSettingsSchema = z
  .object({
    onlinePaymentsEnabled: z.boolean(),
    codEnabled: z.boolean(),
    codFee: rupeesSchema,
    codMinOrderValue: optionalRupeesSchema,
    codMaxOrderValue: optionalRupeesSchema,
    pendingOrderTtlMinutes: intFromString({ min: 5, max: 1440 }),
  })
  .superRefine((v, ctx) => {
    if (!v.onlinePaymentsEnabled && !v.codEnabled) {
      ctx.addIssue({ code: "custom", path: ["codEnabled"], message: "paymentMethodRequired" });
    }
    if (
      v.codMinOrderValue != null &&
      v.codMaxOrderValue != null &&
      v.codMaxOrderValue < v.codMinOrderValue
    ) {
      ctx.addIssue({ code: "custom", path: ["codMaxOrderValue"], message: "maxBelowMin" });
    }
  });

export const shippingRuleSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(80, "tooLong"),
    isActive: z.boolean(),
    priority: intFromString({ min: -1000, max: 1000 }),
    /** Comma/space separated pincode prefixes, e.g. "560, 600". */
    pincodePrefixes: z.string().transform((value, ctx) => {
      const parts = value.split(/[\s,]+/).filter(Boolean);
      if (parts.some((p) => !/^[1-9]\d{0,5}$/.test(p))) {
        ctx.addIssue({ code: "custom", message: "pincodePrefixInvalid" });
        return z.NEVER;
      }
      return [...new Set(parts)];
    }),
    stateCodes: z.array(z.enum(INDIAN_STATE_CODES)),
    rateType: z.enum(["FLAT", "WEIGHT_BASED"]),
    flatRate: optionalRupeesSchema,
    baseWeightGrams: optionalIntFromString({ min: 1, max: 1_000_000 }),
    baseRate: optionalRupeesSchema,
    additionalWeightGrams: optionalIntFromString({ min: 1, max: 1_000_000 }),
    additionalRate: optionalRupeesSchema,
    freeShippingThreshold: optionalRupeesSchema,
    estimatedDaysMin: optionalIntFromString({ min: 0, max: 60 }),
    estimatedDaysMax: optionalIntFromString({ min: 0, max: 60 }),
    codAvailable: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const need = (field: keyof typeof v) => {
      if (v[field] == null) ctx.addIssue({ code: "custom", path: [field], message: "required" });
    };
    if (v.rateType === "FLAT") need("flatRate");
    else
      (["baseWeightGrams", "baseRate", "additionalWeightGrams", "additionalRate"] as const).forEach(
        need,
      );
    if (
      v.estimatedDaysMin != null &&
      v.estimatedDaysMax != null &&
      v.estimatedDaysMax < v.estimatedDaysMin
    ) {
      ctx.addIssue({ code: "custom", path: ["estimatedDaysMax"], message: "maxBelowMin" });
    }
  })
  .transform((v) =>
    // Drop fields that don't apply to the chosen rate type.
    v.rateType === "FLAT"
      ? {
          ...v,
          baseWeightGrams: null,
          baseRate: null,
          additionalWeightGrams: null,
          additionalRate: null,
        }
      : { ...v, flatRate: null },
  );

export const featureSettingsSchema = z.object(
  Object.fromEntries(FEATURES.map((f) => [f, z.boolean()])) as Record<Feature, z.ZodBoolean>,
);
export type FeatureSettingsInput = z.input<typeof featureSettingsSchema>;

export type GeneralSettingsInput = z.input<typeof generalSettingsSchema>;
export type BrandingSettingsInput = z.input<typeof brandingSettingsSchema>;
export type ContactSettingsInput = z.input<typeof contactSettingsSchema>;
export type TaxSettingsInput = z.input<typeof taxSettingsSchema>;
export type PaymentSettingsInput = z.input<typeof paymentSettingsSchema>;
export type ShippingRuleInput = z.input<typeof shippingRuleSchema>;
export type ShippingRuleData = z.output<typeof shippingRuleSchema>;
