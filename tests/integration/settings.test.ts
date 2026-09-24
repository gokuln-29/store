import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  deleteShippingRule,
  getStoreSettingsFresh,
  saveShippingRule,
  updateGeneralSettings,
  updatePaymentSettings,
} from "@/lib/services/settings.service";

async function owner() {
  return db.user.create({ data: { email: "owner@test.dev", role: "OWNER" } });
}

describe("settings service", () => {
  it("returns defaults when no settings row exists", async () => {
    expect((await getStoreSettingsFresh()).name).toBe(DEFAULT_SETTINGS.name);
  });

  it("creates the singleton on first save and records an audit diff", async () => {
    const actor = await owner();
    await updateGeneralSettings(
      {
        name: "Kaveri Mart",
        tagline: { ta: "அன்றாடத் தேவைகள்" },
        supportedLocales: ["en", "ta"],
        defaultLocale: "ta",
        minOrderValue: 9900,
      },
      actor.id,
    );
    const settings = await getStoreSettingsFresh();
    expect(settings).toMatchObject({
      name: "Kaveri Mart",
      defaultLocale: "ta",
      minOrderValue: 9900,
      supportedLocales: ["en", "ta"],
    });

    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "settings.general.update" },
    });
    expect(log.actorId).toBe(actor.id);
    expect(log.changes).toMatchObject({ name: { from: "My Store", to: "Kaveri Mart" } });
  });

  it("updates only its own section", async () => {
    const actor = await owner();
    await updateGeneralSettings(
      { name: "A", tagline: null, supportedLocales: ["en"], defaultLocale: "en", minOrderValue: 0 },
      actor.id,
    );
    await updatePaymentSettings(
      {
        onlinePaymentsEnabled: false,
        codEnabled: true,
        codFee: 4900,
        codMinOrderValue: null,
        codMaxOrderValue: 500000,
        pendingOrderTtlMinutes: 45,
      },
      actor.id,
    );
    const settings = await getStoreSettingsFresh();
    expect(settings).toMatchObject({
      name: "A",
      codFee: 4900,
      onlinePaymentsEnabled: false,
      pendingOrderTtlMinutes: 45,
    });
    expect(await db.storeSettings.count()).toBe(1);
  });

  it("creates, updates and deletes shipping rules with audit entries", async () => {
    const actor = await owner();
    const data = {
      name: "Local",
      isActive: true,
      priority: 10,
      pincodePrefixes: ["560"],
      stateCodes: [],
      rateType: "FLAT" as const,
      flatRate: 4000,
      baseWeightGrams: null,
      baseRate: null,
      additionalWeightGrams: null,
      additionalRate: null,
      freeShippingThreshold: 49900,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      codAvailable: true,
    };
    const created = await saveShippingRule(null, data, actor.id);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await saveShippingRule(created.id, { ...data, flatRate: 5000 }, actor.id);
    expect((await db.shippingRule.findUniqueOrThrow({ where: { id: created.id } })).flatRate).toBe(
      5000,
    );
    expect(await saveShippingRule("missing", data, actor.id)).toEqual({
      ok: false,
      error: "not_found",
    });
    await deleteShippingRule(created.id, actor.id);
    expect(await db.shippingRule.count()).toBe(0);

    const actions = (await db.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map(
      (l) => l.action,
    );
    expect(actions).toEqual([
      "shipping_rule.create",
      "shipping_rule.update",
      "shipping_rule.delete",
    ]);
  });
});
