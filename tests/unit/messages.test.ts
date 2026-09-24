import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import kn from "@/messages/kn.json";
import ta from "@/messages/ta.json";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n", () => {
  it("supports en, ta and kn with en as default", () => {
    expect(routing.locales).toEqual(["en", "ta", "kn"]);
    expect(routing.defaultLocale).toBe("en");
  });

  it.each([
    ["ta", ta],
    ["kn", kn],
  ])("%s has exactly the same keys as en", (_locale, messages) => {
    expect(flattenKeys(messages).sort()).toEqual(flattenKeys(en).sort());
  });
});
