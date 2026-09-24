/** Money is stored as integer paise. These helpers convert only at the UI edge. */

const LOCALE_TAGS: Record<string, string> = { en: "en-IN", ta: "ta-IN", kn: "kn-IN" };

/** 49900 -> "₹499.00" (Indian digit grouping: ₹1,00,000.00). */
export function formatINR(paise: number, locale = "en", opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? paise % 100 !== 0;
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? "en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
    // Keep Latin digits in all locales so prices are easy to read and compare.
    numberingSystem: "latn",
  }).format(paise / 100);
}

/** 49900 -> "499", 49950 -> "499.50" (for input fields). */
export function paiseToRupeeInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

/**
 * "499" / "499.5" / "1,499.00" / "₹ 499" -> paise, or null if not a valid amount.
 * Parses the string directly so there is no floating-point rounding.
 */
export function rupeeInputToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? "").padEnd(2, "0"));
  return rupees * 100 + paise;
}

/** 1800 -> "18%", 1250 -> "12.5%" */
export function formatBps(bps: number): string {
  return `${bps / 100}%`;
}
