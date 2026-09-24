import { z } from "zod";
import { locales } from "@/i18n/routing";

const localeEnum = z.enum(locales);

/**
 * Translatable text stored as Json, e.g. { en: "Shirt", ta: "சட்டை", kn: "ಅಂಗಿ" }.
 * At least one locale must be filled; missing locales fall back to the store default.
 */
export const localizedTextSchema = z
  .partialRecord(localeEnum, z.string().trim().max(10_000))
  .refine((value) => Object.values(value).some((text) => typeof text === "string" && text !== ""), {
    message: "At least one language is required",
  });

export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** Same as localizedTextSchema but requires a specific locale (usually the store default). */
export function localizedTextRequiring(locale: z.infer<typeof localeEnum>) {
  return localizedTextSchema.refine((value) => Boolean(value[locale]), {
    message: `Text in "${locale}" is required`,
    path: [locale],
  });
}
