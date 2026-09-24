import { describe, expect, it } from "vitest";
import { localize } from "@/lib/utils/localized";

describe("localize", () => {
  const text = { en: "Coffee", ta: "காபி" };

  it("returns the requested locale", () => {
    expect(localize(text, "ta")).toBe("காபி");
  });

  it("falls back to the default locale, then any filled locale", () => {
    expect(localize(text, "kn")).toBe("Coffee");
    expect(localize({ ta: "காபி" }, "kn", "en")).toBe("காபி");
  });

  it("handles plain strings and invalid values", () => {
    expect(localize("Coffee", "ta")).toBe("Coffee");
    expect(localize(null, "en")).toBe("");
    expect(localize(["x"], "en")).toBe("");
  });
});
