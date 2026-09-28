"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type en from "@/messages/en.json";

type ErrorKey = keyof (typeof en)["Errors"];

/**
 * Translates an error code/validation key from a server action or zod schema. The returned
 * function is stable across renders, so it is safe in effect dependency lists (a new function
 * per render once caused the checkout to re-quote in an endless loop).
 */
export function useErrorText() {
  const t = useTranslations("Errors");
  return useCallback(
    (key: string | undefined, values?: Record<string, string | number>) => {
      if (!key) return undefined;
      return t.has(key as ErrorKey) ? t(key as ErrorKey, values) : t("unknown");
    },
    [t],
  );
}
