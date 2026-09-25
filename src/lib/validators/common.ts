import { z } from "./zod";
import { locales } from "@/i18n/routing";
import { rupeeInputToPaise } from "@/lib/utils/money";

// Messages are keys in the "Errors" namespace.

/** Rupee amount typed by a person ("499", "1,499.50") -> integer paise. */
export const rupeesSchema = z.string().transform((value, ctx) => {
  const paise = rupeeInputToPaise(value);
  if (paise === null) {
    ctx.addIssue({ code: "custom", message: value.trim() ? "amountInvalid" : "required" });
    return z.NEVER;
  }
  return paise;
});

/** Empty -> null, otherwise rupees -> paise. */
export const optionalRupeesSchema = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  const paise = rupeeInputToPaise(value);
  if (paise === null) {
    ctx.addIssue({ code: "custom", message: "amountInvalid" });
    return z.NEVER;
  }
  return paise;
});

/** Empty string -> null; otherwise trimmed and length-checked. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => v || null);
}

/** Localized text where every language may be empty (stored as null if all are). */
/** A missing value (e.g. an editor that was never touched) counts as empty. */
const localizedValue = z.string().trim().max(10_000, "tooLong").optional();

export const optionalLocalizedSchema = z
  .partialRecord(z.enum(locales), localizedValue)
  .transform((value) => {
    const filled = Object.fromEntries(
      Object.entries(value).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return Object.keys(filled).length ? filled : null;
  });

/** Localized text that needs at least the given locale filled. */
export function requiredLocalizedSchema(requiredLocale: (typeof locales)[number] = "en") {
  return z
    .partialRecord(z.enum(locales), localizedValue)
    .superRefine((value, ctx) => {
      if (!value[requiredLocale]) {
        ctx.addIssue({ code: "custom", message: "required", path: [requiredLocale] });
      }
    })
    .transform((value) =>
      Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => Boolean(e[1]))),
    );
}

export const urlOrPathSchema = z
  .string()
  .trim()
  .max(2000, "tooLong")
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "urlInvalid")
  .transform((v) => v || null);

export const optionalUrlSchema = z
  .string()
  .trim()
  .max(500, "tooLong")
  .refine((v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+/.test(v), "urlInvalid")
  .transform((v) => v || null);

/** Whole number typed in a form field. */
export function intFromString(opts: { min?: number; max?: number } = {}) {
  return z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: trimmed ? "numberInvalid" : "required" });
      return z.NEVER;
    }
    const n = Number(trimmed);
    if ((opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max)) {
      ctx.addIssue({ code: "custom", message: "numberOutOfRange" });
      return z.NEVER;
    }
    return n;
  });
}

export function optionalIntFromString(opts: { min?: number; max?: number } = {}) {
  return z.string().transform((value, ctx) => {
    if (!value.trim()) return null;
    const parsed = intFromString(opts).safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "numberInvalid" });
      return z.NEVER;
    }
    return parsed.data;
  });
}

/** "18" or "12.5" percent -> basis points. */
export const percentToBpsSchema = z.string().transform((value, ctx) => {
  const match = /^(\d{1,2}|100)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    ctx.addIssue({ code: "custom", message: value.trim() ? "percentInvalid" : "required" });
    return z.NEVER;
  }
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (bps > 10_000) {
    ctx.addIssue({ code: "custom", message: "percentInvalid" });
    return z.NEVER;
  }
  return bps;
});
