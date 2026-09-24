import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShippingRuleForm } from "@/components/admin/settings/shipping-rule-form";
import { requirePermission } from "@/lib/auth-guards";

export async function generateMetadata() {
  const t = await getTranslations("Shipping");
  return { title: t("newTitle") };
}

export default async function NewShippingRulePage({
  params,
}: PageProps<"/[locale]/admin/settings/shipping/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const t = await getTranslations("Shipping");
  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">{t("newTitle")}</h2>
      <ShippingRuleForm
        id={null}
        defaults={{
          name: "",
          isActive: true,
          priority: "0",
          pincodePrefixes: "",
          stateCodes: [],
          rateType: "FLAT",
          flatRate: "",
          baseWeightGrams: "500",
          baseRate: "",
          additionalWeightGrams: "500",
          additionalRate: "",
          freeShippingThreshold: "",
          estimatedDaysMin: "",
          estimatedDaysMax: "",
          codAvailable: true,
        }}
      />
    </section>
  );
}
