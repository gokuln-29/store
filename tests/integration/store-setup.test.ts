import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { isStoreSetUp, setupStore, type StoreSetupInput } from "@/lib/services/store-setup.service";

const answers: StoreSetupInput = {
  storeName: "Kaveri Handlooms",
  ownerName: "Anitha R",
  ownerEmail: "Owner@Kaveri.in",
  ownerPassword: "a-long-password",
  supportedLocales: ["en", "kn"],
  defaultLocale: "kn",
  contactEmail: "help@kaveri.in",
  contactPhone: "9876543210",
  legalName: "Kaveri Handlooms LLP",
  gstNumber: "29abcde1234f1z5",
  stateCode: "KA",
  pricesIncludeTax: true,
  defaultTaxRateBps: "5",
  codEnabled: false,
  shippingRate: "60",
  freeShippingThreshold: "999",
};

describe("setupStore", () => {
  it("creates settings, the owner, a shipping rule and a home section, and no demo data", async () => {
    expect(await isStoreSetUp()).toBe(false);
    const result = await setupStore(answers);
    expect(result).toEqual({
      ok: true,
      ownerCreated: true,
      shippingRuleCreated: true,
      homeSectionsCreated: 1,
    });

    const settings = await db.storeSettings.findUniqueOrThrow({ where: { id: "default" } });
    expect(settings).toMatchObject({
      name: "Kaveri Handlooms",
      supportedLocales: ["en", "kn"],
      defaultLocale: "kn",
      currency: "INR",
      contactPhone: "+919876543210",
      gstNumber: "29ABCDE1234F1Z5",
      stateCode: "KA",
      defaultTaxRateBps: 500,
      codEnabled: false,
    });

    const owner = await db.user.findUniqueOrThrow({ where: { email: "owner@kaveri.in" } });
    expect(owner.role).toBe("OWNER");
    expect(await verify(owner.passwordHash!, "a-long-password")).toBe(true);

    const rule = await db.shippingRule.findFirstOrThrow();
    expect(rule).toMatchObject({
      flatRate: 6000,
      freeShippingThreshold: 99900,
      codAvailable: false,
    });
    expect(await db.product.count()).toBe(0);
    expect(await db.category.count()).toBe(0);
    expect(await isStoreSetUp()).toBe(true);
  });

  it("refuses to run twice unless forced, and keeps existing rules and sections", async () => {
    await setupStore(answers);
    expect(await setupStore({ ...answers, storeName: "Other" })).toEqual({
      ok: false,
      error: "already_set_up",
    });

    const forced = await setupStore(
      { ...answers, storeName: "Renamed", ownerPassword: "another-password" },
      { force: true },
    );
    expect(forced).toEqual({
      ok: true,
      ownerCreated: false,
      shippingRuleCreated: false,
      homeSectionsCreated: 0,
    });
    expect((await db.storeSettings.findFirstOrThrow()).name).toBe("Renamed");
    expect(await db.shippingRule.count()).toBe(1);
    const owner = await db.user.findUniqueOrThrow({ where: { email: "owner@kaveri.in" } });
    expect(await verify(owner.passwordHash!, "another-password")).toBe(true);
  });

  it("rejects invalid answers without writing anything", async () => {
    const result = await setupStore({
      ...answers,
      ownerPassword: "short",
      gstNumber: "NOT-A-GSTIN",
      defaultLocale: "ta",
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error !== "validation") throw new Error("expected validation error");
    expect(result.issues.map((i) => i.path).sort()).toEqual([
      "defaultLocale",
      "gstNumber",
      "ownerPassword",
    ]);
    expect(await isStoreSetUp()).toBe(false);
  });
});
