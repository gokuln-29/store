import { cache } from "react";
import { Prisma, type StoreSettings } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { z } from "zod";
import type {
  brandingSettingsSchema,
  contactSettingsSchema,
  generalSettingsSchema,
  paymentSettingsSchema,
  shippingRuleSchema,
  taxSettingsSchema,
} from "@/lib/validators/settings";
import { audit, diff } from "./audit.service";

const SETTINGS_ID = "default";

/** Used when the database has no settings row yet (fresh install before setup). */
export const DEFAULT_SETTINGS: StoreSettings = {
  id: SETTINGS_ID,
  name: "My Store",
  tagline: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#111827",
  secondaryColor: "#f59e0b",
  headingFont: "Noto Sans",
  bodyFont: "Noto Sans",
  contactEmail: null,
  contactPhone: null,
  whatsappNumber: null,
  businessAddress: null,
  socialLinks: {},
  legalName: null,
  gstNumber: null,
  stateCode: null,
  pricesIncludeTax: true,
  defaultTaxRateBps: 1800,
  currency: "INR",
  supportedLocales: ["en", "ta", "kn"],
  defaultLocale: "en",
  minOrderValue: 0,
  onlinePaymentsEnabled: true,
  codEnabled: true,
  codFee: 0,
  codMinOrderValue: null,
  codMaxOrderValue: null,
  pendingOrderTtlMinutes: 30,
  metaTitle: null,
  metaDescription: null,
  features: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

async function loadSettings(): Promise<StoreSettings> {
  const row = await db.storeSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row ?? DEFAULT_SETTINGS;
}

/** Store settings, fetched once per request. */
export const getStoreSettings = cache(loadSettings);

/** Uncached read, for admin forms and services that must see the latest value. */
export const getStoreSettingsFresh = loadSettings;

type SettingsPatch = Partial<Omit<StoreSettings, "id" | "createdAt" | "updatedAt">>;

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

async function applyPatch(section: string, patch: SettingsPatch, actorId: string) {
  await db.$transaction(async (tx) => {
    const before =
      (await tx.storeSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? DEFAULT_SETTINGS;
    const data = {
      ...patch,
      tagline: "tagline" in patch ? toJson(patch.tagline) : undefined,
      businessAddress: "businessAddress" in patch ? toJson(patch.businessAddress) : undefined,
      socialLinks:
        "socialLinks" in patch ? (patch.socialLinks as Prisma.InputJsonValue) : undefined,
      metaTitle: undefined,
      metaDescription: undefined,
      features: undefined,
    };
    const { id: _id, createdAt: _c, updatedAt: _u, ...createBase } = DEFAULT_SETTINGS;
    await tx.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        ...createBase,
        tagline: toJson(createBase.tagline),
        businessAddress: toJson(createBase.businessAddress),
        socialLinks: createBase.socialLinks as Prisma.InputJsonValue,
        metaTitle: Prisma.DbNull,
        metaDescription: Prisma.DbNull,
        features: createBase.features as Prisma.InputJsonValue,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
        id: SETTINGS_ID,
      },
      update: data,
    });
    await audit(
      {
        actorId,
        action: `settings.${section}.update`,
        entityType: "StoreSettings",
        entityId: SETTINGS_ID,
        changes: diff(before as unknown as Record<string, unknown>, patch) as Prisma.InputJsonValue,
      },
      tx,
    );
  });
}

export async function updateGeneralSettings(
  data: z.output<typeof generalSettingsSchema>,
  actorId: string,
) {
  await applyPatch("general", data, actorId);
}

export async function updateBrandingSettings(
  data: z.output<typeof brandingSettingsSchema>,
  actorId: string,
) {
  await applyPatch("branding", data, actorId);
}

export async function updateContactSettings(
  data: z.output<typeof contactSettingsSchema>,
  actorId: string,
) {
  const { address, ...rest } = data;
  await applyPatch(
    "contact",
    {
      ...rest,
      businessAddress: address.line1 ? { ...address } : null,
      socialLinks: Object.fromEntries(Object.entries(data.socialLinks).filter(([, v]) => v)),
    },
    actorId,
  );
}

export async function updateTaxSettings(data: z.output<typeof taxSettingsSchema>, actorId: string) {
  await applyPatch("tax", data, actorId);
}

export async function updatePaymentSettings(
  data: z.output<typeof paymentSettingsSchema>,
  actorId: string,
) {
  await applyPatch("payments", data, actorId);
}

// ───────────── Shipping rules ─────────────

type ShippingRuleData = z.output<typeof shippingRuleSchema>;

export function listShippingRules() {
  return db.shippingRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
}

export function getShippingRule(id: string) {
  return db.shippingRule.findUnique({ where: { id } });
}

export async function saveShippingRule(
  id: string | null,
  data: ShippingRuleData,
  actorId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: "not_found" }> {
  return db.$transaction(async (tx) => {
    if (id) {
      const before = await tx.shippingRule.findUnique({ where: { id } });
      if (!before) return { ok: false, error: "not_found" } as const;
      await tx.shippingRule.update({ where: { id }, data });
      await audit(
        {
          actorId,
          action: "shipping_rule.update",
          entityType: "ShippingRule",
          entityId: id,
          changes: diff(
            before as unknown as Record<string, unknown>,
            data,
          ) as Prisma.InputJsonValue,
        },
        tx,
      );
      return { ok: true, id } as const;
    }
    const created = await tx.shippingRule.create({ data });
    await audit(
      {
        actorId,
        action: "shipping_rule.create",
        entityType: "ShippingRule",
        entityId: created.id,
        changes: { name: data.name, rateType: data.rateType },
      },
      tx,
    );
    return { ok: true, id: created.id } as const;
  });
}

export async function deleteShippingRule(
  id: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  return db.$transaction(async (tx) => {
    const before = await tx.shippingRule.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "not_found" } as const;
    await tx.shippingRule.delete({ where: { id } });
    await audit(
      {
        actorId,
        action: "shipping_rule.delete",
        entityType: "ShippingRule",
        entityId: id,
        changes: { name: before.name },
      },
      tx,
    );
    return { ok: true } as const;
  });
}
