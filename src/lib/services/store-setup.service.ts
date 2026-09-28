import { z } from "@/lib/validators/zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { locales } from "@/i18n/routing";
import { hashPassword } from "@/lib/services/auth.service";
import { emailSchema, indianMobileSchema } from "@/lib/validators/auth";
import { optionalRupeesSchema, rupeesSchema } from "@/lib/validators/common";
import { taxSettingsSchema } from "@/lib/validators/settings";
import { passwordSchema } from "@/lib/validators/staff";
import { INDIAN_STATE_CODES } from "@/lib/constants/indian-states";

/**
 * First-run setup of a new client store (`pnpm setup:store`): store settings, the owner account,
 * a catch-all shipping rule and a "New arrivals" home section. No demo products or customers are created.
 * Messages are keys in the "Errors" namespace.
 */
export const storeSetupSchema = z
  .object({
    storeName: z.string().trim().min(1, "required").max(80, "tooLong"),
    ownerName: z.string().trim().min(1, "required").max(80, "tooLong"),
    ownerEmail: emailSchema,
    ownerPassword: passwordSchema,
    supportedLocales: z.array(z.enum(locales)).min(1, "localeRequired"),
    defaultLocale: z.enum(locales),
    contactEmail: emailSchema,
    contactPhone: indianMobileSchema,
    legalName: taxSettingsSchema.shape.legalName,
    gstNumber: taxSettingsSchema.shape.gstNumber,
    // Required here (optional in the admin form): it decides CGST+SGST vs IGST on every invoice.
    stateCode: z.enum(INDIAN_STATE_CODES),
    pricesIncludeTax: z.boolean(),
    defaultTaxRateBps: taxSettingsSchema.shape.defaultTaxRateBps,
    codEnabled: z.boolean(),
    shippingRate: rupeesSchema,
    freeShippingThreshold: optionalRupeesSchema,
  })
  .superRefine((v, ctx) => {
    if (!v.supportedLocales.includes(v.defaultLocale)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultLocale"],
        message: "defaultLocaleNotSupported",
      });
    }
  });

export type StoreSetupInput = z.input<typeof storeSetupSchema>;

export type StoreSetupResult =
  | { ok: true; ownerCreated: boolean; shippingRuleCreated: boolean; homeSectionsCreated: number }
  | { ok: false; error: "already_set_up" }
  | { ok: false; error: "validation"; issues: { path: string; message: string }[] };

/** True once a store has settings or an owner, so a second run can't silently overwrite it. */
export async function isStoreSetUp(): Promise<boolean> {
  const [settings, owners] = await Promise.all([
    db.storeSettings.count(),
    db.user.count({ where: { role: "OWNER" } }),
  ]);
  return settings > 0 || owners > 0;
}

export async function setupStore(
  input: StoreSetupInput,
  { force = false }: { force?: boolean } = {},
): Promise<StoreSetupResult> {
  const parsed = storeSetupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  if (!force && (await isStoreSetUp())) return { ok: false, error: "already_set_up" };
  const data = parsed.data;
  const passwordHash = await hashPassword(data.ownerPassword);

  const settings = {
    name: data.storeName,
    supportedLocales: data.supportedLocales,
    defaultLocale: data.defaultLocale,
    currency: "INR",
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    legalName: data.legalName,
    gstNumber: data.gstNumber,
    stateCode: data.stateCode,
    pricesIncludeTax: data.pricesIncludeTax,
    defaultTaxRateBps: data.defaultTaxRateBps,
    codEnabled: data.codEnabled,
  } satisfies Prisma.StoreSettingsUpdateInput;

  return db.$transaction(async (tx) => {
    await tx.storeSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...settings },
      update: settings,
    });

    const existing = await tx.user.findUnique({ where: { email: data.ownerEmail } });
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: { role: "OWNER", isActive: true, name: data.ownerName, passwordHash },
      });
    } else {
      await tx.user.create({
        data: {
          email: data.ownerEmail,
          name: data.ownerName,
          role: "OWNER",
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
    }

    let shippingRuleCreated = false;
    if ((await tx.shippingRule.count()) === 0) {
      await tx.shippingRule.create({
        data: {
          name: "Standard delivery",
          priority: 0,
          rateType: "FLAT",
          flatRate: data.shippingRate,
          freeShippingThreshold: data.freeShippingThreshold,
          estimatedDaysMin: 3,
          estimatedDaysMax: 7,
          codAvailable: data.codEnabled,
        },
      });
      shippingRuleCreated = true;
    }

    // A home page section that fills itself as products are added; banners and featured
    // categories are added by the owner in Content → Home page.
    let homeSectionsCreated = 0;
    if ((await tx.homeSection.count()) === 0) {
      await tx.homeSection.create({
        data: {
          type: "PRODUCT_CAROUSEL",
          title: { en: "New arrivals", ta: "புதிய வரவுகள்", kn: "ಹೊಸ ಆಗಮನಗಳು" },
          config: { source: "newest", categoryId: null, limit: 8 },
          sortOrder: 0,
        },
      });
      homeSectionsCreated = 1;
    }

    return { ok: true, ownerCreated: !existing, shippingRuleCreated, homeSectionsCreated };
  });
}
