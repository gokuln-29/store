import { describe, expect, it } from "vitest";
import { can, isRole, isStaffRole, PERMISSIONS } from "@/lib/permissions";

describe("permissions", () => {
  it("gives the owner every permission", () => {
    for (const permission of PERMISSIONS) expect(can("OWNER", permission)).toBe(true);
  });

  it("lets staff run the store but not change settings or staff", () => {
    expect(can("STAFF", "admin:access")).toBe(true);
    expect(can("STAFF", "catalog:write")).toBe(true);
    expect(can("STAFF", "orders:manage")).toBe(true);
    expect(can("STAFF", "settings:manage")).toBe(false);
    expect(can("STAFF", "staff:manage")).toBe(false);
    expect(can("STAFF", "coupons:manage")).toBe(false);
  });

  it("limits customers to their own account", () => {
    const allowed = PERMISSIONS.filter((p) => can("CUSTOMER", p));
    expect(allowed).toEqual(["account:self"]);
  });

  it("denies everything without a role", () => {
    expect(can(null, "account:self")).toBe(false);
    expect(can(undefined, "admin:access")).toBe(false);
  });

  it("recognises roles", () => {
    expect(isRole("OWNER")).toBe(true);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isStaffRole("STAFF")).toBe(true);
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });
});
