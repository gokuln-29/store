import type { LocalizedText } from "@/lib/validators/localized";

/**
 * Picks the text for `locale`, falling back to `fallbackLocale`, then to any filled locale.
 * Accepts the raw Prisma Json value so callers don't need to cast.
 */
export function localize(value: unknown, locale: string, fallbackLocale = "en"): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "";
  const text = value as Record<string, unknown>;
  for (const key of [locale, fallbackLocale]) {
    const candidate = text[key];
    if (typeof candidate === "string" && candidate !== "") return candidate;
  }
  const first = Object.values(text).find((v) => typeof v === "string" && v !== "");
  return typeof first === "string" ? first : "";
}

export type { LocalizedText };
