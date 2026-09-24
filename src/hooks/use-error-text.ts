"use client";

import { useTranslations } from "next-intl";
import type en from "@/messages/en.json";

type ErrorKey = keyof (typeof en)["Errors"];

/** Translates an error code/validation key from a server action or zod schema. */
export function useErrorText() {
  const t = useTranslations("Errors");
  return (key: string | undefined, values?: Record<string, string | number>) => {
    if (!key) return undefined;
    return t.has(key as ErrorKey) ? t(key as ErrorKey, values) : t("unknown");
  };
}
