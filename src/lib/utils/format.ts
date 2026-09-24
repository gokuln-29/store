const LOCALE_TAGS: Record<string, string> = { en: "en-IN", ta: "ta-IN", kn: "kn-IN" };

/** Date + time in the store's timezone (India). */
export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
    numberingSystem: "latn",
  }).format(date);
}
