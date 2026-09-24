import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyStaffCredentials } from "@/lib/services/auth.service";
import {
  changeOwnPassword,
  createStaff,
  listStaff,
  resetStaffPassword,
  setStaffActive,
  setStaffRole,
} from "@/lib/services/staff.service";

async function makeOwner(email = "owner@test.dev") {
  const result = await createStaff(
    { name: "Owner", email, role: "OWNER", password: "OwnerPass@123" },
    null as unknown as string,
  );
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

describe("staff service", () => {
  it("creates staff who can sign in with their password", async () => {
    const ownerId = await makeOwner();
    const result = await createStaff(
      { name: "Ravi", email: "ravi@test.dev", role: "STAFF", password: "StaffPass@123" },
      ownerId,
    );
    expect(result.ok).toBe(true);
    const user = await verifyStaffCredentials("ravi@test.dev", "StaffPass@123");
    expect(user?.role).toBe("STAFF");
    expect(await verifyStaffCredentials("ravi@test.dev", "wrong-password")).toBeNull();
  });

  it("rejects duplicate emails", async () => {
    const ownerId = await makeOwner();
    const dup = await createStaff(
      { name: "X", email: "owner@test.dev", role: "STAFF", password: "Whatever@123" },
      ownerId,
    );
    expect(dup).toEqual({ ok: false, error: "email_taken" });
  });

  it("never leaves the store without an active owner", async () => {
    const ownerA = await makeOwner("a@test.dev");
    const ownerB = await makeOwner("b@test.dev");
    expect(await setStaffActive(ownerB, false, ownerA)).toEqual({ ok: true, data: undefined });
    // Now A is the only active owner; B (inactive) cannot demote/deactivate A... and A can't change self.
    expect(await setStaffActive(ownerA, false, ownerA)).toEqual({
      ok: false,
      error: "cannot_change_self",
    });
    await db.user.update({ where: { id: ownerB }, data: { isActive: true, role: "STAFF" } });
    expect(await setStaffRole(ownerA, "STAFF", ownerB)).toEqual({ ok: false, error: "last_owner" });
    expect(await setStaffActive(ownerA, false, ownerB)).toEqual({ ok: false, error: "last_owner" });
  });

  it("deactivation and password reset end existing sessions", async () => {
    const ownerId = await makeOwner();
    const staff = await createStaff(
      { name: "S", email: "s@test.dev", role: "STAFF", password: "StaffPass@123" },
      ownerId,
    );
    if (!staff.ok) throw new Error();
    const before = (await db.user.findUniqueOrThrow({ where: { id: staff.data.id } }))
      .sessionVersion;

    await setStaffActive(staff.data.id, false, ownerId);
    const deactivated = await db.user.findUniqueOrThrow({ where: { id: staff.data.id } });
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.sessionVersion).toBe(before + 1);
    expect(await verifyStaffCredentials("s@test.dev", "StaffPass@123")).toBeNull();

    await setStaffActive(staff.data.id, true, ownerId);
    await resetStaffPassword(staff.data.id, "NewStaffPass@1", ownerId);
    const reset = await db.user.findUniqueOrThrow({ where: { id: staff.data.id } });
    expect(await verify(reset.passwordHash!, "NewStaffPass@1")).toBe(true);
    expect(reset.sessionVersion).toBe(before + 2);
  });

  it("changing your own password requires the current one", async () => {
    const ownerId = await makeOwner();
    expect(await changeOwnPassword(ownerId, "wrong", "Another@12345")).toEqual({
      ok: false,
      error: "wrong_password",
    });
    expect(await changeOwnPassword(ownerId, "OwnerPass@123", "Another@12345")).toEqual({
      ok: true,
    });
    expect(await verifyStaffCredentials("owner@test.dev", "Another@12345")).not.toBeNull();
  });

  it("lists only staff accounts, with search and sorting", async () => {
    const ownerId = await makeOwner();
    await createStaff(
      { name: "Zara", email: "zara@test.dev", role: "STAFF", password: "StaffPass@123" },
      ownerId,
    );
    await db.user.create({ data: { phone: "+919876543210", role: "CUSTOMER" } });

    const all = await listStaff({ page: 1, pageSize: 20, sort: "name", dir: "asc" });
    expect(all.total).toBe(2);
    expect(all.rows.map((r) => r.name)).toEqual(["Owner", "Zara"]);
    const search = await listStaff({
      page: 1,
      pageSize: 20,
      q: "ZAR",
      sort: "createdAt",
      dir: "desc",
    });
    expect(search.rows.map((r) => r.email)).toEqual(["zara@test.dev"]);
  });
});
