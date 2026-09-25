import { z } from "./zod";
import { locales } from "@/i18n/routing";
import { requiredLocalizedSchema } from "./common";

const base64url = z
  .string()
  .min(8)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+=*$/);

/** A browser PushSubscription (from `subscription.toJSON()`) plus the customer's choices. */
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(1000)
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }),
  keys: z.object({ p256dh: base64url, auth: base64url }),
  orderUpdates: z.boolean(),
  offers: z.boolean(),
  locale: z.enum(locales),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

export const pushPreferencesSchema = pushSubscriptionSchema.pick({
  endpoint: true,
  orderUpdates: true,
  offers: true,
});
export type PushPreferencesInput = z.input<typeof pushPreferencesSchema>;

function maxPerLocale(max: number) {
  return (value: Record<string, string>, ctx: z.RefinementCtx) => {
    for (const [locale, text] of Object.entries(value)) {
      if (text.length > max) ctx.addIssue({ code: "custom", message: "tooLong", path: [locale] });
    }
  };
}

export const pushCampaignSchema = z.object({
  title: requiredLocalizedSchema("en").superRefine(maxPerLocale(60)),
  body: requiredLocalizedSchema("en").superRefine(maxPerLocale(180)),
  /** Uploaded image: a local upload path or an https URL. */
  imageUrl: z
    .string()
    .trim()
    .max(500, "tooLong")
    .refine((v) => v === "" || v.startsWith("/uploads/") || /^https:\/\/\S+$/.test(v), "urlInvalid")
    .transform((v) => v || null),
  /** Page on this store to open, e.g. "/c/sweets" (the customer's language is added). */
  url: z
    .string()
    .trim()
    .max(300, "tooLong")
    .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")), "pathInvalid")
    .transform((v) => v || null),
});
export type PushCampaignInput = z.input<typeof pushCampaignSchema>;
