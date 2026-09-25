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

/** Time of day in the store's timezone (India), e.g. "4:35 pm". */
export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? "en-IN", {
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
    numberingSystem: "latn",
  }).format(date);
}
