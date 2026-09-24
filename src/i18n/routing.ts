import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ta", "kn"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});
