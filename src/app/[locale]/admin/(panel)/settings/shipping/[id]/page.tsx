import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShippingRuleForm } from "@/components/admin/settings/shipping-rule-form";
import { requirePermission } from "@/lib/auth-guards";
import { getShippingRule } from "@/lib/services/settings.service";
import { paiseToRupeeInput } from "@/lib/utils/money";
import type { ShippingRuleInput } from "@/lib/validators/settings";

export async function generateMetadata() {
  const t = await getTranslations("Shipping");
  return { title: t("editTitle") };
}

export default async function EditShippingRulePage({
  params,
}: PageProps<"/[locale]/admin/settings/shipping/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const t = await getTranslations("Shipping");
  const rule = await getShippingRule(id);
  if (!rule) notFound();
  const num = (n: number | null) => (n == null ? "" : String(n));

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">{t("editTitle")}</h2>
      <ShippingRuleForm
        id={rule.id}
        defaults={{
          name: rule.name,
          isActive: rule.isActive,
          priority: String(rule.priority),
          pincodePrefixes: rule.pincodePrefixes.join(", "),
          stateCodes: rule.stateCodes as ShippingRuleInput["stateCodes"],
          rateType: rule.rateType,
          flatRate: paiseToRupeeInput(rule.flatRate),
          baseWeightGrams: num(rule.baseWeightGrams),
          baseRate: paiseToRupeeInput(rule.baseRate),
          additionalWeightGrams: num(rule.additionalWeightGrams),
          additionalRate: paiseToRupeeInput(rule.additionalRate),
          freeShippingThreshold: paiseToRupeeInput(rule.freeShippingThreshold),
          estimatedDaysMin: num(rule.estimatedDaysMin),
          estimatedDaysMax: num(rule.estimatedDaysMax),
          codAvailable: rule.codAvailable,
        }}
      />
    </section>
  );
}
