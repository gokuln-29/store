import { describe, expect, it } from "vitest";
import { formatIndianMobile, maskIndianMobile, normalizeIndianMobile } from "@/lib/utils/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(["", "12345", "5876543210", "+1 9876543210", "98765432101", "abcdefghij"])(
    "rejects %s",
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );

  it("formats and masks", () => {
    expect(formatIndianMobile("+919876543210")).toBe("+91 98765 43210");
    expect(maskIndianMobile("+919876543210")).toBe("+91 ••••• •3210");
  });
});
