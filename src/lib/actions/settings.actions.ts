"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import {
  deleteShippingRule,
  saveShippingRule,
  updateBrandingSettings,
  updateContactSettings,
  updateGeneralSettings,
  updatePaymentSettings,
  updateTaxSettings,
} from "@/lib/services/settings.service";
import {
  brandingSettingsSchema,
  contactSettingsSchema,
  generalSettingsSchema,
  paymentSettingsSchema,
  shippingRuleSchema,
  taxSettingsSchema,
  type BrandingSettingsInput,
  type ContactSettingsInput,
  type GeneralSettingsInput,
  type PaymentSettingsInput,
  type ShippingRuleInput,
  type TaxSettingsInput,
} from "@/lib/validators/settings";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };

/** Settings affect every page (name, theme, languages), so refresh everything. */
function revalidateStore() {
  revalidatePath("/", "layout");
}

async function saveSection<S extends z.ZodType>(
  schema: S,
  input: unknown,
  save: (data: z.output<S>, actorId: string) => Promise<void>,
): Promise<ActionResult> {
  const user = await authorize("settings:manage");
  if (!user) return FORBIDDEN;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await save(parsed.data, user.id);
  revalidateStore();
  return { ok: true, data: undefined };
}

export async function updateGeneralSettingsAction(input: GeneralSettingsInput) {
  return saveSection(generalSettingsSchema, input, updateGeneralSettings);
}

export async function updateBrandingSettingsAction(input: BrandingSettingsInput) {
  return saveSection(brandingSettingsSchema, input, updateBrandingSettings);
}

export async function updateContactSettingsAction(input: ContactSettingsInput) {
  return saveSection(contactSettingsSchema, input, updateContactSettings);
}

export async function updateTaxSettingsAction(input: TaxSettingsInput) {
  return saveSection(taxSettingsSchema, input, updateTaxSettings);
}

export async function updatePaymentSettingsAction(input: PaymentSettingsInput) {
  return saveSection(paymentSettingsSchema, input, updatePaymentSettings);
}

export async function saveShippingRuleAction(
  id: string | null,
  input: ShippingRuleInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("settings:manage");
  if (!user) return FORBIDDEN;
  const parsed = shippingRuleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await saveShippingRule(
    typeof id === "string" && id ? id : null,
    parsed.data,
    user.id,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/[locale]/admin/settings/shipping", "page");
  return { ok: true, data: { id: result.id } };
}

export async function deleteShippingRuleAction(id: string): Promise<ActionResult> {
  const user = await authorize("settings:manage");
  if (!user) return FORBIDDEN;
  if (typeof id !== "string" || !id) return { ok: false, error: "not_found" };
  const result = await deleteShippingRule(id, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/[locale]/admin/settings/shipping", "page");
  return { ok: true, data: undefined };
}
