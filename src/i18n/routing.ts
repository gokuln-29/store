import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ta", "kn"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
  // Remember the chosen language for a year (next-intl's default is a session cookie).
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
