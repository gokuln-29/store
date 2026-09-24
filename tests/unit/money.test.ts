import { describe, expect, it } from "vitest";
import { formatBps, formatINR, paiseToRupeeInput, rupeeInputToPaise } from "@/lib/utils/money";

describe("money", () => {
  it("formats INR with Indian grouping and Latin digits in every locale", () => {
    expect(formatINR(49900)).toBe("₹499");
    expect(formatINR(49950)).toBe("₹499.50");
    expect(formatINR(10000000)).toBe("₹1,00,000");
    expect(formatINR(49900, "ta")).toContain("499");
    expect(formatINR(49900, "kn")).toContain("499");
  });

  it("parses typed rupees to paise without float errors", () => {
    expect(rupeeInputToPaise("499")).toBe(49900);
    expect(rupeeInputToPaise("499.5")).toBe(49950);
    expect(rupeeInputToPaise("0.1")).toBe(10);
    expect(rupeeInputToPaise("1,499.99")).toBe(149999);
    expect(rupeeInputToPaise("₹ 20")).toBe(2000);
    expect(rupeeInputToPaise("0.29")).toBe(29);
  });

  it("rejects invalid amounts", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "."])
      expect(rupeeInputToPaise(bad)).toBeNull();
  });

  it("round-trips input values", () => {
    expect(paiseToRupeeInput(49900)).toBe("499");
    expect(paiseToRupeeInput(49950)).toBe("499.50");
    expect(paiseToRupeeInput(null)).toBe("");
    expect(formatBps(1800)).toBe("18%");
    expect(formatBps(1250)).toBe("12.5%");
  });
});
