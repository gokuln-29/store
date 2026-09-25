import { z } from "./zod";
import { locales } from "@/i18n/routing";
import { INDIAN_STATE_CODES } from "@/lib/constants/indian-states";
import { normalizeIndianMobile } from "@/lib/utils/phone";

// Error messages are keys in the "Validation" namespace of src/messages/*.json.

export const indianMobileSchema = z
  .string({ error: "required" })
  .trim()
  .min(1, "required")
  .transform((value, ctx) => {
    const normalized = normalizeIndianMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return normalized;
  });

export const emailSchema = z
  .string({ error: "required" })
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(254, "tooLong")
  .pipe(z.email({ error: "emailInvalid" }));

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "required" }).min(1, "required").max(200, "tooLong"),
});
export type AdminLoginInput = z.input<typeof adminLoginSchema>;

export const otpRequestSchema = z.object({ phone: indianMobileSchema });
export type OtpRequestInput = z.input<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: indianMobileSchema,
  code: z
    .string({ error: "required" })
    .trim()
    .regex(/^\d{6}$/, "otpInvalid"),
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "tooLong"),
  email: z.union([z.literal(""), emailSchema]).transform((v) => v || null),
  preferredLocale: z.enum(locales),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(30, "tooLong")
    .transform((v) => v || null),
  name: z.string().trim().min(1, "required").max(80, "tooLong"),
  phone: indianMobileSchema,
  line1: z.string().trim().min(1, "required").max(120, "tooLong"),
  line2: z
    .string()
    .trim()
    .max(120, "tooLong")
    .transform((v) => v || null),
  landmark: z
    .string()
    .trim()
    .max(80, "tooLong")
    .transform((v) => v || null),
  city: z.string().trim().min(1, "required").max(60, "tooLong"),
  stateCode: z.enum(INDIAN_STATE_CODES, { error: "required" }),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "pincodeInvalid"),
  isDefault: z.boolean(),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

/**
 * Blank address form values. Lives here (not in the client form component) so server
 * pages can import it: values exported from a "use client" module are only references.
 */
export const EMPTY_ADDRESS: AddressInput = {
  label: "",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  stateCode: "" as AddressInput["stateCode"],
  pincode: "",
  isDefault: false,
};

/** Only same-origin relative paths are allowed as post-login redirects. */
export function safeCallbackPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
