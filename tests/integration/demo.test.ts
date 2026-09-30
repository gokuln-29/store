import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadDemo() {
  return import("@/lib/demo");
}

describe("demo mode", () => {
  it("makes only the demo admin read-only, and only when DEMO_MODE=true", async () => {
    vi.stubEnv("DEMO_ADMIN_EMAIL", "demo@example.com");
    const demoAdmin = await db.user.create({
      data: { email: "demo@example.com", role: "OWNER", passwordHash: "x" },
    });
    const owner = await db.user.create({
      data: { email: "owner@example.com", role: "OWNER", passwordHash: "x" },
    });

    vi.stubEnv("DEMO_MODE", "false");
    expect(await (await loadDemo()).isReadOnlyDemoUser(demoAdmin.id)).toBe(false);

    vi.resetModules();
    vi.stubEnv("DEMO_MODE", "true");
    const demo = await loadDemo();
    expect(await demo.isReadOnlyDemoUser(demoAdmin.id)).toBe(true);
    expect(await demo.isReadOnlyDemoUser(owner.id)).toBe(false);
  });

  it("blocks every permission that changes data, and no read permission", async () => {
    const { isWritePermission } = await loadDemo();
    for (const p of [
      "catalog:write",
      "orders:manage",
      "payments:refund",
      "settings:manage",
    ] as const)
      expect(isWritePermission(p)).toBe(true);
    for (const p of ["admin:access", "catalog:read", "orders:read", "reports:read"] as const)
      expect(isWritePermission(p)).toBe(false);
  });
});
