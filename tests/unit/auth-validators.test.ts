import { describe, expect, it } from "vitest";
import {
  addressSchema,
  adminLoginSchema,
  otpVerifySchema,
  profileSchema,
  safeCallbackPath,
} from "@/lib/validators/auth";

describe("auth validators", () => {
  it("normalises admin email", () => {
    expect(adminLoginSchema.parse({ email: " Owner@Example.COM ", password: "x" }).email).toBe(
      "owner@example.com",
    );
    expect(adminLoginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(
      false,
    );
  });

  it("normalises phone and requires a 6-digit code", () => {
    expect(otpVerifySchema.parse({ phone: "98765 43210", code: "123456" }).phone).toBe(
      "+919876543210",
    );
    expect(otpVerifySchema.safeParse({ phone: "9876543210", code: "12345" }).success).toBe(false);
  });

  it("treats an empty profile email as null", () => {
    expect(
      profileSchema.parse({ name: "Asha", email: "", preferredLocale: "ta" }).email,
    ).toBeNull();
  });

  it("validates addresses", () => {
    const valid = {
      label: "",
      name: "Asha",
      phone: "9876543210",
      line1: "12 MG Road",
      line2: "",
      landmark: "",
      city: "Bengaluru",
      stateCode: "KA",
      pincode: "560001",
      isDefault: false,
    };
    const parsed = addressSchema.parse(valid);
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.line2).toBeNull();
    expect(addressSchema.safeParse({ ...valid, pincode: "060001" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, stateCode: "XX" }).success).toBe(false);
  });

  it("only allows same-origin callback paths", () => {
    expect(safeCallbackPath("/en/account", "/en")).toBe("/en/account");
    expect(safeCallbackPath("https://evil.com", "/en")).toBe("/en");
    expect(safeCallbackPath("//evil.com", "/en")).toBe("/en");
    expect(safeCallbackPath("/\\evil.com", "/en")).toBe("/en");
    expect(safeCallbackPath(null, "/en")).toBe("/en");
  });
});
