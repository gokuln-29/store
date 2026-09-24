import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("test database", () => {
  it("is empty and isolated for each test", async () => {
    expect(await db.user.count()).toBe(0);
    await db.user.create({ data: { email: "a@example.com" } });
    expect(await db.user.count()).toBe(1);
  });

  it("starts clean again", async () => {
    expect(await db.user.count()).toBe(0);
  });
});
